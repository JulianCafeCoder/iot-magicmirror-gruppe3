-- ─────────────────────────────────────────────────────────────────────────────
-- MMM-EnergyDashboard – Datenbankschema
-- Für deinen Kollegen: dieses Script einmalig in der PostgreSQL-DB ausführen.
--
-- Ausführen:  psql -U <user> -d <datenbank> -f schema.sql
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS energy_demo_day (
  hour        SMALLINT PRIMARY KEY CHECK (hour >= 0 AND hour <= 23),
  solar_kw    NUMERIC(5, 2) NOT NULL DEFAULT 0,   -- Solarproduktion in kW
  house_kw    NUMERIC(5, 2) NOT NULL DEFAULT 0,   -- Hausverbrauch in kW
  battery_pct SMALLINT      NOT NULL DEFAULT 0,   -- Batterieladung 0–100 %
  battery_kw  NUMERIC(5, 2) NOT NULL DEFAULT 0,   -- >0 = laden, <0 = entladen
  grid_kw     NUMERIC(5, 2) NOT NULL DEFAULT 0    -- >0 = Einspeisung, <0 = Netzbezug
);

-- Demo-Tag: sonniger Sommertag
-- grid_kw = solar_kw - house_kw - battery_kw (Energiebilanz)
INSERT INTO energy_demo_day (hour, solar_kw, house_kw, battery_pct, battery_kw, grid_kw) VALUES
  ( 0,  0.0, 1.8, 65,  0.0, -1.8),
  ( 1,  0.0, 1.7, 63,  0.0, -1.7),
  ( 2,  0.0, 1.6, 61,  0.0, -1.6),
  ( 3,  0.0, 1.5, 59,  0.0, -1.5),
  ( 4,  0.0, 1.5, 57,  0.0, -1.5),
  ( 5,  0.2, 1.6, 55,  0.0, -1.4),
  ( 6,  0.8, 1.9, 56,  0.6, -1.7),
  ( 7,  1.8, 2.1, 62,  1.2, -1.5),
  ( 8,  3.2, 2.3, 72,  1.5, -0.6),
  ( 9,  4.5, 2.4, 82,  1.8,  0.3),
  (10,  5.4, 2.5, 90,  1.6,  1.3),
  (11,  6.1, 2.6, 95,  1.2,  2.3),
  (12,  6.3, 2.7, 97,  0.8,  2.8),
  (13,  6.0, 2.6, 98,  0.3,  3.1),
  (14,  5.5, 2.5, 99,  0.0,  3.0),
  (15,  4.8, 2.4, 99,  0.0,  2.4),
  (16,  3.8, 2.3, 99,  0.0,  1.5),
  (17,  2.5, 2.4, 96, -0.5,  0.6),
  (18,  1.2, 2.6, 88, -1.4,  0.0),
  (19,  0.4, 2.8, 78, -1.8, -0.6),
  (20,  0.0, 2.5, 68, -1.8, -0.7),
  (21,  0.0, 2.2, 58, -1.6, -0.6),
  (22,  0.0, 2.0, 50, -1.5, -0.5),
  (23,  0.0, 1.9, 44, -1.3, -0.6)
ON CONFLICT (hour) DO NOTHING;
