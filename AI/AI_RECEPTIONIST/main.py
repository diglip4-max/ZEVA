import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import os
import json
import logging
from datetime import datetime
from typing import Annotated, TypedDict, Optional
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import httpx
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.messages import (
    AIMessage,
    HumanMessage,
    SystemMessage,
    BaseMessage,
    ToolMessage,
)
from psycopg_pool import AsyncConnectionPool
from reschedule import reschedule_apt_by_id
from datetime import datetime
from langchain_core.tools import tool
from langchain_core.runnables import RunnableConfig
from langgraph.graph import StateGraph, START, END, add_messages
from langgraph.prebuilt import ToolNode
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langsmith import traceable
from pydantic import BaseModel
from shared.receptionist_prompts import build_receptionist_prompt
from shared.appointment import (
    get_header,
    buildGraph,
    register_patient as _register_patient,
)
from shared.faq import get_services, get_doctors_by_treatment, get_clinic_id
from get_my_billing import fetch_my_billings
from get_my_packages import fetch_receptionist_packages
from get_clinic_appointments import fetch_appointments_tool as _fetch_appointments
from permissions import (
    get_allowed_tool_names,
    filter_tools_by_permission,
    require_permission,
)
from shared.kaka_service_gate import is_kaka_enabled

logger = logging.getLogger("receptionist")
logging.basicConfig(level=logging.INFO)

load_dotenv()

AGENT_URL = os.getenv("NEXT_PUBLIC_BASE_URL")

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

http_client: Optional[httpx.AsyncClient] = None


def get_http_client() -> httpx.AsyncClient:
    global http_client
    if http_client is None:
        http_client = httpx.AsyncClient(timeout=httpx.Timeout(20.0))
    return http_client


def get_context(config: RunnableConfig) -> str:
    configurable = config.get("configurable", {}) if config else {}
    return configurable.get("clinic_token") or ""


def get_agent_id_context(config: RunnableConfig) -> str:
    configurable = config.get("configurable", {}) if config else {}
    return configurable.get("agent_id") or ""

DISABLED_MESSAGE = "This clinic's AI receptionist is currently unavailable. Please contact your admin to re-enable it."

async def check_service_enabled(clinic_token: str) -> bool:
    try:
        clinic_id = await get_clinic_id(clinic_token)
    except Exception:
        return True  # fail-open: don't take down the agent over a lookup error
    if not clinic_id:
        return True
    async with app.state.db_pool.connection() as conn:
        return await is_kaka_enabled(conn, clinic_id)


    
class ChatState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    export: Optional[dict]
    list_block: Optional[dict]
    exports_by_message: Annotated[dict, lambda a, b: {**a, **b}]
    list_blocks_by_message: Annotated[dict, lambda a, b: {**a, **b}]
    loop_restart_count: Optional[int]
    turn_start_index: Optional[int]
    active_category: Optional[str]


class ChatRequest(BaseModel):
    messages: str
    threadId: str
    clinicToken: str
    agentId: str = ""


class HistoryRequest(BaseModel):
    threadId: str


class BookingPayload(BaseModel):
    patient_name: str
    patient_phone: str
    doctor_name: str
    treatment_name: str
    startDate: str
    fromTime: str


class RescheduleAppointmentPayload(BaseModel):
    appointment_id: str
    patient_name: str
    current_date: str
    current_time: str
    new_date: str
    new_time: str


class PatientSearchPayload(BaseModel):
    patient_name: str = ""
    patient_phone: str = ""


class RegisterPatientPayload(BaseModel):
    patient_name: str
    patient_phone: str


class GetAppointmentsPayload(BaseModel):
    date_from: str = ""
    date_to: str = ""
    doctor_name: str = ""
    status: str = ""
    patient_name: str = ""
    patient_phone: str = ""
    page: int = 1
    workflow_stage: str = "lookup"


REPEAT_TOOL_CALL_THRESHOLD = 3
MAX_LOOP_RESTARTS = 1


def _count_trailing_same_tool_calls(
    messages: list[BaseMessage], turn_start_index: int
) -> tuple[Optional[str], int]:
    """
    Scans messages[turn_start_index:] for consecutive AIMessage tool-calls
    that all name the SAME single tool (one tool call per AIMessage, which
    is how this graph's ToolNode step operates turn-to-turn). Returns
    (tool_name, consecutive_count) for the most recent streak, or
    (None, 0) if the most recent AI tool-call message doesn't extend a
    same-tool streak.

    Only considers messages from turn_start_index onward, so a loop
    detected in an earlier, already-completed request never bleeds into
    the count for a new request.
    """
    tool_call_names: list[str] = []
    for msg in messages[turn_start_index:]:
        if isinstance(msg, AIMessage) and msg.tool_calls:
            names = {tc.get("name") for tc in msg.tool_calls if isinstance(tc, dict)}

            if len(names) == 1:
                tool_call_names.append(next(iter(names)))
            else:
                tool_call_names.append(None)  # multi-tool call breaks the streak

    if not tool_call_names:
        return None, 0

    last_name = tool_call_names[-1]
    if last_name is None:
        return None, 0

    streak = 0
    for name in reversed(tool_call_names):
        if name == last_name:
            streak += 1
        else:
            break

    return last_name, streak


def _make_export(kind: str, rows: list[dict]) -> Optional[dict]:
    if not rows:
        return None
    columns = list(rows[0].keys())
    return {"kind": kind, "columns": columns, "rows": rows}


def _make_billing_list_block(rows: list[dict]) -> Optional[dict]:

    if not rows:
        return None

    def _money(value) -> str:
        if value is None or value == "":
            return "-"
        try:
            return f"\u20b9{float(value):,.2f}"
        except (TypeError, ValueError):
            return str(value)

    def item(row: dict) -> dict:

        raw_amount = row.get("amount")
        paid = row.get("paid") or 0
        pending = row.get("pending") or 0
        try:
            amount_val = float(raw_amount) if raw_amount not in (None, "") else 0
        except (TypeError, ValueError):
            amount_val = 0
        if amount_val <= 0:
            amount_val = float(paid) + float(pending)

        try:
            pending_val = float(pending)
        except (TypeError, ValueError):
            pending_val = 0
        status = "Pending" if pending_val > 0 else "Paid"

        treatment_or_service = (
            row.get("treatment") or row.get("package") or row.get("service") or "-"
        )

        return {
            "id": str(row.get("_id") or row.get("invoiceNumber") or ""),
            "summary": {
                "Patient": str(row.get("patientName") or "Unknown"),
                "Invoice/Date": str(row.get("invoiceNumber") or "-"),
                "Amount": _money(amount_val),
                "Status": status,
            },
            "detail": {
                "fields": {
                    "Phone": str(row.get("patientNumber") or "-"),
                    "Doctor": str(row.get("doctorName") or "-"),
                    "Service/Treatment": str(treatment_or_service),
                    "EMR Number": str(row.get("emrNumber") or "-"),
                    "Payment Method": str(row.get("paymentMethod") or "-"),
                    "Paid": _money(paid),
                    "Pending": _money(pending),
                    "Date": str(row.get("invoicedDate") or "-")[:10],
                },
                "lineItems": [],
            },
        }

    return {
        "kind": "billing",
        "summaryColumns": ["Patient", "Invoice/Date", "Amount", "Status"],
        "items": [item(r) for r in rows],
    }


