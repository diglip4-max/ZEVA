import os
import httpx
import asyncio
import logging
import traceback
from cache import get_cache, set_cache
from appointment import get_header
from dotenv import load_dotenv
from pagination import _fetch_all_pages

load_dotenv()

logger = logging.getLogger(__name__)
CACHE_TTL = 600
AGENT_URL = os.getenv("NEXT_PUBLIC_BASE_URL")

SEMAPHORE = asyncio.Semaphore(10)

async def get_services_for_doctor(doctor_id: str, clinicToken: str) -> list[str]:
    cache_key = f"services:{doctor_id}"
    cached = await get_cache(cache_key)
    if cached:
        return cached

    header = get_header(clinicToken)

    async with SEMAPHORE:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(30.0, connect=15.0), headers=header
        ) as client:
            items = await _fetch_all_pages(
                client,
                url_fn=lambda p: (
                    f"{AGENT_URL}/api/appointment-booking/get-services/{doctor_id}"
                    f"?search=&page={p}&limit=10"
                ),
                data_extractor=lambda d: [
                    s["name"]
                    for s in d.get("data", {}).get("services", [])
                    if s.get("name")
                ],
                has_more_fn=lambda d: bool(
                    d.get("data", {}).get("pagination", {}).get("hasMore")
                ),
                page_size=10,
            )

    await set_cache(cache_key, items, CACHE_TTL)
    return items


# ─── All doctors ──────────────────────────────────────────────────────────────


async def get_all_doctors(clinicToken: str, clinic_id: str) -> list[dict]:
    cache_key = f"doctors:{clinic_id}"
    cached = await get_cache(cache_key)
    if cached:
        return cached

    header = get_header(clinicToken)

    async with httpx.AsyncClient(timeout=httpx.Timeout(30.0), headers=header) as client:
        items = await _fetch_all_pages(
            client,
            url_fn=lambda p: (
                f"{AGENT_URL}/api/appointment-booking/get-doctors-by-clinic"
                f"?clinicId={clinic_id}&search=&page={p}&limit=10"
            ),
            data_extractor=lambda d: [
                {
                    "_id": doc.get("_id"),
                    "name": doc.get("name"),
                    "email": doc.get("email"),
                }
                for doc in d.get("data", {}).get("doctors", [])
            ],
            has_more_fn=lambda d: bool(
                d.get("data", {}).get("pagination", {}).get("hasMore")
            ),
            page_size=10,
        )

    # Deduplicate by _id
    seen = set()
    unique = []
    for d in items:
        if d["_id"] not in seen:
            seen.add(d["_id"])
            unique.append(d)

    await set_cache(cache_key, unique, CACHE_TTL)
    return unique


# ─── get_doctors_by_treatment — unchanged logic, faster because above is faster


async def get_doctors_by_treatment(
    treatment_name: str, clinicToken: str, clinic_id: str
) -> dict:
    doctors = await get_all_doctors(clinicToken, clinic_id)

    if not doctors:
        return {
            "status": "error",
            "message": "Could not fetch doctors. Please try again later.",
        }

    async def doctor_with_services(doctor: dict) -> tuple[dict, list[str]]:
        services = await get_services_for_doctor(doctor["_id"], clinicToken)
        return doctor, services

    results = await asyncio.gather(
        *[doctor_with_services(d) for d in doctors], return_exceptions=True
    )

    treatment_lower = treatment_name.strip().lower()
    matched_doctors = []
    all_services: set[str] = set()

    for result in results:
        if isinstance(result, Exception):
            logger.warning(f"Failed to fetch services for a doctor: {result}")
            continue

        doctor, services = result
        all_services.update(services)
        services_lower = [s.lower() for s in services]

        if treatment_lower in services_lower or any(
            treatment_lower in s for s in services_lower
        ):
            matched_doctors.append(
                {
                    "doctor_name": doctor["name"],
                    "doctor_id": doctor["_id"],
                    "services": services,
                }
            )

    if not matched_doctors:
        return {
            "status": "not_found",
            "message": f"No doctors found for treatment '{treatment_name}'.",
            "available_treatments": sorted(all_services),
        }

    return {
        "status": "success",
        "treatment": treatment_name,
        "doctors": matched_doctors,
    }


# ─── Clinic services ──────────────────────────────────────────────────────────


async def get_services(clinicToken: str) -> dict:
    header = get_header(clinicToken)

    async with httpx.AsyncClient(timeout=httpx.Timeout(30.0), headers=header) as client:
        items = await _fetch_all_pages(
            client,
            url_fn=lambda p: f"{AGENT_URL}/api/clinic/services?page={p}&limit=20",
            data_extractor=lambda d: [
                {
                    "name": s.get("name"),
                    "price": s.get("clinicPrice") or s.get("price"),
                    "duration_minutes": s.get("durationMinutes"),
                    "department": (
                        s.get("departmentId", {}).get("name")
                        if isinstance(s.get("departmentId"), dict)
                        else None
                    ),
                }
                for s in d.get("services", [])
                if s.get("isActive")
            ],
            has_more_fn=lambda d: bool(d.get("pagination", {}).get("hasMore")),
            page_size=20,
        )

    grouped: dict[str, list] = {}
    for s in items:
        dept = s["department"] or "General"
        grouped.setdefault(dept, []).append(s)

    return {
        "status": "success",
        "total": len(items),
        "by_department": grouped,
    }


# ─── Timings — single page, no change needed ─────────────────────────────────


async def get_timings(clinicToken: str) -> dict:
    header = get_header(clinicToken)
    url = f"{AGENT_URL}/api/clinic/timings"

    async with httpx.AsyncClient(timeout=httpx.Timeout(15.0)) as client:
        resp = await client.get(url, headers=header)
        resp.raise_for_status()
        data = resp.json()

    timings = [
        {
            "day": t.get("day"),
            "isOpen": t.get("isOpen"),
            "openingTime": t.get("openingTime") if t.get("isOpen") else None,
            "closingTime": t.get("closingTime") if t.get("isOpen") else None,
        }
        for t in data.get("timings", [])
    ]

    return {"status": "success", "timings": timings}


async def get_clinic_id(clinicToken: str) -> str:
    header = get_header(clinicToken)
    url = f"{AGENT_URL}/api/clinics/myallClinic"
    async with httpx.AsyncClient(timeout=httpx.Timeout(15.0)) as client:
        resp = await client.get(url, headers=header)
        resp.raise_for_status()
        data = resp.json()
        return data["clinic"]["_id"]
