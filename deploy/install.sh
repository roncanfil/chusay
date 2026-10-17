#!/usr/bin/env bash
# Sets up Ch'usay on an Ubuntu server: Docker, the app behind HTTPS with one shared password,
# updates every 5 minutes from the image GitHub builds, and nightly database backups.
# Run from a copy of this deploy folder:  sudo ./install.sh   (safe to run again)
set -euo pipefail

DIR=/opt/chusay
HERE=$(cd "$(dirname "$0")" && pwd)
IMAGE_DEFAULT=ghcr.io/roncanfil/chusay:latest

[ "$(id -u)" = 0 ] || { echo "Please run with sudo: sudo $0"; exit 1; }

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

say "1/6 Docker"
if ! command -v docker > /dev/null; then
  curl -fsSL https://get.docker.com | sh
else
  echo "Docker is already installed: $(docker --version)"
fi
docker compose version > /dev/null || { echo "Docker Compose v2 is missing; install the docker-compose-plugin package."; exit 1; }

say "2/6 Files in $DIR"
mkdir -p "$DIR/backups"
chown 1000:1000 "$DIR/backups" # the app runs as the image's node user (uid 1000)
install -m 644 "$HERE/docker-compose.yml" "$HERE/Caddyfile" "$DIR/"
install -m 755 "$HERE/update.sh" "$HERE/backup.sh" "$DIR/"

say "3/6 Settings"
if [ -f "$DIR/.env" ]; then
  echo "Keeping the existing $DIR/.env (edit it to change settings, then: cd $DIR && docker compose up -d)"
else
  read -rp "Domain for the app (its DNS A record must point at this server): " DOMAIN
  read -rp "Username for the shared login [us]: " AUTH_USER; AUTH_USER=${AUTH_USER:-us}
  while :; do
    read -rsp "Password for the shared login: " PASS; echo
    read -rsp "Same password again: " PASS2; echo
    [ -n "$PASS" ] && [ "$PASS" = "$PASS2" ] && break
    echo "The passwords didn't match (or were empty). Try again."
  done
  # the password goes in through the environment, so it never shows up in the host's process list
  HASH=$(PASS="$PASS" docker run --rm -e PASS caddy:2 sh -c 'caddy hash-password --plaintext "$PASS"')
  read -rp "Google Maps browser key (Enter to skip): " MAPS_KEY
  read -rp "Google Places server key (Enter to skip): " PLACES_KEY
  umask 077
  cat > "$DIR/.env" <<EOF
# Ch'usay settings. After editing: cd $DIR && docker compose up -d
DOMAIN=$DOMAIN
BASIC_AUTH_USER=$AUTH_USER
BASIC_AUTH_HASH='$HASH'
CHUSAY_IMAGE=$IMAGE_DEFAULT
DEMO_MODE=false
GOOGLE_MAPS_BROWSER_KEY=$MAPS_KEY
GOOGLE_MAPS_MAP_ID=
GOOGLE_PLACES_SERVER_KEY=$PLACES_KEY
EOF
  umask 022
  echo "Saved $DIR/.env"
fi

say "4/6 The app image"
IMAGE=$(grep -E '^CHUSAY_IMAGE=' "$DIR/.env" | cut -d= -f2-); IMAGE=${IMAGE:-$IMAGE_DEFAULT}
if ! docker pull -q "$IMAGE" > /dev/null 2>&1; then
  echo "Couldn't pull $IMAGE. While the GitHub repo is private, the image is too."
  echo "Create a token at https://github.com/settings/tokens (classic, scope: read:packages)."
  read -rp "GitHub username: " GH_USER
  read -rsp "Token: " GH_TOKEN; echo
  printf '%s' "$GH_TOKEN" | docker login ghcr.io -u "$GH_USER" --password-stdin
  docker pull -q "$IMAGE" > /dev/null
fi

say "5/6 Firewall"
if command -v ufw > /dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 443/udp
else
  echo "ufw isn't active; make sure ports 80 and 443 reach this server (and forward them on your router if it's at home)."
fi

say "6/6 Start, automatic updates and backups"
install -m 644 "$HERE"/systemd/chusay-*.service "$HERE"/systemd/chusay-*.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now chusay-update.timer chusay-backup.timer
(cd "$DIR" && docker compose up -d)

DOMAIN=$(grep -E '^DOMAIN=' "$DIR/.env" | cut -d= -f2-)
say "Done. Open https://$DOMAIN"
cat <<EOF
- HTTPS certificates are fetched on the first visit (needs ports 80/443 and the DNS record).
- New versions install within 5 minutes of each push to main:  journalctl -u chusay-update
- Database backups land in $DIR/backups every night; copy them off the server now and then.
- Logs: cd $DIR && docker compose logs -f
EOF
