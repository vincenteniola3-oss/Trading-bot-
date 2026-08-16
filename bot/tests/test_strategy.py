"""
Unit tests for critical strategy and utility components.
Run with: pytest tests/ -v or python3 -m unittest discover -s bot/tests
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

# Add bot directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from strategy import Strategy
from utils import format_duration, safe_float


class TestStrategy(unittest.TestCase):
    def setUp(self) -> None:
        self.strat = Strategy()
        self.strat.entry_threshold = 20.0
        self.strat.tp_pct = 5.0

    def test_calc_move_pct_positive(self) -> None:
        self.assertAlmostEqual(self.strat.calc_move_pct(100.0, 120.0), 20.0)

    def test_calc_move_pct_negative(self) -> None:
        self.assertAlmostEqual(self.strat.calc_move_pct(100.0, 80.0), -20.0)

    def test_should_enter_buy(self) -> None:
        side = self.strat.should_enter("BTC/USDT", 100.0, 120.0, is_locked=False)
        self.assertEqual(side, "buy")

    def test_should_enter_sell(self) -> None:
        side = self.strat.should_enter("BTC/USDT", 100.0, 80.0, is_locked=False)
        self.assertEqual(side, "sell")

    def test_should_not_enter_below_threshold(self) -> None:
        side = self.strat.should_enter("BTC/USDT", 100.0, 115.0, is_locked=False)
        self.assertIsNone(side)

    def test_should_not_enter_when_locked(self) -> None:
        side = self.strat.should_enter("BTC/USDT", 100.0, 125.0, is_locked=True)
        self.assertIsNone(side)

    def test_calc_take_profit_buy(self) -> None:
        tp = self.strat.calc_take_profit("buy", 120.0)
        self.assertAlmostEqual(tp, 126.0)

    def test_calc_take_profit_sell(self) -> None:
        tp = self.strat.calc_take_profit("sell", 80.0)
        self.assertAlmostEqual(tp, 76.0)

    def test_should_exit_buy(self) -> None:
        self.assertTrue(self.strat.should_exit("buy", 120.0, 126.0, 126.0))
        self.assertFalse(self.strat.should_exit("buy", 120.0, 126.0, 125.9))

    def test_should_exit_sell(self) -> None:
        self.assertTrue(self.strat.should_exit("sell", 80.0, 76.0, 76.0))
        self.assertFalse(self.strat.should_exit("sell", 80.0, 76.0, 76.1))

    def test_get_max_positions_for_balance(self) -> None:
        self.assertEqual(self.strat.get_max_positions_for_balance(8.0), 1)
        self.assertEqual(self.strat.get_max_positions_for_balance(10.0), 1)
        self.assertEqual(self.strat.get_max_positions_for_balance(12.0), 2)
        self.assertEqual(self.strat.get_max_positions_for_balance(15.0), 3)
        self.assertEqual(self.strat.get_max_positions_for_balance(20.0), 4)
        self.assertEqual(self.strat.get_max_positions_for_balance(50.0), 5)
        self.assertEqual(self.strat.get_max_positions_for_balance(100.0), 5)
        self.assertGreater(self.strat.get_max_positions_for_balance(150.0), 100)


class TestUtils(unittest.TestCase):
    def test_format_duration(self) -> None:
        self.assertIn("1d", format_duration(90061))
        self.assertIn("1h", format_duration(3661))

    def test_safe_float(self) -> None:
        self.assertEqual(safe_float("3.14"), 3.14)
        self.assertEqual(safe_float(None, 0.0), 0.0)
        self.assertEqual(safe_float("abc", 1.5), 1.5)


if __name__ == "__main__":
    unittest.main()
