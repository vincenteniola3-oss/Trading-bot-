#!/usr/bin/env python3
"""Database initialization script."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from database import db
from logger import logger


async def main() -> None:
    logger.info("Initializing database …")
    await db.connect()
    logger.info("Schema applied successfully at %s", db.path)
    await db.close()


if __name__ == "__main__":
    asyncio.run(main())
