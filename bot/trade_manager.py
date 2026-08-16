"""
Trade Manager – order execution, position sizing, pair locking, reconciliation.
"""

from __future__ import annotations

from typing import Any, Optional

from config import config
from database import db
from exchange import exchange
from logger import logger
from state import state
from strategy import strategy
from telegram import telegram
from utils import format_duration


class TradeManager:
    def __init__(self) -> None:
        self._pending: set[str] = set()

    async def calculate_quantity(self, symbol: str, price: float) -> float:
        if config.POSITION_SIZE_MODE == "fixed":
            usdt_size = config.FIXED_TRADE_SIZE_USDT
        else:
            balance = await exchange.get_available_usdt()
            usdt_size = balance * (config.PERCENT_OF_BALANCE / 100.0)

        if usdt_size <= 0 or price <= 0:
            return 0.0

        raw_qty = usdt_size / price
        qty = exchange.amount_to_precision(symbol, raw_qty)
        return float(qty)

    async def open_position(
        self,
        symbol: str,
        side: str,
        current_price: float,
        daily_open: float,
    ) -> bool:
        if symbol in self._pending:
            return False
        self._pending.add(symbol)

        try:
            if state.is_locked(symbol) or state.get_position(symbol):
                logger.debug("Skip open %s – already locked or open", symbol)
                return False

            total_assets = await exchange.get_total_usdt_balance()
            if total_assets > 0:
                max_allowed = strategy.get_max_positions_for_balance(total_assets)
                current_open = len(state.positions)
                if current_open >= max_allowed:
                    logger.info(
                        "Skip open %s – balance $%.2f limits max open positions to %d (currently active: %d)",
                        symbol, total_assets, max_allowed, current_open,
                    )
                    return False

            qty = await self.calculate_quantity(symbol, current_price)
            if qty <= 0:
                logger.warning("Calculated quantity is zero for %s – skipping", symbol)
                return False

            await exchange.setup_symbol_risk(symbol)

            order = await exchange.create_market_order(symbol, side, qty)
            order_id = str(order.get("id", ""))

            fill_price = float(
                order.get("average")
                or order.get("price")
                or current_price
            )
            if not order.get("average") and not order.get("price"):
                logger.warning(
                    "No fill price in order response for %s – using live price %.8f",
                    symbol, current_price,
                )
            tp = strategy.calc_take_profit(side, fill_price)

            await db.insert_position(
                symbol=symbol,
                side=side,
                entry_price=fill_price,
                quantity=qty,
                take_profit=tp,
                daily_open=daily_open,
                exchange_order_id=order_id,
            )
            await db.lock_pair(symbol, reason="position_open")

            state.set_position(symbol, {
                "symbol": symbol,
                "side": side,
                "entry_price": fill_price,
                "quantity": qty,
                "take_profit": tp,
                "daily_open": daily_open,
                "exchange_order_id": order_id,
                "status": "open",
            })

            logger.info(
                "OPENED %s %s @ %.8f qty=%.6f TP=%.8f (daily_open=%.8f)",
                side.upper(), symbol, fill_price, qty, tp, daily_open,
            )
            await telegram.notify_trade_opened(symbol, side, fill_price, qty, tp)
            return True

        except Exception as exc:
            logger.exception("Failed to open position on %s: %s", symbol, exc)
            await telegram.notify_error(f"Open {symbol} failed: {exc}")
            return False
        finally:
            self._pending.discard(symbol)

    async def close_position(self, symbol: str, current_price: float) -> bool:
        if symbol in self._pending:
            return False
        self._pending.add(symbol)

        try:
            pos = state.get_position(symbol) or await db.get_position(symbol)
            if not pos:
                return False

            side = pos["side"]
            qty = float(pos["quantity"])
            close_side = "sell" if side == "buy" else "buy"

            order = await exchange.create_market_order(
                symbol, close_side, qty, params={"reduceOnly": True},
            )
            order_id = str(order.get("id", ""))
            exit_price = float(
                order.get("average")
                or order.get("price")
                or current_price
            )

            closed = await db.close_position(symbol, exit_price, order_id)
            state.remove_position(symbol)

            if closed is None:
                return False

            duration = format_duration(closed["duration_sec"])
            logger.info(
                "CLOSED %s %s entry=%.8f exit=%.8f PnL=%.2f%% duration=%s",
                side.upper(), symbol, closed["entry_price"], exit_price,
                closed["pnl_pct"], duration,
            )
            await telegram.notify_trade_closed(
                symbol=symbol,
                side=side,
                entry=closed["entry_price"],
                exit_price=exit_price,
                pnl_pct=closed["pnl_pct"],
                duration=duration,
            )
            return True

        except Exception as exc:
            logger.exception("Failed to close position on %s: %s", symbol, exc)
            await telegram.notify_error(f"Close {symbol} failed: {exc}")
            return False
        finally:
            self._pending.discard(symbol)

    async def reconcile_with_exchange(self) -> None:
        logger.info("Reconciling positions with exchange …")
        try:
            exchange_positions = await exchange.fetch_open_positions()

            # Preserve local open positions in testnet/simulated mode or when exchange returns empty list
            if not exchange_positions and (config.TESTNET or not config.API_KEY):
                logger.info("Testnet/Simulated mode: Preserving local open positions without exchange wipe.")
                await state.load_from_db()
                return

            exchange_map: dict[str, dict[str, Any]] = {}
            for p in exchange_positions:
                sym = p.get("symbol")
                if not sym:
                    continue
                contracts = float(p.get("contracts") or p.get("size") or 0)
                if contracts == 0:
                    continue
                side_raw = (p.get("side") or "").lower()
                if side_raw in ("long", "buy"):
                    side = "buy"
                elif side_raw in ("short", "sell"):
                    side = "sell"
                else:
                    side = "buy" if contracts > 0 else "sell"
                entry = float(p.get("entryPrice") or p.get("average") or 0)
                if entry <= 0:
                    continue
                exchange_map[sym] = {
                    "side": side,
                    "quantity": abs(contracts),
                    "entry_price": entry,
                }

            local_positions = await db.get_open_positions()
            local_symbols = {p["symbol"] for p in local_positions}

            if exchange_map:
                for pos in local_positions:
                    if pos["symbol"] not in exchange_map:
                        logger.warning(
                            "Local position %s not found on exchange – marking closed",
                            pos["symbol"],
                        )
                        await db.close_position(pos["symbol"], float(pos["entry_price"]))
                        state.remove_position(pos["symbol"])

            for sym, ep in exchange_map.items():
                if sym in local_symbols:
                    continue
                side = ep["side"]
                entry = ep["entry_price"]
                qty = ep["quantity"]
                tp = strategy.calc_take_profit(side, entry)
                daily_open = entry
                logger.warning(
                    "Importing exchange position %s %s @ %.8f qty=%.6f TP=%.8f",
                    side.upper(), sym, entry, qty, tp,
                )
                await db.insert_position(
                    symbol=sym,
                    side=side,
                    entry_price=entry,
                    quantity=qty,
                    take_profit=tp,
                    daily_open=daily_open,
                    exchange_order_id=None,
                )
                await db.lock_pair(sym, reason="imported_from_exchange")
                state.set_position(sym, {
                    "symbol": sym,
                    "side": side,
                    "entry_price": entry,
                    "quantity": qty,
                    "take_profit": tp,
                    "daily_open": daily_open,
                    "status": "open",
                })
                await telegram.notify_error(
                    f"Imported open position from exchange: {side.upper()} {sym} @ {entry}"
                )

            await state.load_from_db()

            logger.info(
                "Reconciliation done – local open: %d, exchange open: %d",
                len(state.positions),
                len(exchange_map),
            )
        except Exception as exc:
            logger.exception("Reconciliation failed: %s", exc)

    async def close_all_positions_eod(self) -> None:
        logger.info("End of Day reached – closing all open positions...")
        positions = list(state.positions.values())
        if not positions:
            logger.info("No active positions to close for EOD.")
            return

        for pos in positions:
            symbol = pos["symbol"]
            try:
                live_price = state.get_last_price(symbol) or float(pos["entry_price"])
                logger.info("EOD Closing position %s at live_price=%.8f", symbol, live_price)
                await self.close_position(symbol, live_price)
            except Exception as exc:
                logger.exception("Failed to close EOD position for %s: %s", symbol, exc)


trade_manager = TradeManager()
