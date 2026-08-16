"""
Async unit tests for SQLite Database layer.
"""

from __future__ import annotations

import asyncio
import unittest
import tempfile
import sys
from pathlib import Path

# Add bot directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from database import Database


class TestDatabase(unittest.TestCase):

    def test_database_crud_operations(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "test_trading.db"
            test_db = Database(path=db_path)

            async def _test():
                await test_db.connect()

                # 1. Save and query daily open
                await test_db.save_daily_open("SOLUSDT", "2026-07-27", 100.0)
                daily_open = await test_db.get_daily_open("SOLUSDT", "2026-07-27")
                self.assertEqual(daily_open, 100.0)

                # 2. Insert position
                pos_id = await test_db.insert_position(
                    symbol="SOLUSDT",
                    side="buy",
                    entry_price=120.0,
                    quantity=2.5,
                    take_profit=126.0,
                    daily_open=100.0,
                )
                self.assertGreater(pos_id, 0)

                # 3. Fetch open positions
                positions = await test_db.get_open_positions()
                self.assertEqual(len(positions), 1)
                self.assertEqual(positions[0]["symbol"], "SOLUSDT")

                # 4. Lock & check lock
                await test_db.lock_pair("SOLUSDT", reason="test")
                self.assertTrue(await test_db.is_locked("SOLUSDT"))

                # 5. Close position & check trade history
                closed = await test_db.close_position("SOLUSDT", exit_price=126.0, unlock=True)
                self.assertIsNotNone(closed)
                self.assertAlmostEqual(closed["pnl_pct"], 5.0)
                self.assertFalse(await test_db.is_locked("SOLUSDT"))

                # Verify no remaining open positions
                remaining = await test_db.get_open_positions()
                self.assertEqual(len(remaining), 0)

                await test_db.close()

            asyncio.run(_test())


if __name__ == "__main__":
    unittest.main()
