import asyncio
import os
import re
from typing import Literal, TypedDict
import httpx
from dotenv import load_dotenv
from langgraph.graph import END, START, StateGraph
from datetime import datetime, timedelta
import random
from cache import get_cache, set_cache
from pagination import _fetch_all_pages

load_dotenv()
AGENT_URL = os.getenv("NEXT_PUBLIC_BASE_URL")


class AppointmentState(TypedDict):
    clinicToken: str
    conversation_id: str
    patient_name: str
    patient_phone: str
    doctor_name: str
    treatment_name: str
    doctors: list
    treatments: list
    patients: list
    patientExists: bool
    doctorExists: bool
    treatmentExists: bool
    timeConfirmed: bool
    selectedDoctorId: str
    selectedTreatment: str
    patientId: str
    Status: str
    referenceId: str
    appointmentId: str
    startDate: str
    fromTime: str
    toTime: str
    errorMessage: str
    Message: str


def get_header(token):
    return {"Authorization": f"Bearer {token}"}


async def check_patient(state: AppointmentState):
    cache_key = f"patients:{state['clinicToken']}"
    data = await get_cache(cache_key)

    if not data:
        header = get_header(state["clinicToken"])
        url = f"{AGENT_URL}/api/clinic/patient-information"
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=header)
        data = resp.json()
        if data.get("success"):
            await set_cache(cache_key, data, 300)

    if not data.get("success") or not data.get("data"):
        return {"patientExists": False, "patients": [], "patientId": ""}

    def normalize_phone(raw: str) -> str:
        digits = re.sub(r"\D", "", raw)
        if not digits:
            return digits
        if len(digits) == 12 and digits.startswith("91"):
            candidate = digits[2:]
            if len(candidate) == 10:
                return candidate
        return digits

    def normalize_name(raw: str) -> str:
        return raw.strip().lower()

    patient_name_input = normalize_name(state.get("patient_name", ""))
    patient_phone_input = normalize_phone(state.get("patient_phone", ""))
    matched_patient = None

    for patient in data["data"]:
        first = patient.get("firstName", "") or ""
        last = patient.get("lastName", "") or ""
        db_full_name = normalize_name(f"{first} {last}".strip())
        db_phone = normalize_phone(patient.get("mobileNumber", "") or "")

        if db_full_name == patient_name_input and db_phone == patient_phone_input:
            matched_patient = patient
            break

    if matched_patient:
        return {
            "patientExists": True,
            "patients": [matched_patient],
            "patientId": matched_patient["_id"],
        }

    return {"patientExists": False, "patients": [], "patientId": ""}


async def register_patient(state: AppointmentState):
    header = get_header(state["clinicToken"])

    name_parts = state["patient_name"].strip().split(" ", 1)
    first_name = name_parts[0] if name_parts else ""
    last_name = name_parts[1] if len(name_parts) > 1 else ""

    now = datetime.now()
    invoice_number = f"INV-{now.strftime('%Y%m%d-%H%M%S')}-{random.randint(0, 999):03d}"

    emr_number = ""
    try:
        emr_url = f"{AGENT_URL}/api/clinic/patient-registration?generateEmr=true"
        async with httpx.AsyncClient() as client:
            emr_response = await client.get(emr_url, headers=header)
        emr_data = emr_response.json()
        if emr_response.status_code == 200 and emr_data.get("success"):
            emr_number = emr_data.get("emrNumber", "")
        else:
            emr_number = f"EMR-{int(datetime.now().timestamp())}"
    except Exception:
        emr_number = f"EMR-{int(datetime.now().timestamp())}"

    phone = state.get("patient_phone", "").strip()
    country_code = "+91"
    mobile_number = phone if phone.startswith("+") else country_code + phone

    payload = {
        "invoiceNumber": invoice_number,
        "emrNumber": emr_number,
        "firstName": first_name,
        "lastName": last_name,
        "email": "",
        "mobileNumber": mobile_number,
        "countryCode": country_code,
        "gender": "",
        "patientType": "New",
        "referredBy": "No",
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{AGENT_URL}/api/clinic/patient-registration",
                json=payload,
                headers=header,
            )
        data = response.json()

        if response.status_code in [200, 201] and data.get("success"):
            patient = data.get("data", {})
            return {
                "patientExists": True,
                "patientId": patient.get("_id", ""),
                "patients": [patient],
            }

        return {
            "patientExists": False,
            "Status": "Error",
            "errorMessage": data.get("message", "Patient registration failed"),
        }
    except Exception as e:
        return {
            "patientExists": False,
            "Status": "Error",
            "errorMessage": f"Patient registration error: {str(e)}",
        }


