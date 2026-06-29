import asyncio
import math

from langsmith import traceable

from cache import get_cache, set_cache, redis_client
import httpx
from datetime import datetime, timedelta
from appointment import get_header
import redis
import os
import logging
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)
APPOINTMENT_CACHE_TTL = 120
LEAD_CACHE_TTL = 300
AGENT_URL = os.getenv("NEXT_PUBLIC_BASE_URL")


async def find_lead_id(conversation_id: str, clinicToken: str):
    cache_key = f"lead_id:{conversation_id}"
    cached = await get_cache(cache_key)
    if cached:
        return cached

    headers = get_header(clinicToken)

    async with httpx.AsyncClient() as client:
        # Page 1 first — most conversations find leadId on page 1
        resp = await client.get(
            f"{AGENT_URL}/api/messages/get-messages/{conversation_id}?page=1&limit=50",
            headers=headers,
        )
        data = resp.json()

        def extract_lead_id(data: dict) -> str | None:
            for day in data.get("data", []):
                for message in day.get("messages", []):
                    if "leadId" in message:
                        return message["leadId"]
            return None

        lead_id = extract_lead_id(data)
        if lead_id:
            result = {"leadId": lead_id}
            await set_cache(cache_key, result, LEAD_CACHE_TTL)
            return result

        if not data.get("pagination", {}).get("hasMore"):
            return {"Status": "Error", "Message": "No leadId found in any page."}

        total = data.get("pagination", {}).get("total", 0)
        total_pages = math.ceil(total / 50) if total else 10  # limit=50 here

        # Fire remaining pages in parallel, return as soon as any finds it
        async def fetch_page_for_lead(page: int) -> str | None:
            try:
                r = await client.get(
                    f"{AGENT_URL}/api/messages/get-messages/{conversation_id}"
                    f"?page={page}&limit=50",
                    headers=headers,
                )
                return extract_lead_id(r.json())
            except Exception:
                return None

        tasks = {
            asyncio.create_task(fetch_page_for_lead(p)): p
            for p in range(2, total_pages + 1)
        }

        pending = set(tasks)
        found_lead_id = None

        while pending:
            done, pending = await asyncio.wait(
                pending, return_when=asyncio.FIRST_COMPLETED
            )
            for task in done:
                result = task.result()
                if result:
                    found_lead_id = result
                    # Cancel remaining in-flight requests
                    for t in pending:
                        t.cancel()
                    pending = set()
                    break

        if found_lead_id:
            result = {"leadId": found_lead_id}
            await set_cache(cache_key, result, LEAD_CACHE_TTL)
            return result

    return {"Status": "Error", "Message": "No leadId found in any page."}


# AFTER — parallel pages
async def find_patient_number(leadId: str, clinicToken: str):
    cache_key = f"patient_phone:{leadId}"
    cached = await get_cache(cache_key)
    if cached:
        return cached

    headers = get_header(clinicToken)

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{AGENT_URL}/api/lead-ms/leadFilter?page=1&limit=20&name=",
            headers=headers,
        )
        data = resp.json()
        leads = data.get("leads", [])

        for lead in leads:
            if lead["_id"] == leadId:
                phone = lead.get("phone")
                if not phone:
                    return {"Status": "Error", "Message": "No phone found."}
                result = {"patient_number": phone}
                await set_cache(cache_key, result, LEAD_CACHE_TTL)  # ← cache page-1 hit
                return result

        if not data.get("pagination", {}).get("hasMore"):
            return {"Status": "Error", "Message": "No Lead Id Found"}

        total = data.get("pagination", {}).get("total", 0)
        total_pages = math.ceil(total / 20) if total else 10

        async def fetch_page(page: int) -> list:
            r = await client.get(
                f"{AGENT_URL}/api/lead-ms/leadFilter?page={page}&limit=20&name=",
                headers=headers,
            )
            return r.json().get("leads", [])

        pages = await asyncio.gather(
            *[fetch_page(p) for p in range(2, total_pages + 1)]
        )

        for page_leads in pages:
            for lead in page_leads:
                if lead["_id"] == leadId:
                    phone = lead.get("phone")
                    if not phone:
                        return {"Status": "Error", "Message": "No phone found."}
                    result = {"patient_number": phone}
                    await set_cache(
                        cache_key, result, LEAD_CACHE_TTL
                    )  # ← cache parallel hit
                    return result

    return {"Status": "Error", "Message": "No Lead Id Found"}


