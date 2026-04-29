-- ─────────────────────────────────────────────────────────────────────────────
-- MMM-TodoList – Datenbankschema
-- Voraussetzung: schema.sql aus MMM-CompanyCalendar wurde bereits ausgeführt
--                (mm_users-Tabelle muss existieren)
--
-- Ausführen: psql -U gruppe3 -d postgres -f schema.sql
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS todos (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER      REFERENCES mm_users(id) ON DELETE CASCADE,
  title       VARCHAR(300) NOT NULL,
  category    VARCHAR(100) NOT NULL DEFAULT 'Sonstiges',
  done        BOOLEAN      NOT NULL DEFAULT FALSE,
  priority    SMALLINT     NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- priority: 1 = hoch, 2 = mittel, 3 = niedrig

CREATE INDEX IF NOT EXISTS idx_todos_user ON todos (user_id, done);

-- Trigger: updated_at automatisch setzen
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS todos_updated_at ON todos;
CREATE TRIGGER todos_updated_at
  BEFORE UPDATE ON todos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── Demo-Daten (user_id=2 = Home User aus MMM-CompanyCalendar schema.sql) ───
INSERT INTO todos (user_id, title, category, done, priority) VALUES
  (2, 'Einkaufen: Milch, Brot, Käse',        'Haushalt',   FALSE, 2),
  (2, 'Zahnarzt Termin vereinbaren',          'Gesundheit', FALSE, 1),
  (2, 'Auto zur Inspektion bringen',          'Auto',       FALSE, 2),
  (2, 'Steuererklärung abgeben',             'Finanzen',   FALSE, 1),
  (2, 'Geburtstagskarte für Mama schreiben', 'Familie',    FALSE, 3),
  (2, 'Sport: 3x diese Woche',               'Gesundheit', FALSE, 2),
  (2, 'Wohnung saugen',                      'Haushalt',   TRUE,  3),
  (2, 'Rechnung bezahlen',                   'Finanzen',   TRUE,  1),
  (2, 'Paket bei Nachbarn abholen',          'Sonstiges',  TRUE,  3)
ON CONFLICT DO NOTHING;
