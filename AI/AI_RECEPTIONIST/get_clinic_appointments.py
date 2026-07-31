import os
import httpx
import logging
from datetime import datetime, timedelta
from typing import Optional

from shared.appointment import get_header
from shared.faq import get_all_doctors, get_clinic_id

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)
AGENT_URL = os.getenv("NEXT_PUBLIC_BASE_URL")

# ─── Display-mode thresholds ────────────────────────────────────────────────
WEEK_THRESHOLD = 100
PATIENT_THRESHOLD = 50
MONTH_YEAR_SPAN_DAYS = 27


# ─── Doctor name resolution ────────────────────────────────────────────────


async def resolve_doctor_id(doctor_name: str, clinicToken: str) -> dict:
    """
    Resolves a doctor's natural-language name to a doctorId using the
    existing get_all_doctors helper (already cached, already scoped to
    doctorStaff users used in booking).
    Returns {"doctorId": ..., "doctorName": ...} on a clean single match,
    or a {"Status": "Error", ...} dict on ambiguity / no match.
    """
    clinic_id = await get_clinic_id(clinicToken)
    doctors = await get_all_doctors(clinicToken, clinic_id)

    if not doctors:
        return {"Status": "Error", "Message": "No doctors found for this clinic."}

    name_lower = doctor_name.lower().replace("dr.", "").replace("dr", "").strip()
    matches = [d for d in doctors if name_lower in (d.get("name") or "").lower()]

    if len(matches) == 1:
        return {"doctorId": matches[0]["_id"], "doctorName": matches[0]["name"]}
    elif len(matches) > 1:
        return {
            "Status": "Error",
            "Message": "Multiple doctors matched that name. Please specify which one.",
            "candidates": [d["name"] for d in matches],
        }
    else:
        return {
            "Status": "Error",
            "Message": f"No doctor found matching '{doctor_name}'.",
            "available_doctors": [d["name"] for d in doctors],
        }


# ─── Date resolution ────────────────────────────────────────────────────────


def resolve_date_range(
    date_from: Optional[str],
    date_to: Optional[str],
    default_to_today: bool = True,
) -> tuple[Optional[str], Optional[str]]:
    """
    Both date_from and date_to are DD-MM-YYYY strings the LLM has already
    resolved from natural language against the date context it was given.
    No keyword handling here — that intelligence lives in the prompt.

    If neither date is given and default_to_today is False, returns
    (None, None) — meaning "no date filter at all", so the caller can
    omit fromDate/toDate entirely and search across all time. This is
    used for named-patient lookups, where "no date" means "search all
    of this patient's appointments," not "search today."
    """
    if not date_from and not date_to and not default_to_today:
        return None, None

    today = datetime.now().date()
    try:
        start = datetime.strptime(date_from, "%d-%m-%Y").date() if date_from else today
        end = datetime.strptime(date_to, "%d-%m-%Y").date() if date_to else start
        if end < start:
            start, end = end, start
        return start.isoformat(), end.isoformat()
    except ValueError:
        logger.warning(
            f"Unparseable dates '{date_from}'/'{date_to}', defaulting to today."
        )
        return today.isoformat(), today.isoformat()


def _span_days(date_from_iso: Optional[str], date_to_iso: Optional[str]) -> int:
    """Inclusive day span between two ISO (YYYY-MM-DD) date strings, or
    -1 if either is missing/unparseable (caller treats -1 as 'no bound',
    i.e. an all-time named-patient search)."""
    if not date_from_iso or not date_to_iso:
        return -1
    try:
        d1 = datetime.strptime(date_from_iso, "%Y-%m-%d")
        d2 = datetime.strptime(date_to_iso, "%Y-%m-%d")
    except ValueError:
        return -1
    return abs((d2 - d1).days) + 1


# ─── Structured summary + detail extraction ────────────────────────────────


def extract_appointment_item(apt: dict) -> dict:
    """
    Builds one structured list item for the expandable appointments UI:
    a flat `summary` (shown in the collapsed row) and a nested `detail`
    (shown on expand) — including per-service line items so multiple
    services on one appointment render as separate rows in the expanded
    view, rather than being flattened/lost.
    """
    services = apt.get("services") or []

    line_items = [
        {
            "label": s.get("name") or "Service",
            "columns": {
                "Qty": str(s.get("quantity", 1)),
                "Price": _format_price(s.get("clinicPrice") or s.get("price")),
            },
        }
        for s in services
        if isinstance(s, dict)
    ]

    if not line_items:
        # Fallback to the single serviceName field when no services[] array
        # is populated for this appointment.
        fallback_name = apt.get("serviceName")
        if fallback_name:
            line_items = [{"label": fallback_name, "columns": {}}]

    return {
        "id": apt.get("_id") or apt.get("visitId") or "",
        "summary": {
            "Patient": apt.get("patientName") or "Unknown",
            "Doctor": apt.get("doctorName") or "Unknown",
            "Status": apt.get("status") or "-",
            "Date": apt.get("registeredDate") or "-",
            "Time": apt.get("registeredTime") or "-",
        },
        "detail": {
            "fields": {
                "Phone": apt.get("patientNumber") or "-",
                "Room": apt.get("roomName") or "-",
                "EMR Number": apt.get("emrNumber") or "-",
                "Notes": apt.get("notes") or "-",
            },
            "lineItems": line_items,
        },
    }