# ── Tools ──────────────────────────────────────────────────────────────────


@tool("fetch_billings_tool")
@require_permission("clinic_invoices", "read")
@traceable
async def fetch_billings_tool(config: RunnableConfig = None) -> dict:
    """Fetches the clinic's billing information (invoices, dues, payment status).

    ⚠️ ALWAYS call this tool fresh for every new billing request — even if
    billing info was already fetched earlier in this conversation. NEVER
    answer a billing request by repeating results from earlier in the chat
    history without calling this tool again. The downloadable CSV export
    and expandable billing list are only attached if the tool actually
    runs this turn.

    The billing list renders separately in the UI as an expandable
    accordion — do NOT restate individual billing rows yourself. Respond
    with ONLY a brief one-line summary, e.g. "5 billing records found —
    4 paid, 1 pending." NEVER output BILLING_START/BILLING_END, a
    markdown table, or a bullet-row breakdown of the results.
    """
    clinicToken = get_context(config)
    if not clinicToken:
        return {"Status": "Error", "Message": "Missing clinic token."}
    try:
        data = await fetch_my_billings(clinicToken)
        logger.debug("Billing raw response: %s", json.dumps(data)[:1000])

        rows = data.get("billings") if isinstance(data, dict) else None
        if isinstance(rows, list) and rows:
            data = dict(data)
            data["_export"] = _make_export("billing", rows)
            data["_list_block"] = _make_billing_list_block(rows)
        return data
    except Exception as e:
        logger.exception("Failed to fetch billing information")

        return {
            "Status": "Error",
            "Message": (f"Failed to fetch billings: " f"{type(e).__name__}: {e!r}"),
        }


@tool("fetch_packages_tool")
@require_permission("Clinic_user_package", "read")
@traceable
async def fetch_packages_tool(config: RunnableConfig = None) -> dict:
    """Fetches the clinic's available treatment/service packages.

    When you present these results to staff, format each row as a bullet
    line of pipe-separated values, and ALWAYS start the block with ONE
    header bullet line naming the columns, e.g.:
      PACKAGES_START
      * Package | Treatments Included | Price | Validity
      * Glow Package | Facial, Peel | ₹5,000 | 3 months
      ...
      PACKAGES_END
    The header row is required — do not omit it or invent column names
    that don't match the header.
    """
    clinicToken = get_context(config)
    if not clinicToken:
        return {"Status": "Error", "Message": "Missing clinic token."}
    try:
        packages = await fetch_receptionist_packages(clinicToken)
        if not packages:
            return {
                "Status": "NotFound",
                "Message": "No packages found for this clinic.",
            }
        return {"Status": "Success", "packages": packages}
    except Exception as e:
        return {"Status": "Error", "Message": f"Failed to fetch packages: {str(e)}"}


@tool("get_clinic_services_tool")
@require_permission("clinic_Appointment", "read")
@traceable
async def get_clinic_services_tool(config: RunnableConfig = None) -> dict:
    """Fetches all active treatments/services offered by the clinic, grouped
    by department, with real names, prices, and durations.

    Call this tool:
      - At the start of ANY booking, so you have the real treatment list
        before the treatment name is confirmed.
      - Whenever staff says "I don't know" / "not sure" / "show me the
        treatments" / "what do you offer" during a booking.
      - Before calling find_doctors_for_treatment_tool, if you haven't
        already fetched the services list earlier in this booking.
    """
    clinicToken = get_context(config)
    if not clinicToken:
        return {"Status": "Error", "Message": "Missing clinic token."}
    try:
        return await get_services(clinicToken)
    except Exception as e:
        return {"Status": "Error", "Message": f"Failed to fetch services: {str(e)}"}


@tool("find_doctors_for_treatment_tool")
@traceable
async def find_doctors_for_treatment_tool(
    treatment_name: str = "", config: RunnableConfig = None
) -> dict:
    """Finds doctors who perform a SPECIFIC named treatment.

    ⚠ Requires a real, specific treatment name — one that you have already
    matched against the real list from get_clinic_services_tool. Do NOT
    call this with an empty string, a guess, or an unmatched/garbled value
    (e.g. "prpr") — if the treatment hasn't been confirmed yet, call
    get_clinic_services_tool first and resolve it against the real list,
    or ask staff to pick from the list.
    """
    if not treatment_name or not treatment_name.strip():
        return {
            "Status": "NEEDS_INPUT",
            "Message": (
                "No treatment name was provided. Fetch the treatment list "
                "via get_clinic_services_tool and confirm one before "
                "calling this tool again."
            ),
        }
    clinicToken = get_context(config)
    if not clinicToken:
        return {"Status": "Error", "Message": "Missing clinic token."}
    try:
        clinic_id = await get_clinic_id(clinicToken)
        result = await get_doctors_by_treatment(treatment_name, clinicToken, clinic_id)
        return result
    except Exception as e:
        return {"Status": "Error", "Message": f"Failed to fetch doctors: {str(e)}"}


