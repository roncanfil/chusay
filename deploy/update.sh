#!/usr/bin/env bash
# Pulls the newest image GitHub built and restarts the app only if it changed. Run by chusay-update.timer.
set -euo pipefail
cd "$(dirname "$0")"
docker compose pull --quiet
docker compose up -d --remove-orphans
docker image prune -f > /dev/null
