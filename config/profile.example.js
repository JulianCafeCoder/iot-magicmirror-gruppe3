/**
 * MagicMirror – Nutzungsprofil (Vorlage)
 * ─────────────────────────────────────────────────────────────────────────────
 * Diese Datei ist eine Vorlage. Kopiere sie als profile.js und passe die
 * Werte für dein Gerät an. Die profile.js ist bewusst NICHT im Git –
 * jedes Gerät (Pi, Entwicklungs-Mac, …) hat seine eigene Version.
 *
 * Einrichtung:
 *   cp config/profile.example.js config/profile.js
 *   nano config/profile.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

module.exports = {

  // ── Nutzungsart ────────────────────────────────────────────────────────────
  // "business"   →  Haupt-Dashboard + Scrum Board
  // "private"    →  Haupt-Dashboard + Kalender + To-Do
  // "developer"  →  Nur Seiten aus modules/developer/
  USAGE_TYPE: "business",

  // ── Standort (für Wettermodul) ────────────────────────────────────────────
  LOCATION: {
    lat:  48.1351,
    lon:  11.5820,
    name: "München",
  },

  // ── Seiten-Rotation ───────────────────────────────────────────────────────
  // Wie lange jede Seite angezeigt wird (Millisekunden)
  PAGE_TIMING_MS: 15000,

  // ── Anzeigemodus ──────────────────────────────────────────────────────────
  // "dark"   →  dunkler Hintergrund (Standard, ideal für Spiegel)
  // "light"  →  heller Hintergrund (ideal für Monitore / Tageslicht)
  DISPLAY_MODE: "dark",

};
