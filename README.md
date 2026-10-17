# Ch’usay

A trip planner for one household: plan the next trip, collect ideas for places you have no dates for yet, and keep every past trip. Two people share one space, with no accounts. Self-hosted: one Docker container and one SQLite file.

- **Trips**: tiles for trips coming up, Someday lists and trips you’ve been on.
- **Itinerary**: each day is a colored line of stops you drag between days, with your own notes and optional times.
- **Ideas**: places saved with Google search or typed in by hand, grouped by category, with a map.
- **World map**: countries colored by visited, planning and wish list.
- Color coding everywhere and everything opens in place, no pop-ups.

## Run it locally

```bash
cp .env.example .env.local   # DEMO_MODE=true: start with sample trips
npm install
npm run dev                  # http://localhost:3000
```

The SQLite file is created at `./data/chusay.db` on first start (override with `DATABASE_PATH`). With `DEMO_MODE=true` a new database starts with sample trips and the header offers **Reset sample data**; without it the app starts empty and can’t be reset.

## Deploy on your own server

The repo’s CI publishes a Docker image to `ghcr.io/roncanfil/chusay` on every push to `main`. On an Ubuntu server, copy the `deploy/` folder over (or clone the repo) and run:

```bash
sudo ./deploy/install.sh
```

It installs Docker if needed, asks for your domain, a shared username and password, and optional Google keys, then starts:

- the app, with its database on a Docker volume;
- [Caddy](https://caddyserver.com) in front, with automatic HTTPS and the shared password (the app itself has no accounts);
- a timer that checks for a new image every 5 minutes and restarts the app only when there is one (`journalctl -u chusay-update`);
- a nightly backup of the database into `/opt/chusay/backups`, kept for 30 days. Copy those off the server now and then.

Before running it: point a DNS A record for your domain at the server, and make sure ports 80 and 443 reach it (forward them on your router if the server is at home). Settings live in `/opt/chusay/.env`; after editing, run `cd /opt/chusay && docker compose up -d`.

Running your own fork: CI publishes to `ghcr.io/<you>/<repo>` once you change the `github.repository` check in `.github/workflows/ci.yml`, and `CHUSAY_IMAGE` in `/opt/chusay/.env` tells the server which image to follow. A private repo’s image is private too: the installer asks for a GitHub token with `read:packages` to pull it.

To try the image without Caddy: `docker compose up -d --build` with the root `docker-compose.yml` serves it on port 3000.

## CI

`.github/workflows/ci.yml` type-checks, lints and builds every push and pull request. Pushes to `main` also build the image for `linux/amd64` and `linux/arm64` and publish it, tagged `latest` and with the commit. The server pulls it by itself, so GitHub never holds credentials for the server.

## Stack

| Part | Choice |
| --- | --- |
| Web app | Next.js 16 (App Router, Cache Components), React 19, TypeScript |
| Database | SQLite via `better-sqlite3` (prebuilt binaries, no compiler needed in Docker) |
| State in the browser | A small `useSyncExternalStore` store with Immer (`src/lib/store.ts`) |
| Drag and drop | SortableJS |

## How it fits together

- `src/app/` – routes: `/` trips, `/trips/[id]` trip page, `/world` world map, and `api/*` route handlers.
- `src/components/` – the UI, one folder per page, plus the sketch maps in `map/`.
- `src/lib/` – types, constants, date and format helpers, picks and search, and sample data (`seed.ts`, `data/`).
- `src/server/` – SQLite: `schema.ts` (eleven tables), `repo.ts` (reads and writes), `validate.ts`.

The browser loads everything from `GET /api/state`, applies each change at once, then sends only what changed: the edited trip (`PUT /api/trips/:id`, debounced while typing), a country status, a visit, preferences or a dismissed pick. Saving a trip only touches that trip’s rows. When a tab comes back into view it reloads, so you see the other person’s changes. If you both edit the same trip at the same moment, the last save wins.

View settings (map on or off, one day or all days, compact, divider width) stay in each browser’s local storage, as the guide suggests.

## Google Maps and Places

Set the keys in `.env` (see `.env.example`) and restart; nothing else changes. Without them the app keeps the preview’s sketch maps, sample search and drawings.

- **Map**: Google Maps JavaScript API with category pins, short name labels that flip left or hide when they’d overlap, and one route per day in its color. The browser gets its key from `GET /api/config` at request time, so a Docker image built without keys picks them up from the container.
- **Search and save** (`/api/places/search`): Places API (New) Text Search, biased to the trip’s center. Only the place id, name, kind, area and location are saved; Google never fills in notes, ratings, prices or hours.
- **Destinations** (`/api/places/destinations`): **+ New** takes any city, region or country and stores its center and country.
- **Photos** (`/api/places/photo`): loaded by place id when a row is shown, never stored; the photographer is credited when a row is opened.
- **Adding by hand**: any place can also be typed in without Google (no map pin).
- If Google rejects the browser key, maps fall back to the sketch (where there is one) with a note to check the key.

Google’s terms limit what can be stored and require photo attributions; check the current [Maps Platform terms](https://cloud.google.com/maps-platform/terms) before going live.

## Still sample data

- **Picks for you and Suggest a plan**: built from the sample catalog (`src/lib/data/catalog.ts`); next, Places Text Search queries built from the household’s preferences.
- **Culture**: sample phrases and customs (`src/lib/data/culture.ts`); next, Wikivoyage text summarized by Claude, cached in the `culture` table.

## License

[MIT](LICENSE). World map shapes are derived from [Natural Earth](https://www.naturalearthdata.com) (public domain).