@tool("search_patient_tool", args_schema=PatientSearchPayload)
@require_permission("clinic_patient_registration", "read")
@traceable
async def search_patient_tool(
    patient_name: str = "",
    patient_phone: str = "",
    config: RunnableConfig = None,
) -> dict:
    """Searches for an existing patient by name and/or phone number.
    Call BEFORE registering a new patient, to avoid duplicates.

    ⚠️ ALWAYS call this tool fresh for every new search request — even if
    staff searched for the same or a similar name/phone earlier in this
    conversation. NEVER answer a search request by repeating or
    re-listing matches from earlier in the chat history without calling
    this tool again. The downloadable CSV export button shown to staff
    is only attached when the tool actually runs this turn, so skipping
    the call silently breaks that feature even if the text looks right.

    Returns ONLY name and phone for each match — no other patient
    fields are ever surfaced by this tool, regardless of what the
    upstream API response contains.

    When you present multiple matches to staff, format each row as a
    bullet line of pipe-separated values, and ALWAYS start the block
    with ONE header bullet line naming the columns, e.g.:
      PATIENTS_START
      * Name | Phone
      * Priya Shah | 9876543210
      ...
      PATIENTS_END
    The header row is required — do not omit it or invent column names
    that don't match the header.
    """
    clinicToken = get_context(config)
    if not clinicToken:
        return {"Status": "Error", "Message": "Missing clinic token."}
    if not patient_name.strip() and not patient_phone.strip():
        return {
            "Status": "NEEDS_INPUT",
            "Message": "Provide at least a patient name or phone number to search.",
        }

    header = get_header(clinicToken)
    url = f"{AGENT_URL}/api/clinic/patient-information"
    try:
        resp = await get_http_client().get(url, headers=header)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        return {"Status": "Error", "Message": f"Patient search failed: {str(e)}"}
    if not data.get("success") or not data.get("data"):
        return {"Status": "NotFound", "Message": "No patients found."}

    # Lowercased copies used ONLY for matching — never returned to the caller.
    name_q = patient_name.strip().lower()
    phone_q = "".join(c for c in patient_phone if c.isdigit())

    matches = []
    for p in data["data"]:
        # Display-cased name, kept separate from the lowercased match key.
        display_name = f"{p.get('firstName', '')} {p.get('lastName', '')}".strip()
        match_name = display_name.lower()
        db_phone = "".join(c for c in (p.get("mobileNumber") or "") if c.isdigit())

        name_match = bool(name_q) and name_q in match_name
        phone_match = bool(phone_q) and phone_q in db_phone
        if not (name_match or phone_match):
            continue
        matches.append(
            {
                "name": display_name,
                "phone": db_phone,
            }
        )

    if not matches:
        return {"Status": "NotFound", "Message": "No matching patients found."}

    export = _make_export("patients", matches)
    result = {"Status": "Success", "matches": matches}
    if export:
        result["_export"] = export
    return result


def _normalize_patient_phone(raw: str) -> str:
    digits = re.sub(r"\D", "", raw or "")

    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]

    return digits


async def find_existing_patient(
    clinic_token: str, patient_name: str, patient_phone: str
) -> Optional[dict]:

    header = get_header(clinic_token)
    url = f"{AGENT_URL}/api/clinic/patient-information"
    try:
        resp = await get_http_client().get(url, headers=header)
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        return None

    if not data.get("success") or not data.get("data"):
        return None

    def normalize_phone(raw: str) -> str:
        digits = re.sub(r"\D", "", raw or "")
        if not digits:
            return digits
        if len(digits) == 12 and digits.startswith("91"):
            candidate = digits[2:]
            if len(candidate) == 10:
                return candidate
        return digits

    def normalize_name(raw: str) -> str:
        return re.sub(r"\s+", " ", (raw or "").strip().lower())

    name_q = normalize_name(patient_name)
    phone_q = normalize_phone(patient_phone)

    for patient in data["data"]:
        first = patient.get("firstName", "") or ""
        last = patient.get("lastName", "") or ""
        db_full_name = normalize_name(f"{first} {last}".strip())
        db_phone = normalize_phone(patient.get("mobileNumber", "") or "")

        if db_full_name == name_q and db_phone == phone_q:
            return patient

    return None


@tool("register_patient_tool", args_schema=RegisterPatientPayload)
@require_permission("clinic_patient_registration", "create")
@traceable
async def register_patient_tool(
    patient_name: str,
    patient_phone: str,
    config: RunnableConfig = None,
) -> dict:
    """Registers a brand-new patient.
    This Tool registers a patient only if no exact match exists (name AND phone, both exact after normalization). If an exact match already exists, it returns the existing patient ID instead of creating a duplicate.
    """
    clinicToken = get_context(config)
    if not clinicToken:
        return {"Status": "Error", "Message": "Missing clinic token."}
    if not patient_name.strip() or not patient_phone.strip():
        return {
            "Status": "Fields Are Missing",
            "Message": "Both patient name and phone number are required.",
        }

    patient_phone = _normalize_patient_phone(patient_phone)

    if len(patient_phone) != 10:
        return {
            "Status": "InvalidPhone",
            "Message": (
                f"Indian mobile number must contain exactly 10 digits. "
                f"Received {len(patient_phone)} digits."
            ),
        }

    existing = await find_existing_patient(
        clinicToken,
        patient_name,
        patient_phone,
    )
    if existing:
        existing_name = (
            f"{existing.get('firstName', '')} {existing.get('lastName', '')}".strip()
        )
        return {
            "Status": "AlreadyExists",
            "Message": f"Patient '{existing_name or patient_name}' is already registered.",
            "patientId": existing.get("_id", ""),
        }
    state = {
        "clinicToken": clinicToken,
        "patient_name": patient_name,
        "patient_phone": patient_phone,
    }
    try:
        result = await _register_patient(state)
    except Exception as e:
        return {"Status": "Error", "Message": f"Registration failed: {str(e)}"}

    if result.get("patientExists"):
        return {
            "Status": "Success",
            "Message": f"Patient '{patient_name}' registered.",
        }
    return {
        "Status": "Error",
        "Message": result.get("errorMessage", "Patient registration failed."),
    }


