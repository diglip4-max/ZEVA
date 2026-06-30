from datetime import datetime
import os
import re
from typing import Annotated, Literal, TypedDict
import httpx
from langchain_openai import ChatOpenAI
from fastapi import Depends, FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from langgraph.graph import END, START, StateGraph, add_messages
from langsmith import traceable
from pydantic import BaseModel, Field
from langchain_core.messages import (
    HumanMessage,
    AIMessage,
    BaseMessage,
    SystemMessage,
    ToolMessage,
    trim_messages,
)
from fastapi import Header
from urllib.parse import urlencode
import asyncio
from psycopg.rows import dict_row
from langchain_core.runnables import RunnableConfig
import redis.asyncio as aioredis
from contextlib import asynccontextmanager
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.prebuilt import ToolNode, tools_condition
from langchain_core.tools import tool
from faq import get_clinic_id, get_doctors_by_treatment, get_services, get_timings
from apt_reschedule import find_latest_appointment, reschedule_apt
from appointment import buildGraph, get_header
from fastapi.responses import JSONResponse
from psycopg import AsyncConnection
from contextvars import ContextVar
from prompts import prompt, LANGUAGE_RULE
from scenario_keys import SCENARIO_KEYS
from scenario_tagging_prompt import SCENARIO_TAGGING_PROMPT
from clinic_context import fetch_clinic_id
from response_resolver import (
    resolve_response,
    preview_rewrite,
    preview_style_only_rewrite,
)
import templates_db as db
from scenario_keys import BEHAVIOR_STYLES, DEFAULT_BEHAVIOR_STYLE

load_dotenv()

ScenarioKeyLiteral = Literal[tuple(SCENARIO_KEYS)]


class KakaResponse(BaseModel):
    scenario_key: ScenarioKeyLiteral = Field(
        description="The scenario this reply belongs to."
    )
    message: str = Field(
        description="The reply text, copied exactly as given, unedited."
    )


clinic_token_var: ContextVar[str] = ContextVar("clinic_token")
conversation_id_var: ContextVar[str] = ContextVar("conversation_id")
clinic_name_var: ContextVar[str] = ContextVar("clinic_name")
redis_client: aioredis.Redis = None
AGENT_URL = os.getenv("NEXT_PUBLIC_BASE_URL")

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
tagging_llm = llm.with_structured_output(KakaResponse)


def get_context(config: RunnableConfig) -> tuple[str, str]:
    configurable = config.get("configurable", {}) if config else {}
    conversation_id = configurable.get("conversation_id") or conversation_id_var.get("")
    clinic_token = configurable.get("clinic_token") or clinic_token_var.get("")
    return conversation_id, clinic_token


