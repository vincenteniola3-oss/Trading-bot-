"""
SQLite persistence layer with aiosqlite / sqlite3 fallback.
"""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

try:
    import aiosqlite
    HAS_AIOSQLITE = True
except ImportError:
    HAS_AIOSQLITE = False

from config import config
from logger import logger
from utils import utc_now


SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS daily_opens (
    symbol          TEXT NOT NULL,
    trade_date      TEXT NOT NULL,
    open_price      REAL NOT NULL,
    captured_at     TEXT NOT NULL,
    PRIMARY KEY (symbol, trade_date)
);

CREATE TABLE IF NOT EXISTS positions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol          TEXT NOT NULL UNIQUE,
    side            TEXT NOT NULL,
    entry_price     REAL NOT NULL,
    quantity        REAL NOT NULL,
    take_profit     REAL NOT NULL,
    daily_open      REAL NOT NULL,
    opened_at       TEXT NOT NULL,
    exchange_order_id TEXT,
    status          TEXT NOT NULL DEFAULT 'open'
);

CREATE TABLE IF NOT EXISTS trade_history (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol          TEXT NOT NULL,
    side            TEXT NOT NULL,
    entry_price     REAL NOT NULL,
    exit_price      REAL NOT NULL,
    quantity        REAL NOT NULL,
    pnl_pct         REAL NOT NULL,
    pnl_usdt        REAL,
    daily_open      REAL NOT NULL,
    opened_at       TEXT NOT NULL,
    closed_at       TEXT NOT NULL,
    duration_sec    REAL NOT NULL,
    entry_order_id  TEXT,
    exit_order_id   TEXT
);

CREATE TABLE IF NOT EXISTS locked_pairs (
    symbol          TEXT PRIMARY KEY,
    locked_at       TEXT NOT NULL,
    reason          TEXT
);

CREATE TABLE IF NOT EXISTS bot_state (
    key             TEXT PRIMARY KEY,
    value           TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status);
