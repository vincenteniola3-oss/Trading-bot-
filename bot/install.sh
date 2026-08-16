#!/usr/bin/env bash
set -euo pipefail

echo "=== Cryptocurrency Trading Bot – Installer ==="

if command -v python3.12 &>/dev/null; then
    PYTHON=python3.12
elif command -v python3 &>/dev/null; then
    PYTHON=python3
else
    echo "ERROR: Python 3.12+ is required."
    exit 1
fi

echo "Using: $($PYTHON --version)"

if [ ! -d ".venv" ]; then
    echo "Creating virtual environment …"
    $PYTHON -m venv .venv
fi

source .venv/bin/activate

echo "Upgrading pip …"
pip install --upgrade pip

echo "Installing dependencies …"
pip install -r requirements.txt

if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "Created .env from .env.example – please edit it with your credentials."
else
    echo ".env already exists – skipping."
fi

mkdir -p logs database

echo "Initializing database …"
python init_db.py

echo ""
echo "=== Installation complete ==="
echo "1. Edit .env with your API keys"
echo "2. Run:  source .venv/bin/activate && python bot.py"