@asynccontextmanager
async def lifespan(app: FastAPI):
    global redis_client
    redis_client = aioredis.from_url(
        os.getenv("REDIS_URL"), encoding="utf-8", decode_responses=True, protocol=2
    )
    checkpointer_conn = await AsyncConnection.connect(
        os.getenv("DATABASE_URL"), autocommit=True, prepare_threshold=None
    )
    await checkpointer_conn.set_autocommit(True)
    checkpointer = AsyncPostgresSaver(checkpointer_conn)
    await checkpointer.setup()
    app.state.workflow = build_workflow(checkpointer)

    dashboard_conn = await AsyncConnection.connect(
        os.getenv("DATABASE_URL"), autocommit=True, prepare_threshold=None
    )
    await dashboard_conn.set_autocommit(True)
    app.state.db_conn = dashboard_conn

    yield
    await redis_client.aclose()
    await checkpointer_conn.close()
    await dashboard_conn.close()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[f"{AGENT_URL}", "https://zeva360.com", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ────────────────────────── State & Request Models ───────────────────────────


class ChatState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    scenario_key: str
    final_message: str


class ChatRequest(BaseModel):
    messages: str
    threadId: str
    clinicToken: str
    conversation_id: str
    channel: str = "web"


class BookingPayload(BaseModel):
    patient_name: str = ""
    doctor_name: str
    treatment_name: str
    startDate: str
    fromTime: str


class RescheduleSchema(BaseModel):
    startDate: str
    fromTime: str


class StoreTokenRequest(BaseModel):
    clinicId: str
    token: str


class GetTokenRequest(BaseModel):
    clinicId: str


class TemplateUpsertRequest(BaseModel):
    scenario_key: str
    template_text: str
    is_enabled: bool = True
    updated_by: str | None = None


class TemplateEnableRequest(BaseModel):
    is_enabled: bool
    updated_by: str | None = None


class BehaviorStyleRequest(BaseModel):
    behavior_style: str
    updated_by: str | None = None


class TemplatePreviewRequest(BaseModel):
    scenario_key: str
    template_text: str | None = None
    behavior_style: str
    sample_message: str | None = None


SAMPLE_MESSAGES = {
    "greeting": "Welcome! I'm KAKA, your appointment assistant. What can I help you with today?",
    "booking_success": "🎉 Your appointment is confirmed!\n\nWe'll see you on 05-07-2026 at 14:30 with Dr. Preet.",
    "booking_failed": "Something went wrong on my end and the booking didn't go through. Please try again in a moment.",
    "reschedule_success": "Done! Your appointment has been rescheduled. ✅\n\nPrevious details:\n- Date: 01-07-2026\n- Time: 10:00\n\nNew details:\n- Date: 05-07-2026\n- Time: 15:00\n- Doctor: Preet",
    "off_topic": "I'm KAKA — I'm specifically here to help with clinic appointments and clinic information.",
}
DEFAULT_SAMPLE = (
    "Your request has been handled. Is there anything else I can help you with?"
)


async def resolve_clinic_id_or_401(clinicToken: str) -> str:
    clinic_id = await get_clinic_id_cached(clinicToken)
    if not clinic_id:
        raise HTTPException(
            status_code=401, detail="Invalid or unrecognized clinicToken."
        )
    return clinic_id


def format_for_whatsapp(text: str) -> str:
    for marker in [
        "DOCTORS_LIST_START",
        "DOCTORS_LIST_END",
        "SERVICES_SUMMARY_START",
        "SERVICES_SUMMARY_END",
        "SERVICES_DETAIL_START",
        "SERVICES_DETAIL_END",
        "BOOKING_CONFIRM",
        "APT_DETAILS",
        "TIMINGS_START",
        "TIMINGS_END",
    ]:
        text = text.replace(marker, "")

    SCHEDULER_LINK_RE = re.compile(
        r"🔗\s*(?:"
        r"SCHEDULER_LINK:\s*(?:\[.*?\]\((\S+?)\)|(\S+))"
        r"|"
        r"\[SCHEDULER_LINK\]\((\S+?)\)"
        r"|\[.*?\]\((\S+?)\)"
        r")"
    )

    def _sched_sub(m: re.Match) -> str:
        url = m.group(1) or m.group(2) or m.group(3) or m.group(4)
        return f"\n📅 *Book online*\n{url}\n" if url else m.group(0)

    text = SCHEDULER_LINK_RE.sub(_sched_sub, text)

    lines = text.split("\n")
    result = []

    for line in lines:
        stripped = line.strip()

        if not stripped:
            result.append("")
            continue

        if re.match(
            r"^(\|?\s*)[\*_]?Day[\*_]?\s*[\|,]?\s*(Status|Opening|Closing)",
            stripped,
            re.I,
        ):
            continue

        if re.match(r"^\|[\s\-\|:]+\|$", stripped):
            continue

        timings_row = re.match(
            r"^\|\s*(\w+)\s*\|\s*(Open|Closed)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|$",
            stripped,
            re.I,
        )
        if timings_row:
            day, status, opens, closes = timings_row.groups()
            if status.lower() == "open":
                result.append(f"*{day}:* {opens} – {closes}")
            else:
                result.append(f"*{day}:* _Closed_")
            continue

        already_fmt = re.match(r"^\*(\w+)\*:\s*(Open,\s*)?(.+?\s*[–-]\s*.+)$", stripped)
        if already_fmt:
            day = already_fmt.group(1)
            hours = already_fmt.group(3).strip()
            result.append(f"*{day}:* {hours}")
            continue

        plain_timing = re.match(
            r"^(\w+)\s+(Open|Closed)\s+([\d:APM]+(?:\s*[APM]+)?)\s+([\d:APM]+(?:\s*[APM]+)?)$",
            stripped,
            re.I,
        )
        if plain_timing:
            day, status, opens, closes = plain_timing.groups()
            DAYS = {
                "monday",
                "tuesday",
                "wednesday",
                "thursday",
                "friday",
                "saturday",
                "sunday",
            }
            if day.lower() in DAYS:
                if status.lower() == "open":
                    result.append(f"*{day}:* {opens} – {closes}")
                else:
                    result.append(f"*{day}:* _Closed_")
                continue

        if stripped.startswith("|") and stripped.endswith("|"):
            cells = [c.strip() for c in stripped.split("|") if c.strip()]

            if all(re.match(r"^[-:]+$", c) for c in cells):
                continue
            if len(cells) == 2 and cells[0].lower() in ("day", "field"):
                continue
            if len(cells) == 2:
                result.append(f"› *{cells[0]}:* {cells[1]}")
            else:
                result.append(
                    "  ".join(
                        f"*{cell}*" if idx == 0 else cell
                        for idx, cell in enumerate(cells)
                    )
                )
            continue

        line_out = re.sub(r"\*\*(.+?)\*\*", r"*\1*", stripped)

        if re.match(r"^\*(Previous details|New details):\*$", stripped):
            result.append("")
            result.append(stripped)
            continue

        if re.match(r"^\*[A-Z][^*]+\*$", line_out):
            result.append("")
            result.append(line_out)
            result.append("─" * 22)
            continue

        doc_match = re.match(r"^-\s*(.+?)\s*[—-]\s*(.+)$", line_out)
        if doc_match:
            result.append(f"👨‍⚕️ *{doc_match.group(1).strip()}*")
            result.append(f"   _{doc_match.group(2).strip()}_")
            continue

        svc_summary = re.match(r"^-\s*(.+?)\s*\|\s*(\d+)$", stripped)
        if svc_summary:
            result.append(
                f"  🏥 *{svc_summary.group(1).strip()}*"
                f" — {svc_summary.group(2)} treatments"
            )
            continue

        svc_detail = re.match(
            r"^-\s*(.+?)\s*\|\s*(₹[\d,]+|[\d,]+)\s*\|\s*(\d+\s*min)",
            stripped,
            re.I,
        )
        if svc_detail:
            name = svc_detail.group(1).strip()
            price = svc_detail.group(2).strip()
            dur = svc_detail.group(3).strip()
            price = price if price.startswith("₹") else f"₹{price}"
            result.append(f"  • *{name}*")
            result.append(f"    💰 {price}  ⏱ {dur}")
            continue

        bullet_match = re.match(r"^[-•]\s+(.+)$", line_out)
        if bullet_match:
            result.append(f"  • {bullet_match.group(1)}")
            continue

        result.append(line_out)

    cleaned = re.sub(r"\n{3,}", "\n\n", "\n".join(result))
    return cleaned.strip()


def normalize_doctor_name(name: str) -> str:
    cleaned = re.sub(
        r"^(dr\.?|prof\.?|mr\.?|mrs\.?|ms\.?)\s+",
        "",
        name.strip(),
        flags=re.IGNORECASE,
    )
    return cleaned.strip()


def build_system_prompt():
    today = datetime.now().strftime("%d-%m-%Y")
    current_year = datetime.now().year
    clinic_name = clinic_name_var.get("")
    date_context = (
        f"TODAY'S DATE: {today}\n\n"
        f"If the user provides a date without a year (e.g. '15th June'), "
        f"assume year {current_year}. If that date has already passed this year, "
        f"use {current_year + 1}.\n\n"
    )
    platform_context = (
        f"PLATFORM CONTEXT:\n"
        f"You are deployed on ZEVA — a clinic management platform that powers appointment "
        f"booking, patient communication, and operations for clinics.\n"
        f"The clinic you are currently representing is: {clinic_name}\n"
        f"Always address patients on behalf of {clinic_name}, not ZEVA.\n"
        f"If a patient asks about ZEVA, you may briefly explain it is the platform "
        f"that powers this clinic's booking system — but keep focus on {clinic_name}.\n\n"
    )
    return (
        LANGUAGE_RULE
        + "\n\n"
        + platform_context
        + date_context
        + prompt.replace("ZEVA Clinic", clinic_name)
    )


async def fetch_patient_name(conversation_id: str, clinicToken: str):
    headers = get_header(clinicToken)
    async with httpx.AsyncClient() as client:
        page = 1
        while True:
            url = (
                f"{AGENT_URL}/api/messages/get-messages/"
                f"{conversation_id}?page={page}&limit=50"
            )
            resp = await client.get(url, headers=headers)
            data = resp.json()
            for d in data["data"]:
                for message in d["messages"]:
                    recipient = message.get("recipientId")
                    if recipient and recipient.get("name"):
                        return recipient["name"]
            if not data["pagination"]["hasMore"]:
                break
            page += 1
    return None


async def fetch_patient_MobNumber(conversation_id: str, clinicToken: str):
    headers = get_header(clinicToken)
    async with httpx.AsyncClient() as client:
        page = 1
        while True:
            url = (
                f"{AGENT_URL}/api/messages/get-messages/"
                f"{conversation_id}?page={page}&limit=50"
            )
            resp = await client.get(url, headers=headers)
            data = resp.json()
            for d in data["data"]:
                for message in d["messages"]:
                    recipient = message.get("recipientId")
                    if recipient and recipient.get("phone"):
                        return recipient["phone"]
            if not data["pagination"]["hasMore"]:
                break
            page += 1
    return None


@traceable
async def fetch_clinic_name(clinicToken: str) -> str:
    cache_key = f"clinic_name:{clinicToken}"
    cached = await redis_client.get(cache_key)
    if cached:
        return cached
    try:
        header = get_header(clinicToken)
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{AGENT_URL}/api/clinics/myallClinic", headers=header
            )
            data = resp.json()
            name = data.get("clinic", {}).get("name") or "the clinic"
            await redis_client.setex(cache_key, 3600, name)  # 1hr TTL
            return name
    except Exception:
        return "the clinic"


