-- ─────────────────────────────────────────────────────────────────────────────
-- MMM-Stundenplan – Datenbankschema
-- Stundenplan 11BE13, Friedrich-Ebert-Schule Wiesbaden
--
-- Ausführen: psql -U gruppe3 -d postgres -f schema.sql
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stundenplan_perioden (
  id         SERIAL   PRIMARY KEY,
  nummer     SMALLINT NOT NULL UNIQUE,
  start_time TIME     NOT NULL,
  end_time   TIME     NOT NULL
);

CREATE TABLE IF NOT EXISTS stundenplan_eintraege (
  id         SERIAL       PRIMARY KEY,
  klasse     VARCHAR(20)  NOT NULL DEFAULT '11BE13',
  wochentag  SMALLINT     NOT NULL CHECK (wochentag BETWEEN 1 AND 6),
  periode_nr SMALLINT     NOT NULL REFERENCES stundenplan_perioden(nummer) ON DELETE CASCADE,
  fach       VARCHAR(100) NOT NULL,
  raum       VARCHAR(20),
  lehrer     VARCHAR(20)
);

CREATE INDEX IF NOT EXISTS idx_sp_klasse_tag ON stundenplan_eintraege (klasse, wochentag);

-- ── Zeitslots ─────────────────────────────────────────────────────────────────
INSERT INTO stundenplan_perioden (nummer, start_time, end_time) VALUES
  (1,  '07:30', '08:15'),
  (2,  '08:15', '09:00'),
  (3,  '09:15', '10:00'),
  (4,  '10:00', '10:45'),
  (5,  '11:00', '11:45'),
  (6,  '11:45', '12:30'),
  (7,  '12:30', '13:15'),
  (8,  '13:15', '14:00'),
  (9,  '14:00', '14:45'),
  (10, '14:45', '15:30'),
  (11, '15:45', '16:30')
ON CONFLICT (nummer) DO NOTHING;

-- ── Stundenplan-Einträge ──────────────────────────────────────────────────────
-- wochentag: 1=Montag, 2=Dienstag, 3=Mittwoch, 4=Donnerstag, 5=Freitag

INSERT INTO stundenplan_eintraege (klasse, wochentag, periode_nr, fach, raum, lehrer) VALUES
  -- ── Montag ──
  ('11BE13', 1, 1,  'LF', 'A213', 'EN'),
  ('11BE13', 1, 2,  'LF', 'A213', 'EN'),
  ('11BE13', 1, 3,  'LF', 'A213', 'EN'),
  ('11BE13', 1, 4,  'LF', 'A213', 'EN'),
  ('11BE13', 1, 5,  'LF', 'A213', 'BK'),
  ('11BE13', 1, 6,  'LF', 'A213', 'BK'),

  -- ── Dienstag ──
  ('11BE13', 2, 1,  'LF', 'A213', 'BOU'),
  ('11BE13', 2, 2,  'LF', 'A213', 'BOU'),
  ('11BE13', 2, 3,  'LF', 'A213', 'FU'),   -- Gruppe A
  ('11BE13', 2, 3,  'LF', 'A213', 'BOU'),  -- Gruppe B
  ('11BE13', 2, 4,  'LF', 'A213', 'FU'),
  ('11BE13', 2, 4,  'LF', 'A213', 'BOU'),
  ('11BE13', 2, 5,  'LF', 'A213', 'BK'),
  ('11BE13', 2, 6,  'LF', 'A213', 'BK'),
  ('11BE13', 2, 8,  'LF', 'A213', 'BK'),
  ('11BE13', 2, 9,  'LF', 'A213', 'BK'),

  -- ── Mittwoch ──
  ('11BE13', 3, 1,  'LF', 'A213', 'YÖ'),
  ('11BE13', 3, 2,  'LF', 'A213', 'YÖ'),
  ('11BE13', 3, 3,  'LF', 'A213', 'YÖ'),   -- Gruppe A
  ('11BE13', 3, 3,  'LF', 'A213', 'FU'),   -- Gruppe B
  ('11BE13', 3, 4,  'LF', 'A213', 'YÖ'),
  ('11BE13', 3, 4,  'LF', 'A213', 'FU'),
  ('11BE13', 3, 5,  'LF', 'A213', 'SF'),
  ('11BE13', 3, 6,  'LF', 'A213', 'SF'),
  ('11BE13', 3, 8,  'LF', 'A213', 'SF'),
  ('11BE13', 3, 9,  'LF', 'A213', 'SF'),

  -- ── Donnerstag ──
  ('11BE13', 4, 1,  'LF',          'A213', 'SF'),
  ('11BE13', 4, 2,  'LF',          'A213', 'SF'),
  ('11BE13', 4, 3,  'LF',          'A213', 'YÖ'),
  ('11BE13', 4, 4,  'LF',          'A213', 'YÖ'),
  ('11BE13', 4, 5,  'Religion-ev', 'A213', 'HA'),
  ('11BE13', 4, 6,  'Religion-ev', 'A213', 'HA'),
  ('11BE13', 4, 8,  'LF',          'A213', 'YÖ'),
  ('11BE13', 4, 9,  'LF',          'A213', 'YÖ'),
  ('11BE13', 4, 10, 'CISCO-AG',    'A214', 'MÜ'),
  ('11BE13', 4, 11, 'CISCO-AG',    'A214', 'MÜ'),

  -- ── Freitag ──
  ('11BE13', 5, 1,  'LF', 'A213', 'EN'),
  ('11BE13', 5, 2,  'LF', 'A213', 'EN'),
  ('11BE13', 5, 3,  'LF', 'A213', 'EN'),
  ('11BE13', 5, 4,  'LF', 'A213', 'EN');
