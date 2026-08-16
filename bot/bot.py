"""
Main entry point for the Cryptocurrency Trading Bot.
"""

from __future__ import annotations

import asyncio
import signal
import sys

from config import config
from database import db
from exchange import exchange
from logger import logger
from scanner import scanner
from state import state
from telegram import telegram
from trade_manager import trade_manager
from websocket import ws_manager


class TradingBot:
    def __init__(self) -> None:
        self._shutdown_event = asyncio.Event()
        self._connectivity_task: asyncio.Task | None = None
        self._internet_ok = True

    async def start(self) -> None:
        logger.info("=" * 60)
        logger.info("Starting Cryptocurrency Trading Bot")
        logger.info("Exchange: %s | Testnet: %s", config.EXCHANGE_ID, config.TESTNET)
        logger.info(
            "Leverage: %dx | Margin: %s | Max symbols: %d",
            config.DEFAULT_LEVERAGE,
            config.MARGIN_MODE,
            config.MAX_SYMBOLS,
        )
        logger.info("=" * 60)

        try:
            config.validate()
        except ValueError as exc:
            logger.critical("Configuration error: %s", exc)
            sys.exit(1)

        await db.connect()
        await telegram.start()
        await telegram.notify_bot_started()

        await exchange.connect()
        await exchange.setup_all_risk()

        await trade_manager.reconcile_with_exchange()
        await state.load_from_db()

        await scanner.start()
        await ws_manager.start()

        self._connectivity_task = asyncio.create_task(self._connectivity_loop())

        logger.info("Bot is fully operational – monitoring markets")
        await self._shutdown_event.wait()

    async def stop(self) -> None:
        logger.info("Shutting down …")
        self._shutdown_event.set()

        if self._connectivity_task is not None:
            self._connectivity_task.cancel()
            try:
                await self._connectivity_task
            except asyncio.CancelledError:
                pass

        await scanner.stop()
        await ws_manager.stop()
        await exchange.close()
        await telegram.stop()
        await db.close()
        logger.info("Shutdown complete")

    def request_shutdown(self) -> None:
        logger.info("Shutdown signal received")
        self._shutdown_event.set()

    async def _connectivity_loop(self) -> None:
        while not self._shutdown_event.is_set():
            try:
                await asyncio.sleep(config.CONNECTIVITY_CHECK_INTERVAL)
                await exchange.fetch_ticker(
                    exchange.symbols[0] if exchange.symbols else "BTC/USDT"
                )
                if not self._internet_ok:
                    self._internet_ok = True
                    logger.info("Connectivity restored")
                    await telegram.notify_internet_restored()
            except asyncio.CancelledError:
                break
            except Exception as exc:
                if self._internet_ok:
                    self._internet_ok = False
                    logger.warning("Connectivity lost: %s", exc)
                    await telegram.notify_internet_down()


async def _main() -> None:
    bot = TradingBot()
    loop = asyncio.get_running_loop()

    def _signal_handler() -> None:
        bot.request_shutdown()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _signal_handler)
        except NotImplementedError:
            signal.signal(sig, lambda s, f: _signal_handler())

    try:
        await bot.start()
    except Exception as exc:
        logger.exception("Fatal error: %s", exc)
        try:
            await telegram.notify_error(f"Fatal: {exc}")
        except Exception:
            pass
    finally:
        await bot.stop()


def main() -> None:
    try:
        asyncio.run(_main())
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
