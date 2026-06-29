import asyncio
import os
from psycopg import AsyncConnection

import templates_db as db
from scenario_keys import ScenarioKey, BehaviorStyle
import sys
import asyncio
from dotenv import load_dotenv
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

load_dotenv()
CLINIC_ID = os.environ["TEST_CLINIC_ID"]
SCENARIO = os.environ.get("TEST_SCENARIO_KEY", ScenarioKey.BOOKING_SUCCESS.value)
ENABLE = os.environ.get("TEST_ENABLE", "true").lower() == "true"
STYLE = os.environ.get("TEST_BEHAVIOR_STYLE", BehaviorStyle.LUXURIOUS.value)
TEMPLATE_TEXT = os.environ.get(
    "TEST_TEMPLATE_TEXT",
    "Dear patient, your appointment has been gracefully reserved. We look forward to welcoming you.",
)


async def main():
    conn = await AsyncConnection.connect(os.getenv("DATABASE_URL"), autocommit=True)

    await db.upsert_template(
        conn,
        clinic_id=CLINIC_ID,
        scenario_key=SCENARIO,
        template_text=TEMPLATE_TEXT,
        is_enabled=ENABLE,
        updated_by="manual_seed",
    )
    await db.set_behavior_style(conn, clinic_id=CLINIC_ID, behavior_style=STYLE)

    saved = await db.find_template(conn, CLINIC_ID, SCENARIO)
    print("seeded template:", saved.to_dict() if saved else None)
    style = await db.get_behavior_style(conn, CLINIC_ID)
    print("behavior style:", style)

    await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