async def check_doctor(state: AppointmentState) -> dict:
    cache_key = f"doctors_list:{state['clinicToken']}"
    data = await get_cache(cache_key)

    if not data:
        header = get_header(state["clinicToken"])
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{AGENT_URL}/api/lead-ms/get-agents-options?role=doctorStaff",
                headers=header,
            )
        data = resp.json()
        if data.get("success"):
            await set_cache(cache_key, data, 300)

    doctor_name = state["doctor_name"].strip().lower()
    if data.get("success"):
        doctor = next(
            (
                d
                for d in data["agents"]
                if d.get("name", "").strip().lower() == doctor_name
            ),
            None,
        )
        if doctor:
            return {
                "doctorExists": True,
                "doctors": data,
                "selectedDoctorId": doctor["_id"],
            }

    return {"doctorExists": False, "doctors": data, "selectedDoctorId": ""}


async def check_treatments(state: AppointmentState) -> dict:
    cache_key = f"treatments:{state['clinicToken']}"
    cached = await get_cache(cache_key)

    if cached:
        data = cached
    else:
        header = get_header(state["clinicToken"])
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(30.0), headers=header
        ) as client:
            services = await _fetch_all_pages(
                client,
                url_fn=lambda p: f"{AGENT_URL}/api/clinic/services?page={p}&limit=20",
                data_extractor=lambda d: d.get("services", []),
                has_more_fn=lambda d: bool(d.get("pagination", {}).get("hasMore")),
                page_size=20,
            )
        data = {"success": True, "services": services}
        await set_cache(cache_key, data, 300)

    treatment_name = state["treatment_name"].strip().lower()
    treatment = next(
        (
            t
            for t in data["services"]
            if t.get("name", "").strip().lower() == treatment_name
        ),
        None,
    )
    if treatment:
        return {
            "treatmentExists": True,
            "treatments": data,
            "selectedTreatment": treatment["_id"],
        }
    return {"treatmentExists": False, "treatments": data, "selectedTreatment": ""}


# ── THE MISSING FUNCTION — runs check_doctor and check_treatments in parallel ──
async def check_doctor_and_treatments(state: AppointmentState) -> dict:
    doctor_result, treatment_result = await asyncio.gather(
        check_doctor(state),
        check_treatments(state),
    )
    return {**doctor_result, **treatment_result}


def confirm_time(state: AppointmentState):
    start_time_str = state["fromTime"]
    date_str = state["startDate"]
    converted_date = None

    for fmt in ["%d-%m-%Y", "%Y-%m-%d", "%Y-%m-%dT%H:%M:%S.%fZ"]:
        try:
            converted_date = datetime.strptime(date_str, fmt).strftime(
                "%Y-%m-%dT00:00:00.000Z"
            )
            break
        except ValueError:
            continue

    if not converted_date:
        return {"Status": "Error", "errorMessage": f"Could not parse date: {date_str}"}

    start_time = datetime.strptime(start_time_str, "%H:%M")
    to_time_str = (start_time + timedelta(minutes=20)).strftime("%H:%M")

    return {
        "timeConfirmed": True,
        "startDate": converted_date,
        "fromTime": start_time_str,
        "toTime": to_time_str,
    }


