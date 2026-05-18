#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/root/neural-love-telegram-bot}"
SERVICE="${SERVICE:-neural-love-bot}"

cd "$APP_DIR"
git pull --ff-only origin main
npm install --omit=dev
systemctl restart "$SERVICE"
systemctl is-active --quiet "$SERVICE" && echo "OK: $SERVICE is running"
