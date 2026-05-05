-- MMM-ScrumBoard – PostgreSQL Schema
-- psql -U gruppe3 -d postgres -f modules/B2B/MMM-ScrumBoard/schema.sql

CREATE TABLE IF NOT EXISTS scrum_sprints (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS scrum_cards (
  id           SERIAL PRIMARY KEY,
  sprint_id    INTEGER REFERENCES scrum_sprints(id) ON DELETE CASCADE,
  title        VARCHAR(255) NOT NULL,
  story_points INTEGER NOT NULL DEFAULT 1,
  assignee     VARCHAR(100) NOT NULL DEFAULT '',
  status       VARCHAR(20) NOT NULL DEFAULT 'todo'
                 CHECK (status IN ('todo','busy','done')),
  completed_at TIMESTAMP,
  created_at   TIMESTAMP DEFAULT NOW()
);

-- Default sprint (inserted only when table is empty)
INSERT INTO scrum_sprints (name, start_date, end_date)
SELECT 'Sprint 1', '2026-04-28', '2026-05-08'
WHERE NOT EXISTS (SELECT 1 FROM scrum_sprints);

-- Seed cards (only when no cards exist for the first sprint)
INSERT INTO scrum_cards (sprint_id, title, story_points, assignee, status, completed_at)
SELECT
  (SELECT id FROM scrum_sprints ORDER BY id LIMIT 1),
  title, story_points, assignee, status, completed_at
FROM (VALUES
  ('Repository einrichten',           3, 'Alle',   'done', '2026-04-29 10:00:00'::TIMESTAMP),
  ('B2B und B2C trennen',             2, 'Julian', 'done', '2026-04-30 14:00:00'::TIMESTAMP),
  ('Rasberry Pi einrichten',          3, 'Alle',   'done', '2026-04-28 16:00:00'::TIMESTAMP),
  ('Magic Mirror initial Screen',     2, 'Alle',   'done', '2026-04-29 09:00:00'::TIMESTAMP),
  ('Lokale Umgebung erstellen',       5, 'Julia',  'done', '2026-04-30 11:00:00'::TIMESTAMP),
  ('Flyer',                           8, 'Alle',   'busy', NULL),
  ('Rauchen',                         5, 'Alle',   'busy', NULL),
  ('Burn Down Chart',                 5, 'Julian', 'busy', NULL),
  ('To do Liste',                     5, 'Julian', 'todo', NULL)
) AS t(title, story_points, assignee, status, completed_at)
WHERE NOT EXISTS (
  SELECT 1 FROM scrum_cards
   WHERE sprint_id = (SELECT id FROM scrum_sprints ORDER BY id LIMIT 1)
);
