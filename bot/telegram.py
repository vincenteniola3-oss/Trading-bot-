"""
Telegram notification helper.
"""

from __future__ import annotations

from typing import Optional

import aiohttp

from config import config
from logger import logger


class TelegramNotifier:
    def __init__(self) -> None:
        self.token = config.TELEGRAM_TOKEN
        self.chat_id = config.TELEGRAM_CHAT_ID
        self.enabled = (
            config.TELEGRAM_ENABLED
            and bool(self.token)
            and bool(self.chat_id)
        )
        self._session: Optional[aiohttp.ClientSession] = None

    async def start(self) -> None:
        if self.enabled and self._session is None:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=10)
            )
            logger.info("Telegram notifier started")

    async def stop(self) -> None:
        if self._session is not None:
            await self._session.close()
            self._session = None
            logger.info("Telegram notifier stopped")

    async def send(self, message: str, parse_mode: str = "HTML") -> None:
        if not self.enabled:
            return
        if self._session is None:
            await self.start()

        url = f"https://api.telegram.org/bot{self.token}/sendMessage"
        payload = {
            "chat_id": self.chat_id,
            "text": message,
            "parse_mode": parse_mode,
            "disable_web_page_preview": True,
        }
        try:
            assert self._session is not None
            async with self._session.post(url, json=payload) as resp:
                if resp.status != 200:
                    body = await resp.text()
                    logger.warning("Telegram API returned %s: %s", resp.status, body)
        except Exception as exc:
            logger.warning("Failed to send Telegram message: %s", exc)

    async def notify_bot_started(self) -> None:
        await self.send("🚀 <b>Trading Bot Started</b>")

    async def notify_new_utc_day(self, date_str: str) -> None:
        await self.send(f"📅 <b>New UTC Day</b>: {date_str}")

    async def notify_trade_opened(
        self, symbol: str, side: str, entry: float, size: float, tp: float,
    ) -> None:
        msg = (
            f"🟢 <b>Trade Opened</b>\n"
            f"Symbol: <code>{symbol}</code>\n"
            f"Side: <b>{side.upper()}</b>\n"
            f"Entry: {entry:.8f}\n"
            f"Size: {size:.6f}\n"
            f"Take-Profit: {tp:.8f}"
        )
        await self.send(msg)

    async def notify_trade_closed(
        self, symbol: str, side: str, entry: float, exit_price: float,
        pnl_pct: float, duration: str,
    ) -> None:
        emoji = "💰" if pnl_pct >= 0 else "🔻"
        msg = (
            f"{emoji} <b>Trade Closed</b>\n"
            f"Symbol: <code>{symbol}</code>\n"
            f"Side: {side.upper()}\n"
            f"Entry: {entry:.8f}\n"
            f"Exit: {exit_price:.8f}\n"
            f"PnL: <b>{pnl_pct:+.2f}%</b>\n"
            f"Duration: {duration}"
        )
        await self.send(msg)

    async def notify_error(self, error: str) -> None:
        await self.send(f"⚠️ <b>Error</b>\n<code>{error[:500]}</code>")

    async def notify_internet_down(self) -> None:
        await self.send("🌐❌ Internet connection lost")

    async def notify_internet_restored(self) -> None:
        await self.send("🌐✅ Internet connection restored")

    async def notify_exchange_disconnected(self) -> None:
        await self.send("🔌❌ Exchange disconnected")

    async def notify_exchange_reconnected(self) -> None:
        await self.send("🔌✅ Exchange reconnected")


telegram = TelegramNotifier()
