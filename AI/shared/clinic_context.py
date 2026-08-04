import httpx
import os
from dotenv import load_dotenv
load_dotenv()
AGENT_URL = os.getenv("NEXT_PUBLIC_BASE_URL")


async def fetch_clinic_id(clinicToken: str, get_header_fn) -> str:
    header = get_header_fn(clinicToken)
    url = f"{AGENT_URL}/api/clinics/myallClinic"

    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=header)
        data = resp.json()
        return data.get("clinic", {}).get("_id", "")