@tool
@traceable
async def get_patient_name(config: RunnableConfig):
    """Use This tool to fetch patient name everytime when user wants to book an appointment."""
    conversation_id, clinicToken = get_context(config)
    name = await fetch_patient_name(conversation_id, clinicToken)
    if name:
        return {"patient_name": name}
    return {"Status": "Error", "Message": "No patient name found."}


@tool("fetch_scheduler_link_tool")
@traceable
async def fetch_scheduler_link_tool(config: RunnableConfig) -> dict:
    """Fetches the online booking scheduler link for the clinic.

    Call this tool IMMEDIATELY when the user expresses intent to book an appointment,
    BEFORE asking for any appointment details. Return the link alongside the
    date/time/treatment question so the user has both options.
    """
    _, clinicToken = get_context(config)
    header = get_header(clinicToken)
    url = f"{AGENT_URL}/api/clinics/myallClinic"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=header)
        data = resp.json()
        clinic_id = data.get("clinic", {}).get("_id")
        if not clinic_id:
            return {"Status": "Error", "Message": "Could not retrieve clinic info."}
        scheduler_link = (
            f"https://zeva360.com/clinic/appointment-booking?clinicId={clinic_id}"
        )
        return {"scheduler_link": scheduler_link}


async def get_scheduler_link(clinicToken: str) -> str | None:
    """Fetches the clinic's booking scheduler link directly (no tool-call
    judgment involved). Returns None if the clinic id can't be resolved."""
    header = get_header(clinicToken)
    url = f"{AGENT_URL}/api/clinics/myallClinic"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=header)
        data = resp.json()
        clinic_id = data.get("clinic", {}).get("_id")
        if not clinic_id:
            return None
        return f"https://zeva360.com/clinic/appointment-booking?clinicId={clinic_id}"


def _has_scheduler_link(text: str) -> bool:
    """True if a scheduler link is already present in the message — covers
    both the raw '🔗 SCHEDULER_LINK:' marker (pre-WhatsApp-formatting) and a
    bare appointment-booking URL, so we never double-append."""
    if "SCHEDULER_LINK:" in text:
        return True
    if "appointment-booking?clinicId=" in text:
        return True
    return False


async def ensure_scheduler_link(content: str, clinicToken: str) -> str:
    """Guarantees a scheduler link is present in `content`. If one is already
    there (LLM called the tool, or a template's {link} slot already filled
    it in), leaves content untouched. Otherwise fetches the link directly
    and appends it in the same '🔗 SCHEDULER_LINK:' format the rest of the
    pipeline (format_for_whatsapp, clinic templates' {link} slot) already
    expects, so nothing downstream needs to change."""
    if _has_scheduler_link(content):
        return content
    try:
        link = await get_scheduler_link(clinicToken)
    except Exception as e:
        print(f"[ensure_scheduler_link] fetch failed: {type(e).__name__}: {e}")
        return content
    if not link:
        return content
    separator = "\n\n" if content and not content.endswith("\n") else "\n"
    return f"{content}{separator}🔗 SCHEDULER_LINK: [Book Appointment]({link})"


@tool
@traceable
async def find_doctors_for_treatment(
    treatment_name: str = "", config: RunnableConfig = None
) -> str:
    """
    Finds doctors who perform a SPECIFIC named treatment.

    ⚠ Requires a real, specific treatment name from the patient.
    Do NOT call this with an empty string, a guess, or a generic
    request like "show all doctors" / "which doctors are available"
    with no treatment specified — if the patient hasn't named a
    treatment yet, ASK THEM first ("Which treatment or service are
    you looking for?") and wait for their reply. Do not call this tool
    in the same turn you ask that question.

    WHEN NOT TO CALL: user wants to book (use book_appointment instead),
    or user hasn't named any treatment yet (ask first, don't guess).
    """
    if not treatment_name or not treatment_name.strip():
        return (
            "Status: NEEDS_INPUT — no treatment name was provided. "
            "Ask the patient which treatment or service they're looking "
            "for, then call this tool again once they answer. Do not retry "
            "this call with a guessed or empty value."
        )
    _, clinicToken = get_context(config)
    clinic_id = await get_clinic_id(clinicToken)
    result = await get_doctors_by_treatment(treatment_name, clinicToken, clinic_id)
    if result["status"] == "success":
        names = [d["doctor_name"] for d in result["doctors"]]
        return f"Doctors available for '{treatment_name}': {', '.join(names)}"
    elif result["status"] == "not_found":
        treatments = result.get("available_treatments", [])
        return (
            f"No doctors found for '{treatment_name}'. "
            f"Available treatments are: {', '.join(treatments)}"
        )
    return result.get("message", "Could not fetch doctor information.")


@tool("get_clinic_services_tool")
@traceable
async def get_clinic_services_tool(config: RunnableConfig) -> dict:
    """Fetches all active services/treatments offered by the clinic."""
    _, clinicToken = get_context(config)
    return await get_services(clinicToken)