def extract_appointment_details(appointment: dict) -> dict:
    return {
        "_id": appointment.get("_id"),
        "patientName": appointment.get("patientName"),
        "patientNumber": appointment.get("patientNumber"),
        "doctorName": appointment.get("doctorName"),
        "treatment_names": appointment.get("serviceNames", []),
        "status": appointment.get("status"),
        "startDate": appointment.get("startDate"),
        "fromTime": appointment.get("fromTime"),
        "toTime": appointment.get("toTime"),
    }


@traceable
async def find_latest_appointment(conversation_id: str, clinicToken: str):
    headers = get_header(clinicToken)

    # Step 1: Get lead ID
    lead_result = await find_lead_id(
        conversation_id=conversation_id, clinicToken=clinicToken
    )
    if "Status" in lead_result and lead_result["Status"] == "Error":
        return lead_result  # Bubble up: "No leadId found" etc.

    # Step 2: Get patient numb
    patient_result = await find_patient_number(
        leadId=lead_result["leadId"], clinicToken=clinicToken
    )
    if "Status" in patient_result and patient_result["Status"] == "Error":
        return patient_result  # Bubble up: "There are no bookings yet." etc.

    patientNumber = patient_result["patient_number"]

    url = (
        f"{AGENT_URL}/api/clinic/all-appointments"
        f"?page=1&limit=50&patientNumber={patientNumber}"
    )

    def parse_date(appt: dict) -> datetime:
        raw = appt.get("createdAt")
        if not raw:
            return datetime.min
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            data = resp.json()

            appointments = data.get("appointments", [])
            if not appointments:
                return {"Status": "Error", "Message": "No appointments found."}

            latest_apt = max(appointments, key=parse_date)
            return {
                "apt_details": extract_appointment_details(latest_apt),
                "existing": latest_apt,
                "all_apt": appointments,
            }

        except httpx.HTTPStatusError as e:
            return {
                "Status": "Error",
                "Message": f"API returned {e.response.status_code}: {e.response.text}",
            }
        except Exception as e:
            return {
                "Status": "Error",
                "Message": f"Failed to fetch appointment details: {e}",
            }


async def reschedule_apt(
    conversation_id: str, clinicToken: str, startDate: str, fromTime: str
):
    headers = get_header(clinicToken)

    apt = await find_latest_appointment(
        conversation_id=conversation_id, clinicToken=clinicToken
    )
    # Check for any error bubbled up from lead/patient/appointment lookup
    if "Status" in apt and apt["Status"] == "Error":
        return apt  # Bubble up: agent will receive and relay the message

    existing = apt["existing"]
    apt_id = existing["_id"]

    toTime = (datetime.strptime(fromTime, "%H:%M") + timedelta(minutes=20)).strftime(
        "%H:%M"
    )
    try:
        converted_date = datetime.strptime(startDate, "%d-%m-%Y").strftime(
            "%Y-%m-%dT00:00:00.000Z"
        )
    except ValueError:
        return {
            "Status": "Error",
            "Message": f"Invalid date format received: {startDate}",
        }

    existing["startDate"] = converted_date
    existing["fromTime"] = fromTime
    existing["toTime"] = toTime
    existing["status"] = "Rescheduled"

    fields_to_remove = ["_id", "__v", "createdAt", "updatedAt", "referenceId"]
    for field in fields_to_remove:
        existing.pop(field, None)

    try:
        async with httpx.AsyncClient() as client:
            put_resp = await client.put(
                f"{AGENT_URL}/api/clinic/update-appointment/{apt_id}",
                json=existing,
                headers=headers,
                timeout=10.0,
            )
        put_data = put_resp.json()
    except Exception as e:
        return {"Status": "Error", "Message": f"Failed to update appointment: {e}"}

    if put_data.get("success"):
        cache_key = f"appointment:{clinicToken}:{apt_id}"
        try:
            await redis_client.delete(cache_key)
        except redis.exceptions.RedisError as e:
            logger.error(f"Redis Error: {e}")
        return {
            "Appointment Status": "Rescheduled",
            "Message": put_data.get("message", "Appointment rescheduled successfully."),
            "newDate": startDate,
            "newTime": fromTime,
            "scenario_key": "reschedule_success",
            "placeholders": {
                "newDate": startDate,
                "newTime": fromTime,
                "patient_name": f"{put_data.get("appointment").get("patientId").get("firstName")} {put_data.get("appointment").get("patientId").get("lastName")}",
                "doctor_name": put_data.get("appointment").get("doctorId").get("name"),
                "service_name": put_data.get("appointment")
                .get("serviceId")
                .get("name"),
            },
        }
    else:
        return {
            "Status": "Error",
            "Message": put_data.get("message", "Server rejected the update."),
        }
