"""
In-memory state cache.

Avoids per-tick SQLite reads for open positions and locked pairs.
"""

from __future__ import annotations

from typing import Any, Optional

from database import db
from logger import logger


class StateCache:
    def __init__(self) -> None:
        self.positions: dict[str, dict[str, Any]] = {}
        self.locked: set[str] = set()
        self.daily_opens: dict[str, float] = {}

    async def load_from_db(self) -> None:
        rows = await db.get_open_positions()
        self.positions = {r["symbol"]: dict(r) for r in rows}
        self.locked = await db.get_locked_pairs()
        for sym in self.positions:
            self.locked.add(sym)
        logger.info(
            "State cache loaded: %d open positions, %d locked pairs",
            len(self.positions),
            len(self.locked),
        )

    def get_position(self, symbol: str) -> Optional[dict[str, Any]]:
        return self.positions.get(symbol)

    def is_locked(self, symbol: str) -> bool:
        return symbol in self.locked

    def set_position(self, symbol: str, pos: dict[str, Any]) -> None:
        self.positions[symbol] = pos
        self.locked.add(symbol)

    def remove_position(self, symbol: str) -> None:
        self.positions.pop(symbol, None)
        self.locked.discard(symbol)

    def lock(self, symbol: str) -> None:
        self.locked.add(symbol)

    def unlock(self, symbol: str) -> None:
        self.locked.discard(symbol)

    def set_daily_opens(self, opens: dict[str, float]) -> None:
        self.daily_opens = dict(opens)

    def get_daily_open(self, symbol: str) -> Optional[float]:
        return self.daily_opens.get(symbol)

    def set_daily_open(self, symbol: str, price: float) -> None:
        self.daily_opens[symbol] = price


state = StateCache()