@tool("book_appointment", args_schema=BookingPayload)
@traceable
async def book_appointment(
    patient_name: str,
    startDate: str,
    fromTime: str,
    doctor_name: str,
    treatment_name: str,
    config: RunnableConfig = None,
):
    """Books a clinic appointment for a patient.

    ⚠️ HARD REQUIREMENT — DO NOT CALL THIS TOOL UNTIL:
    1. You have already shown the patient a BOOKING_CONFIRM markdown table
       with Treatment, Doctor, Date, Time in a PREVIOUS turn, AND
    2. The patient has explicitly replied with confirmation
       ("yes", "confirm", "correct", etc.) in their MOST RECENT message.

    treatment_name MUST be the exact treatment name as it exists in the
    clinic's database — not the patient's wording. Before calling this tool:

    1. Call get_clinic_services_tool to fetch the real list of treatment names.
    2. Match the patient's wording to the closest real treatment name yourself
       (handle typos, singular/plural, partial names, synonyms — e.g. patient
       says "body filler", DB has "Body Fillers" → use "Body Fillers").
    3. Pass the EXACT DB name as treatment_name, never the patient's raw words.

    If no real treatment is a reasonable match, do not guess — ask the patient
    to clarify or pick from the list instead of calling this tool with a
    fabricated name.

    patient_name — REQUIRED, never leave blank and never omit.
      - If the patient is booking for THEMSELVES (e.g. "book an appointment",
        "I want to book", no other person named) → pass the exact literal
        string "self". Do NOT try to fetch or guess their real name yourself.
      - If the patient named anyone else (a friend, family member, etc. —
        e.g. "book for James", "book my dad an appointment") → pass that
        person's name exactly as given/resolved, e.g. "James".
      - Never pass an empty string. If you are unsure whether they mean
        themselves or someone else, ask before calling this tool.

    doctor_name — Same rule applies: resolve to the exact name as it exists
              in the doctor list (via find_doctors_for_treatment or
              clinic doctor data), not the patient's phrasing.
              ⚠ Never pass placeholder values like "any available doctor",
              "anyone", "whoever's free", etc. If the patient hasn't named
              a real doctor yet, call find_doctors_for_treatment first and
              ask them to choose from the real list — do not call this
              tool until a real doctor name is selected.
    Before calling this tool:
    - Collect all required fields
    - Resolve treatment_name and doctor_name against real data as above
    - If booking for someone else, collect THEIR name explicitly
    - Never guess or fabricate any fieldver guess or fabricate any field
    """
    missing = []
    if not patient_name or not patient_name.strip():
        missing.append("patient name (pass 'self' if booking for the requester)")
    if not doctor_name or not doctor_name.strip():
        missing.append("doctor name")
    if not treatment_name or not treatment_name.strip():
        missing.append("treatment name")
    if not startDate or not startDate.strip():
        missing.append("appointment date")
    if not fromTime or not fromTime.strip():
        missing.append("appointment time")
    if missing:
        return {
            "Status": "Fields Are Missing",
            "Message": f"Cannot book — missing: {', '.join(missing)}. Please collect these from the patient first.",
        }

    try:
        conversation_id, clinicToken = get_context(config)
        provided_name = patient_name.strip()

        if provided_name.lower() == "self":
            resolved_name, patient_phone = await asyncio.gather(
                fetch_patient_name(
                    conversation_id=conversation_id, clinicToken=clinicToken
                ),
                fetch_patient_MobNumber(
                    conversation_id=conversation_id, clinicToken=clinicToken
                ),
            )
            resolved_name = resolved_name or ""
            patient_phone = patient_phone or ""
        else:
            resolved_name = provided_name
            patient_phone = (
                await fetch_patient_MobNumber(
                    conversation_id=conversation_id, clinicToken=clinicToken
                )
                or ""
            )

        if not resolved_name:
            return {
                "Status": "Error",
                "Message": "Could not determine patient name. Please ask the patient for their name.",
            }

        doctor_name = normalize_doctor_name(doctor_name)
        payload = {
            "patient_name": resolved_name,
            "patient_phone": patient_phone,
            "doctor_name": doctor_name,
            "treatment_name": treatment_name,
            "startDate": startDate,
            "fromTime": fromTime,
        }
        payload_date = datetime.strptime(payload["startDate"], "%d-%m-%Y").strftime(
            "%Y-%m-%d"
        )
        apts = await find_latest_appointment(
            conversation_id=conversation_id,
            clinicToken=clinicToken,
        )
        if apts.get("Status") == "Error":
            all_apts = []
        else:
            all_apts = apts.get("all_apt", [])
        for a in all_apts:
            existing_date = a.get("startDate", "")[:10]
            if existing_date == payload_date and a.get("fromTime") == payload.get(
                "fromTime"
            ):
                return {"Status": "Error", "Message": "This slot is already booked"}
        workflow, initial_state = buildGraph(clinicToken, payload)
        response = await workflow.ainvoke(initial_state)
        return {
            "Status": response.get("Status", "Error"),
            "Message": response.get("Message")
            or response.get("errorMessage", "Something went wrong."),
        }
    except Exception as e:
        return {"Status": "Error", "Message": f"Booking failed: {str(e)}"}


@tool("get_appointment_details_tool")
@traceable
async def get_appointment_details_tool(config: RunnableConfig) -> dict:
    """Fetches current appointment details before rescheduling."""
    conversation_id, clinicToken = get_context(config)
    if not clinicToken:
        return {"Status": "Error", "Message": "Missing clinic token."}
    if not conversation_id:
        return {"Status": "Error", "Message": "Missing conversation ID."}
    try:
        apt = await find_latest_appointment(
            conversation_id=conversation_id,
            clinicToken=clinicToken,
        )
    except Exception as e:
        return {"Status": "Error", "Message": f"Failed to fetch appointment: {str(e)}"}
    if apt.get("Status") == "Error":
        return apt
    apt_details = apt.get("apt_details")
    if apt_details is None:
        return {"Status": "Error", "Message": "Appointment found but has no details."}
    return {
        "patient_name": apt_details.get("patientName")
        or apt_details.get("patient_name", ""),
        "doctor_name": apt_details.get("doctorName")
        or apt_details.get("doctor_name", ""),
        "treatment_name": apt_details.get("treatment_names")
        or apt_details.get("treatment_name", ""),
        "original_date": apt_details.get("startDate", "")[:10],
        "original_time": apt_details.get("fromTime", ""),
        "status": apt_details.get("status", ""),
    }