def handle_error(state: AppointmentState):
    if not state.get("patientExists"):
        return {
            "Status": "Error",
            "errorMessage": f"Patient '{state['patient_name']}' was not found.",
        }
    elif not state.get("doctorExists"):
        return {
            "Status": "Error",
            "errorMessage": f"Doctor '{state['doctor_name']}' was not found.",
        }
    elif not state.get("treatmentExists"):
        return {
            "Status": "Error",
            "errorMessage": f"Treatment '{state['treatment_name']}' is not available.",
        }


async def book_appointment(state: AppointmentState):
    header = get_header(state["clinicToken"])
    payload = {
        "patientId": state["patientId"],
        "doctorId": state["selectedDoctorId"],
        "serviceId": state["selectedTreatment"],
        "serviceName": state["treatment_name"],
        "status": "booked",
        "followType": "first time",
        "startDate": state["startDate"],
        "fromTime": state["fromTime"],
        "toTime": state["toTime"],
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{AGENT_URL}/api/clinic/appointments",
            json=payload,
            headers=header,
        )
    data = response.json()

    if data.get("success"):
        appt = data.get("appointment", {})
        return {
            "Status": "Booked",
            "Message": "Appointment Booked Successfully",
            "scenario_key": "booking_success",
            "placeholders": {
                "patient_name": appt.get("patientName"),
                "start_date": appt.get("startDate"),
                "from_time": appt.get("fromTime"),
                "doctor_name": appt.get("doctorName"),
                "service_names": appt.get("serviceNames"),
            },
        }

    return {
        "Status": "Error",
        "Message": data.get(
            "message", "An error occurred while booking the appointment."
        ),
    }


# ── Routing functions — updated to point to new combined node ─────────────────


def after_check_patient(
    state: AppointmentState,
) -> Literal["check_doctor_and_treatments", "register_patient"]:
    return (
        "check_doctor_and_treatments" if state["patientExists"] else "register_patient"
    )


def after_register_patient(
    state: AppointmentState,
) -> Literal["check_doctor_and_treatments", "handle_error"]:
    return "check_doctor_and_treatments" if state["patientExists"] else "handle_error"


def after_check_doctor_and_treatments(
    state: AppointmentState,
) -> Literal["confirm_time", "handle_error"]:
    return (
        "confirm_time"
        if state["doctorExists"] and state["treatmentExists"]
        else "handle_error"
    )


def buildGraph(clinicToken: str, payload: dict):
    initial_state = {
        "clinicToken": clinicToken,
        "conversation_id": payload.get("conversation_id", ""),
        "patient_name": payload.get("patient_name", ""),
        "patient_phone": payload.get("patient_phone", ""),
        "doctor_name": payload.get("doctor_name", ""),
        "treatment_name": payload.get("treatment_name", ""),
        "startDate": payload.get("startDate", ""),
        "fromTime": payload.get("fromTime", ""),
        "toTime": "",
        "selectedDoctorId": "",
        "selectedTreatment": "",
        "doctors": [],
        "treatments": [],
        "patients": [],
        "patientExists": False,
        "doctorExists": False,
        "treatmentExists": False,
        "timeConfirmed": False,
        "patientId": "",
        "Status": "",
        "errorMessage": "",
        "Message": "",
        "referenceId": "",
        "appointmentId": "",
    }

    graph = StateGraph(AppointmentState)

    graph.add_node("check_patient", check_patient)
    graph.add_node("register_patient", register_patient)
    graph.add_node("check_doctor_and_treatments", check_doctor_and_treatments)
    graph.add_node("confirm_time", confirm_time)
    graph.add_node("handle_error", handle_error)
    graph.add_node("book_appointment", book_appointment)

    graph.add_edge(START, "check_patient")
    graph.add_conditional_edges("check_patient", after_check_patient)
    graph.add_conditional_edges("register_patient", after_register_patient)
    graph.add_conditional_edges(
        "check_doctor_and_treatments", after_check_doctor_and_treatments
    )
    graph.add_edge("confirm_time", "book_appointment")
    graph.add_edge("handle_error", END)
    graph.add_edge("book_appointment", END)

    return graph.compile(), initial_state
