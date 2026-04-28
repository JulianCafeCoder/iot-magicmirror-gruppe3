-- ─────────────────────────────────────────────────────────────────────────────
-- MMM-CompanyCalendar – Datenbankschema
--
-- Ausführen:  psql -U <user> -d <datenbank> -f schema.sql
--
-- Übersicht der Tabellen:
--   mm_users              – Personen, die einen MagicMirror nutzen
--   mm_mirror_configs     – Konfiguration pro Spiegel (business / private / developer)
--   calendar_employees    – Mitarbeiter mit ICS-Kalender-URL (je Mirror-Config)
--   calendar_events_cache – Gecachte Termine aus den ICS-Feeds
-- ─────────────────────────────────────────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Nutzer
--    Jeder Eintrag steht für eine reale Person, die (mindestens) einen
--    MagicMirror betreibt.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mm_users (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(255) UNIQUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Mirror-Konfigurationen
--    Ein Nutzer kann mehrere Spiegel haben (z. B. einen im Büro, einen zu Hause).
--    usage_type steuert, welche Seiten/Module geladen werden.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TYPE mm_usage_type AS ENUM ('business', 'private', 'developer');

CREATE TABLE IF NOT EXISTS mm_mirror_configs (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER       NOT NULL REFERENCES mm_users(id) ON DELETE CASCADE,
  name        VARCHAR(100)  NOT NULL,                -- z. B. "Büro-Spiegel Raum 3"
  usage_type  mm_usage_type NOT NULL,
  location    VARCHAR(150),                          -- z. B. "München, Büro EG"
  active      BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Einen Nutzer kann nur einen aktiven Spiegel pro Typ und Standort haben
CREATE UNIQUE INDEX IF NOT EXISTS uq_mirror_active
  ON mm_mirror_configs (user_id, usage_type, location)
  WHERE active = TRUE;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Kalender-Mitarbeiter
--    Pro Mirror-Config können mehrere Mitarbeiter-Kalender hinterlegt werden.
--    Nur business-Spiegel nutzen diese Tabelle sinnvoll, sie ist aber
--    konfigurationstyp-unabhängig modelliert.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calendar_employees (
  id               SERIAL PRIMARY KEY,
  mirror_config_id INTEGER      NOT NULL REFERENCES mm_mirror_configs(id) ON DELETE CASCADE,
  name             VARCHAR(100) NOT NULL,
  email            VARCHAR(255),
  color            VARCHAR(25)  NOT NULL DEFAULT '#aaaaaa', -- Hex-Farbe für die Anzeige
  ics_url          TEXT         NOT NULL,
  active           BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cal_emp_mirror
  ON calendar_employees (mirror_config_id)
  WHERE active = TRUE;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Kalender-Ereignisse (Cache)
--    Fetched Termine werden hier gespeichert, damit der Node-Helper nicht bei
--    jedem Start alle ICS-Feeds neu laden muss.
--    uid + employee_id ist eindeutig – Wiederholungs-Instanzen bekommen ein
--    zusammengesetztes uid der Form "<original-uid>_<iso-start>".
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calendar_events_cache (
  id           SERIAL PRIMARY KEY,
  employee_id  INTEGER      NOT NULL REFERENCES calendar_employees(id) ON DELETE CASCADE,
  uid          VARCHAR(512) NOT NULL,          -- UID aus dem ICS (ggf. + Zeitstempel)
  title        VARCHAR(500) NOT NULL,
  start_at     TIMESTAMPTZ  NOT NULL,
  end_at       TIMESTAMPTZ  NOT NULL,
  all_day      BOOLEAN      NOT NULL DEFAULT FALSE,
  location     VARCHAR(500),
  description  TEXT,
  fetched_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_event_per_employee UNIQUE (employee_id, uid)
);

CREATE INDEX IF NOT EXISTS idx_cache_employee_start
  ON calendar_events_cache (employee_id, start_at);

CREATE INDEX IF NOT EXISTS idx_cache_start
  ON calendar_events_cache (start_at);


-- ─────────────────────────────────────────────────────────────────────────────
-- Hilfsfunktion: veraltete Cache-Einträge aufräumen (> 90 Tage alt)
-- Aufruf z. B. per pg_cron: SELECT cleanup_old_events();
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION cleanup_old_events()
RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE
  deleted INTEGER;
BEGIN
  DELETE FROM calendar_events_cache
  WHERE end_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- View: aktive Mitarbeiter mit ihrer Mirror-Konfiguration (praktisch für Abfragen)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_active_employees AS
SELECT
  e.id               AS employee_id,
  e.name             AS employee_name,
  e.email            AS employee_email,
  e.color,
  e.ics_url,
  m.id               AS mirror_id,
  m.name             AS mirror_name,
  m.usage_type,
  m.location         AS mirror_location,
  u.id               AS user_id,
  u.name             AS user_name,
  u.email            AS user_email
FROM calendar_employees e
JOIN mm_mirror_configs  m ON m.id = e.mirror_config_id
JOIN mm_users           u ON u.id = m.user_id
WHERE e.active = TRUE
  AND m.active = TRUE;


-- ─────────────────────────────────────────────────────────────────────────────
-- Demo-Daten (optional – zum Testen)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO mm_users (name, email) VALUES
  ('Admin Business', 'admin@firma.de'),
  ('Home User',      'user@privat.de')
ON CONFLICT (email) DO NOTHING;

INSERT INTO mm_mirror_configs (user_id, name, usage_type, location) VALUES
  (1, 'Büro-Spiegel',    'business',  'München, Büro EG'),
  (1, 'Dev-Spiegel',     'developer', 'München, Büro EG'),
  (2, 'Wohnzimmer',      'private',   'München, Zuhause')
ON CONFLICT DO NOTHING;

INSERT INTO calendar_employees (mirror_config_id, name, email, color, ics_url) VALUES
  (1, 'Max Mustermann', 'max@firma.de',  '#4a9eff', 'https://example.com/max.ics'),
  (1, 'Anna Schmidt',   'anna@firma.de', '#ff7043', 'https://example.com/anna.ics'),
  (1, 'Tom Bauer',      'tom@firma.de',  '#66bb6a', 'https://example.com/tom.ics')
ON CONFLICT DO NOTHING;