@tool("reschedule_appointment", args_schema=RescheduleSchema)
async def reschedule_appointment(
    startDate: str,
    fromTime: str,
    config: RunnableConfig = None,
) -> dict:
    """Reschedules an existing appointment.

    Use this tool when the user wants to reschedule an appointment:
    - startDate: the new appointment date (DD-MM-YYYY)
    - fromTime: the new appointment time (HH:MM, 12-hour format)

    Do NOT call this tool if any of these fields are missing.
    """
    conversation_id, clinicToken = get_context(config)
    return await reschedule_apt(
        clinicToken=clinicToken,
        conversation_id=conversation_id,
        startDate=startDate,
        fromTime=fromTime,
    )


@tool("get_clinic_timings_tool")
async def get_clinic_timings_tool(config: RunnableConfig) -> dict:
    """Fetches the clinic's operating hours for each day of the week.

    Call this tool when the user asks:
    - What are your hours?
    - When are you open?
    - Are you open on Sunday?
    - What time do you close?
    - Clinic timings / working hours

    Returns a pre-formatted table string in 'formatted_table'.
    Wrap this EXACT string with TIMINGS_START and TIMINGS_END —
    do not retype, reformat, or recalculate it.
    """
    _, clinicToken = get_context(config)
    result = await get_timings(clinicToken)
    timings = result.get("timings", [])
    day_order = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
    ]
    by_day = {t["day"]: t for t in timings}
    rows = [
        "| Day | Status | Opening | Closing |",
        "|-----|--------|---------|---------|",
    ]
    for day in day_order:
        t = by_day.get(day)
        if t and t.get("isOpen"):
            rows.append(f"| {day} | Open | {t['openingTime']} | {t['closingTime']} |")
        else:
            rows.append(f"| {day} | Closed | - | - |")
    formatted_table = "\n".join(rows)
    result["formatted_table"] = formatted_table
    return result





tools = [
    book_appointment,
    reschedule_appointment,
    get_appointment_details_tool,
    get_patient_name,
    fetch_scheduler_link_tool,
    find_doctors_for_treatment,
    get_clinic_services_tool,
    get_clinic_timings_tool,
]
agent = llm.bind_tools(tools)

MAX_TOKENS = 2000


def build_workflow(checkpointer):
    async def chat_node(state: ChatState):
        system_message = SystemMessage(content=build_system_prompt())
        trimmed = trim_messages(
            state["messages"],
            max_tokens=MAX_TOKENS,
            strategy="last",
            token_counter=llm,
            include_system=False,
            allow_partial=False,
            start_on=HumanMessage,
        )

        last = state["messages"][-1] if state["messages"] else None

        # ── Post-tool path: tools just ran, generate final reply then tag ──
        if isinstance(last, ToolMessage):
            response = await agent.ainvoke([system_message] + trimmed)
            if not response.tool_calls:
                patient_text = next(
                    (
                        m.content
                        for m in reversed(state["messages"])
                        if isinstance(m, HumanMessage)
                    ),
                    "",
                )
                print(
                    f"[tagging post-tool] patient='{patient_text[:60]}' | kaka='{response.content[:60]}'"
                )
                result = await tagging_llm.ainvoke(
                    [
                        SystemMessage(content=SCENARIO_TAGGING_PROMPT),
                        HumanMessage(
                            content=f"[Patient said]: {patient_text}\n\n[KAKA replied]: {response.content}"
                        ),
                    ]
                )
                return {
                    "messages": [response],
                    "scenario_key": result.scenario_key,
                    "final_message": result.message,
                }
            return {"messages": [response]}

        response = await agent.ainvoke([system_message] + trimmed)

        if not response.tool_calls:
            patient_text = next(
                (
                    m.content
                    for m in reversed(state["messages"])
                    if isinstance(m, HumanMessage)
                ),
                "",
            )
            print(
                f"[tagging direct] patient='{patient_text[:60]}' | kaka='{response.content[:60]}'"
            )
            result = await tagging_llm.ainvoke(
                [
                    SystemMessage(content=SCENARIO_TAGGING_PROMPT),
                    HumanMessage(
                        content=f"[Patient said]: {patient_text}\n\n[KAKA replied]: {response.content}"
                    ),
                ]
            )
            return {
                "messages": [response],
                "scenario_key": result.scenario_key,
                "final_message": result.message,
            }

        # ── Has tool calls → route to tools ──
        return {"messages": [response], "scenario_key": "", "final_message": ""}

    def route_after_chat(state: ChatState):
        last = state["messages"][-1]
        if isinstance(last, AIMessage) and last.tool_calls:
            return "tools"
        return END

    graph = StateGraph(ChatState)
    graph.add_node("chat", chat_node)
    graph.add_node("tools", ToolNode(tools))
    graph.add_edge(START, "chat")
    graph.add_conditional_edges("chat", route_after_chat, {"tools": "tools", END: END})
    graph.add_edge("tools", "chat")
    return graph.compile(checkpointer=checkpointer)


async def get_clinic_id_cached(clinicToken: str) -> str | None:
    cache_key = f"clinic_id:{clinicToken}"
    cached = await redis_client.get(cache_key)
    if cached:
        return cached
    clinic_id = await fetch_clinic_id(clinicToken, get_header)
    if clinic_id:
        await redis_client.setex(cache_key, 900, clinic_id)  # 15min TTL
    return clinic_id


