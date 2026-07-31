import sys
from pathlib import Path
import httpx

ROOT_DIR = Path(__file__).resolve().parents[1]

sys.path.insert(0, str(ROOT_DIR))

import os
from dotenv import load_dotenv
from shared import appointment

load_dotenv()

AGENT_URL = os.getenv("NEXT_PUBLIC_BASE_URL")
url = f"{AGENT_URL}/api/clinic/my-packages"


async def fetch_receptionist_packages(userToken: str):
    header = appointment.get_header(userToken)
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=header)
        data = resp.json()
        if not data.get("success"):
            return []
        raw_packages = data.get("packages", [])
        return [
            {
                "name": p.get("name", ""),
                "treatments": ", ".join(
                    t.get("treatmentName", "") for t in p.get("treatments", [])
                ),
                "totalPrice": p.get("totalPrice", 0),
                "validityInMonths": p.get("validityInMonths", 0),
            }
            for p in raw_packages
        ]
