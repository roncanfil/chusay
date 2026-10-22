# Ch’usay

A trip planner for one household: plan the next trip, collect ideas for places you have no dates for yet, and keep every past trip. Two people share one space, with no accounts. Self-hosted: one Docker container and one SQLite file.

- **Trips**: tiles for trips coming up, Someday lists and trips you’ve been on. Any trip can be renamed and its dates changed, past ones too.
- **Itinerary**: each day is a colored line of stops you drag between days, with your own notes and optional times.
- **Ideas**: places saved with Google search or typed in by hand, grouped by category (an idea can be under several), with a map. Sections and the ideas in them drag into your order; stays and rental cars can be compared side by side. Categories can be added (name, color, icon) wherever one is picked, for trips and for Muhu.
- **Muhu**: ideas of things to see in a country, kept without a trip or dates, as photo tiles or a list. Pick a country or a category, search every idea and filter by one or more categories or by wish (searches can be saved for both of you); on wide screens the picked idea's photo, map pin and details sit on the right. Each idea is matched to Google once (fixable) for its photo and pin, or gets our own picture, uploaded or linked. A Notion export (.zip or CSV) can be imported, and any idea can be copied onto a trip in that country.
- **World map**: countries colored by visited, planning and wish list; picking one zooms in on it. Visits logged by hand can be edited.
- Color coding everywhere and everything opens in place, no pop-ups.

## Run it locally

```bash
cp .env.example .env.local   # DEMO_MODE=true: start with sample trips
npm install
npm run dev                  # http://localhost:3000
```

The SQLite file is created at `./data/chusay.db` on first start (override with `DATABASE_PATH`). With `DEMO_MODE=true` a new database starts with sample trips and the header offers **Reset sample data**; without it the app starts empty and can’t be reset.

## Deploy on your own server

The repo’s CI publishes a Docker image to `ghcr.io/roncanfil/chusay` (amd64 and arm64) on every push to `main`.

### CasaOS

1. In CasaOS: **App Store → Custom Install → Import**, and paste [`casaos/docker-compose.yml`](casaos/docker-compose.yml).
2. Change `APP_PASSWORD` (the shared password; the app asks for it once per browser) and add Google keys if you have them. Pick another host port than `3210` if it’s taken.
3. Install, then open the app from the CasaOS dashboard.

The data lives in `/DATA/AppData/chusay/data` (the database, and pictures uploaded for Muhu ideas in `photos/`), with a copy of the database every night in `/DATA/AppData/chusay/backups` (kept 30 days) and of every uploaded picture in `backups/photos`.

### Deploy on every push

The compose file also runs a small deployer ([Watchtower](https://github.com/nicholas-fedor/watchtower) in HTTP API mode, pinned to a release). It never checks for updates on its own: it installs the newest Ch’usay image only when called with its token, and only touches the Ch’usay container. After publishing an image, CI calls it and waits until the site’s `/api/version` reports the new commit.

1. Make a long random token (`openssl rand -hex 32`) and put it in the compose file as `WATCHTOWER_HTTP_API_TOKEN`.
2. Give the deployer a hostname, e.g. a Cloudflare Tunnel route from `deploy.example.com` to host port `3211`.
3. In the GitHub repo, set the variables and the secret:
   ```bash
   gh variable set SITE_URL --body https://trips.example.com
   gh variable set DEPLOY_URL --body https://deploy.example.com
   gh secret set DEPLOY_TOKEN   # paste the token
   ```

Without them CI still publishes the image and skips deploying.

## Changing it with Claude

The repo is set up for [Claude Code on the web](https://claude.ai/code) and the Code tab of the Claude mobile app: `CLAUDE.md` tells Claude how to check a change, push it to `main` and wait with `scripts/wait-for-deploy.sh` until it’s live, and `.claude/settings.json` installs dependencies when a web session starts. Each person connects their own GitHub account in Claude and needs write access to the repo.

The app serves plain HTTP on port 3000 inside the container. For access from outside your network, put HTTPS in front (for example a Cloudflare Tunnel to the host port) and keep `APP_PASSWORD` set. Restrict the Google browser key to that address.

### Any Docker host

```bash
docker run -d --name chusay -p 3210:3000 -v chusay-data:/data -e APP_PASSWORD=change-me ghcr.io/roncanfil/chusay:latest
```

### Settings

| Variable | What it does |
| --- | --- |
| `APP_PASSWORD` | Shared password for the whole site, built into the app (off when empty). |
| `BACKUP_DIR`, `BACKUP_KEEP_DAYS` | Copy the database into this folder every day and keep this many days. |
| `DEMO_MODE` | `true` starts a new database with sample trips and shows **Reset sample data**. |
| `DATABASE_PATH` | Where the SQLite file lives (`/data/chusay.db` in the image). |
| `GOOGLE_MAPS_BROWSER_KEY`, `GOOGLE_MAPS_MAP_ID`, `GOOGLE_PLACES_SERVER_KEY` | Turn on Google Maps, search and photos. |
| `ANTHROPIC_API_KEY` | Culture tab: each country's phrases and customs, summarized by Claude from Wikivoyage and saved per country. |

## CI

`.github/workflows/ci.yml` type-checks, lints and builds every push and pull request. Pushes to `main` also build the image for `linux/amd64` and `linux/arm64` and publish it, tagged `latest` and with the commit.

## Stack

| Part | Choice |
| --- | --- |
| Web app | Next.js 16 (App Router, Cache Components), React 19, TypeScript |
| Database | SQLite via `better-sqlite3` (prebuilt binaries, no compiler needed in Docker) |
| State in the browser | A small `useSyncExternalStore` store with Immer (`src/lib/store.ts`) |
| Drag and drop | SortableJS |

## How it fits together

- `src/app/` – routes: `/` trips, `/trips/[id]` trip page, `/muhu` ideas by country, `/world` world map, and `api/*` route handlers.
- `src/components/` – the UI, one folder per page, plus the sketch maps in `map/`.
- `src/lib/` – types, constants, date and format helpers, picks and search, and sample data (`seed.ts`, `data/`).
- `src/server/` – SQLite: `schema.ts` (the tables), `repo.ts` (reads and writes), `validate.ts`.

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
- **Culture** without `ANTHROPIC_API_KEY`: sample phrases and customs (`src/lib/data/culture.ts`). With the key, each country's Wikivoyage page summarized by Claude, cached in the `culture` table.

## License

[MIT](LICENSE). World map shapes are derived from [Natural Earth](https://www.naturalearthdata.com) (public domain).