def _format_price(value) -> str:
    if value is None or value == "":
        return "-"
    try:
        return f"\u20b9{float(value):,.0f}"
    except (TypeError, ValueError):
        return str(value)


def _build_reschedule_candidates(
    appointments: list[dict], patient_name: str, patient_phone: Optional[str]
) -> list[dict]:
    """Builds the narrowed candidate list for STAGE 4/reschedule_stage3 —
    small by construction (already filtered by patient + exact date +
    booked status upstream), so it's safe to send full details to the
    model."""
    candidates = []
    for i, apt in enumerate(appointments, start=1):
        apt_id = apt.get("_id") or apt.get("visitId") or ""
        if not apt_id:
            continue  # NEW — never surface a candidate staff can't select
        candidates.append(
            {
                "position": i,
                "appointment_id": apt_id,
                "patient_name": apt.get("patientName") or patient_name,
                "patient_phone": apt.get("patientNumber") or patient_phone or "",
                "doctor_name": apt.get("doctorName") or "",
                "current_date": apt.get("registeredDate") or "",
                "current_time": apt.get("fromTime") or "",
                "status": apt.get("status") or "booked",
            }
        )
    return candidates


# ─── Main tool ──────────────────────────────────────────────────────────────


ACTIVE_STATUSES = {"booked", "Rescheduled"}  # match your API's exact casing


def _build_status_counts(
    appointments: list[dict],
) -> dict[str, int]:
    counts: dict[str, int] = {}

    for appointment in appointments:
        status_value = str(appointment.get("status") or "").strip()

        if not status_value:
            continue

        counts[status_value] = counts.get(status_value, 0) + 1

    return counts


# get_clinic_appointments.py


