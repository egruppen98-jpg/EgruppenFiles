/*
# Create keno_draws table

1. Purpose
   Stores the most recent BCLC Keno Live BC draws (20 winning numbers 1-80, plus optional Keno Bonus).
   The app keeps the last 20 draws and uses them to compute the most statistically significant
   pair of numbers to play next. Older draws are pruned by the sync edge function so the table
   stays bounded at ~20 rows.

2. New Tables
   - `keno_draws`
     - `draw_nbr`   (integer, primary key) — BCLC draw number (monotonically increasing).
     - `draw_date`  (date, not null)      — calendar date of the draw (BC local).
     - `draw_time`  (text,   not null)     — "HH:MM:SS" draw time string from BCLC.
     - `numbers`    (integer[], not null)  — 20 winning numbers, each 1-80.
     - `bonus`      (integer, nullable)    — Keno Bonus number when present (1-80).
     - `fetched_at` (timestamptz, default now()) — when the row was stored.

3. Indexes
   - Primary key on `draw_nbr` (used for upsert + ordering).
   - Index on `draw_date` for date-range queries.

4. Security
   - Single-tenant, no-auth app: data is intentionally public/shared.
   - Enable RLS on `keno_draws`.
   - Grant SELECT to `anon, authenticated` so the anon-key frontend can read.
   - Grant INSERT, UPDATE, DELETE to `anon, authenticated` so the frontend can add/edit draws
     manually (manual entry fallback when the BCLC feed is geo-blocked) and the edge function's
     service-role upserts work (service_role bypasses RLS but still needs the grant).
   - Grant the same verbs to `service_role` for the sync edge function.
   - Policies use `USING (true)` / `WITH CHECK (true)` because the data is intentionally public.

5. Notes
   - `numbers` is `integer[]` so pair-frequency stats can be computed server-side via array
     operators if needed, though the app computes them client-side.
   - No `user_id` / auth columns — this is a shared single-tenant tracker.
*/

CREATE TABLE IF NOT EXISTS keno_draws (
  draw_nbr   integer PRIMARY KEY,
  draw_date  date    NOT NULL,
  draw_time  text    NOT NULL,
  numbers    integer[] NOT NULL,
  bonus      integer,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS keno_draws_draw_date_idx ON keno_draws (draw_date);

ALTER TABLE keno_draws ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON keno_draws TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON keno_draws TO service_role;

DROP POLICY IF EXISTS "anon_read_keno_draws" ON keno_draws;
CREATE POLICY "anon_read_keno_draws"
  ON keno_draws FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_keno_draws" ON keno_draws;
CREATE POLICY "anon_insert_keno_draws"
  ON keno_draws FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_keno_draws" ON keno_draws;
CREATE POLICY "anon_update_keno_draws"
  ON keno_draws FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_keno_draws" ON keno_draws;
CREATE POLICY "anon_delete_keno_draws"
  ON keno_draws FOR DELETE
  TO anon, authenticated USING (true);
