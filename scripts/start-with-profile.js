#!/usr/bin/env node
/**
 * MagicMirror – Interaktiver Profilwähler
 *
 * Verwendung:
 *   npm run start:select          (Wayland – Standard Pi)
 *   npm run start:select:x11      (X11 – falls Wayland nicht verfügbar)
 *
 * Das Script fragt welches Profil geladen werden soll,
 * schreibt config/profile.js und startet MagicMirror.
 */

const readline = require("readline");
const fs       = require("fs");
const path     = require("path");
const { spawn } = require("child_process");

// ── Verfügbare Profile ────────────────────────────────────────────────────────

const PROFILES = [
  {
    key:   "business",
    label: "Business",
    desc:  "Haupt-Dashboard · Scrum Board",
    color: "\x1b[33m",  // gelb
  },
  {
    key:   "private",
    label: "Private",
    desc:  "Haupt-Dashboard · Kalender · To-Do",
    color: "\x1b[36m",  // cyan
  },
  {
    key:   "developer",
    label: "Developer",
    desc:  "Nur Developer-Seiten (Git, Tools …)",
    color: "\x1b[32m",  // grün
  },
];

const RESET = "\x1b[0m";
const BOLD  = "\x1b[1m";
const DIM   = "\x1b[2m";

// ── Menü anzeigen ─────────────────────────────────────────────────────────────

const rootDir     = path.join(__dirname, "..");
const profilePath = path.join(rootDir, "config", "profile.js");

// Aktuelles Profil auslesen falls vorhanden
let currentType = null;
try {
  currentType = require(profilePath).USAGE_TYPE;
} catch (_) { /* kein Profil vorhanden */ }

process.stdout.write("\x1bc"); // Terminal leeren

console.log(`${BOLD}╔══════════════════════════════════════════╗${RESET}`);
console.log(`${BOLD}║     MagicMirror – Profil auswählen       ║${RESET}`);
console.log(`${BOLD}╚══════════════════════════════════════════╝${RESET}`);
console.log();

PROFILES.forEach((p, i) => {
  const active  = p.key === currentType ? ` ${DIM}(aktuell)${RESET}` : "";
  const number  = `${BOLD}${i + 1}${RESET}`;
  const label   = `${p.color}${BOLD}${p.label.padEnd(11)}${RESET}`;
  console.log(`  ${number})  ${label}  ${DIM}${p.desc}${RESET}${active}`);
});

console.log();

// ── Eingabe lesen ─────────────────────────────────────────────────────────────

const rl = readline.createInterface({
  input:  process.stdin,
  output: process.stdout,
});

rl.question(`Auswahl [1–${PROFILES.length}]: `, (answer) => {
  rl.close();

  const idx = parseInt(answer.trim(), 10) - 1;

  if (isNaN(idx) || idx < 0 || idx >= PROFILES.length) {
    console.error(`\n  Ungültige Eingabe. Bitte eine Zahl zwischen 1 und ${PROFILES.length} eingeben.\n`);
    process.exit(1);
  }

  const selected = PROFILES[idx];
  console.log(`\n  ${selected.color}${BOLD}→ Profil: ${selected.label}${RESET}\n`);

  // ── profile.js schreiben ────────────────────────────────────────────────────

  // Vorhandene Werte übernehmen (z.B. LOCATION, PAGE_TIMING_MS), nur USAGE_TYPE ändern
  let existing = {};
  try { existing = require(profilePath); } catch (_) {}

  const location     = existing.LOCATION      || { lat: 48.1351, lon: 11.5820, name: "München" };
  const pageTiming   = existing.PAGE_TIMING_MS || 15000;

  const content = `// Automatisch generiert von scripts/start-with-profile.js
// Manuell änderbar – diese Datei ist nicht im Git.
module.exports = {
  USAGE_TYPE:    "${selected.key}",
  LOCATION:      { lat: ${location.lat}, lon: ${location.lon}, name: "${location.name}" },
  PAGE_TIMING_MS: ${pageTiming},
};
`;

  fs.writeFileSync(profilePath, content, "utf-8");

  // ── MagicMirror starten ─────────────────────────────────────────────────────

  // Startvariante aus Umgebungsvariable oder Argument ermitteln
  const useX11 = process.argv.includes("--x11") || process.env.MM_DISPLAY === "x11";
  const script = useX11 ? "start:x11" : "start";

  const env = { ...process.env };
  // Fallback falls keine Display-Variable gesetzt ist
  if (!env.DISPLAY && !env.WAYLAND_DISPLAY) {
    if (useX11) {
      env.DISPLAY = ":0";
    } else {
      env.XDG_RUNTIME_DIR  = env.XDG_RUNTIME_DIR  || `/run/user/${process.getuid()}`;
      env.WAYLAND_DISPLAY  = env.WAYLAND_DISPLAY   || "wayland-1";
    }
  }

  console.log(`  ${DIM}Starte: npm run ${script}${RESET}\n`);

  const child = spawn("npm", ["run", script], {
    stdio: "inherit",
    shell: true,
    env,
    cwd:  rootDir,
  });

  child.on("exit", (code) => process.exit(code ?? 0));
});
