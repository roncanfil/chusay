// The tables from the build guide. A Someday list is a trip with no start date.
// Field names follow the guide; a few extra columns keep the preview working (noted inline).
export const SCHEMA = /* sql */ `
CREATE TABLE IF NOT EXISTS trips (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  destination_name TEXT NOT NULL,
  country_name     TEXT NOT NULL,           -- shown on tiles and the trip header
  country_code     TEXT NOT NULL,           -- ISO 3166 numeric, matches the world map
  city_key         TEXT,                    -- preview only: which sketch map to draw
  center_lat       REAL,
  center_lng       REAL,
  start_date       TEXT,                    -- YYYY-MM-DD; NULL = Someday
  length_days      INTEGER NOT NULL DEFAULT 0,
  notes            TEXT NOT NULL DEFAULT '',
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS days (
  id       TEXT PRIMARY KEY,
  trip_id  TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,                -- date = start_date + position
  title    TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS days_trip ON days(trip_id, position);

CREATE TABLE IF NOT EXISTS ideas (
  id              TEXT PRIMARY KEY,
  trip_id         TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  google_place_id TEXT,
  name            TEXT NOT NULL,            -- the household's own label for the place
  category        TEXT NOT NULL,            -- sight, food, act, tour, stay, shop, or the id of one in categories
  kind            TEXT,                     -- from Google's primaryType: bakery, museum, …
  area            TEXT NOT NULL DEFAULT '',
  lat             REAL,
  lng             REAL,
  tags            TEXT NOT NULL DEFAULT '[]', -- JSON
  note            TEXT NOT NULL DEFAULT '',   -- the household's own text, never from Google
  source          TEXT NOT NULL DEFAULT '',   -- a URL, or who recommended it
  price           TEXT NOT NULL DEFAULT '',   -- stays: the price as typed or shown by the booking link
  image           TEXT NOT NULL DEFAULT '',   -- stays: the listing's preview picture URL
  position        INTEGER NOT NULL DEFAULT 0, -- keeps the list in the order ideas were saved
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ideas_trip ON ideas(trip_id, position);

-- either idea_id or own_title is set; own_* columns hold "your own" entries like meeting friends
CREATE TABLE IF NOT EXISTS stops (
  id           TEXT PRIMARY KEY,
  day_id       TEXT NOT NULL REFERENCES days(id) ON DELETE CASCADE,
  idea_id      TEXT REFERENCES ideas(id) ON DELETE CASCADE,
  position     INTEGER NOT NULL,
  time         TEXT NOT NULL DEFAULT '',
  own_title    TEXT,
  own_where    TEXT,
  own_note     TEXT,
  own_link     TEXT,
  own_place_id TEXT,
  own_lat      REAL,
  own_lng      REAL,
  CHECK (idea_id IS NOT NULL OR own_title IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS stops_day ON stops(day_id, position);
-- one idea sits on at most one day
CREATE UNIQUE INDEX IF NOT EXISTS stops_idea ON stops(idea_id) WHERE idea_id IS NOT NULL;

-- cached Wikivoyage + Claude output, per trip or per country
CREATE TABLE IF NOT EXISTS culture (
  id               INTEGER PRIMARY KEY,
  trip_id          TEXT REFERENCES trips(id) ON DELETE CASCADE,
  country_code     TEXT,
  language_variant TEXT,
  intro            TEXT,
  phrases          TEXT NOT NULL DEFAULT '[]', -- JSON
  dos              TEXT NOT NULL DEFAULT '[]', -- JSON
  donts            TEXT NOT NULL DEFAULT '[]', -- JSON
  regional         TEXT NOT NULL DEFAULT '[]', -- JSON: regional words, e.g. Portugal's beers and coffees
  source_url       TEXT,
  fetched_at       TEXT
);

-- one row per trip, no stars
CREATE TABLE IF NOT EXISTS feedback (
  trip_id    TEXT PRIMARY KEY REFERENCES trips(id) ON DELETE CASCADE,
  go_back    TEXT CHECK (go_back IN ('yes', 'maybe', 'no')),
  highlights TEXT NOT NULL DEFAULT '',
  next_time  TEXT NOT NULL DEFAULT ''
);

-- feeds suggestions
CREATE TABLE IF NOT EXISTS stop_votes (
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  vote    TEXT NOT NULL CHECK (vote IN ('love', 'ok', 'skip')),
  PRIMARY KEY (trip_id, idea_id)
);

-- Muhu: things to see in a country, kept without a trip or dates
CREATE TABLE IF NOT EXISTS muhu (
  id           TEXT PRIMARY KEY,
  country_code TEXT NOT NULL,              -- ISO 3166 numeric, matches the world map
  country_name TEXT NOT NULL,
  name         TEXT NOT NULL,
  categories   TEXT NOT NULL DEFAULT '[]', -- JSON, the first one gives the color
  want         TEXT NOT NULL DEFAULT '' CHECK (want IN ('high', 'med', 'low', '')),
  area         TEXT NOT NULL DEFAULT '',
  season       TEXT NOT NULL DEFAULT '',   -- when to go, as typed
  getting_there TEXT NOT NULL DEFAULT '',
  note         TEXT NOT NULL DEFAULT '',
  source       TEXT NOT NULL DEFAULT '',
  google_place_id TEXT,                    -- guessed by the app or picked by hand
  lat          REAL,
  lng          REAL,
  google_match TEXT NOT NULL DEFAULT '' CHECK (google_match IN ('auto', 'set', 'none', '')),
  image        TEXT NOT NULL DEFAULT '',   -- our own picture: a link, or a file in the photos folder
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- categories the household added, for trip ideas or for Muhu
CREATE TABLE IF NOT EXISTS categories (
  id         TEXT PRIMARY KEY,
  scope      TEXT NOT NULL CHECK (scope IN ('trip', 'muhu')),
  label      TEXT NOT NULL,
  color      TEXT NOT NULL,
  icon       TEXT NOT NULL,                -- an SVG path
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Muhu searches kept under a name, with their filters
CREATE TABLE IF NOT EXISTS muhu_searches (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  query      TEXT NOT NULL DEFAULT '',
  category   TEXT NOT NULL DEFAULT '',    -- comma-separated; '' = all categories
  want       TEXT NOT NULL DEFAULT 'any', -- 'any', or high / med / low / '' (not set)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- manual overrides only; otherwise the status is derived from trips. A country can hold several.
CREATE TABLE IF NOT EXISTS country_status (
  country_code TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('visited', 'planning', 'want', 'nope')),
  PRIMARY KEY (country_code, status)
);

-- older trips logged by hand
CREATE TABLE IF NOT EXISTS visits (
  id           TEXT PRIMARY KEY,
  country_code TEXT NOT NULL,
  places       TEXT NOT NULL,
  month        TEXT NOT NULL                -- YYYY-MM
);

-- one shared row for the household
CREATE TABLE IF NOT EXISTS preferences (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  interests   TEXT NOT NULL DEFAULT '[]',   -- JSON
  pace        TEXT NOT NULL DEFAULT 'balanced' CHECK (pace IN ('relaxed', 'balanced', 'packed')),
  budget      INTEGER NOT NULL DEFAULT 2 CHECK (budget BETWEEN 1 AND 4),
  diets       TEXT NOT NULL DEFAULT '[]',   -- JSON
  show_photos INTEGER NOT NULL DEFAULT 1
);

-- suggestions marked "not for us" (the preview's sample places have no Google id, so it stores the name)
CREATE TABLE IF NOT EXISTS dismissed_picks (
  google_place_id TEXT PRIMARY KEY
);
`;