async def fetch_appointments_tool(
    clinicToken: str,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    doctor_name: Optional[str] = None,
    status: Optional[str] = None,
    patient_name: Optional[str] = None,
    patient_phone: Optional[str] = None,
    page: int = 1,
    limit: int = 15,
    workflow_stage: str = "lookup",
) -> dict:

    if workflow_stage in ("reschedule_stage1", "reschedule_stage3"):
        if not (patient_name or "").strip() or not (patient_phone or "").strip():
            return {
                "Status": "NEEDS_INPUT",
                "Message": (
                    "Rescheduling requires both the patient's full name "
                    "and phone number to avoid matching the wrong person. "
                    "Please provide both."
                ),
            }

    headers = get_header(clinicToken)
    has_patient_identifier = bool((patient_name or "").strip()) or bool(
        (patient_phone or "").strip()
    )
    has_explicit_date = bool(date_from) or bool(date_to)
    default_to_today = has_explicit_date or not has_patient_identifier

    from_date_iso, to_date_iso = resolve_date_range(
        date_from, date_to, default_to_today=default_to_today
    )

    doctor_id = None
    resolved_doctor_name = None
    if doctor_name:
        resolved = await resolve_doctor_id(doctor_name, clinicToken)
        if "Status" in resolved:
            return resolved
        doctor_id = resolved["doctorId"]
        resolved_doctor_name = resolved["doctorName"]

    search_term = None
    if patient_name:
        search_term = patient_name.strip().split()[0]

    # Rescheduling stages always filter to booked only.
    effective_status = status
    if workflow_stage in ("reschedule_stage1", "reschedule_stage3"):
        effective_status = (
            None  # can't OR two statuses upstream — filter client-side instead
        )

    effective_limit = limit
    if workflow_stage == "reschedule_stage1":
        effective_limit = max(limit, PATIENT_THRESHOLD + 1)

    # NEW: a plain named-patient lookup (no reschedule flow, no explicit
    # status filter given) should default to only active appointments —
    # booked or Rescheduled — not Completed/Arrived/Cancelled etc.
    is_named_patient_lookup = (
        workflow_stage == "lookup" and has_patient_identifier and not has_explicit_date
    )
    request_status = effective_status  # what we send to the upstream API
    if is_named_patient_lookup and not status:
        # The upstream API only accepts a single status value per call
        # (see all-appointments.js: `if (status) query.status = status`),
        # so we can't ask it to filter to "booked OR Rescheduled" directly.
        # Fetch without a status filter and filter client-side instead.
        request_status = None

    params = {
        "fromDate": from_date_iso,
        "toDate": to_date_iso,
        "doctorId": doctor_id,
        "status": request_status,
        "search": search_term,
        "patientNumber": patient_phone,
        "page": page,
        "limit": effective_limit,
    }
    params = {k: v for k, v in params.items() if v is not None}

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(15.0)) as client:
            resp = await client.get(
                f"{AGENT_URL}/api/clinic/all-appointments",
                params=params,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as e:
        return {
            "Status": "Error",
            "Message": f"API returned {e.response.status_code}: {e.response.text}",
        }
    except Exception as e:
        return {"Status": "Error", "Message": f"Failed to fetch appointments: {e}"}

    if not data.get("success"):
        return {
            "Status": "Error",
            "Message": data.get("message", "Failed to fetch appointments"),
        }

    appointments = data.get("appointments", [])

    if is_named_patient_lookup:
        appointments = [
            a for a in appointments if (a.get("status") or "") in ACTIVE_STATUSES
        ]

    if workflow_stage in ("reschedule_stage1", "reschedule_stage3"):
        appointments = [
            a for a in appointments if (a.get("status") or "") in ACTIVE_STATUSES
        ]
        if patient_phone:
            target_phone = "".join(c for c in patient_phone if c.isdigit())
            appointments = [
                a
                for a in appointments
                if "".join(c for c in (a.get("patientNumber") or "") if c.isdigit())
                == target_phone
            ]

    total = len(appointments) if is_named_patient_lookup else data.get("total", 0)
    status_counts = (
        _build_status_counts(appointments)
        if is_named_patient_lookup
        else data.get("statusCounts", {})
    )
    filters_applied = {
        "date_from": date_from,
        "date_to": date_to,
        "doctor_name": resolved_doctor_name or doctor_name,
        "status": status,
        "patient_name": patient_name,
    }

    if not appointments:
        return {
            "Status": "Success",
            "Message": "No appointments found for the given filters.",
            "total": 0,
            "page": data.get("page", page),
            "total_pages": 0,
            "status_counts": {},
            "filters_applied": filters_applied,
            "display_mode": "summary_only",
        }

    span = _span_days(from_date_iso, to_date_iso)
    is_single_date = span == 1

    # STAGE 3 of reschedule flow
    if (
        workflow_stage == "reschedule_stage3"
        and has_patient_identifier
        and is_single_date
    ):
        candidates = _build_reschedule_candidates(
            appointments, patient_name or "", patient_phone
        )
        return {
            "Status": "Success",
            "total": total,
            "display_mode": "reschedule_candidates",
            "appointments": candidates,
        }

   
    if workflow_stage == "reschedule_stage1" and has_patient_identifier and span == -1:
        if total >= PATIENT_THRESHOLD:
            return {
                "Status": "Success",
                "total": total,
                "status_counts": status_counts,
                "filters_applied": filters_applied,
                "display_mode": "summary_only",
                "Message": (
                    f"{patient_name or 'This patient'} has {total} booked "
                    "appointments. Please provide the appointment date to "
                    "narrow the results."
                ),
            }
        list_block = {
            "kind": "appointments",
            "summaryColumns": ["Patient", "Doctor", "Status", "Date", "Time"],
            "items": [extract_appointment_item(a) for a in appointments],
        }
       
        candidates = _build_reschedule_candidates(
            appointments, patient_name or "", patient_phone
        )
        return {
            "Status": "Success",
            "total": total,
            "page": data.get("page", page),
            "total_pages": data.get("totalPages", 0),
            "status_counts": status_counts,
            "filters_applied": filters_applied,
            "display_mode": "accordion",
            "appointments": candidates,  # NEW — model-visible, positioned
            "_list_block": list_block,
        }
    
    if is_named_patient_lookup:
        list_block = {
            "kind": "appointments",
            "summaryColumns": ["Patient", "Doctor", "Status", "Date", "Time"],
            "items": [extract_appointment_item(a) for a in appointments],
        }
        return {
            "Status": "Success",
            "total": total,
            "status_counts": status_counts,
            "filters_applied": filters_applied,
            "display_mode": "accordion",
            "_list_block": list_block,
        }

    # General lookup: month/year span is unconditional summary_only.
    if span == -1 or span >= MONTH_YEAR_SPAN_DAYS:
        return {
            "Status": "Success",
            "total": data.get("total", 0),
            "page": data.get("page", page),
            "total_pages": data.get("totalPages", 0),
            "status_counts": data.get("statusCounts", {}),
            "filters_applied": filters_applied,
            "display_mode": "summary_only",
        }

    # Week/range or single-date lookup
    if data.get("total", 0) >= WEEK_THRESHOLD:
        return {
            "Status": "Success",
            "total": data.get("total", 0),
            "page": data.get("page", page),
            "total_pages": data.get("totalPages", 0),
            "status_counts": data.get("statusCounts", {}),
            "filters_applied": filters_applied,
            "display_mode": "summary_only",
        }

    list_block = {
        "kind": "appointments",
        "summaryColumns": ["Patient", "Doctor", "Status", "Date", "Time"],
        "items": [extract_appointment_item(a) for a in appointments],
    }

    return {
        "Status": "Success",
        "total": data.get("total", 0),
        "page": data.get("page", page),
        "total_pages": data.get("totalPages", 0),
        "status_counts": data.get("statusCounts", {}),
        "filters_applied": filters_applied,
        "display_mode": "accordion",
        "_list_block": list_block,
    }
