-- ─────────────────────────────────────────────────────────────────────────────
-- MMM-CompanyCalendar – Demo-Termine
--
-- Voraussetzung: schema.sql wurde bereits ausgeführt.
-- Ausführen: psql -U <user> -d <datenbank> -f seed.sql
--
-- Mitarbeiter (IDs aus schema.sql):
--   1 → Max Mustermann  (#4a9eff, blau)
--   2 → Anna Schmidt    (#ff7043, orange)
--   3 → Tom Bauer       (#66bb6a, grün)
--
-- Termintypen in diesem Seed:
--   Meeting, Präsentation, Urlaub (Ganztag), Workshop, Review,
--   1:1, Standup, Kundenbesuch, Messe, Weiterbildung
-- ─────────────────────────────────────────────────────────────────────────────


-- Sicherstellen dass die Employee-IDs stabil sind (falls seed mehrfach läuft)
DO $$
DECLARE
  max_id INTEGER;
  anna_id INTEGER;
  tom_id  INTEGER;
BEGIN
  SELECT id INTO max_id  FROM calendar_employees WHERE email = 'max@firma.de'  LIMIT 1;
  SELECT id INTO anna_id FROM calendar_employees WHERE email = 'anna@firma.de' LIMIT 1;
  SELECT id INTO tom_id  FROM calendar_employees WHERE email = 'tom@firma.de'  LIMIT 1;

  IF max_id IS NULL OR anna_id IS NULL OR tom_id IS NULL THEN
    RAISE EXCEPTION 'Mitarbeiter fehlen – bitte zuerst schema.sql ausführen';
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- Hilfsfunktion: Termin einfügen (idempotent)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION seed_event(
  p_emp_email TEXT,
  p_uid       TEXT,
  p_title     TEXT,
  p_start     TIMESTAMPTZ,
  p_end       TIMESTAMPTZ,
  p_all_day   BOOLEAN DEFAULT FALSE,
  p_location  TEXT    DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_emp_id INTEGER;
BEGIN
  SELECT id INTO v_emp_id FROM calendar_employees WHERE email = p_emp_email LIMIT 1;
  IF v_emp_id IS NULL THEN RETURN; END IF;

  INSERT INTO calendar_events_cache
    (employee_id, uid, title, start_at, end_at, all_day, location, fetched_at)
  VALUES
    (v_emp_id, p_uid, p_title, p_start, p_end, p_all_day, p_location, NOW())
  ON CONFLICT (employee_id, uid) DO UPDATE SET
    title      = EXCLUDED.title,
    start_at   = EXCLUDED.start_at,
    end_at     = EXCLUDED.end_at,
    all_day    = EXCLUDED.all_day,
    location   = EXCLUDED.location,
    fetched_at = NOW();
END $$;


-- ═════════════════════════════════════════════════════════════════════════════
-- KW 18  (28. Apr – 02. Mai 2026)  ← aktuelle Woche
-- ═════════════════════════════════════════════════════════════════════════════

-- ── Montag 28.04. ────────────────────────────────────────────────────────────
SELECT seed_event('max@firma.de',  'kw18-mon-1', 'Daily Standup',          '2026-04-28 09:00', '2026-04-28 09:15', FALSE, 'Konferenzraum A');
SELECT seed_event('anna@firma.de', 'kw18-mon-2', 'Daily Standup',          '2026-04-28 09:00', '2026-04-28 09:15', FALSE, 'Konferenzraum A');
SELECT seed_event('tom@firma.de',  'kw18-mon-3', 'Daily Standup',          '2026-04-28 09:00', '2026-04-28 09:15', FALSE, 'Konferenzraum A');
SELECT seed_event('max@firma.de',  'kw18-mon-4', 'Sprint Planning',        '2026-04-28 10:00', '2026-04-28 12:00', FALSE, 'Konferenzraum B');
SELECT seed_event('anna@firma.de', 'kw18-mon-5', 'Sprint Planning',        '2026-04-28 10:00', '2026-04-28 12:00', FALSE, 'Konferenzraum B');
SELECT seed_event('tom@firma.de',  'kw18-mon-6', 'Sprint Planning',        '2026-04-28 10:00', '2026-04-28 12:00', FALSE, 'Konferenzraum B');
SELECT seed_event('max@firma.de',  'kw18-mon-7', '1:1 mit Anna',           '2026-04-28 14:00', '2026-04-28 14:30', FALSE, 'Besprechungsraum 1');
SELECT seed_event('anna@firma.de', 'kw18-mon-8', '1:1 mit Max',            '2026-04-28 14:00', '2026-04-28 14:30', FALSE, 'Besprechungsraum 1');
SELECT seed_event('tom@firma.de',  'kw18-mon-9', 'Architektur-Review',     '2026-04-28 15:00', '2026-04-28 16:30', FALSE, 'Konferenzraum A');

-- ── Dienstag 29.04. ──────────────────────────────────────────────────────────
SELECT seed_event('max@firma.de',  'kw18-tue-1', 'Daily Standup',          '2026-04-29 09:00', '2026-04-29 09:15', FALSE, 'Konferenzraum A');
SELECT seed_event('anna@firma.de', 'kw18-tue-2', 'Daily Standup',          '2026-04-29 09:00', '2026-04-29 09:15', FALSE, 'Konferenzraum A');
SELECT seed_event('tom@firma.de',  'kw18-tue-3', 'Daily Standup',          '2026-04-29 09:00', '2026-04-29 09:15', FALSE, 'Konferenzraum A');
SELECT seed_event('anna@firma.de', 'kw18-tue-4', 'Kundenpräsentation Q2',  '2026-04-29 10:00', '2026-04-29 11:30', FALSE, 'Showroom EG');
SELECT seed_event('max@firma.de',  'kw18-tue-5', 'Kundenpräsentation Q2',  '2026-04-29 10:00', '2026-04-29 11:30', FALSE, 'Showroom EG');
SELECT seed_event('tom@firma.de',  'kw18-tue-6', 'Backend Workshop',       '2026-04-29 13:00', '2026-04-29 17:00', FALSE, 'Schulungsraum');
SELECT seed_event('max@firma.de',  'kw18-tue-7', 'Design Review',          '2026-04-29 14:00', '2026-04-29 15:00', FALSE, 'Konferenzraum B');
SELECT seed_event('anna@firma.de', 'kw18-tue-8', 'UX-Feedback-Session',    '2026-04-29 15:30', '2026-04-29 16:30', FALSE, 'Besprechungsraum 2');

-- ── Mittwoch 30.04. ──────────────────────────────────────────────────────────
SELECT seed_event('max@firma.de',  'kw18-wed-1', 'Daily Standup',          '2026-04-30 09:00', '2026-04-30 09:15', FALSE, 'Konferenzraum A');
SELECT seed_event('anna@firma.de', 'kw18-wed-2', 'Daily Standup',          '2026-04-30 09:00', '2026-04-30 09:15', FALSE, 'Konferenzraum A');
SELECT seed_event('tom@firma.de',  'kw18-wed-3', 'Daily Standup',          '2026-04-30 09:00', '2026-04-30 09:15', FALSE, 'Konferenzraum A');
SELECT seed_event('max@firma.de',  'kw18-wed-4', 'Investoren-Meeting',     '2026-04-30 10:00', '2026-04-30 12:00', FALSE, 'Boardroom OG');
SELECT seed_event('tom@firma.de',  'kw18-wed-5', 'Code Review Session',    '2026-04-30 10:00', '2026-04-30 11:30', FALSE, 'Konferenzraum B');
SELECT seed_event('anna@firma.de', 'kw18-wed-6', 'Weiterbildung: Figma',   '2026-04-30 13:00', '2026-04-30 17:00', FALSE, 'Online');
SELECT seed_event('max@firma.de',  'kw18-wed-7', 'Produktstrategie',       '2026-04-30 13:30', '2026-04-30 15:00', FALSE, 'Boardroom OG');
SELECT seed_event('tom@firma.de',  'kw18-wed-8', '1:1 mit Tom (Lead)',     '2026-04-30 16:00', '2026-04-30 16:30', FALSE, 'Besprechungsraum 1');

-- ── Donnerstag 01.05. (Feiertag – Tag der Arbeit) ────────────────────────────
SELECT seed_event('max@firma.de',  'kw18-thu-1', 'Tag der Arbeit',         '2026-05-01 00:00', '2026-05-02 00:00', TRUE,  NULL);
SELECT seed_event('anna@firma.de', 'kw18-thu-2', 'Tag der Arbeit',         '2026-05-01 00:00', '2026-05-02 00:00', TRUE,  NULL);
SELECT seed_event('tom@firma.de',  'kw18-thu-3', 'Tag der Arbeit',         '2026-05-01 00:00', '2026-05-02 00:00', TRUE,  NULL);

-- ── Freitag 02.05. ───────────────────────────────────────────────────────────
SELECT seed_event('max@firma.de',  'kw18-fri-1', 'Daily Standup',          '2026-05-02 09:00', '2026-05-02 09:15', FALSE, 'Konferenzraum A');
SELECT seed_event('anna@firma.de', 'kw18-fri-2', 'Daily Standup',          '2026-05-02 09:00', '2026-05-02 09:15', FALSE, 'Konferenzraum A');
SELECT seed_event('tom@firma.de',  'kw18-fri-3', 'Daily Standup',          '2026-05-02 09:00', '2026-05-02 09:15', FALSE, 'Konferenzraum A');
SELECT seed_event('anna@firma.de', 'kw18-fri-4', 'Sprint Review',          '2026-05-02 10:00', '2026-05-02 11:30', FALSE, 'Konferenzraum B');
SELECT seed_event('max@firma.de',  'kw18-fri-5', 'Sprint Review',          '2026-05-02 10:00', '2026-05-02 11:30', FALSE, 'Konferenzraum B');
SELECT seed_event('tom@firma.de',  'kw18-fri-6', 'Sprint Review',          '2026-05-02 10:00', '2026-05-02 11:30', FALSE, 'Konferenzraum B');
SELECT seed_event('max@firma.de',  'kw18-fri-7', 'Sprint Retrospektive',   '2026-05-02 13:00', '2026-05-02 14:30', FALSE, 'Konferenzraum A');
SELECT seed_event('anna@firma.de', 'kw18-fri-8', 'Sprint Retrospektive',   '2026-05-02 13:00', '2026-05-02 14:30', FALSE, 'Konferenzraum A');
SELECT seed_event('tom@firma.de',  'kw18-fri-9', 'Sprint Retrospektive',   '2026-05-02 13:00', '2026-05-02 14:30', FALSE, 'Konferenzraum A');
SELECT seed_event('max@firma.de',  'kw18-fri-10','Wochenabschluss-Runde',  '2026-05-02 16:00', '2026-05-02 16:30', FALSE, 'Aufenthaltsraum');


-- ═════════════════════════════════════════════════════════════════════════════
-- KW 19  (05. – 09. Mai 2026)  ← nächste Woche
-- ═════════════════════════════════════════════════════════════════════════════

-- Urlaub Anna (gesamte Woche)
SELECT seed_event('anna@firma.de', 'kw19-urlaub', 'Urlaub 🌴',            '2026-05-05 00:00', '2026-05-10 00:00', TRUE,  'Mallorca');

-- ── Montag 05.05. ────────────────────────────────────────────────────────────
SELECT seed_event('max@firma.de',  'kw19-mon-1', 'Daily Standup',          '2026-05-05 09:00', '2026-05-05 09:15', FALSE, 'Konferenzraum A');
SELECT seed_event('tom@firma.de',  'kw19-mon-2', 'Daily Standup',          '2026-05-05 09:00', '2026-05-05 09:15', FALSE, 'Konferenzraum A');
SELECT seed_event('max@firma.de',  'kw19-mon-3', 'Kick-off: Projekt Nova', '2026-05-05 10:00', '2026-05-05 12:00', FALSE, 'Boardroom OG');
SELECT seed_event('tom@firma.de',  'kw19-mon-4', 'Kick-off: Projekt Nova', '2026-05-05 10:00', '2026-05-05 12:00', FALSE, 'Boardroom OG');
SELECT seed_event('max@firma.de',  'kw19-mon-5', 'Vertriebsmeeting',       '2026-05-05 14:00', '2026-05-05 15:30', FALSE, 'Konferenzraum B');

-- ── Dienstag 06.05. ──────────────────────────────────────────────────────────
SELECT seed_event('max@firma.de',  'kw19-tue-1', 'Daily Standup',          '2026-05-06 09:00', '2026-05-06 09:15', FALSE, 'Konferenzraum A');
SELECT seed_event('tom@firma.de',  'kw19-tue-2', 'Daily Standup',          '2026-05-06 09:00', '2026-05-06 09:15', FALSE, 'Konferenzraum A');
SELECT seed_event('tom@firma.de',  'kw19-tue-3', 'Infrastruktur-Workshop', '2026-05-06 09:30', '2026-05-06 12:30', FALSE, 'Schulungsraum');
SELECT seed_event('max@firma.de',  'kw19-tue-4', 'Messe EXPO München',     '2026-05-06 09:00', '2026-05-07 18:00', TRUE,  'Messe München');
SELECT seed_event('max@firma.de',  'kw19-tue-5', 'Keynote Vorbereitung',   '2026-05-06 14:00', '2026-05-06 16:00', FALSE, 'Online');

-- ── Mittwoch 07.05. ──────────────────────────────────────────────────────────
SELECT seed_event('tom@firma.de',  'kw19-wed-1', 'Daily Standup',          '2026-05-07 09:00', '2026-05-07 09:15', FALSE, 'Konferenzraum A');
SELECT seed_event('max@firma.de',  'kw19-wed-2', 'Messe EXPO München',     '2026-05-06 09:00', '2026-05-07 18:00', TRUE,  'Messe München');
SELECT seed_event('tom@firma.de',  'kw19-wed-3', 'API-Design-Session',     '2026-05-07 10:00', '2026-05-07 12:00', FALSE, 'Konferenzraum B');
SELECT seed_event('tom@firma.de',  'kw19-wed-4', 'Weiterbildung: K8s',     '2026-05-07 13:00', '2026-05-07 17:00', FALSE, 'Online');

-- ── Donnerstag 08.05. ────────────────────────────────────────────────────────
SELECT seed_event('max@firma.de',  'kw19-thu-1', 'Daily Standup',          '2026-05-08 09:00', '2026-05-08 09:15', FALSE, 'Konferenzraum A');
SELECT seed_event('tom@firma.de',  'kw19-thu-2', 'Daily Standup',          '2026-05-08 09:00', '2026-05-08 09:15', FALSE, 'Konferenzraum A');
SELECT seed_event('max@firma.de',  'kw19-thu-3', 'Präsentation Geschäftsführung', '2026-05-08 10:00', '2026-05-08 11:30', FALSE, 'Boardroom OG');
SELECT seed_event('tom@firma.de',  'kw19-thu-4', 'Präsentation Geschäftsführung', '2026-05-08 10:00', '2026-05-08 11:30', FALSE, 'Boardroom OG');
SELECT seed_event('max@firma.de',  'kw19-thu-5', 'Kundenbesuch TechCorp',  '2026-05-08 14:00', '2026-05-08 16:00', FALSE, 'TechCorp HQ');
SELECT seed_event('tom@firma.de',  'kw19-thu-6', 'Security Audit',         '2026-05-08 13:00', '2026-05-08 17:00', FALSE, 'Serverraum');

-- ── Freitag 09.05. ───────────────────────────────────────────────────────────
SELECT seed_event('max@firma.de',  'kw19-fri-1', 'Daily Standup',          '2026-05-09 09:00', '2026-05-09 09:15', FALSE, 'Konferenzraum A');
SELECT seed_event('tom@firma.de',  'kw19-fri-2', 'Daily Standup',          '2026-05-09 09:00', '2026-05-09 09:15', FALSE, 'Konferenzraum A');
SELECT seed_event('max@firma.de',  'kw19-fri-3', 'Sprint Review',          '2026-05-09 10:00', '2026-05-09 11:30', FALSE, 'Konferenzraum B');
SELECT seed_event('tom@firma.de',  'kw19-fri-4', 'Sprint Review',          '2026-05-09 10:00', '2026-05-09 11:30', FALSE, 'Konferenzraum B');
SELECT seed_event('max@firma.de',  'kw19-fri-5', 'Sprint Retrospektive',   '2026-05-09 13:00', '2026-05-09 14:30', FALSE, 'Konferenzraum A');
SELECT seed_event('tom@firma.de',  'kw19-fri-6', 'Sprint Retrospektive',   '2026-05-09 13:00', '2026-05-09 14:30', FALSE, 'Konferenzraum A');
SELECT seed_event('max@firma.de',  'kw19-fri-7', 'Team-Lunch',             '2026-05-09 12:00', '2026-05-09 13:00', FALSE, 'Restaurant nebenan');
SELECT seed_event('tom@firma.de',  'kw19-fri-8', 'Team-Lunch',             '2026-05-09 12:00', '2026-05-09 13:00', FALSE, 'Restaurant nebenan');


-- ═════════════════════════════════════════════════════════════════════════════
-- KW 17  (21. – 25. Apr 2026)  ← vergangene Woche (für Rückblick)
-- ═════════════════════════════════════════════════════════════════════════════

SELECT seed_event('max@firma.de',  'kw17-mon-1', 'Quartalsbericht Q1',     '2026-04-21 09:00', '2026-04-21 11:00', FALSE, 'Boardroom OG');
SELECT seed_event('anna@firma.de', 'kw17-mon-2', 'Quartalsbericht Q1',     '2026-04-21 09:00', '2026-04-21 11:00', FALSE, 'Boardroom OG');
SELECT seed_event('tom@firma.de',  'kw17-mon-3', 'Quartalsbericht Q1',     '2026-04-21 09:00', '2026-04-21 11:00', FALSE, 'Boardroom OG');
SELECT seed_event('tom@firma.de',  'kw17-wed-1', 'Deployment Prod',        '2026-04-23 10:00', '2026-04-23 11:00', FALSE, 'Remote');
SELECT seed_event('anna@firma.de', 'kw17-wed-2', 'User-Testing Runde',     '2026-04-23 14:00', '2026-04-23 16:00', FALSE, 'Besprechungsraum 2');
SELECT seed_event('max@firma.de',  'kw17-fri-1', 'All-Hands Meeting',      '2026-04-25 10:00', '2026-04-25 11:30', FALSE, 'Großer Saal');
SELECT seed_event('anna@firma.de', 'kw17-fri-2', 'All-Hands Meeting',      '2026-04-25 10:00', '2026-04-25 11:30', FALSE, 'Großer Saal');
SELECT seed_event('tom@firma.de',  'kw17-fri-3', 'All-Hands Meeting',      '2026-04-25 10:00', '2026-04-25 11:30', FALSE, 'Großer Saal');


-- Hilfsfunktion nach dem Seed wieder aufräumen
DROP FUNCTION IF EXISTS seed_event(TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN, TEXT);
