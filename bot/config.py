"""
Configuration module for the Cryptocurrency Trading Bot.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

try:
    from dotenv import load_dotenv
except ImportError:
    def load_dotenv(dotenv_path=None):
        if dotenv_path and Path(dotenv_path).exists():
            with open(dotenv_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

_BOT_DIR = Path(__file__).resolve().parent
_ENV_PATH = _BOT_DIR / ".env"
if not _ENV_PATH.exists():
    _ENV_PATH = _BOT_DIR.parent / ".env"

load_dotenv(dotenv_path=_ENV_PATH)


@dataclass
class Config:
    """Central configuration for the trading bot."""

    API_KEY: str = field(default_factory=lambda: os.getenv("API_KEY", ""))
    API_SECRET: str = field(default_factory=lambda: os.getenv("API_SECRET", ""))
    EXCHANGE_ID: str = field(default_factory=lambda: os.getenv("EXCHANGE_ID", "binanceusdm"))
    TESTNET: bool = field(
        default_factory=lambda: os.getenv("TESTNET", "false").lower() in ("1", "true", "yes")
    )
    QUOTE_CURRENCY: str = field(default_factory=lambda: os.getenv("QUOTE_CURRENCY", "USDT"))

    DEFAULT_LEVERAGE: int = field(
        default_factory=lambda: int(os.getenv("DEFAULT_LEVERAGE", "20"))
    )
    MARGIN_MODE: str = field(
        default_factory=lambda: os.getenv("MARGIN_MODE", "isolated").lower()
    )

    POSITION_SIZE_MODE: Literal["fixed", "percent"] = field(
        default_factory=lambda: os.getenv("POSITION_SIZE_MODE", "fixed").lower()  # type: ignore
    )
    FIXED_TRADE_SIZE_USDT: float = field(
        default_factory=lambda: float(os.getenv("FIXED_TRADE_SIZE_USDT", "6.0"))
    )
    PERCENT_OF_BALANCE: float = field(
        default_factory=lambda: float(os.getenv("PERCENT_OF_BALANCE", "2.0"))
    )

    ENTRY_THRESHOLD_PCT: float = field(
        default_factory=lambda: float(os.getenv("ENTRY_THRESHOLD_PCT", "20.0"))
    )
    TAKE_PROFIT_PCT: float = field(
        default_factory=lambda: float(os.getenv("TAKE_PROFIT_PCT", "0.0"))
    )

    TELEGRAM_TOKEN: str = field(default_factory=lambda: os.getenv("TELEGRAM_TOKEN", ""))
    TELEGRAM_CHAT_ID: str = field(default_factory=lambda: os.getenv("TELEGRAM_CHAT_ID", ""))
    TELEGRAM_ENABLED: bool = field(
        default_factory=lambda: os.getenv("TELEGRAM_ENABLED", "true").lower()
        in ("1", "true", "yes")
    )

    BASE_DIR: Path = field(default_factory=lambda: Path(__file__).resolve().parent)
    DATABASE_PATH: Path = field(
        default_factory=lambda: Path(
            os.getenv(
                "DATABASE_PATH",
                str(Path(__file__).resolve().parent / "database" / "trading_bot.db"),
            )
        )
    )
    LOG_DIR: Path = field(
        default_factory=lambda: Path(
            os.getenv("LOG_DIR", str(Path(__file__).resolve().parent / "logs"))
        )
    )

    WEBSOCKET_RECONNECT_DELAY: float = field(
        default_factory=lambda: float(os.getenv("WEBSOCKET_RECONNECT_DELAY", "5.0"))
    )
    WEBSOCKET_PING_INTERVAL: float = field(
        default_factory=lambda: float(os.getenv("WEBSOCKET_PING_INTERVAL", "20.0"))
    )
    REST_RATE_LIMIT_SAFETY: float = field(
        default_factory=lambda: float(os.getenv("REST_RATE_LIMIT_SAFETY", "0.8"))
    )
    MAX_RECONNECT_ATTEMPTS: int = field(
        default_factory=lambda: int(os.getenv("MAX_RECONNECT_ATTEMPTS", "0"))
    )
    EXCLUDED_SYMBOLS: set[str] = field(
        default_factory=lambda: {
            s.strip().upper()
            for s in os.getenv("EXCLUDED_SYMBOLS", "").split(",")
            if s.strip()
        }
    )
    MIN_QUOTE_VOLUME_USDT: float = field(
        default_factory=lambda: float(os.getenv("MIN_QUOTE_VOLUME_USDT", "0.0"))
    )
    MAX_SYMBOLS: int = field(
        default_factory=lambda: int(os.getenv("MAX_SYMBOLS", "0"))
    )
    CONNECTIVITY_CHECK_INTERVAL: float = field(
        default_factory=lambda: float(os.getenv("CONNECTIVITY_CHECK_INTERVAL", "60.0"))
    )

    def validate(self) -> None:
        if not self.API_KEY or not self.API_SECRET:
            raise ValueError(
                "API_KEY and API_SECRET must be set in the environment or .env file."
            )
        if self.POSITION_SIZE_MODE not in ("fixed", "percent"):
            raise ValueError("POSITION_SIZE_MODE must be 'fixed' or 'percent'.")
        if self.FIXED_TRADE_SIZE_USDT <= 0 and self.POSITION_SIZE_MODE == "fixed":
            raise ValueError("FIXED_TRADE_SIZE_USDT must be positive.")
        if not (0 < self.PERCENT_OF_BALANCE <= 100) and self.POSITION_SIZE_MODE == "percent":
            raise ValueError("PERCENT_OF_BALANCE must be between 0 and 100.")
        if self.ENTRY_THRESHOLD_PCT <= 0:
            raise ValueError("ENTRY_THRESHOLD_PCT must be positive.")
        if self.TAKE_PROFIT_PCT < 0:
            raise ValueError("TAKE_PROFIT_PCT must be >= 0.")
        if self.DEFAULT_LEVERAGE < 1:
            raise ValueError("DEFAULT_LEVERAGE must be >= 1.")
        if self.MARGIN_MODE not in ("isolated", "cross"):
            raise ValueError("MARGIN_MODE must be 'isolated' or 'cross'.")
        if self.MAX_SYMBOLS < 0:
            raise ValueError("MAX_SYMBOLS must be >= 0.")

        self.LOG_DIR.mkdir(parents=True, exist_ok=True)
        self.DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)


config = Config()