def _normalize_doctor_name_for_lookup(name: str) -> str:
    stripped = re.sub(r"^(dr\.?|doctor)\s+", "", name.strip(), flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", stripped).strip().lower()


@tool("book_appointment_tool", args_schema=BookingPayload)
@require_permission("clinic_Appointment", "create")
@traceable
async def book_appointment_tool(
    patient_name: str,
    patient_phone: str,
    doctor_name: str,
    treatment_name: str,
    startDate: str,
    fromTime: str,
    config: RunnableConfig = None,
) -> dict:
    """Books an appointment on behalf of the receptionist for a named patient.

    ⚠️ DO NOT CALL THIS TOOL UNTIL:
    1. You have already shown a BOOKING_CONFIRM_START markdown table with
       Patient, Phone, Treatment, Doctor, Date, Time in a PREVIOUS turn, AND
    2. Staff has explicitly confirmed ("yes", "confirm", "correct") in
       their MOST RECENT message.

    ⚠️ This tool NEVER creates a patient. It requires the patient to
    already exist (matched by exact name AND phone). If no match is
    found, it fails with Status "PatientNotFound" — call
    register_patient_tool first (with its own confirmation step), then
    retry booking.

    treatment_name MUST be the exact treatment name as it exists in the
    clinic's database — not staff's wording. Before calling this tool:

    1. Call get_clinic_services_tool to fetch the real treatment list (if
       not already fetched this booking).
    2. Match staff's wording to the closest real treatment name yourself
       (handle typos, singular/plural, partial names, synonyms — e.g.
       "beard removal" -> "Beard Laser Removal").
    3. Pass the EXACT DB name as treatment_name, never staff's raw words.

    If no real treatment is a reasonable match, do not guess — ask staff
    to clarify or pick from the list instead of calling this tool with a
    fabricated name.

    doctor_name — same rule: resolve to the exact name returned by
    find_doctors_for_treatment_tool. Never pass placeholders like "any
    available doctor" or "whoever's free".

    All fields are REQUIRED — resolve doctor_name/treatment_name against real
    data first; never pass placeholders or guesses.
    """
    missing = [
        label
        for label, val in [
            ("patient name", patient_name),
            ("patient phone", patient_phone),
            ("doctor name", doctor_name),
            ("treatment name", treatment_name),
            ("date", startDate),
            ("time", fromTime),
        ]
        if not val or not val.strip()
    ]
    if missing:
        return {
            "Status": "Fields Are Missing",
            "Message": f"Cannot book — missing: {', '.join(missing)}.",
        }

    patient_phone = _normalize_patient_phone(patient_phone)

    if len(patient_phone) != 10:
        return {
            "Status": "InvalidPhone",
            "Message": (
                f"Indian mobile number must contain exactly 10 digits. "
                f"Received {len(patient_phone)} digits."
            ),
        }

    clinicToken = get_context(config)
    if not clinicToken:
        return {"Status": "Error", "Message": "Missing clinic token."}

    matched_patient = await find_existing_patient(
        clinicToken, patient_name, patient_phone
    )
    if not matched_patient:
        return {
            "Status": "PatientNotFound",
            "Message": (
                f"No existing patient matches '{patient_name}' / "
                f"'{patient_phone}' exactly. Register the patient first "
                "via register_patient_tool, then book."
            ),
        }

    # Remove titles while preserving the doctor's original capitalization.

    doctor_name = re.sub(
        r"^(?:dr|doctor)(?:\s*\.\s*|\s+)",
        "",
        doctor_name.strip(),
        flags=re.IGNORECASE,
    ).strip()

    try:
        clinic_id = await get_clinic_id(clinicToken)

        doctors_result = await get_doctors_by_treatment(
            treatment_name,
            clinicToken,
            clinic_id,
        )

        if isinstance(doctors_result, dict):
            real_doctors = (
                doctors_result.get("doctors")
                or doctors_result.get("Doctors")
                or doctors_result.get("data")
                or []
            )
        elif isinstance(doctors_result, list):
            real_doctors = doctors_result
        else:
            real_doctors = []

        target = _normalize_doctor_name_for_lookup(doctor_name)

        resolved = next(
            (
                doctor
                for doctor in real_doctors
                if _normalize_doctor_name_for_lookup(
                    (
                        doctor.get("name")
                        or doctor.get("doctor_name")
                        or doctor.get("doctorName")
                        or doctor.get("fullName")
                        or doctor.get("label")
                        or ""
                    )
                    if isinstance(doctor, dict)
                    else str(doctor)
                )
                == target
            ),
            None,
        )

        if resolved:
            if isinstance(resolved, dict):
                doctor_name = (
                    resolved.get("name")
                    or resolved.get("doctor_name")
                    or resolved.get("doctorName")
                    or resolved.get("fullName")
                    or resolved.get("label")
                    or doctor_name
                )
            else:
                doctor_name = str(resolved)

    except Exception as e:
        logger.warning(
            "Could not resolve doctor '%s' against treatment doctors: %s",
            doctor_name,
            e,
        )

    payload = {
        "patient_name": patient_name,
        "patient_phone": patient_phone,
        "doctor_name": doctor_name,
        "treatment_name": treatment_name,
        "startDate": startDate,
        "fromTime": fromTime,
    }
    try:
        workflow, initial_state = buildGraph(clinicToken, payload)
        response = await workflow.ainvoke(initial_state)
    except Exception as e:
        return {"Status": "Error", "Message": f"Booking failed: {str(e)}"}

    return {
        "Status": response.get("Status", "Error"),
        "Message": response.get("Message")
        or response.get("errorMessage", "Something went wrong."),
    }


@tool("reschedule_appointment_tool", args_schema=RescheduleAppointmentPayload)
@require_permission("clinic_Appointment", "update")
@traceable
async def reschedule_appointment_tool(
    appointment_id: str,
    patient_name: str,
    current_date: str,
    current_time: str,
    new_date: str,
    new_time: str,
    config: RunnableConfig = None,
) -> dict:
    """Reschedules a patient's existing appointment to a new date/time.

    ⚠️ If the patient may have more than one appointment on file (e.g.
    get_appointments_tool showed multiple earlier in this conversation),
    you MUST ask staff which one they mean BEFORE calling this tool, and
    pass target_date / target_time / doctor_name to identify it precisely.
    If you call this without those and the patient has multiple
    appointments, it returns Status "MultipleFound" with a list of
    candidates instead of guessing — relay that list to staff and ask.

    ⚠️ DO NOT CALL THIS TOOL UNTIL:
    1. You have already shown a RESCHEDULE_CONFIRM_START markdown table
       with Patient, Phone, (Existing Date/Time if disambiguating),
       New Date, New Time in a PREVIOUS turn, AND
    2. Staff has explicitly confirmed ("yes", "confirm", "correct") in
       their MOST RECENT message.

    startDate/fromTime = the NEW date/time to move the appointment to.
    target_date/target_time/doctor_name = identify WHICH existing
    appointment to move, only needed when the patient has more than one.
    """
    missing = [
        label
        for label, value in [
            ("appointment ID", appointment_id),
            ("patient name", patient_name),
            ("current date", current_date),
            ("current time", current_time),
            ("new date", new_date),
            ("new time", new_time),
        ]
        if not value or not value.strip()
    ]
    if missing:
        return {
            "Status": "Fields Are Missing",
            "Message": f"Cannot reschedule — missing: {', '.join(missing)}.",
        }

    clinicToken = get_context(config)
    if not clinicToken:
        return {"Status": "Error", "Message": "Missing clinic token."}

    try:
        return await reschedule_apt_by_id(
            clinicToken=clinicToken,
            appointment_id=appointment_id,
            patient_name=patient_name,
            claimed_current_date=current_date,
            claimed_current_time=current_time,
            new_date=new_date,
            new_time=new_time,
        )
    except Exception as e:
        return {"Status": "Error", "Message": f"Reschedule failed: {str(e)}"}


@tool("get_appointments_tool", args_schema=GetAppointmentsPayload)
@require_permission("clinic_Appointment", "read")
@traceable
async def get_appointments_tool(
    date_from: str = "",
    date_to: str = "",
    doctor_name: str = "",
    status: str = "",
    patient_name: str = "",
    patient_phone: str = "",
    page: int = 1,
    workflow_stage: str = "lookup",
    config: RunnableConfig = None,
) -> dict:
    """Fetch the clinic's scheduled appointments for staff. THIS IS THE
    ONLY appointment lookup tool — used for general lookup AND every
    stage of rescheduling. Never introduce a second tool for
    rescheduling.

    ⚠️ OUTPUT CONTRACT depends on display_mode in the result:
      - "summary_only": reply is exactly ONE sentence using only `total`
        and `status_counts`. No bullet list, no table, no individual
        names/dates/times.
      - "accordion": the frontend renders the list itself. Reply is
        still ONE summary sentence — never restate individual records.
      - "reschedule_candidates": the `appointments` array is safe and
        necessary to read directly, to resolve staff's selection by
        position/doctor/time during rescheduling.

    date_from / date_to: DD-MM-YYYY dates YOU must resolve from natural
    language before calling this tool (e.g. "this week", "last week").

    - Named patient, no date: leave date_from/date_to EMPTY — searches
      ALL of that patient's appointments, never defaults to today.
    - Date/range with no patient: resolve the date as usual.
    - Both patient and date: resolve the date and pass both.
    - Neither: default date_from == date_to == today.

    workflow_stage:
    - "lookup" (default): general appointment lookup, any range.
    - "reschedule_stage1": rescheduling, patient named, no date yet.
    - "reschedule_stage3": rescheduling, patient AND a particular date
      already given — narrows to that patient+date+booked and returns
      full candidate details.

    Never call this a second time with identical arguments in the same
    request if a prior call already succeeded — reuse that result.
    """

    clinicToken = get_context(config)
    if not clinicToken:
        return {"Status": "Error", "Message": "Missing clinic token."}

    try:
        data = await _fetch_appointments(
            clinicToken=clinicToken,
            date_from=date_from or None,
            date_to=date_to or None,
            doctor_name=doctor_name or None,
            status=status or None,
            patient_name=patient_name or None,
            patient_phone=patient_phone or None,
            page=page,
            workflow_stage=workflow_stage,
        )
        return data
    except Exception as e:
        return {"Status": "Error", "Message": f"Failed to fetch appointments: {str(e)}"}


tools = [
    fetch_billings_tool,
    fetch_packages_tool,
    get_clinic_services_tool,
    find_doctors_for_treatment_tool,
    search_patient_tool,
    register_patient_tool,
    book_appointment_tool,
    get_appointments_tool,
    reschedule_appointment_tool,
]


EXPORTABLE_TOOLS = {
    "fetch_billings_tool": "billing",
    "search_patient_tool": "patients",
}


LIST_BLOCK_TOOLS = {
    "get_appointments_tool",
    "fetch_billings_tool",
}


def _compact_oversized_group(group: list[BaseMessage]) -> list[BaseMessage]:
    """Shrinks an oversized AI-tool-call + ToolMessage group down to
    just the summary fields instead of dropping it entirely — so the
    model always sees that its most recent tool call succeeded, even
    under a tight token budget."""
    compacted: list[BaseMessage] = []
    for msg in group:
        if isinstance(msg, ToolMessage) and isinstance(msg.content, str):
            try:
                payload = json.loads(msg.content)
            except (json.JSONDecodeError, TypeError):
                compacted.append(msg)
                continue
            if isinstance(payload, dict):
                slim = {
                    k: payload[k]
                    for k in (
                        "Status",
                        "total",
                        "status_counts",
                        "filters_applied",
                        "display_mode",
                        "Message",
                    )
                    if k in payload
                }
                if payload.get("display_mode") == "reschedule_candidates":
                    slim["appointments"] = payload.get("appointments", [])
                msg = ToolMessage(
                    content=json.dumps(slim),
                    tool_call_id=msg.tool_call_id,
                    name=msg.name,
                )
        compacted.append(msg)
    return compacted


def safe_trim_messages(
    messages: list[BaseMessage],
    max_tokens: int,
    token_counter,
) -> list[BaseMessage]:

    if not messages:
        return []

    groups: list[list[BaseMessage]] = []
    i = 0

    while i < len(messages):
        message = messages[i]

        # ── AI message containing one or more tool calls ─────────────
        if isinstance(message, AIMessage) and message.tool_calls:
            required_ids: list[str] = []

            for tool_call in message.tool_calls:
                if not isinstance(tool_call, dict):
                    continue

                tool_call_id = tool_call.get("id")

                if isinstance(tool_call_id, str) and tool_call_id.strip():
                    required_ids.append(tool_call_id)

            # Tool calls without valid IDs cannot form valid API history.
            if not required_ids:
                i += 1

                # Remove immediately following orphan tool responses too.
                while i < len(messages) and isinstance(messages[i], ToolMessage):
                    i += 1

                continue

            required_id_set = set(required_ids)
            matched_tool_messages: dict[str, ToolMessage] = {}

            i += 1

            # Examine the consecutive tool-response section.
            while i < len(messages) and isinstance(messages[i], ToolMessage):
                tool_message = messages[i]
                tool_call_id = getattr(tool_message, "tool_call_id", None)

                # Keep only responses belonging to this AI tool-call message.
                # Keep only the first response if duplicate IDs are present.
                if (
                    isinstance(tool_call_id, str)
                    and tool_call_id in required_id_set
                    and tool_call_id not in matched_tool_messages
                ):
                    matched_tool_messages[tool_call_id] = tool_message

                i += 1

            # A tool-call group is valid only if every tool call was answered.
            if required_id_set != set(matched_tool_messages):
                continue

            # Preserve the same order as tool calls in the AIMessage.
            group: list[BaseMessage] = [message]
            group.extend(
                matched_tool_messages[tool_call_id] for tool_call_id in required_ids
            )

            groups.append(group)
            continue

        # ── ToolMessage without a preceding valid AI tool call ───────
        if isinstance(message, ToolMessage):
            i += 1
            continue

        # Normal HumanMessage, AIMessage, or other message.
        groups.append([message])
        i += 1

    def count_message_tokens(message: BaseMessage) -> int:
        """
        Count content plus tool-call metadata.

        AI tool-call messages often have empty content, so counting only
        message.content would significantly underestimate their size.
        """
        token_parts = [str(getattr(message, "content", "") or "")]

        if isinstance(message, AIMessage) and message.tool_calls:
            token_parts.append(str(message.tool_calls))

        if isinstance(message, ToolMessage):
            token_parts.append(str(getattr(message, "tool_call_id", "") or ""))
            token_parts.append(str(getattr(message, "name", "") or ""))

        serialized = "\n".join(token_parts)
        return token_counter.get_num_tokens(serialized)

    # ── Keep the newest complete groups within the token budget ──────
    kept_groups: list[list[BaseMessage]] = []
    total_tokens = 0

    for idx, group in enumerate(reversed(groups)):
        group_tokens = sum(count_message_tokens(msg) for msg in group)

        if total_tokens + group_tokens > max_tokens:
            if idx == 0:
                # This is the MOST RECENT group in the whole history —
                # i.e. the tool call/result that just happened this turn.
                # Never silently drop it; that's what causes the model
                # to "forget" a successful result and re-call the same
                # tool. Compact it instead of skipping it outright.
                compacted = _compact_oversized_group(group)
                kept_groups.append(compacted)
                total_tokens += sum(count_message_tokens(m) for m in compacted)
            # else: an older oversized group — safe to drop entirely.
            continue

        kept_groups.append(group)
        total_tokens += group_tokens

    kept_groups.reverse()

    kept = [message for group in kept_groups for message in group]

    # OpenAI history should not start with assistant/tool output.
    while kept and not isinstance(kept[0], HumanMessage):
        kept.pop(0)

    return kept


MAX_TOKENS = 4000
SYSTEM_PROMPT_LOG_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "system_prompt_log.json"
)


