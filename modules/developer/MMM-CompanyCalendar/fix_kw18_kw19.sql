-- ─────────────────────────────────────────────────────────────────────────────
-- Fix KW18 + KW19: Wochentage waren um 1 Tag verschoben
--   Mo 28.04. → korrekt Mo 27.04.  |  Mo 05.05. → korrekt Mo 04.05.
--
-- Ausführen: psql -U gruppe3 -d postgres -f fix_kw18_kw19.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- Alte falsche Einträge löschen
DELETE FROM calendar_events_cache
WHERE uid LIKE 'kw18-%' OR uid LIKE 'kw19-%';


-- Hilfsfunktion
CREATE OR REPLACE FUNCTION seed_event(
  p_emp_email TEXT, p_uid TEXT, p_title TEXT,
  p_start TIMESTAMPTZ, p_end TIMESTAMPTZ,
  p_all_day BOOLEAN DEFAULT FALSE, p_location TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_emp_id INTEGER;
BEGIN
  SELECT id INTO v_emp_id FROM calendar_employees WHERE email = p_emp_email LIMIT 1;
  IF v_emp_id IS NULL THEN RETURN; END IF;
  INSERT INTO calendar_events_cache (employee_id,uid,title,start_at,end_at,all_day,location,fetched_at)
  VALUES (v_emp_id,p_uid,p_title,p_start,p_end,p_all_day,p_location,NOW())
  ON CONFLICT (employee_id,uid) DO UPDATE SET
    title=EXCLUDED.title, start_at=EXCLUDED.start_at, end_at=EXCLUDED.end_at,
    all_day=EXCLUDED.all_day, location=EXCLUDED.location, fetched_at=NOW();
END $$;


-- ═════════════════════════════════════════════════════════════════════════════
-- KW 18  (27. Apr – 01. Mai 2026)
-- Mo=27.04  Di=28.04  Mi=29.04  Do=30.04  Fr=01.05 (Feiertag)
-- ═════════════════════════════════════════════════════════════════════════════

-- ── Montag 27.04. ────────────────────────────────────────────────────────────
SELECT seed_event('max@firma.de',  'kw18-mon-1', 'Daily Standup',         '2026-04-27 09:00', '2026-04-27 09:15', FALSE, 'Konferenzraum A');
SELECT seed_event('anna@firma.de', 'kw18-mon-2', 'Daily Standup',         '2026-04-27 09:00', '2026-04-27 09:15', FALSE, 'Konferenzraum A');
SELECT seed_event('tom@firma.de',  'kw18-mon-3', 'Daily Standup',         '2026-04-27 09:00', '2026-04-27 09:15', FALSE, 'Konferenzraum A');
SELECT seed_event('max@firma.de',  'kw18-mon-4', 'Sprint Planning',       '2026-04-27 10:00', '2026-04-27 12:00', FALSE, 'Konferenzraum B');
SELECT seed_event('anna@firma.de', 'kw18-mon-5', 'Sprint Planning',       '2026-04-27 10:00', '2026-04-27 12:00', FALSE, 'Konferenzraum B');
SELECT seed_event('tom@firma.de',  'kw18-mon-6', 'Sprint Planning',       '2026-04-27 10:00', '2026-04-27 12:00', FALSE, 'Konferenzraum B');
SELECT seed_event('max@firma.de',  'kw18-mon-7', '1:1 mit Anna',          '2026-04-27 14:00', '2026-04-27 14:30', FALSE, 'Besprechungsraum 1');
SELECT seed_event('anna@firma.de', 'kw18-mon-8', '1:1 mit Max',           '2026-04-27 14:00', '2026-04-27 14:30', FALSE, 'Besprechungsraum 1');
SELECT seed_event('tom@firma.de',  'kw18-mon-9', 'Architektur-Review',    '2026-04-27 15:00', '2026-04-27 16:30', FALSE, 'Konferenzraum A');

-- ── Dienstag 28.04. ──────────────────────────────────────────────────────────
SELECT seed_event('max@firma.de',  'kw18-tue-1', 'Daily Standup',         '2026-04-28 09:00', '2026-04-28 09:15', FALSE, 'Konferenzraum A');
SELECT seed_event('anna@firma.de', 'kw18-tue-2', 'Daily Standup',         '2026-04-28 09:00', '2026-04-28 09:15', FALSE, 'Konferenzraum A');
SELECT seed_event('tom@firma.de',  'kw18-tue-3', 'Daily Standup',         '2026-04-28 09:00', '2026-04-28 09:15', FALSE, 'Konferenzraum A');
SELECT seed_event('anna@firma.de', 'kw18-tue-4', 'Kundenpräsentation Q2', '2026-04-28 10:00', '2026-04-28 11:30', FALSE, 'Showroom EG');
SELECT seed_event('max@firma.de',  'kw18-tue-5', 'Kundenpräsentation Q2', '2026-04-28 10:00', '2026-04-28 11:30', FALSE, 'Showroom EG');
SELECT seed_event('tom@firma.de',  'kw18-tue-6', 'Backend Workshop',      '2026-04-28 13:00', '2026-04-28 17:00', FALSE, 'Schulungsraum');
SELECT seed_event('max@firma.de',  'kw18-tue-7', 'Design Review',         '2026-04-28 14:00', '2026-04-28 15:00', FALSE, 'Konferenzraum B');
SELECT seed_event('anna@firma.de', 'kw18-tue-8', 'UX-Feedback-Session',   '2026-04-28 15:30', '2026-04-28 16:30', FALSE, 'Besprechungsraum 2');

-- ── Mittwoch 29.04. ──────────────────────────────────────────────────────────
SELECT seed_event('max@firma.de',  'kw18-wed-1', 'Daily Standup',         '2026-04-29 09:00', '2026-04-29 09:15', FALSE, 'Konferenzraum A');
SELECT seed_event('anna@firma.de', 'kw18-wed-2', 'Daily Standup',         '2026-04-29 09:00', '2026-04-29 09:15', FALSE, 'Konferenzraum A');
SELECT seed_event('tom@firma.de',  'kw18-wed-3', 'Daily Standup',         '2026-04-29 09:00', '2026-04-29 09:15', FALSE, 'Konferenzraum A');
SELECT seed_event('max@firma.de',  'kw18-wed-4', 'Investoren-Meeting',    '2026-04-29 10:00', '2026-04-29 12:00', FALSE, 'Boardroom OG');
SELECT seed_event('tom@firma.de',  'kw18-wed-5', 'Code Review Session',   '2026-04-29 10:00', '2026-04-29 11:30', FALSE, 'Konferenzraum B');
SELECT seed_event('anna@firma.de', 'kw18-wed-6', 'Weiterbildung: Figma',  '2026-04-29 13:00', '2026-04-29 17:00', FALSE, 'Online');
SELECT seed_event('max@firma.de',  'kw18-wed-7', 'Produktstrategie',      '2026-04-29 13:30', '2026-04-29 15:00', FALSE, 'Boardroom OG');
SELECT seed_event('tom@firma.de',  'kw18-wed-8', '1:1 mit Teamlead',      '2026-04-29 16:00', '2026-04-29 16:30', FALSE, 'Besprechungsraum 1');

-- ── Donnerstag 30.04. (Sprint Review vorgezogen, Fr=Feiertag) ────────────────
SELECT seed_event('max@firma.de',  'kw18-thu-1', 'Daily Standup',         '2026-04-30 09:00', '2026-04-30 09:15', FALSE, 'Konferenzraum A');
SELECT seed_event('anna@firma.de', 'kw18-thu-2', 'Daily Standup',         '2026-04-30 09:00', '2026-04-30 09:15', FALSE, 'Konferenzraum A');
SELECT seed_event('tom@firma.de',  'kw18-thu-3', 'Daily Standup',         '2026-04-30 09:00', '2026-04-30 09:15', FALSE, 'Konferenzraum A');
SELECT seed_event('max@firma.de',  'kw18-thu-4', 'Sprint Review',         '2026-04-30 10:00', '2026-04-30 11:30', FALSE, 'Konferenzraum B');
SELECT seed_event('anna@firma.de', 'kw18-thu-5', 'Sprint Review',         '2026-04-30 10:00', '2026-04-30 11:30', FALSE, 'Konferenzraum B');
SELECT seed_event('tom@firma.de',  'kw18-thu-6', 'Sprint Review',         '2026-04-30 10:00', '2026-04-30 11:30', FALSE, 'Konferenzraum B');
SELECT seed_event('max@firma.de',  'kw18-thu-7', 'Sprint Retrospektive',  '2026-04-30 13:00', '2026-04-30 14:30', FALSE, 'Konferenzraum A');
SELECT seed_event('anna@firma.de', 'kw18-thu-8', 'Sprint Retrospektive',  '2026-04-30 13:00', '2026-04-30 14:30', FALSE, 'Konferenzraum A');
SELECT seed_event('tom@firma.de',  'kw18-thu-9', 'Sprint Retrospektive',  '2026-04-30 13:00', '2026-04-30 14:30', FALSE, 'Konferenzraum A');
SELECT seed_event('max@firma.de',  'kw18-thu-10','Wochenabschluss-Runde', '2026-04-30 16:00', '2026-04-30 16:30', FALSE, 'Aufenthaltsraum');
SELECT seed_event('anna@firma.de', 'kw18-thu-11','Wochenabschluss-Runde', '2026-04-30 16:00', '2026-04-30 16:30', FALSE, 'Aufenthaltsraum');
SELECT seed_event('tom@firma.de',  'kw18-thu-12','Wochenabschluss-Runde', '2026-04-30 16:00', '2026-04-30 16:30', FALSE, 'Aufenthaltsraum');

-- ── Freitag 01.05. – Tag der Arbeit ──────────────────────────────────────────
SELECT seed_event('max@firma.de',  'kw18-fri-1', 'Tag der Arbeit 🎉',    '2026-05-01 00:00', '2026-05-02 00:00', TRUE, NULL);
SELECT seed_event('anna@firma.de', 'kw18-fri-2', 'Tag der Arbeit 🎉',    '2026-05-01 00:00', '2026-05-02 00:00', TRUE, NULL);
SELECT seed_event('tom@firma.de',  'kw18-fri-3', 'Tag der Arbeit 🎉',    '2026-05-01 00:00', '2026-05-02 00:00', TRUE, NULL);


-- ═════════════════════════════════════════════════════════════════════════════
-- KW 19  (04. – 08. Mai 2026)
-- Mo=04.05  Di=05.05  Mi=06.05  Do=07.05  Fr=08.05
-- ═════════════════════════════════════════════════════════════════════════════

-- Anna gesamte Woche Urlaub
SELECT seed_event('anna@firma.de', 'kw19-urlaub', 'Urlaub 🌴',           '2026-05-04 00:00', '2026-05-09 00:00', TRUE, 'Mallorca');

-- ── Montag 04.05. ────────────────────────────────────────────────────────────
SELECT seed_event('max@firma.de',  'kw19-mon-1', 'Daily Standup',         '2026-05-04 09:00', '2026-05-04 09:15', FALSE, 'Konferenzraum A');
SELECT seed_event('tom@firma.de',  'kw19-mon-2', 'Daily Standup',         '2026-05-04 09:00', '2026-05-04 09:15', FALSE, 'Konferenzraum A');
SELECT seed_event('max@firma.de',  'kw19-mon-3', 'Kick-off: Projekt Nova','2026-05-04 10:00', '2026-05-04 12:00', FALSE, 'Boardroom OG');
SELECT seed_event('tom@firma.de',  'kw19-mon-4', 'Kick-off: Projekt Nova','2026-05-04 10:00', '2026-05-04 12:00', FALSE, 'Boardroom OG');
SELECT seed_event('max@firma.de',  'kw19-mon-5', 'Vertriebsmeeting',      '2026-05-04 14:00', '2026-05-04 15:30', FALSE, 'Konferenzraum B');

-- ── Dienstag 05.05. ──────────────────────────────────────────────────────────
SELECT seed_event('max@firma.de',  'kw19-tue-1', 'Daily Standup',         '2026-05-05 09:00', '2026-05-05 09:15', FALSE, 'Konferenzraum A');
SELECT seed_event('tom@firma.de',  'kw19-tue-2', 'Daily Standup',         '2026-05-05 09:00', '2026-05-05 09:15', FALSE, 'Konferenzraum A');
SELECT seed_event('tom@firma.de',  'kw19-tue-3', 'Infrastruktur-Workshop','2026-05-05 09:30', '2026-05-05 12:30', FALSE, 'Schulungsraum');
SELECT seed_event('max@firma.de',  'kw19-tue-4', 'Messe EXPO München',    '2026-05-05 00:00', '2026-05-07 00:00', TRUE,  'Messe München');
SELECT seed_event('max@firma.de',  'kw19-tue-5', 'Keynote Vorbereitung',  '2026-05-05 14:00', '2026-05-05 16:00', FALSE, 'Online');

-- ── Mittwoch 06.05. ──────────────────────────────────────────────────────────
SELECT seed_event('tom@firma.de',  'kw19-wed-1', 'Daily Standup',         '2026-05-06 09:00', '2026-05-06 09:15', FALSE, 'Konferenzraum A');
SELECT seed_event('tom@firma.de',  'kw19-wed-2', 'API-Design-Session',    '2026-05-06 10:00', '2026-05-06 12:00', FALSE, 'Konferenzraum B');
SELECT seed_event('tom@firma.de',  'kw19-wed-3', 'Weiterbildung: K8s',    '2026-05-06 13:00', '2026-05-06 17:00', FALSE, 'Online');

-- ── Donnerstag 07.05. ────────────────────────────────────────────────────────
SELECT seed_event('max@firma.de',  'kw19-thu-1', 'Daily Standup',         '2026-05-07 09:00', '2026-05-07 09:15', FALSE, 'Konferenzraum A');
SELECT seed_event('tom@firma.de',  'kw19-thu-2', 'Daily Standup',         '2026-05-07 09:00', '2026-05-07 09:15', FALSE, 'Konferenzraum A');
SELECT seed_event('max@firma.de',  'kw19-thu-3', 'Präsentation Geschäftsführung','2026-05-07 10:00','2026-05-07 11:30',FALSE,'Boardroom OG');
SELECT seed_event('tom@firma.de',  'kw19-thu-4', 'Präsentation Geschäftsführung','2026-05-07 10:00','2026-05-07 11:30',FALSE,'Boardroom OG');
SELECT seed_event('max@firma.de',  'kw19-thu-5', 'Kundenbesuch TechCorp', '2026-05-07 14:00', '2026-05-07 16:00', FALSE, 'TechCorp HQ');
SELECT seed_event('tom@firma.de',  'kw19-thu-6', 'Security Audit',        '2026-05-07 13:00', '2026-05-07 17:00', FALSE, 'Serverraum');

-- ── Freitag 08.05. ───────────────────────────────────────────────────────────
SELECT seed_event('max@firma.de',  'kw19-fri-1', 'Daily Standup',         '2026-05-08 09:00', '2026-05-08 09:15', FALSE, 'Konferenzraum A');
SELECT seed_event('tom@firma.de',  'kw19-fri-2', 'Daily Standup',         '2026-05-08 09:00', '2026-05-08 09:15', FALSE, 'Konferenzraum A');
SELECT seed_event('max@firma.de',  'kw19-fri-3', 'Sprint Review',         '2026-05-08 10:00', '2026-05-08 11:30', FALSE, 'Konferenzraum B');
SELECT seed_event('tom@firma.de',  'kw19-fri-4', 'Sprint Review',         '2026-05-08 10:00', '2026-05-08 11:30', FALSE, 'Konferenzraum B');
SELECT seed_event('max@firma.de',  'kw19-fri-5', 'Team-Lunch',            '2026-05-08 12:00', '2026-05-08 13:00', FALSE, 'Restaurant nebenan');
SELECT seed_event('tom@firma.de',  'kw19-fri-6', 'Team-Lunch',            '2026-05-08 12:00', '2026-05-08 13:00', FALSE, 'Restaurant nebenan');
SELECT seed_event('max@firma.de',  'kw19-fri-7', 'Sprint Retrospektive',  '2026-05-08 13:00', '2026-05-08 14:30', FALSE, 'Konferenzraum A');
SELECT seed_event('tom@firma.de',  'kw19-fri-8', 'Sprint Retrospektive',  '2026-05-08 13:00', '2026-05-08 14:30', FALSE, 'Konferenzraum A');


DROP FUNCTION IF EXISTS seed_event(TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN, TEXT);
