#!/bin/sh
# Folders bind-mounted from the host (CasaOS, docker run -v) are often created by root.
# Hand them to the app's user, then drop root and start the app.
set -e
if [ "$(id -u)" = 0 ]; then
  for dir in /data "${BACKUP_DIR:-}"; do
    [ -n "$dir" ] && mkdir -p "$dir" && chown -R node:node "$dir"
  done
  exec setpriv --reuid=node --regid=node --init-groups "$@"
fi
exec "$@"
