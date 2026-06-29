from typing import Optional
from psycopg import AsyncConnection
from psycopg.rows import dict_row

from scenario_keys import SCENARIO_KEYS, BEHAVIOR_STYLES, DEFAULT_BEHAVIOR_STYLE


class TemplateRecord:
    def __init__(self, row: dict):
        self.id = str(row["id"])
        self.clinic_id = row["clinic_id"]
        self.scenario_key = row["scenario_key"]
        self.template_text = row["custom_text"]
        self.is_enabled = row["is_enabled"]
        self.created_at = row["created_at"]
        self.updated_at = row["updated_at"]
        self.updated_by = row["updated_by"]

    def to_dict(self):
        return {
            "id": self.id,
            "clinic_id": self.clinic_id,
            "scenario_key": self.scenario_key,
            "template_text": self.template_text,
            "is_enabled": self.is_enabled,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "updated_by": self.updated_by,
        }


def _validate_scenario_key(scenario_key: str):
    if scenario_key not in SCENARIO_KEYS:
        raise ValueError(f"Unknown scenario_key: {scenario_key}")


def _validate_behavior_style(behavior_style: str):
    if behavior_style not in BEHAVIOR_STYLES:
        raise ValueError(f"Unknown behavior_style: {behavior_style}")


async def get_template(
    conn: AsyncConnection, clinic_id: str, scenario_key: str
) -> Optional[TemplateRecord]:
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(
            """
            SELECT id, clinic_id, scenario_key, custom_text, is_enabled,
                   created_at, updated_at, updated_by
            FROM clinic_response_templates
            WHERE clinic_id = %s AND scenario_key = %s
            """,
            (clinic_id, scenario_key),
        )
        row = await cur.fetchone()
        return TemplateRecord(row) if row else None


async def list_templates(conn: AsyncConnection, clinic_id: str) -> list[TemplateRecord]:
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(
            """
            SELECT id, clinic_id, scenario_key, custom_text, is_enabled,
                   created_at, updated_at, updated_by
            FROM clinic_response_templates
            WHERE clinic_id = %s
            ORDER BY scenario_key
            """,
            (clinic_id,),
        )
        rows = await cur.fetchall()
        return [TemplateRecord(r) for r in rows]


async def upsert_template(
    conn: AsyncConnection,
    clinic_id: str,
    scenario_key: str,
    template_text: str,
    is_enabled: bool,
    updated_by: Optional[str] = None,
) -> TemplateRecord:
    _validate_scenario_key(scenario_key)

    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(
            """
            INSERT INTO clinic_response_templates
                (clinic_id, scenario_key, custom_text, is_enabled, updated_by, updated_at)
            VALUES (%s, %s, %s, %s, %s, now())
            ON CONFLICT (clinic_id, scenario_key)
            DO UPDATE SET
                custom_text = EXCLUDED.custom_text,
                is_enabled = EXCLUDED.is_enabled,
                updated_by = EXCLUDED.updated_by,
                updated_at = now()
            RETURNING id, clinic_id, scenario_key, custom_text, is_enabled,
                      created_at, updated_at, updated_by
            """,
            (clinic_id, scenario_key, template_text, is_enabled, updated_by),
        )
        row = await cur.fetchone()
        return TemplateRecord(row)


async def set_template_enabled(
    conn: AsyncConnection,
    clinic_id: str,
    scenario_key: str,
    is_enabled: bool,
    updated_by: Optional[str] = None,
) -> Optional[TemplateRecord]:
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(
            """
            UPDATE clinic_response_templates
            SET is_enabled = %s, updated_by = %s, updated_at = now()
            WHERE clinic_id = %s AND scenario_key = %s
            RETURNING id, clinic_id, scenario_key, custom_text, is_enabled,
                      created_at, updated_at, updated_by
            """,
            (is_enabled, updated_by, clinic_id, scenario_key),
        )
        row = await cur.fetchone()
        return TemplateRecord(row) if row else None


async def delete_template(
    conn: AsyncConnection, clinic_id: str, scenario_key: str
) -> bool:
    async with conn.cursor() as cur:
        await cur.execute(
            """
            DELETE FROM clinic_response_templates
            WHERE clinic_id = %s AND scenario_key = %s
            """,
            (clinic_id, scenario_key),
        )
        return cur.rowcount > 0


async def get_behavior_style(conn: AsyncConnection, clinic_id: str) -> str:
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(
            """
            SELECT behavior_style FROM clinic_behavior_settings
            WHERE clinic_id = %s
            """,
            (clinic_id,),
        )
        row = await cur.fetchone()
        return row["behavior_style"] if row else DEFAULT_BEHAVIOR_STYLE


async def set_behavior_style(
    conn: AsyncConnection,
    clinic_id: str,
    behavior_style: str,
    updated_by: Optional[str] = None,
) -> str:
    _validate_behavior_style(behavior_style)

    async with conn.cursor() as cur:
        await cur.execute(
            """
            INSERT INTO clinic_behavior_settings
                (clinic_id, behavior_style, updated_by, updated_at)
            VALUES (%s, %s, %s, now())
            ON CONFLICT (clinic_id)
            DO UPDATE SET
                behavior_style = EXCLUDED.behavior_style,
                updated_by = EXCLUDED.updated_by,
                updated_at = now()
            """,
            (clinic_id, behavior_style, updated_by),
        )
        return behavior_style


async def find_template(
    conn: AsyncConnection, clinic_id: str, scenario_key: str
) -> Optional[TemplateRecord]:
    return await get_template(conn, clinic_id, scenario_key)