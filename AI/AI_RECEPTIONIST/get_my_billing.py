import asyncio
import logging
import os
import sys
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))

from shared import appointment

load_dotenv()

logger = logging.getLogger(__name__)

AGENT_URL = os.getenv("NEXT_PUBLIC_BASE_URL")

if not AGENT_URL:
    raise RuntimeError("NEXT_PUBLIC_BASE_URL is missing from the .env file")

BILLING_URL = f"{AGENT_URL.rstrip('/')}/api/clinics/MyBilling"

TIMEOUT = httpx.Timeout(
    connect=10.0,
    read=60.0,
    write=10.0,
    pool=10.0,
)

TRANSIENT_ERRORS = (
    httpx.ConnectError,
    httpx.ConnectTimeout,
    httpx.ReadTimeout,
    httpx.RemoteProtocolError,
)


async def fetch_my_billings(userToken: str) -> dict:
    if not userToken:
        raise ValueError("A user token is required to fetch billings")

    headers = appointment.get_header(userToken)

    # Do not print headers because they contain the JWT token.
    logger.info("Fetching billings from %s", BILLING_URL)

    last_error: Exception | None = None

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        for attempt in range(1, 3):
            try:
                response = await client.get(
                    BILLING_URL,
                    headers=headers,
                )

                response.raise_for_status()

                try:
                    return response.json()
                except ValueError as exc:
                    raise RuntimeError(
                        "Billing API returned an invalid JSON response"
                    ) from exc

            except TRANSIENT_ERRORS as exc:
                last_error = exc

                logger.warning(
                    "Billing request attempt %s failed: %s: %r",
                    attempt,
                    type(exc).__name__,
                    exc,
                )

                if attempt < 2:
                    await asyncio.sleep(1)
                    continue

            except httpx.HTTPStatusError as exc:
                response_text = exc.response.text[:500]

                raise RuntimeError(
                    f"Billing API returned HTTP "
                    f"{exc.response.status_code}: {response_text}"
                ) from exc

    if last_error:
        raise RuntimeError(
            f"Billing request failed after 2 attempts: "
            f"{type(last_error).__name__}: {last_error!r}"
        ) from last_error

    raise RuntimeError("Billing request failed for an unknown reason")
