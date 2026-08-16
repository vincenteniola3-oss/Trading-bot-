"""
Utility helpers used across the trading bot.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any, Callable, Coroutine, TypeVar

from logger import logger

T = TypeVar("T")


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def utc_today_str() -> str:
    return utc_now().strftime("%Y-%m-%d")


def seconds_until_next_utc_midnight() -> float:
    now = utc_now()
    tomorrow = now.replace(hour=0, minute=0, second=0, microsecond=0)
    if now.hour != 0 or now.minute != 0 or now.second != 0:
        from datetime import timedelta
        tomorrow = tomorrow + timedelta(days=1)
    return max(0.0, (tomorrow - now).total_seconds())


def format_duration(seconds: float) -> str:
    seconds = int(seconds)
    days, rem = divmod(seconds, 86400)
    hours, rem = divmod(rem, 3600)
    minutes, secs = divmod(rem, 60)
    parts = []
    if days:
        parts.append(f"{days}d")
    if hours:
        parts.append(f"{hours}h")
    if minutes:
        parts.append(f"{minutes}m")
    parts.append(f"{secs}s")
    return " ".join(parts)


async def retry_async(
    coro_factory: Callable[[], Coroutine[Any, Any, T]],
    *,
    max_attempts: int = 5,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    exceptions: tuple = (Exception,),
    label: str = "operation",
) -> T:
    attempt = 0
    while True:
        attempt += 1
        try:
            return await coro_factory()
        except exceptions as exc:
            if max_attempts and attempt >= max_attempts:
                logger.error("%s failed after %d attempts: %s", label, attempt, exc)
                raise
            delay = min(base_delay * (2 ** (attempt - 1)), max_delay)
            logger.warning(
                "%s failed (attempt %d): %s – retrying in %.1fs",
                label, attempt, exc, delay,
            )
            await asyncio.sleep(delay)


def safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default
