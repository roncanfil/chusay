# Ch’usay

A trip planner for one household (two people sharing one space, no accounts). Next.js 16 App Router + React 19 + TypeScript, SQLite through API routes, deployed as a Docker image on the household’s CasaOS server. See README.md for the full picture.

@AGENTS.md

## Who asks for changes

Changes are usually dictated by the two people who use the app, often from the Claude mobile app. They are not necessarily developers:

- Explain what you changed in plain words, as it looks in the app, not as code.
- If a request is ambiguous, ask one short question before building.
- Ask before anything that deletes or rewrites their data, changes how data is stored, or removes a feature.

## Shipping a change

Every push to `main` goes live on their server within a few minutes. Work directly on `main`, one change per commit.

1. Make the change, matching the surrounding code (see Conventions).
2. Check it — all four must pass before you commit:
   ```bash
   npx next typegen && npx tsc --noEmit && npm run lint && npm run build
   ```
3. Commit with a short message saying what changed for the user, then push straight to main:
   ```bash
   git push origin HEAD:main
   ```
   If the push is rejected because main moved, run `git pull --rebase origin main`, re-run the checks, and push again.
4. Wait for it to go live and report back:
   ```bash
   scripts/wait-for-deploy.sh
   ```
   It follows CI (checks → image → deploy) and prints `LIVE` once the server runs the new commit. If it prints `FAILED`, open the run it links (`gh api repos/roncanfil/chusay/actions/runs/<id>/jobs`, then the failed job’s log), fix the cause, and ship again. Tell them when it’s live so they can reload the page.

## How it’s built

- `src/app/` routes: `/` trips, `/trips/[id]` (tabs: Itinerary, Ideas, Culture, Feedback), `/world`, and `api/*` route handlers.
- `src/components/` UI per page; `map/` has the Google map and the SVG sketch-map fallback.
- `src/lib/store.ts` is the browser store: `update(fn)` applies an Immer change at once and syncs only what changed to the API (`PUT /api/trips/:id` for a trip). Use `editTrip` / `editIdea` / `update` for every data change.
- `src/server/` is SQLite: `schema.ts` (tables), `repo.ts` (load/save), `db.ts` (opening and **migrations**), `validate.ts`, `google.ts` (Places API).
- Cache Components is on: dynamic route params are read inside `<Suspense>`, and GET route handlers that read data call `await connection()`. Hidden routes stay mounted (React `<Activity>`), so use refs instead of global DOM queries or ids.

## The household’s data is real

The SQLite file on their server holds their actual trips.

- To change an existing table, add an entry to `MIGRATIONS` in `src/server/db.ts` **and** the same change in `src/server/schema.ts`. Never edit a migration that has shipped.
- New fields must be optional in the types (old rows won’t have them) and default sensibly in `repo.ts`.
- Keep `saveTrip` touching only that trip’s rows.

## Design rules (from the household; keep them)

- White, airy look; turquoise accent `#12A39F`; Plus Jakarta Sans; dark mode follows the system. Reuse the CSS variables and classes in `src/app/globals.css`.
- Color coding everywhere is a requirement, not decoration: each tab, day, category, trip status and section has its color.
- The list sits beside the map (map pinned at the top on phones); nobody should scroll to reach the map.
- Everything opens and closes in place. No pop-up windows or floating panels.
- Avoid: anything spreadsheet-like, dense card or chip grids, numbered stops, times that stand out more than places, star ratings, money signs and stop counts, strong cream or gray backgrounds, Pinterest- or blog-style layouts, photo or memory uploads, packing lists.
- Google only finds places and draws maps. It never fills in their notes, ratings, prices or hours. Save only the place id, name, kind, area and location; request only the fields shown (field masks).

## Conventions

- Match the surrounding code: its density, naming and idiom. Short comments that explain why.
- TypeScript strict; no new dependencies unless they clearly earn their place.
- Never commit secrets. Keys live in the server’s environment (see `.env.example`).