CREATE INDEX IF NOT EXISTS idx_history_symbol ON trade_history(symbol);
CREATE INDEX IF NOT EXISTS idx_daily_opens_date ON daily_opens(trade_date);
"""


class _Sqlite3SyncWrapper:
    """Fallback wrapper around stdlib sqlite3 for sync/async dual usage."""
    def __init__(self, path: Path) -> None:
        self.conn = sqlite3.connect(str(path))
        self.conn.row_factory = sqlite3.Row

    async def executescript(self, sql: str) -> None:
        self.conn.executescript(sql)

    async def execute(self, sql: str, params: tuple = ()) -> "_Sqlite3CursorWrapper":
        cur = self.conn.cursor()
        cur.execute(sql, params)
        return _Sqlite3CursorWrapper(cur)

    async def commit(self) -> None:
        self.conn.commit()

    async def close(self) -> None:
        self.conn.close()


class _Sqlite3CursorWrapper:
    def __init__(self, cursor: sqlite3.Cursor) -> None:
        self.cursor = cursor
        self.lastrowid = cursor.lastrowid

    async def fetchone(self) -> Optional[sqlite3.Row]:
        return self.cursor.fetchone()

    async def fetchall(self) -> list[sqlite3.Row]:
        return self.cursor.fetchall()

    async def __aenter__(self) -> "_Sqlite3CursorWrapper":
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        self.cursor.close()


class Database:
    def __init__(self, path: Optional[Path] = None) -> None:
        self.path = path or config.DATABASE_PATH
        self._db: Any = None

    async def connect(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if HAS_AIOSQLITE:
            self._db = await aiosqlite.connect(str(self.path))
            self._db.row_factory = aiosqlite.Row
        else:
            self._db = _Sqlite3SyncWrapper(self.path)

        await self._db.executescript(SCHEMA)
        await self._db.commit()
        logger.info("Database connected: %s", self.path)

    async def close(self) -> None:
        if self._db is not None:
            await self._db.close()
            self._db = None
            logger.info("Database closed")

    async def save_daily_open(self, symbol: str, trade_date: str, open_price: float) -> None:
        assert self._db is not None
        await self._db.execute(
            """
            INSERT OR REPLACE INTO daily_opens (symbol, trade_date, open_price, captured_at)
            VALUES (?, ?, ?, ?)
            """,
            (symbol, trade_date, open_price, utc_now().isoformat()),
        )
        await self._db.commit()

    async def get_daily_open(self, symbol: str, trade_date: str) -> Optional[float]:
        assert self._db is not None
        cursor = await self._db.execute(
            "SELECT open_price FROM daily_opens WHERE symbol=? AND trade_date=?",
            (symbol, trade_date),
        )
        if HAS_AIOSQLITE:
            async with cursor:
                row = await cursor.fetchone()
                return float(row["open_price"]) if row else None
        else:
            row = await cursor.fetchone()
            return float(row["open_price"]) if row else None

    async def get_all_daily_opens(self, trade_date: str) -> dict[str, float]:
        assert self._db is not None
        cursor = await self._db.execute(
            "SELECT symbol, open_price FROM daily_opens WHERE trade_date=?",
            (trade_date,),
        )
        if HAS_AIOSQLITE:
            async with cursor:
                rows = await cursor.fetchall()
                return {r["symbol"]: float(r["open_price"]) for r in rows}
        else:
            rows = await cursor.fetchall()
            return {r["symbol"]: float(r["open_price"]) for r in rows}

    async def insert_position(
        self,
        symbol: str,
        side: str,
        entry_price: float,
        quantity: float,
        take_profit: float,
        daily_open: float,
        exchange_order_id: Optional[str] = None,
    ) -> int:
        assert self._db is not None
        cursor = await self._db.execute(
            """
            INSERT INTO positions
                (symbol, side, entry_price, quantity, take_profit, daily_open,
                 opened_at, exchange_order_id, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open')
            """,
            (
                symbol, side, entry_price, quantity, take_profit, daily_open,
                utc_now().isoformat(), exchange_order_id,
            ),
        )
        await self._db.commit()
        return cursor.lastrowid  # type: ignore

    async def get_open_positions(self) -> list[dict[str, Any]]:
        assert self._db is not None
        cursor = await self._db.execute(
            "SELECT * FROM positions WHERE status='open'"
        )
        if HAS_AIOSQLITE:
            async with cursor:
                rows = await cursor.fetchall()
                return [dict(r) for r in rows]
        else:
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

    async def get_position(self, symbol: str) -> Optional[dict[str, Any]]:
        assert self._db is not None
        cursor = await self._db.execute(
            "SELECT * FROM positions WHERE symbol=? AND status='open'",
            (symbol,),
        )
        if HAS_AIOSQLITE:
            async with cursor:
                row = await cursor.fetchone()
                return dict(row) if row else None
        else:
            row = await cursor.fetchone()
            return dict(row) if row else None

    async def close_position(
        self,
        symbol: str,
        exit_price: float,
        exit_order_id: Optional[str] = None,
        unlock: bool = False,
    ) -> Optional[dict[str, Any]]:
        assert self._db is not None
        pos = await self.get_position(symbol)
        if not pos:
            return None

        opened_at = datetime.fromisoformat(pos["opened_at"])
        closed_at = utc_now()
        duration = (closed_at - opened_at).total_seconds()

        if pos["side"] == "buy":
            pnl_pct = ((exit_price - pos["entry_price"]) / pos["entry_price"]) * 100.0
        else:
            pnl_pct = ((pos["entry_price"] - exit_price) / pos["entry_price"]) * 100.0

        pnl_usdt = (pnl_pct / 100.0) * pos["entry_price"] * pos["quantity"]

        await self._db.execute(
            """
            INSERT INTO trade_history
                (symbol, side, entry_price, exit_price, quantity, pnl_pct, pnl_usdt,
                 daily_open, opened_at, closed_at, duration_sec,
                 entry_order_id, exit_order_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                pos["symbol"], pos["side"], pos["entry_price"], exit_price,
                pos["quantity"], pnl_pct, pnl_usdt, pos["daily_open"],
                pos["opened_at"], closed_at.isoformat(), duration,
                pos.get("exchange_order_id"), exit_order_id,
            ),
        )
        await self._db.execute(
            "UPDATE positions SET status='closed' WHERE symbol=? AND status='open'",
            (symbol,),
        )
        if unlock:
            await self._db.execute("DELETE FROM locked_pairs WHERE symbol=?", (symbol,))
        await self._db.commit()

        return {
            "symbol": symbol,
            "side": pos["side"],
            "entry_price": pos["entry_price"],
            "exit_price": exit_price,
            "quantity": pos["quantity"],
            "pnl_pct": pnl_pct,
            "pnl_usdt": pnl_usdt,
            "opened_at": pos["opened_at"],
            "closed_at": closed_at.isoformat(),
            "duration_sec": duration,
        }

    async def lock_pair(self, symbol: str, reason: str = "position_open") -> None:
        assert self._db is not None
        await self._db.execute(
            "INSERT OR REPLACE INTO locked_pairs (symbol, locked_at, reason) VALUES (?, ?, ?)",
            (symbol, utc_now().isoformat(), reason),
        )
        await self._db.commit()

    async def unlock_pair(self, symbol: str) -> None:
        assert self._db is not None
        await self._db.execute("DELETE FROM locked_pairs WHERE symbol=?", (symbol,))
        await self._db.commit()

    async def is_locked(self, symbol: str) -> bool:
        assert self._db is not None
        cursor = await self._db.execute(
            "SELECT 1 FROM locked_pairs WHERE symbol=?", (symbol,)
        )
        if HAS_AIOSQLITE:
            async with cursor:
                return await cursor.fetchone() is not None
        else:
            return await cursor.fetchone() is not None

    async def get_locked_pairs(self) -> set[str]:
        assert self._db is not None
        cursor = await self._db.execute("SELECT symbol FROM locked_pairs")
        if HAS_AIOSQLITE:
            async with cursor:
                rows = await cursor.fetchall()
                return {r["symbol"] for r in rows}
        else:
            rows = await cursor.fetchall()
            return {r["symbol"] for r in rows}

    async def set_state(self, key: str, value: Any) -> None:
        assert self._db is not None
        await self._db.execute(
            "INSERT OR REPLACE INTO bot_state (key, value, updated_at) VALUES (?, ?, ?)",
            (key, json.dumps(value), utc_now().isoformat()),
        )
        await self._db.commit()

    async def get_state(self, key: str, default: Any = None) -> Any:
        assert self._db is not None
        cursor = await self._db.execute(
            "SELECT value FROM bot_state WHERE key=?", (key,)
        )
        if HAS_AIOSQLITE:
            async with cursor:
                row = await cursor.fetchone()
                if row is None:
                    return default
                return json.loads(row["value"])
        else:
            row = await cursor.fetchone()
            if row is None:
                return default
            return json.loads(row["value"])


db = Database()
