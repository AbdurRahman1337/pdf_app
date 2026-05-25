import json
from typing import Any, Optional
import redis.asyncio as redis
from app.core.config import settings

# Async Redis link instance pool
redis_connection: Optional[redis.Redis] = None


def get_redis_client() -> redis.Redis:
    """
    Initialize dynamic connections to the system-wide Redis caches
    """
    global redis_connection
    if redis_connection is None:
        redis_connection = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=settings.REDIS_DB,
            decode_responses=True
        )
    return redis_connection


async def cache_get(key: str) -> Optional[Any]:
    """Retrieve string values from caching channels."""
    client = get_redis_client()
    try:
        data = await client.get(key)
        if data:
            return json.loads(data)
    except Exception:
        pass
    return None


async def cache_set(key: str, value: Any, expire_seconds: int = 3600) -> bool:
    """Set serialization values directly to caching keys."""
    client = get_redis_client()
    try:
        data = json.dumps(value)
        await client.set(key, data, ex=expire_seconds)
        return True
    except Exception:
        return False


async def cache_delete(key: str) -> bool:
    """Evict cached values manually by matching standard formats."""
    client = get_redis_client()
    try:
        await client.delete(key)
        return True
    except Exception:
        return False