def _log_token_usage(response: AIMessage) -> None:
    """Log prompt/completion/cached token counts for this turn, pulled
    from the LLM response's usage metadata."""
    usage = getattr(response, "usage_metadata", None)
    if not usage:
        # Fallback: some providers/versions surface it under response_metadata
        usage = (response.response_metadata or {}).get("token_usage")

    if not usage:
        logger.debug("[receptionist] token usage: unavailable for this response")
        return

    input_tokens = usage.get("input_tokens") or usage.get("prompt_tokens") or 0
    output_tokens = usage.get("output_tokens") or usage.get("completion_tokens") or 0
    total_tokens = usage.get("total_tokens") or (input_tokens + output_tokens)

    # Cached token count lives in different places depending on how the
    # usage dict was shaped — check the common spots.
    cached_tokens = 0
    details = usage.get("input_token_details") or usage.get("prompt_tokens_details")
    if isinstance(details, dict):
        cached_tokens = details.get("cache_read") or details.get("cached_tokens") or 0

    print(
        f"[receptionist] tokens — input: {input_tokens}, cached: {cached_tokens}, output: {output_tokens}, total: {total_tokens}"
    )


def build_workflow(checkpointer):
    async def chat_node(state: ChatState, config: RunnableConfig):
        today = datetime.now().strftime("%d-%m-%Y")
        current_year = datetime.now().year
        day_name = datetime.now().strftime("%A")
        time_str = datetime.now().strftime("%H:%M")

        date_context = (
            f"CURRENT DATE AND TIME:\n"
            f"Today is {day_name}, {today}. Current time: {time_str}.\n\n"
            f"If staff gives a date without a year, assume {current_year}; "
            f"if that date has already passed this year, use {current_year + 1}.\n"
            f"Resolve relative terms like 'today', 'tomorrow', 'this Friday' "
            f"against the date above — never guess.\n\n"
            f"For DURATION-based phrases ('X hours ago', 'X days ago', 'in X hours'), "
            f"compute explicitly: today's date/time minus/plus the stated duration, "
            f"crossing midnight if the duration crosses a day boundary. "
            f"Example: if now is {day_name} {today} {time_str}, then '50 hours ago' "
            f"is 2 days and 2 hours earlier — show your subtraction explicitly before "
            f"picking date_from/date_to, do not estimate.\n\n"
        )

        clinic_token = get_context(config)
        resolved_agent_id = get_agent_id_context(config)

        allowed_tool_names = await get_allowed_tool_names(
            resolved_agent_id, clinic_token
        )
        configurable = config.setdefault("configurable", {})
        configurable["_allowed_tool_names"] = allowed_tool_names

        permitted_tools = filter_tools_by_permission(tools, allowed_tool_names)
        print(f"[receptionist] permitted_tools: {[t.name for t in permitted_tools]}")

        dynamic_prompt = build_receptionist_prompt(allowed_tool_names)
        system_message = SystemMessage(content=date_context + dynamic_prompt)

        trimmed = safe_trim_messages(state["messages"], MAX_TOKENS, llm)
        scoped_agent = llm.bind_tools(permitted_tools) if permitted_tools else llm

        try:
            response = await scoped_agent.ainvoke([system_message] + trimmed)
        except Exception as e:
            logger.debug(
                f"[receptionist] agent.ainvoke failed: {type(e).__name__}: {e}"
            )
            response = AIMessage(
                content="Sorry, I had trouble processing that. Could you try again?"
            )
        _log_token_usage(response)

        pending_export = state.get("export")
        pending_list_block = state.get("list_block")

        # Detect whether this chat_node invocation is starting a BRAND NEW
        # user request (the newest message is a HumanMessage that arrived
        # this call) vs. continuing an existing tool-calling loop. If it's
        # new, reset turn_start_index/loop_restart_count so a loop in a
        # PRIOR request never counts against, or restarts, a later one.
        updates: dict = {
            "messages": [response],
            "export": pending_export if not response.tool_calls else None,
            "list_block": pending_list_block if not response.tool_calls else None,
        }
        last_incoming = state["messages"][-1] if state["messages"] else None
        is_new_user_request = isinstance(last_incoming, HumanMessage) and not state.get(
            "_mid_request"
        )
        if is_new_user_request:
            updates["turn_start_index"] = len(state["messages"]) - 1
            updates["loop_restart_count"] = 0

        if not response.tool_calls:
            if pending_export:
                updates["exports_by_message"] = {response.id: pending_export}
            if pending_list_block:
                updates["list_blocks_by_message"] = {response.id: pending_list_block}

        return updates

    # ↓↓↓ these are now siblings of chat_node, correctly inside build_workflow ↓↓↓
    async def tools_node(state: ChatState, config: RunnableConfig):
        clinic_token = get_context(config)
        resolved_agent_id = get_agent_id_context(config)
        allowed_tool_names = await get_allowed_tool_names(
            resolved_agent_id, clinic_token
        )
        configurable = config.setdefault("configurable", {})
        configurable["_allowed_tool_names"] = allowed_tool_names
        permitted_tools = filter_tools_by_permission(tools, allowed_tool_names or set())
        print(f"[receptionist] permitted_tools: {[t.name for t in permitted_tools]}")
        last_message = state["messages"][-1]
        requested_calls = (
            last_message.tool_calls
            if isinstance(last_message, AIMessage) and last_message.tool_calls
            else []
        )

        denied_calls = [
            tc
            for tc in requested_calls
            if tc.get("name") not in (allowed_tool_names or set())
        ]

        new_messages = []
        export = None
        list_block = None

        if permitted_tools:
            raw_result = await ToolNode(permitted_tools).ainvoke(state, config=config)
            for msg in raw_result.get("messages", []):
                if isinstance(msg, ToolMessage) and isinstance(msg.content, str):
                    try:
                        payload = json.loads(msg.content)
                    except (json.JSONDecodeError, TypeError):
                        new_messages.append(msg)
                        continue
                    if isinstance(payload, dict):
                        if "_export" in payload:
                            tool_kind = EXPORTABLE_TOOLS.get(msg.name)
                            candidate = payload.pop("_export")
                            if tool_kind and isinstance(candidate, dict):
                                export = candidate
                        if "_list_block" in payload:
                            candidate_block = payload.pop("_list_block")
                            if msg.name in LIST_BLOCK_TOOLS and isinstance(
                                candidate_block, dict
                            ):
                                list_block = candidate_block

                        msg = ToolMessage(
                            content=json.dumps(payload),
                            tool_call_id=msg.tool_call_id,
                            name=msg.name,
                        )
                new_messages.append(msg)

        for tc in denied_calls:
            new_messages.append(
                ToolMessage(
                    content=json.dumps(
                        {
                            "Status": "Forbidden",
                            "Message": (
                                "You don't have permission to perform this "
                                "action. Contact your clinic admin to "
                                "request access."
                            ),
                        }
                    ),
                    tool_call_id=tc.get("id", ""),
                    name=tc.get("name", "unknown_tool"),
                )
            )

        turn_start_index = state.get("turn_start_index") or 0
        looped_tool, streak = _count_trailing_same_tool_calls(
            state["messages"], turn_start_index
        )

        if looped_tool is not None and streak >= REPEAT_TOOL_CALL_THRESHOLD:
            restarts_used = state.get("loop_restart_count") or 0

            logger.warning(
                f"[receptionist] repeat-tool-call loop detected: "
                f"'{looped_tool}' called {streak}x in a row "
                f"(restarts_used={restarts_used})."
            )

            if restarts_used >= MAX_LOOP_RESTARTS:

                failure_message = AIMessage(
                    content=(
                        "I'm having trouble completing this request — I "
                        "kept retrying the same step without success. "
                        "Please try rephrasing your request, or try again "
                        "in a moment."
                    )
                )
                return {
                    "messages": new_messages + [failure_message],
                    "export": None,
                    "list_block": None,
                    "loop_restart_count": restarts_used,  # unchanged; already spent
                    "_force_end": True,  # see route_after_tools below
                }

            original_human_messages = [
                m
                for m in state["messages"][turn_start_index:]
                if isinstance(m, HumanMessage)
            ]
            restart_notice = SystemMessage(
                content=(
                    f"NOTE: A previous attempt at this request repeatedly "
                    f"called the '{looped_tool}' tool without making "
                    f"progress and was stopped. The tool call already "
                    f"succeeded — do not call '{looped_tool}' again with "
                    f"the same arguments; use the result already returned. "
                    f"If unsure what to do next, ask staff a clarifying "
                    f"question instead of retrying. Do NOT tell staff you "
                    f"lack permission unless a tool result actually "
                    f'returned Status="Forbidden".'
                )
            )
            return {
                "messages": [restart_notice] + original_human_messages,
                "export": None,
                "list_block": None,
                "loop_restart_count": restarts_used + 1,
                "_restart_requested": True,
            }

        return {
            "messages": new_messages,
            "export": export,
            "list_block": list_block,
        }

    def route_after_chat(state: ChatState):
        last = state["messages"][-1]
        if isinstance(last, AIMessage) and last.tool_calls:
            return "tools"
        return END

    def route_after_tools(state: ChatState):
        # NEW: if tools_node signaled a final loop-failure, end immediately
        # instead of routing back to chat_node — guarantees we never
        # attempt a second restart or re-enter the loop.
        if state.get("_force_end"):
            return END
        return "chat_node"

    graph = StateGraph(ChatState)
    graph.add_node("chat_node", chat_node)
    graph.add_node("tools", tools_node)
    graph.add_edge(START, "chat_node")
    graph.add_conditional_edges(
        "chat_node", route_after_chat, {"tools": "tools", END: END}
    )
    graph.add_conditional_edges(
        "tools", route_after_tools, {"chat_node": "chat_node", END: END}
    )
    return graph.compile(checkpointer=checkpointer)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global http_client
    http_client = httpx.AsyncClient(timeout=httpx.Timeout(20.0))

    checkpointer_pool = AsyncConnectionPool(
        conninfo=os.getenv("DATABASE_URL"),
        min_size=2,
        max_size=10,
        max_idle=120,
        max_lifetime=1500,
        reconnect_timeout=10,
        kwargs={"autocommit": True, "prepare_threshold": None},
        open=False,
        check=AsyncConnectionPool.check_connection,
    )
    await checkpointer_pool.open()
    checkpointer = AsyncPostgresSaver(checkpointer_pool)
    await checkpointer.setup()                                                                                      
    app.state.workflow = build_workflow(checkpointer)                                                                                       
    app.state.db_pool = checkpointer_pool                                                                                       
                                                                                        
    # NEW: separate plain pool for chat-history rows (kept apart from the                                                                                       
    # checkpointer pool so a history insert can never contend with or be                                                                                        
    # coupled to LangGraph's own checkpoint writes).                                                                                        
    history_pool = AsyncConnectionPool(                                                                                     
        conninfo=os.getenv("DATABASE_URL"),                                                                                     
        min_size=2,                                                                                     
        max_size=10,                                                                                        
        kwargs={"autocommit": True, "prepare_threshold": None},                                                                                     
        open=False,                                                                                     
    )                                                                                       
    await history_pool.open()                                                                                       
    app.state.history_db_pool = history_pool                                                                                        
                                                                                        
    yield                                                                                       
    await http_client.aclose()                                                                                      
    await checkpointer_pool.close()                                                                                     
    await history_pool.close()                                                                                      
                                                                                        
                                                                                        
