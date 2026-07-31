from psycopg.rows import dict_row
from shared.cache import redis_client

CACHE_KEY_PREFIX = "kaka_service_enabled:"
CACHE_TTL = 60  # seconds — short TTL so a toggle takes effect almost immediately


async def is_kaka_enabled(conn, clinic_id: str) -> bool:
    """Checks Redis first, falls back to Postgres, defaults to True if no row exists
    (so clinics that never touched the setting keep working)."""
    cache_key = f"{CACHE_KEY_PREFIX}{clinic_id}"
    try:
        cached = await redis_client.get(cache_key)
        if cached is not None:
            return cached == "1"
    except Exception:
        pass

    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(
            "SELECT is_enabled FROM kaka_service_status WHERE clinic_id = %s",
            (clinic_id,),
        )
        row = await cur.fetchone()

    enabled = True if row is None else bool(row["is_enabled"])

    try:
        await redis_client.setex(cache_key, CACHE_TTL, "1" if enabled else "0")
    except Exception:
        pass

    return enabled


async def set_kaka_enabled(
    conn, clinic_id: str, is_enabled: bool, updated_by: str | None = None
) -> bool:
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(
            """
            INSERT INTO kaka_service_status (clinic_id, is_enabled, updated_by, updated_at)
            VALUES (%s, %s, %s, now())
            ON CONFLICT (clinic_id)
            DO UPDATE SET is_enabled = EXCLUDED.is_enabled,
                          updated_by = EXCLUDED.updated_by,
                          updated_at = now()
            RETURNING is_enabled
            """,
            (clinic_id, is_enabled, updated_by),
        )
        row = await cur.fetchone()

    try:
        await redis_client.setex(
            f"{CACHE_KEY_PREFIX}{clinic_id}", CACHE_TTL, "1" if is_enabled else "0"
        )
    except Exception:
        pass

    return bool(row["is_enabled"])