async def get_clinic_token(authorization: str = Header(...)) -> str:
    """Extracts the bearer token from the Authorization header.
    Replaces the old `clinicToken` query param everywhere on the dashboard
    and analytics routes."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Missing or malformed Authorization header. Expected 'Bearer <clinicToken>'.",
        )
    token = authorization[len("Bearer ") :].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Empty clinic token.")
    return token


@app.post("/chat")
async def chat(req: ChatRequest):
    clinic_token_var.set(req.clinicToken)
    conversation_id_var.set(req.conversation_id)
    clinic_name = await fetch_clinic_name(req.clinicToken)
    clinic_name_var.set(clinic_name)
    config = {
        "configurable": {
            "thread_id": req.threadId,
            "conversation_id": req.conversation_id,
            "clinic_token": req.clinicToken,
        }
    }
    if req.channel == "whatsapp":
        user_content = f"[channel:whatsapp]\n\n{req.messages}"
    else:
        user_content = f"[channel:web]\n\n{req.messages}"

    response = await app.state.workflow.ainvoke(
        {"messages": HumanMessage(content=user_content)},
        config=config,
    )

    scenario_key = response.get("scenario_key", "")
    content = response.get("final_message", "")
    if not content:
        last_msg = response["messages"][-1]
        content = last_msg.content

    clinic_id = await get_clinic_id_cached(req.clinicToken)

    if scenario_key == "booking_opening":
        content = await ensure_scheduler_link(content, req.clinicToken)

    if clinic_id and scenario_key:
        try:
            async with app.state.db_conn.cursor() as cur:
                await cur.execute(
                    """
                INSERT INTO kaka_events (thread_id, clinic_id, scenario_key, channel)
                VALUES (%s, %s, %s, %s)
                """,
                    (req.conversation_id, clinic_id, scenario_key, req.channel),
                )
        except Exception as e:
            print(f"[analytics] Failed to log kaka_event: {e}")

    if clinic_id and scenario_key:
        content = await resolve_response(
            conn=app.state.db_conn,
            clinic_id=clinic_id,
            scenario_key=scenario_key,
            kaka_message=content,
        )

    if content and req.channel == "whatsapp":
        content = format_for_whatsapp(content)

    last_msg = response["messages"][-1] if response.get("messages") else None
    usage = getattr(last_msg, "usage_metadata", None) if last_msg else None
    if usage:
        print(
            f"[tokens] input={usage.get('input_tokens')} "
            f"cached={usage.get('input_token_details', {}).get('cache_read', 0)} "
            f"output={usage.get('output_tokens')}"
        )

    return {"response": content, "scenario_key": scenario_key}


@app.post("/store-token")
async def store_token(req: StoreTokenRequest, request: Request):
    secret = request.headers.get("X-Internal-Secret")
    if secret != os.getenv("INTERNAL_SECRET"):
        return JSONResponse(status_code=401, content={"error": "Unauthorized"})
    await redis_client.set(f"clinic_token:{req.clinicId}", req.token)
    print(f"✅ Token stored for clinic: {req.clinicId}")
    return {"message": "Token stored"}


@app.post("/get-token")
async def get_token(req: GetTokenRequest, request: Request):
    secret = request.headers.get("X-Internal-Secret")
    if secret != os.getenv("INTERNAL_SECRET"):
        return JSONResponse(status_code=401, content={"error": "Unauthorized"})
    token = await redis_client.get(f"clinic_token:{req.clinicId}")
    if not token:
        return JSONResponse(
            status_code=404,
            content={"error": "Token not found. Clinic must log in first."},
        )
    return {"token": token}


@app.get("/dashboard/scenarios")
async def list_scenarios(clinicToken: str = Depends(get_clinic_token)):
    clinic_id = await resolve_clinic_id_or_401(clinicToken)
    saved = await db.list_templates(app.state.db_conn, clinic_id)
    saved_by_key = {t.scenario_key: t.to_dict() for t in saved}
    result = []
    for key in SCENARIO_KEYS:
        if key in saved_by_key:
            result.append({**saved_by_key[key], "has_template": True})
        else:
            result.append(
                {
                    "scenario_key": key,
                    "has_template": False,
                    "template_text": None,
                    "is_enabled": False,
                    "clinic_id": clinic_id,
                }
            )
    return {"clinic_id": clinic_id, "scenarios": result}


@app.post("/dashboard/templates")
async def upsert_template_endpoint(
    req: TemplateUpsertRequest, clinicToken: str = Depends(get_clinic_token)
):
    clinic_id = await resolve_clinic_id_or_401(clinicToken)
    if req.scenario_key not in SCENARIO_KEYS:
        raise HTTPException(
            status_code=400, detail=f"Unknown scenario_key: {req.scenario_key}"
        )
    saved = await db.upsert_template(
        app.state.db_conn,
        clinic_id=clinic_id,
        scenario_key=req.scenario_key,
        template_text=req.template_text,
        is_enabled=req.is_enabled,
        updated_by=req.updated_by,
    )
    return saved.to_dict()


@app.patch("/dashboard/templates/{scenario_key}/enable")
async def set_template_enabled_endpoint(
    scenario_key: str,
    req: TemplateEnableRequest,
    clinicToken: str = Depends(get_clinic_token),
):
    clinic_id = await resolve_clinic_id_or_401(clinicToken)
    if scenario_key not in SCENARIO_KEYS:
        raise HTTPException(
            status_code=400, detail=f"Unknown scenario_key: {scenario_key}"
        )
    updated = await db.set_template_enabled(
        app.state.db_conn,
        clinic_id=clinic_id,
        scenario_key=scenario_key,
        is_enabled=req.is_enabled,
        updated_by=req.updated_by,
    )
    if updated is None:
        raise HTTPException(
            status_code=404,
            detail="No template exists for this scenario yet. Create one first.",
        )
    return updated.to_dict()


@app.delete("/dashboard/templates/{scenario_key}")
async def delete_template_endpoint(
    scenario_key: str, clinicToken: str = Depends(get_clinic_token)
):
    clinic_id = await resolve_clinic_id_or_401(clinicToken)
    deleted = await db.delete_template(app.state.db_conn, clinic_id, scenario_key)
    if not deleted:
        raise HTTPException(status_code=404, detail="No template found to delete.")
    return {"deleted": True, "scenario_key": scenario_key}


@app.get("/dashboard/behavior-style")
async def get_behavior_style_endpoint(clinicToken: str = Depends(get_clinic_token)):
    clinic_id = await resolve_clinic_id_or_401(clinicToken)
    style = await db.get_behavior_style(app.state.db_conn, clinic_id)
    return {"clinic_id": clinic_id, "behavior_style": style}


@app.post("/dashboard/behavior-style")
async def set_behavior_style_endpoint(
    req: BehaviorStyleRequest, clinicToken: str = Depends(get_clinic_token)
):
    clinic_id = await resolve_clinic_id_or_401(clinicToken)
    if req.behavior_style not in BEHAVIOR_STYLES:
        raise HTTPException(
            status_code=400, detail=f"Unknown behavior_style: {req.behavior_style}"
        )
    saved_style = await db.set_behavior_style(
        app.state.db_conn,
        clinic_id=clinic_id,
        behavior_style=req.behavior_style,
        updated_by=req.updated_by,
    )
    return {"clinic_id": clinic_id, "behavior_style": saved_style}


@app.post("/dashboard/templates/preview")
async def preview_template_endpoint(
    req: TemplatePreviewRequest, clinicToken: str = Depends(get_clinic_token)
):
    await resolve_clinic_id_or_401(clinicToken)
    if req.scenario_key not in SCENARIO_KEYS:
        raise HTTPException(
            status_code=400, detail=f"Unknown scenario_key: {req.scenario_key}"
        )
    if req.behavior_style not in BEHAVIOR_STYLES:
        raise HTTPException(
            status_code=400, detail=f"Unknown behavior_style: {req.behavior_style}"
        )
    sample = req.sample_message or SAMPLE_MESSAGES.get(req.scenario_key, DEFAULT_SAMPLE)
    has_template = bool(req.template_text and req.template_text.strip())
    if has_template:
        try:
            rewritten = await preview_rewrite(
                kaka_message=sample,
                template_text=req.template_text,
                behavior_style=req.behavior_style,
            )
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Preview rewrite failed: {e}")
        return {
            "scenario_key": req.scenario_key,
            "sample_message": sample,
            "preview_message": rewritten or sample,
            "mode": "template",
        }
    if req.behavior_style == DEFAULT_BEHAVIOR_STYLE:
        return {
            "scenario_key": req.scenario_key,
            "sample_message": sample,
            "preview_message": sample,
            "mode": "default_unchanged",
        }
    try:
        rewritten = await preview_style_only_rewrite(
            kaka_message=sample,
            behavior_style=req.behavior_style,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Preview rewrite failed: {e}")
    return {
        "scenario_key": req.scenario_key,
        "sample_message": sample,
        "preview_message": rewritten or sample,
        "mode": "style_only",
    }


def range_to_since_sql(range: str) -> str:
    if range == "today":
        return "(DATE_TRUNC('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')"
    return {
        "7d": "(now() - interval '7 days')",
        "30d": "(now() - interval '30 days')",
    }.get(range, "(now() - interval '30 days')")


@app.get("/analytics/summary")
async def analytics_summary(
    range: str = "30d",
    clinicToken: str = Depends(get_clinic_token),
):
    """
    Returns KPI counters:
      total_conversations, patients_addressed,
      bookings_completed, reschedules_completed,
      escalations_to_staff, channel_web, channel_whatsapp
    """
    clinic_id = await resolve_clinic_id_or_401(clinicToken)
    since_sql = range_to_since_sql(range)
    async with app.state.db_conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(
            f"""                                         
        SELECT                                          
          COUNT(*)                                                           AS ai_interactions,
          COUNT(DISTINCT thread_id)                                         
            FILTER (WHERE scenario_key NOT IN ('greeting','off_topic'))     AS patients_addressed,                                          
          COUNT(*) FILTER (WHERE scenario_key = 'booking_success')          AS bookings_completed,                                          
          COUNT(*) FILTER (WHERE scenario_key = 'reschedule_success')       AS reschedules_completed,                                           
          COUNT(*) FILTER (WHERE scenario_key = 'escalation')               AS escalations_to_staff,                                        
          COUNT(*) FILTER (WHERE channel = 'web')                           AS channel_web,                                         
          COUNT(*) FILTER (WHERE channel = 'whatsapp')                      AS channel_whatsapp                                         
        FROM kaka_events                                        
        WHERE clinic_id = %s                                        
          AND created_at >= {since_sql}                                       
        """,
            (clinic_id,),
        )
        rows = await cur.fetchall()

    row = rows[0] if rows else {}
    return {
        "ai_interactions": row.get("ai_interactions", 0),
        "patients_addressed": row.get("patients_addressed", 0),
        "bookings_completed": row.get("bookings_completed", 0),
        "reschedules_completed": row.get("reschedules_completed", 0),
        "escalations_to_staff": row.get("escalations_to_staff", 0),
        "channel_web": row.get("channel_web", 0),
        "channel_whatsapp": row.get("channel_whatsapp", 0),
    }


@app.get("/analytics/daily")
async def analytics_daily(
    range: str = "30d", clinicToken: str = Depends(get_clinic_token)
):
    """
    Returns daily time-series for the conversations line chart.
    Each row: { date, conversations, bookings, reschedules, escalations }
    """
    clinic_id = await resolve_clinic_id_or_401(clinicToken)
    since_sql = range_to_since_sql(range)

    async with app.state.db_conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(
            f"""                                         
        SELECT                                          
          DATE(created_at AT TIME ZONE 'Asia/Kolkata')                      AS date,                                        
          COUNT(DISTINCT thread_id)                                         AS conversations,                                          
          COUNT(*) FILTER (WHERE scenario_key = 'booking_success')          AS bookings,                                        
          COUNT(*) FILTER (WHERE scenario_key = 'reschedule_success')       AS reschedules,                                         
          COUNT(*) FILTER (WHERE scenario_key = 'escalation')               AS escalations                                          
        FROM kaka_events                                        
        WHERE clinic_id = %s                                        
          AND created_at >= {since_sql}                                       
        GROUP BY DATE(created_at AT TIME ZONE 'Asia/Kolkata')                                           
        ORDER BY date ASC                                           
        """,
            (clinic_id,),
        )
        rows = await cur.fetchall()

    return {
        "data": [
            {
                "date": str(r["date"]),
                "conversations": r["conversations"],
                "bookings": r["bookings"],
                "reschedules": r["reschedules"],
                "escalations": r["escalations"],
            }
            for r in rows
        ]
    }


@app.get("/analytics/query-mix")
async def analytics_query_mix(
    clinicToken: str = Depends(get_clinic_token), range: str = "30d"
):
    """
    Returns share of each scenario_key as percentage for the donut chart.
    """
    clinic_id = await resolve_clinic_id_or_401(clinicToken)
    since_sql = range_to_since_sql(range)
    async with app.state.db_conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(
            f"""                                         
        SELECT                                          
          scenario_key,                                         
          COUNT(*) AS cnt                                           
        FROM kaka_events                                        
        WHERE clinic_id = %s                                        
          AND created_at >= {since_sql}                                           
        GROUP BY scenario_key                                           
        ORDER BY cnt DESC                                           
        """,
            (clinic_id,),
        )
        rows = await cur.fetchall()

    total = sum(r["cnt"] for r in rows) or 1
    return {
        "data": [
            {
                "scenario_key": r["scenario_key"],
                "count": r["cnt"],
                "percent": round(r["cnt"] / total * 100, 1),
            }
            for r in rows
        ]
    }


HOURS_IN_DAY = list(range(24))


@app.get("/analytics/peak-hours")
async def analytics_peak_hours(
    clinicToken: str = Depends(get_clinic_token), range: str = "30d"
):
    clinic_id = await resolve_clinic_id_or_401(clinicToken)
    since_sql = range_to_since_sql(range)

    async with app.state.db_conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(
            f"""                                         
            SELECT                                          
              EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Kolkata')::int AS hour,                                           
              COUNT(*) AS volume                                        
            FROM kaka_events                                        
            WHERE clinic_id = %s                                        
              AND created_at >= {since_sql}                                           
            GROUP BY hour                                           
            ORDER BY hour ASC                                           
            """,
            (clinic_id,),
        )
        rows = await cur.fetchall()

    by_hour = {r["hour"]: r["volume"] for r in rows}
    return {"data": [{"hour": h, "volume": by_hour.get(h, 0)} for h in HOURS_IN_DAY]}


@app.get("/analytics/weekly")
async def analytics_weekly(
    clinicToken: str = Depends(get_clinic_token), range: str = "30d"
):
    """
    Returns weekly aggregates for the bookings/reschedules bar chart.
    """
    clinic_id = await resolve_clinic_id_or_401(clinicToken)
    since_sql = range_to_since_sql(range)

    async with app.state.db_conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(
            f"""                                         
        SELECT                                          
          DATE_TRUNC('week', created_at AT TIME ZONE 'Asia/Kolkata')        AS week_start,                                          
          COUNT(*) FILTER (WHERE scenario_key = 'booking_success')          AS bookings,                                        
          COUNT(*) FILTER (WHERE scenario_key = 'reschedule_success')       AS reschedules                                          
        FROM kaka_events                                        
        WHERE clinic_id = %s                                        
          AND created_at >= {since_sql}                                            
        GROUP BY week_start                                         
        ORDER BY week_start ASC                                         
        """,
            (clinic_id,),
        )
        rows = await cur.fetchall()

    return {
        "data": [
            {
                "week": str(r["week_start"])[:10],
                "bookings": r["bookings"],
                "reschedules": r["reschedules"],
            }
            for r in rows
        ]
    }


@app.get("/analytics/day-detail")
async def analytics_day_detail(date: str, clinicToken: str = Depends(get_clinic_token)):
    """
    Returns full detail for a single IST calendar day.
    `date` must be in 'YYYY-MM-DD' format (e.g. '2026-06-25').

    Response shape:
      {
        "date": "2026-06-25",
        "total_conversations": int,
        "bookings_completed": int,
        "reschedules_completed": int,
        "escalations_to_staff": int,
        "channel_web": int,
        "channel_whatsapp": int,
        "hourly": [{ "hour": 0..23, "volume": int }, ...],
        "scenario_breakdown": [{ "scenario_key": str, "count": int, "percent": float }, ...]
      }
    """
    clinic_id = await resolve_clinic_id_or_401(clinicToken)

    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(
            status_code=400, detail="date must be in YYYY-MM-DD format."
        )

    day_bounds_sql = """
        (%(date)s::date AT TIME ZONE 'Asia/Kolkata') AS day_start,
        ((%(date)s::date + interval '1 day') AT TIME ZONE 'Asia/Kolkata') AS day_end
    """

    async with app.state.db_conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(
            f"""
            WITH bounds AS (SELECT {day_bounds_sql})
            SELECT
              COUNT(*)                                                           AS ai_interactions,
              COUNT(DISTINCT thread_id)                                          AS total_conversations,
              COUNT(*) FILTER (WHERE scenario_key = 'booking_success')          AS bookings_completed,
              COUNT(*) FILTER (WHERE scenario_key = 'reschedule_success')       AS reschedules_completed,
              COUNT(*) FILTER (WHERE scenario_key = 'escalation')               AS escalations_to_staff,
              COUNT(*) FILTER (WHERE channel = 'web')                           AS channel_web,
              COUNT(*) FILTER (WHERE channel = 'whatsapp')                      AS channel_whatsapp
            FROM kaka_events, bounds
            WHERE clinic_id = %(clinic_id)s
              AND created_at >= bounds.day_start
              AND created_at < bounds.day_end
            """,
            {"date": date, "clinic_id": clinic_id},
        )
        summary_rows = await cur.fetchall()
        summary_row = summary_rows[0] if summary_rows else {}

        await cur.execute(
            f"""
            WITH bounds AS (SELECT {day_bounds_sql})
            SELECT
              EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Kolkata')::int AS hour,
              COUNT(*) AS volume
            FROM kaka_events, bounds
            WHERE clinic_id = %(clinic_id)s
              AND created_at >= bounds.day_start
              AND created_at < bounds.day_end
            GROUP BY hour
            ORDER BY hour ASC
            """,
            {"date": date, "clinic_id": clinic_id},
        )
        hour_rows = await cur.fetchall()
        by_hour = {r["hour"]: r["volume"] for r in hour_rows}
        hourly = [{"hour": h, "volume": by_hour.get(h, 0)} for h in range(24)]

        await cur.execute(
            f"""
            WITH bounds AS (SELECT {day_bounds_sql})
            SELECT
              scenario_key,
              COUNT(*) AS cnt
            FROM kaka_events, bounds
            WHERE clinic_id = %(clinic_id)s
              AND created_at >= bounds.day_start
              AND created_at < bounds.day_end
            GROUP BY scenario_key
            ORDER BY cnt DESC
            """,
            {"date": date, "clinic_id": clinic_id},
        )
        scenario_rows = await cur.fetchall()

    total_scenario = sum(r["cnt"] for r in scenario_rows) or 1
    scenario_breakdown = [
        {
            "scenario_key": r["scenario_key"],
            "count": r["cnt"],
            "percent": round(r["cnt"] / total_scenario * 100, 1),
        }
        for r in scenario_rows
    ]

    return {
        "date": date,
        "ai_interactions": summary_row.get("ai_interactions", 0),
        "total_conversations": summary_row.get("total_conversations", 0),
        "bookings_completed": summary_row.get("bookings_completed", 0),
        "reschedules_completed": summary_row.get("reschedules_completed", 0),
        "escalations_to_staff": summary_row.get("escalations_to_staff", 0),
        "channel_web": summary_row.get("channel_web", 0),
        "channel_whatsapp": summary_row.get("channel_whatsapp", 0),
        "hourly": hourly,
        "scenario_breakdown": scenario_breakdown,
    }

