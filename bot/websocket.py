"""
WebSocket price feed manager.
"""

from __future__ import annotations

import asyncio
from typing import Any, Awaitable, Callable, Optional

from config import config
from exchange import exchange
from logger import logger
from telegram import telegram

PriceCallback = Callable[[str, float], Awaitable[None]]


class WebSocketManager:
    def __init__(self) -> None:
        self._callbacks: list[PriceCallback] = []
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._last_prices: dict[str, float] = {}
        self._reconnect_count = 0

    def add_callback(self, cb: PriceCallback) -> None:
        self._callbacks.append(cb)

    def get_last_price(self, symbol: str) -> Optional[float]:
        return self._last_prices.get(symbol)

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._run_loop())
        logger.info("WebSocket manager started")

    async def stop(self) -> None:
        self._running = False
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        logger.info("WebSocket manager stopped")

    async def _run_loop(self) -> None:
        while self._running:
            try:
                await self._consume_tickers()
            except asyncio.CancelledError:
                break
            except Exception as exc:
                self._reconnect_count += 1
                logger.error(
                    "WebSocket error (reconnect #%d): %s", self._reconnect_count, exc
                )
                await telegram.notify_exchange_disconnected()
                delay = config.WEBSOCKET_RECONNECT_DELAY
                delay = min(delay * (1.5 ** min(self._reconnect_count, 10)), 120.0)
                await asyncio.sleep(delay)
                if config.MAX_RECONNECT_ATTEMPTS and self._reconnect_count >= config.MAX_RECONNECT_ATTEMPTS:
                    logger.critical("Max reconnect attempts reached – stopping WebSocket")
                    break
                await telegram.notify_exchange_reconnected()

    async def _consume_tickers(self) -> None:
        symbols = exchange.symbols
        if not symbols:
            logger.warning("No symbols to subscribe – waiting")
            await asyncio.sleep(30)
            return

        ex = exchange.exchange
        logger.info("Subscribing to %d symbols via WebSocket", len(symbols))

        if hasattr(ex, "watch_tickers"):
            while self._running:
                tickers = await ex.watch_tickers(symbols)
                for symbol, ticker in tickers.items():
                    price = self._extract_price(ticker)
                    if price is not None:
                        await self._dispatch(symbol, price)
        else:
            tasks = [
                asyncio.create_task(self._watch_single(symbol))
                for symbol in symbols
            ]
            try:
                await asyncio.gather(*tasks)
            finally:
                for t in tasks:
                    t.cancel()

    async def _watch_single(self, symbol: str) -> None:
        ex = exchange.exchange
        while self._running:
            try:
                ticker = await ex.watch_ticker(symbol)
                price = self._extract_price(ticker)
                if price is not None:
                    await self._dispatch(symbol, price)
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.warning("watch_ticker(%s) error: %s", symbol, exc)
                await asyncio.sleep(config.WEBSOCKET_RECONNECT_DELAY)

    def _extract_price(self, ticker: dict[str, Any]) -> Optional[float]:
        for key in ("last", "close", "bid", "ask"):
            val = ticker.get(key)
            if val is not None:
                try:
                    return float(val)
                except (TypeError, ValueError):
                    continue
        return None

    async def _dispatch(self, symbol: str, price: float) -> None:
        self._last_prices[symbol] = price
        for cb in self._callbacks:
            try:
                await cb(symbol, price)
            except Exception as exc:
                logger.error("Price callback error for %s: %s", symbol, exc)


ws_manager = WebSocketManager()
