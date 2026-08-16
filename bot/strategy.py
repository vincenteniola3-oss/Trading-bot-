"""
Trading strategy engine.
"""

from __future__ import annotations

from typing import Optional

from config import config


class Strategy:
    def __init__(self) -> None:
        self.entry_threshold = config.ENTRY_THRESHOLD_PCT
        self.tp_pct = config.TAKE_PROFIT_PCT

    def calc_move_pct(self, daily_open: float, current: float) -> float:
        if daily_open <= 0:
            return 0.0
        return ((current - daily_open) / daily_open) * 100.0

    def should_enter(
        self,
        symbol: str,
        daily_open: float,
        current_price: float,
        is_locked: bool,
    ) -> Optional[str]:
        if is_locked:
            return None
        if daily_open <= 0 or current_price <= 0:
            return None
        move = self.calc_move_pct(daily_open, current_price)
        if abs(move) < self.entry_threshold:
            return None
        return "buy" if move > 0 else "sell"

    def calc_take_profit(self, side: str, entry_price: float) -> float:
        if self.tp_pct <= 0:
            return 0.0
        if side == "buy":
            return entry_price * (1.0 + self.tp_pct / 100.0)
        return entry_price * (1.0 - self.tp_pct / 100.0)

    def get_max_positions_for_balance(self, total_assets: float) -> int:
        """
        Calculates max concurrent open positions based on total account USDT balance/assets:
        - <= $10: 1 pair
        - <= $12: 2 pairs
        - <= $15: 3 pairs
        - <= $20: 4 pairs
        - <= $100: 5 pairs
        - > $100: unlimited (multiple entries allowed)
        """
        if total_assets <= 10.0:
            return 1
        elif total_assets <= 12.0:
            return 2
        elif total_assets <= 15.0:
            return 3
        elif total_assets <= 20.0:
            return 4
        elif total_assets <= 100.0:
            return 5
        else:
            return 999999

    def should_exit(
        self,
        side: str,
        entry_price: float,
        take_profit: float,
        current_price: float,
    ) -> bool:
        if take_profit <= 0:
            return False
        if side == "buy":
            return current_price >= take_profit
        return current_price <= take_profit


strategy = Strategy()
