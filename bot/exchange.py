"""
Exchange abstraction layer built on CCXT (async).
"""

from __future__ import annotations

from typing import Any, Optional

import ccxt.async_support as ccxt

from config import config
from logger import logger
from utils import retry_async, safe_float


class Exchange:
    def __init__(self) -> None:
        self.exchange_id = config.EXCHANGE_ID
        self.testnet = config.TESTNET
        self._exchange: Optional[ccxt.Exchange] = None
        self._markets: dict[str, Any] = {}
        self._symbols: list[str] = []

    async def connect(self) -> None:
        exchange_class = getattr(ccxt, self.exchange_id, None)
        if exchange_class is None:
            raise ValueError(f"Unsupported exchange id: {self.exchange_id}")

        opts: dict[str, Any] = {
            "apiKey": config.API_KEY,
            "secret": config.API_SECRET,
            "enableRateLimit": True,
            "options": {
                "defaultType": "future",
                "adjustForTimeDifference": True,
            },
        }
        if self.testnet:
            opts["sandbox"] = True

        self._exchange = exchange_class(opts)
        await self._exchange.load_markets()
        self._markets = self._exchange.markets
        await self._build_symbol_list()
        logger.info(
            "Exchange connected: %s (testnet=%s) – %d eligible symbols",
            self.exchange_id,
            self.testnet,
            len(self._symbols),
        )

    async def close(self) -> None:
        if self._exchange is not None:
            await self._exchange.close()
            self._exchange = None
            logger.info("Exchange connection closed")

    async def _build_symbol_list(self) -> None:
        quote = config.QUOTE_CURRENCY.upper()
        candidates: list[str] = []
        for symbol, market in self._markets.items():
            if not market.get("active", True):
                continue
            if market.get("quote") != quote:
                continue
            if market.get("type") not in ("swap", "future"):
                continue
            if market.get("linear") is False:
                continue
            plain = symbol.replace("/", "").replace(":USDT", "").upper()
            if plain in config.EXCLUDED_SYMBOLS or symbol.upper() in config.EXCLUDED_SYMBOLS:
                continue
            candidates.append(symbol)

        volumes: dict[str, float] = {}
        try:
            to_fetch = candidates[:300] if len(candidates) > 300 else candidates
            tickers = await retry_async(
                lambda: self.exchange.fetch_tickers(to_fetch),
                label="fetch_tickers_volume",
                max_attempts=3,
            )
            for sym, t in tickers.items():
                qv = safe_float(t.get("quoteVolume"), 0.0)
                if qv <= 0:
                    last = safe_float(t.get("last"), 0.0)
                    bv = safe_float(t.get("baseVolume"), 0.0)
                    qv = bv * last
                volumes[sym] = qv
        except Exception as exc:
            logger.warning("Volume ranking failed (%s) – using unfiltered list", exc)
            volumes = {s: 0.0 for s in candidates}

        if config.MIN_QUOTE_VOLUME_USDT > 0 and any(v > 0 for v in volumes.values()):
            filtered = [s for s in candidates if volumes.get(s, 0.0) >= config.MIN_QUOTE_VOLUME_USDT]
        else:
            filtered = list(candidates)

        filtered.sort(key=lambda s: volumes.get(s, 0.0), reverse=True)
        if config.MAX_SYMBOLS > 0 and len(filtered) > config.MAX_SYMBOLS:
            self._symbols = filtered[: config.MAX_SYMBOLS]
        else:
            self._symbols = filtered
        logger.info(
            "Symbol list: %d candidates → %d after volume filter → %d final monitored symbols",
            len(candidates),
            len(filtered),
            len(self._symbols),
        )

    @property
    def symbols(self) -> list[str]:
        return list(self._symbols)

    @property
    def exchange(self) -> ccxt.Exchange:
        if self._exchange is None:
            raise RuntimeError("Exchange not connected")
        return self._exchange

    async def setup_symbol_risk(self, symbol: str) -> None:
        try:
            if hasattr(self.exchange, "set_margin_mode"):
                await self.exchange.set_margin_mode(config.MARGIN_MODE, symbol)
        except Exception as exc:
            logger.debug("set_margin_mode(%s) skipped: %s", symbol, exc)
        try:
            if hasattr(self.exchange, "set_leverage"):
                await self.exchange.set_leverage(config.DEFAULT_LEVERAGE, symbol)
        except Exception as exc:
            logger.debug("set_leverage(%s) skipped: %s", symbol, exc)

    async def setup_all_risk(self) -> None:
        import asyncio
        logger.info(
            "Applying leverage=%dx margin=%s to %d symbols …",
            config.DEFAULT_LEVERAGE,
            config.MARGIN_MODE,
            len(self._symbols),
        )
        for i, symbol in enumerate(self._symbols):
            await self.setup_symbol_risk(symbol)
            if i % 10 == 9:
                await asyncio.sleep(0.3)
        logger.info("Risk setup complete")

    async def fetch_balance(self) -> dict[str, Any]:
        async def _do() -> dict[str, Any]:
            return await self.exchange.fetch_balance()
        return await retry_async(_do, label="fetch_balance", max_attempts=5)

    async def get_available_usdt(self) -> float:
        bal = await self.fetch_balance()
        free = bal.get("free", {})
        return safe_float(free.get(config.QUOTE_CURRENCY, 0.0))

    async def get_total_usdt_balance(self) -> float:
        try:
            bal = await self.fetch_balance()
            total = bal.get("total", {})
            val = safe_float(total.get(config.QUOTE_CURRENCY, 0.0))
            if val > 0:
                return val
            free = bal.get("free", {})
            return safe_float(free.get(config.QUOTE_CURRENCY, 0.0))
        except Exception as exc:
            logger.warning("Failed to fetch total USDT balance: %s", exc)
            return 0.0

    async def fetch_ticker(self, symbol: str) -> dict[str, Any]:
        async def _do() -> dict[str, Any]:
            return await self.exchange.fetch_ticker(symbol)
        return await retry_async(_do, label=f"fetch_ticker({symbol})", max_attempts=3)

    async def fetch_ohlcv(
        self, symbol: str, timeframe: str = "1d", limit: int = 2
    ) -> list[list]:
        async def _do() -> list[list]:
            return await self.exchange.fetch_ohlcv(symbol, timeframe=timeframe, limit=limit)
        return await retry_async(_do, label=f"fetch_ohlcv({symbol})", max_attempts=3)

    async def get_daily_open_price(self, symbol: str) -> Optional[float]:
        try:
            ohlcv = await self.fetch_ohlcv(symbol, "1d", limit=1)
            if ohlcv:
                return float(ohlcv[-1][1])
        except Exception as exc:
            logger.warning("Could not fetch daily open for %s: %s", symbol, exc)
        return None

    async def create_market_order(
        self,
        symbol: str,
        side: str,
        amount: float,
        params: Optional[dict] = None,
    ) -> dict[str, Any]:
        params = params or {}

        async def _do() -> dict[str, Any]:
            return await self.exchange.create_order(
                symbol=symbol,
                type="market",
                side=side,
                amount=amount,
                params=params,
            )

        order = await retry_async(_do, label=f"market_order({symbol},{side})", max_attempts=3)
        logger.info(
            "Market order placed: %s %s qty=%.6f order_id=%s",
            side, symbol, amount, order.get("id"),
        )
        return order

    async def fetch_open_positions(self) -> list[dict[str, Any]]:
        async def _do() -> list[dict[str, Any]]:
            positions = await self.exchange.fetch_positions()
            return [
                p for p in positions
                if safe_float(p.get("contracts") or p.get("size"), 0) != 0
            ]
        try:
            return await retry_async(_do, label="fetch_positions", max_attempts=3)
        except Exception as exc:
            logger.warning("fetch_positions failed: %s", exc)
            return []

    def amount_to_precision(self, symbol: str, amount: float) -> float:
        return float(self.exchange.amount_to_precision(symbol, amount))

    def price_to_precision(self, symbol: str, price: float) -> float:
        return float(self.exchange.price_to_precision(symbol, price))

    def market(self, symbol: str) -> dict[str, Any]:
        return self._markets[symbol]


exchange = Exchange()
