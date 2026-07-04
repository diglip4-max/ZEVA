# cache.py
from dotenv import load_dotenv
load_dotenv()

import redis.asyncio as redis
import os
import json

redis_client = redis.from_url(
    os.getenv("REDIS_AGENT_URL"),
    decode_responses=True,
    max_connections=10,
    protocol=2,
)

async def get_cache(key: str) -> dict | None:
    try:
        data = await redis_client.get(key)
        if data:
            return json.loads(data)
        return None
    except Exception:
        return None

async def set_cache(key: str, value: dict, ttl_seconds: int) -> None:
    try:
        await redis_client.setex(key, ttl_seconds, json.dumps(value))
    except Exception:
        pass