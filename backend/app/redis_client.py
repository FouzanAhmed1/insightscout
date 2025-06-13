import json
from typing import Any
import redis.asyncio as aioredis
from app.config import get_settings

settings = get_settings()
redis_pool = aioredis.from_url(settings.REDIS_URL, decode_responses=True)


async def cache_get(key: str) -> Any | None:
    val = await redis_pool.get(key)
    if val:
        return json.loads(val)
    return None


async def cache_set(key: str, value: Any, ttl: int = 300) -> None:
    await redis_pool.set(key, json.dumps(value, default=str), ex=ttl)


async def cache_delete(key: str) -> None:
    await redis_pool.delete(key)


async def rate_limit(key: str, max_requests: int = 100, window: int = 60) -> bool:
    """Returns True if the request is allowed, False if rate-limited."""
    current = await redis_pool.incr(key)
    if current == 1:
        await redis_pool.expire(key, window)
    return current <= max_requests
