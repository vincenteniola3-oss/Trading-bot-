"""
Market scanner – daily opens, signals, midnight reset.
"""

from __future__ import annotations

import asyncio
from typing import Optional

from database import db
from exchange import exchange
from logger import logger
from state import state
from strategy import strategy
from telegram import telegram
from trade_manager import trade_manager
from utils import seconds_until_next_utc_midnight, utc_now, utc_today_str
from websocket import ws_manager


class Scanner:
    def __init__(self) -> None:
        self._current_date: str = ""
        self._midnight_task: Optional[asyncio.Task] = None
        self._running = False

    async def start(self) -> None:
        self._running = True
        today = utc_today_str()
        self._current_date = today

        opens = await db.get_all_daily_opens(today)
        state.set_daily_opens(opens)

        if not state.daily_opens:
            await self._capture_daily_opens()

        await state.load_from_db()

        ws_manager.add_callback(self.on_price_update)
        self._midnight_task = asyncio.create_task(self._midnight_loop())
        logger.info(
            "Scanner started – monitoring %d pairs (date=%s), %d open positions",
            len(state.daily_opens),
            today,
            len(state.positions),
        )

    async def stop(self) -> None:
        self._running = False
        if self._midnight_task is not None:
            self._midnight_task.cancel()
            try:
                await self._midnight_task
            except asyncio.CancelledError:
                pass
            self._midnight_task = None
        logger.info("Scanner stopped")

    async def _capture_daily_opens(self) -> None:
        today = utc_today_str()
        logger.info("Capturing daily opens for %s …", today)
        symbols = exchange.symbols
        captured = 0
        opens: dict[str, float] = {}
        for symbol in symbols:
            try:
                open_price = await exchange.get_daily_open_price(symbol)
                if open_price and open_price > 0:
                    await db.save_daily_open(symbol, today, open_price)
                    opens[symbol] = open_price
                    captured += 1
            except Exception as exc:
                logger.warning("Failed to capture open for %s: %s", symbol, exc)
            await asyncio.sleep(0.05)

        state.set_daily_opens(opens)
        self._current_date = today
        await db.set_state("last_daily_reset", today)
        logger.info("Daily opens captured: %d / %d symbols", captured, len(symbols))
        await telegram.notify_new_utc_day(today)

    async def _midnight_loop(self) -> None:
        while self._running:
            delay = seconds_until_next_utc_midnight()
            logger.info("Next UTC midnight in %.0f seconds", delay)
            try:
                await asyncio.sleep(max(1.0, delay - 2.0))
            except asyncio.CancelledError:
                break

            while self._running:
                now = utc_now()
                if now.hour == 0 and now.minute == 0:
                    break
                await asyncio.sleep(0.2)

            if not self._running:
                break

            logger.info("UTC midnight reached – closing all active positions for End-of-Day")
            await trade_manager.close_all_positions_eod()
            state.set_daily_opens({})
            await self._capture_daily_opens()

    async def on_price_update(self, symbol: str, price: float) -> None:
        if not self._running:
            return

        daily_open = state.get_daily_open(symbol)
        if daily_open is None:
            try:
                open_price = await exchange.get_daily_open_price(symbol)
                if open_price and open_price > 0:
                    today = utc_today_str()
                    await db.save_daily_open(symbol, today, open_price)
                    state.set_daily_open(symbol, open_price)
                    daily_open = open_price
                else:
                    return
            except Exception:
                return

        pos = state.get_position(symbol)
        if pos:
            if strategy.should_exit(
                pos["side"],
                float(pos["entry_price"]),
                float(pos["take_profit"]),
                price,
            ):
                await trade_manager.close_position(symbol, price)
            return

        if state.is_locked(symbol):
            return

        side = strategy.should_enter(symbol, daily_open, price, is_locked=False)
        if side:
            move = strategy.calc_move_pct(daily_open, price)
            logger.info(
                "SIGNAL %s %s | move=%.2f%% daily_open=%.8f price=%.8f",
                side.upper(), symbol, move, daily_open, price,
            )
            await trade_manager.open_position(symbol, side, price, daily_open)


scanner = Scanner()