app = FastAPI(lifespan=lifespan)                                                                                        
app.add_middleware(                                                                                     
    CORSMiddleware,                                                                                     
    allow_origins=[                                                                                     
        f"{AGENT_URL}",                                                                                     
        "https://zeva360.com",                                                                                      
    ],                                                                                      
    allow_credentials=True,                                                                                     
    allow_methods=["*"],                                                                                        
    allow_headers=["*"],                                                                                        
)                                                                                       
                                                                                        
                                                                                        
def _sse(event: str, data: dict) -> str:                                                                                        
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"                                                                                      
                                                                                        
                                                                                        
async def log_receptionist_turn(                                                                                        
    app: FastAPI,                                                                                       
    thread_id: str,                                                                                     
    agent_id: str,                                                                                      
    user_content: str,                                                                                      
    assistant_content: str,                                                                                     
    export: Optional[dict],                                                                                     
    list_block: Optional[dict],
) -> None:
    """Persists one full turn (user message + assistant reply) into
    kaka_receptionist_messages. Best-effort — never raises, so a logging
    failure can't break the actual chat response."""
    try:
        async with app.state.history_db_pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    INSERT INTO kaka_receptionist_messages
                        (thread_id, agent_id, role, content, export, list_block)
                    VALUES
                        (%s, %s, 'user', %s, NULL, NULL),
                        (%s, %s, 'assistant', %s, %s, %s)
                    """,
                    (
                        thread_id,
                        agent_id,
                        user_content,
                        thread_id,
                        agent_id,
                        assistant_content,
                        json.dumps(export) if export else None,
                        json.dumps(list_block) if list_block else None,
                    ),
                )
    except Exception as e:
        logger.warning(f"[receptionist_history] Failed to log turn: {e}")


@app.post("/receptionist/chat")
async def receptionist_chat(req: ChatRequest):
    """Non-streaming endpoint, kept for backward compatibility / fallback."""
    if not await check_service_enabled(req.clinicToken):
        return {"response": DISABLED_MESSAGE, "export": None, "listBlock": None}
    config = {
        "configurable": {
            "thread_id": req.threadId,
            "clinic_token": req.clinicToken,
            "agent_id": req.agentId,
        }
    }

    result = await app.state.workflow.ainvoke(
        {
            "messages": [HumanMessage(content=req.messages)],
            "export": None,
            "list_block": None,
        },
        config=config,
    )
    print(result)

    last_msg = result["messages"][-1]

    await log_receptionist_turn(
        app,
        thread_id=req.threadId,
        agent_id=req.agentId,
        user_content=req.messages,
        assistant_content=last_msg.content,
        export=result.get("export"),
        list_block=result.get("list_block"),
    )

    return {
        "response": last_msg.content,
        "export": result.get("export"),
        "listBlock": result.get("list_block"),
    }


@app.post("/receptionist/chat/stream")
async def receptionist_chat_stream(req: ChatRequest):
    """SSE endpoint. Streams incremental assistant text as it's generated
    (via astream_events on the underlying chat model), plus a tool-status
    event when a tool is running (so the UI can show "Searching patients…"
    etc.), and a final `done` event carrying the export block and any
    structured list block (e.g. appointments), if present."""
    if not await check_service_enabled(req.clinicToken):
        async def disabled_stream():
            yield _sse("token", {"text": DISABLED_MESSAGE})
            yield _sse("done", {"response": DISABLED_MESSAGE, "export": None, "listBlock": None})
        return StreamingResponse(disabled_stream(), media_type="text/event-stream")
    config = {
        "configurable": {
            "thread_id": req.threadId,
            "clinic_token": req.clinicToken,
            "agent_id": req.agentId,
        }
    }

    async def event_stream():
        try:
            async for event in app.state.workflow.astream_events(
                {
                    "messages": [HumanMessage(content=req.messages)],
                    "export": None,
                    "list_block": None,
                },
                config=config,
                version="v2",
            ):
                kind = event.get("event")
                name = event.get("name", "")

                if kind == "on_chat_model_stream":
                    chunk = event["data"]["chunk"]
                    text = getattr(chunk, "content", "") or ""
                    if text:
                        yield _sse("token", {"text": text})

                elif kind == "on_tool_start":
                    yield _sse("tool_start", {"tool": name})

                elif kind == "on_tool_end":
                    yield _sse("tool_end", {"tool": name})
            final_state = await app.state.workflow.aget_state(config)
            values = final_state.values if final_state else {}
            last_msg = (
                values.get("messages", [])[-1] if values.get("messages") else None
            )
            full_text = getattr(last_msg, "content", "") if last_msg else ""

            await log_receptionist_turn(
                app,
                thread_id=req.threadId,
                agent_id=req.agentId,
                user_content=req.messages,
                assistant_content=full_text,
                export=values.get("export"),
                list_block=values.get("list_block"),
            )

            yield _sse(
                "done",
                {
                    "response": full_text,
                    "export": values.get("export"),
                    "listBlock": values.get("list_block"),
                },
            )
        except Exception as e:
            yield _sse("error", {"message": str(e)})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/receptionist/history")
async def receptionist_history(req: HistoryRequest):
    try:
        async with app.state.history_db_pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    SELECT role, content, export, list_block, created_at
                    FROM kaka_receptionist_messages
                    WHERE thread_id = %s
                    ORDER BY created_at ASC, id ASC
                    """,
                    (req.threadId,),
                )
                rows = await cur.fetchall()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load history: {str(e)}")

    out = []
    for role, content, export, list_block, created_at in rows:
        if role == "user":
            out.append({"role": "user", "content": content})
        else:
            entry = {"role": "assistant", "content": content}
            if export:
                entry["export"] = export
            if list_block:
                entry["listBlock"] = list_block
            out.append(entry)
    return {"messages": out}
