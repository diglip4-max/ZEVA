import os
import re
import logging
from datetime import datetime, timedelta

import httpx
import redis
from dotenv import load_dotenv
from langsmith import traceable

from shared.appointment import get_header
from shared.cache import redis_client

load_dotenv()

logger = logging.getLogger(__name__)
AGENT_URL = os.getenv("NEXT_PUBLIC_BASE_URL")


def _date_only(raw: str) -> str:
    """Normalize supported date formats to YYYY-MM-DD."""
    if not raw:
        return ""

    raw = str(raw).strip()

    # Handles ISO values such as:
    # 2026-07-30T00:00:00.000Z
    if "T" in raw:
        raw = raw.split("T", 1)[0]

    supported_formats = (
        "%Y-%m-%d",
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%Y/%m/%d",
    )

    for date_format in supported_formats:
        try:
            return datetime.strptime(raw, date_format).strftime("%Y-%m-%d")
        except ValueError:
            continue

    return raw


def _time_only(raw: str) -> str:
    """Normalize supported time formats to HH:MM. Also handles a
    'HH:MM - HH:MM' range string (as shown in the appointments
    accordion) by taking only the start time."""
    if not raw:
        return ""

    raw = str(raw).strip()

    # Handle "17:00 - 17:20" style ranges — take the start time only.
    if "-" in raw:
        raw = raw.split("-", 1)[0].strip()

    for time_format in ("%H:%M", "%H:%M:%S"):
        try:
            return datetime.strptime(raw, time_format).strftime("%H:%M")
        except ValueError:
            continue

    return raw


@traceable
async def fetch_appointment_by_id(clinicToken: str, appointment_id: str) -> dict:
    """
    Fetches ONE specific appointment by its exact _id.

    Used when the caller (the LLM) already resolved the exact
    appointment from a previously displayed list (via ordinal,
    doctor-name, or date/time disambiguation) and needs the current
    record before rescheduling.
    """
    headers = get_header(clinicToken)
    single_url = f"{AGENT_URL}/api/clinic/appointment/{appointment_id}"

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
            resp = await client.get(single_url, headers=headers)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return {
                "Status": "NotFound",
                "Message": (
                    f"No appointment exists with id '{appointment_id}'. "
                    "Fetch a fresh appointment list before selecting again."
                ),
            }
        return {
            "Status": "Error",
            "Message": f"API returned {e.response.status_code}: {e.response.text}",
        }
    except Exception as e:
        return {"Status": "Error", "Message": f"Failed to fetch appointment: {e}"}

    if not data.get("success") or not data.get("appointment"):
        return {
            "Status": "NotFound",
            "Message": f"No appointment found with id '{appointment_id}'.",
        }

    return {"existing": data["appointment"]}


@traceable
async def reschedule_apt_by_id(
    clinicToken: str,
    appointment_id: str,
    patient_name: str,
    claimed_current_date: str,
    claimed_current_time: str,
    new_date: str,
    new_time: str,
) -> dict:
    """
    Reschedules one exact appointment using its MongoDB _id.

    claimed_current_date / claimed_current_time: what the caller
    (the LLM) believes the appointment's EXISTING date/time to be —
    verified against the real record before anything is written, to
    catch cross-candidate mixups (e.g. right ID, wrong quoted time).

    new_date: new date, DD-MM-YYYY
    new_time: new time, HH:MM (24-hour)
    """
    if not appointment_id:
        return {"Status": "Error", "Message": "Appointment ID is required."}

    result = await fetch_appointment_by_id(clinicToken, appointment_id)
    if result.get("Status") in ("Error", "NotFound"):
        return result

    existing = result.get("existing")
    if not existing:
        return {
            "Status": "Error",
            "Message": "The selected appointment could not be found.",
        }

    # ── Verify the caller's claimed current date/time match reality ──
    actual_date = _date_only(existing.get("startDate", ""))
    claimed_date = _date_only(claimed_current_date)
    actual_time = _time_only(existing.get("fromTime", ""))
    claimed_time = _time_only(claimed_current_time)

    if claimed_date != actual_date or claimed_time != actual_time:
        return {
            "Status": "Mismatch",
            "Message": (
                f"The current date/time you referenced ({claimed_current_date} "
                f"{claimed_current_time}) don't match this appointment's actual "
                f"record ({actual_date} {actual_time}). Re-fetch the appointment "
                "list and reselect before rescheduling."
            ),
        }

    try:
        new_date_dt = datetime.strptime(new_date, "%d-%m-%Y")
        converted_date = new_date_dt.strftime("%Y-%m-%dT00:00:00.000Z")
    except ValueError:
        return {
            "Status": "Error",
            "Message": f"Invalid date '{new_date}'. The required format is DD-MM-YYYY.",
        }

    try:
        new_time_dt = datetime.strptime(new_time, "%H:%M")
        toTime = (new_time_dt + timedelta(minutes=20)).strftime("%H:%M")
    except ValueError:
        return {
            "Status": "Error",
            "Message": f"Invalid time '{new_time}'. The required format is HH:MM.",
        }

    new_datetime = datetime.strptime(
        f"{new_date} {new_time}",
        "%d-%m-%Y %H:%M",
    )

    if new_datetime <= datetime.now():
        return {
            "Status": "InvalidTime",
            "Message": (
                "The requested appointment time is in the past. "
                "Please select a future date and time."
            ),
        }

    update_payload = dict(existing)
    update_payload["startDate"] = converted_date
    update_payload["fromTime"] = new_time
    update_payload["toTime"] = toTime
    update_payload["status"] = "Rescheduled"

    for field in ["_id", "__v", "createdAt", "updatedAt", "referenceId"]:
        update_payload.pop(field, None)

    headers = get_header(clinicToken)
    update_url = f"{AGENT_URL}/api/clinic/update-appointment/{appointment_id}"

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
            response = await client.put(
                update_url, json=update_payload, headers=headers
            )
            response.raise_for_status()
            response_data = response.json()
    except httpx.HTTPStatusError as exc:
        return {
            "Status": "Error",
            "Message": (
                f"Appointment API returned {exc.response.status_code}: "
                f"{exc.response.text}"
            ),
        }
    except Exception as exc:
        return {"Status": "Error", "Message": f"Failed to update appointment: {exc}"}

    if not response_data.get("success"):
        return {
            "Status": "Error",
            "Message": response_data.get(
                "message", "The server rejected the appointment update."
            ),
        }

    try:
        cache_key = f"appointment:{clinicToken}:{appointment_id}"
        await redis_client.delete(cache_key)
    except redis.exceptions.RedisError as exc:
        logger.warning("Failed to invalidate appointment cache: %s", exc)

    appointment = response_data.get("appointment") or {}

    return {
        "Status": "Success",
        "Message": response_data.get(
            "message", "Appointment rescheduled successfully."
        ),
        "appointmentId": appointment_id,
        "patientName": (
            appointment.get("patientName")
            or existing.get("patientName")
            or patient_name
        ),
        "doctorName": appointment.get("doctorName") or existing.get("doctorName", ""),
        "newDate": new_date,
        "newTime": new_time,
    }
