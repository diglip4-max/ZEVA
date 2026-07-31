import argparse
import json
import os
import sys

import httpx


def get_services(page: int, limit: int) -> None:
    agent_url = os.getenv("AGENT_URL") or os.getenv("NEXT_PUBLIC_AGENT_URL")
    clinic_token = os.getenv("CLINIC_TOKEN")

    if not agent_url:
        raise RuntimeError(
            "Set AGENT_URL (or NEXT_PUBLIC_AGENT_URL) in your environment."
        )

    url = f"{agent_url.rstrip('/')}/api/clinic/services"
    headers = {"Accept": "application/json"}

    if clinic_token:
        headers["Authorization"] = f"Bearer {clinic_token}"

    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.get(
                url,
                params={"page": page, "limit": limit},
                headers=headers,
            )

        print(f"Request URL: {response.request.url}")
        print(f"Status Code: {response.status_code}")
        print("Response:")

        try:
            print(json.dumps(response.json(), indent=2, ensure_ascii=False))
        except ValueError:
            print(response.text)

        response.raise_for_status()

    except httpx.HTTPStatusError as exc:
        print(
            f"API returned HTTP {exc.response.status_code}.",
            file=sys.stderr,
        )
        raise SystemExit(1) from exc
    except httpx.RequestError as exc:
        print(f"Could not connect to the API: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Read services from the clinic services API."
    )
    parser.add_argument("--page", type=int, default=1)
    parser.add_argument("--limit", type=int, default=20)
    args = parser.parse_args()

    get_services(page=args.page, limit=args.limit)
