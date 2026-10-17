#!/usr/bin/env bash
# Nightly copy of the database into ./backups, kept for 30 days. Run by chusay-backup.timer.
# Uses SQLite's backup API, so it's safe while the app is running. Copy ./backups off the server now and then.
set -euo pipefail
cd "$(dirname "$0")"
file="chusay-$(date +%F).db"
docker compose exec -T app node -e "require('better-sqlite3')('/data/chusay.db').backup('/backups/$file').then(() => console.log('Backed up to backups/$file'))"
find backups -name 'chusay-*.db' -mtime +30 -delete
