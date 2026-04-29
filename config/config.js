/**
 * MagicMirror – Hauptkonfiguration
 *
 * Nutzungsart und globale Parameter werden über config/profile.js gesteuert.
 * Diese Datei sollte nicht direkt bearbeitet werden müssen.
 */

const path = require("path");
const configDir = global.root_path ? path.join(global.root_path, "config") : __dirname;

// profile.js ist gerätespezifisch (wie .env) und nicht im Git.
// Falls sie fehlt, gelten diese Standardwerte:
let profile = {};
const profileFile = path.join(configDir, "profile.js");
try {
  profile = require(profileFile);
  console.log(`[MagicMirror] ✔ profile.js geladen: ${profileFile}`);
} catch (e) {
  console.log(`[MagicMirror] ⚠ profile.js nicht gefunden (${profileFile}) – Standardwerte werden genutzt. Fehler: ${e.message}`);
}

const USAGE_TYPE     = profile.USAGE_TYPE    ?? "business";
const LOCATION       = profile.LOCATION      ?? { lat: 48.1351, lon: 11.5820, name: "München" };
const PAGE_TIMING_MS = profile.PAGE_TIMING_MS ?? 15000;
const OPENAI_API_KEY = profile.OPENAI_API_KEY ?? "";
const GROQ_API_KEY   = profile.GROQ_API_KEY   ?? "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";

console.log(`[MagicMirror] ▶ Modus: ${USAGE_TYPE} | Ort: ${LOCATION.name} | Timing: ${PAGE_TIMING_MS}ms`);

// ─────────────────────────────────────────────────────────────────────────────
// Seitendefinitionen pro Nutzungsart
//
// Jeder Eintrag hat:
//   pageClass  – CSS-Klasse, die MMM-pages zur Steuerung nutzt (einmalig, eindeutig)
//   modules    – Array von MagicMirror-Modulkonfigurationen für diese Seite
//
// Um eine neue Seite hinzuzufügen:
//   1. Neuen Eintrag in PAGES["business"] oder PAGES["private"] eintragen
//   2. pageClass muss einmalig sein (z. B. "biz-analytics", "priv-fitness")
//   3. MagicMirror neu starten
// ─────────────────────────────────────────────────────────────────────────────

const PAGES = {

  // ── Seite 0: Haupt-Dashboard (gilt für BEIDE Modi) ───────────────────────
  shared: [
    {
      pageClass: "page-main",
      modules: [
        {
          module: "clock",
          position: "top_left"
        },
        {
          module: "calendar",
          header: "Kalender",
          position: "top_left",
          config: {
            calendars: [
              {
                fetchInterval: 7 * 24 * 60 * 60 * 1000,
                symbol: "calendar-check",
                url: "https://ics.calendarlabs.com/76/mm3137/US_Holidays.ics"
              }
            ]
          }
        },
        {
          module: "compliments",
          position: "lower_third"
        },
        {
          module: "weather",
          position: "top_right",
          config: {
            weatherProvider: "openmeteo",
            type: "current",
            lat: LOCATION.lat,
            lon: LOCATION.lon
          }
        },
        {
          module: "weather",
          position: "top_right",
          header: `Wetter ${LOCATION.name}`,
          config: {
            weatherProvider: "openmeteo",
            type: "forecast",
            lat: LOCATION.lat,
            lon: LOCATION.lon
          }
        },
        {
          module: "newsfeed",
          position: "bottom_bar",
          config: {
            feeds: [
              {
                title: "Tagesschau",
                url: "https://www.tagesschau.de/xml/rss2/"
              }
            ],
            showSourceTitle: true,
            showPublishDate: true,
            broadcastNewsFeeds: true,
            broadcastNewsUpdates: true
          }
        },
      ]
    },
    {
      pageClass: "aurora-page",
      modules: [
        {
          module: "shared/MMM-Aurora",
          position: "fullscreen_below"
        }
      ]
    }
  ],

  // ── Seiten nur für Nutzungsart "business" ────────────────────────────────
  business: [
    {
      pageClass: "biz-scrum",
      modules: [
        {
          module: "B2B/MMM-ScrumBoard",
          position: "top_left",
          header: "Scrum Board",
          config: {
            sprintName: "Sprint 1",
            sprintDays: 10
          }
        }
      ]
    }
    // Weitere Business-Seiten hier einfügen:
    // { pageClass: "biz-analytics", modules: [ ... ] },
  ],

  // ── Seiten nur für Nutzungsart "private" ────────────────────────────────
  private: [
    {
      pageClass: "priv-todo",
      modules: [
        {
          module: "calendar",
          header: "Meine Termine",
          position: "top_left",
          config: {
            maximumEntries: 12,
            calendars: [
              {
                fetchInterval: 60 * 60 * 1000,
                symbol: "calendar-check",
                url: "https://ics.calendarlabs.com/76/mm3137/US_Holidays.ics"
              }
            ]
          }
        },
        {
          module: "compliments",
          position: "middle_center"
        },
        {
          module: "weather",
          position: "top_right",
          header: `Wetter heute – ${LOCATION.name}`,
          config: {
            weatherProvider: "openmeteo",
            type: "current",
            lat: LOCATION.lat,
            lon: LOCATION.lon
          }
        }
      ]
    },
    {
      pageClass: "priv-todos",
      modules: [
        {
          module: "B2C/MMM-TodoList",
          position: "top_left",
          header: "To-Do Liste",
          config: {
            userId: 2   // ID aus mm_users (Home User)
          }
        }
      ]
    }
    // Weitere Private-Seiten hier einfügen:
    // { pageClass: "priv-fitness", modules: [ ... ] },
  ],

  // ── Seiten nur für Nutzungsart "developer" ───────────────────────────────
  // Zeigt AUSSCHLIESSLICH diese Seiten – kein Haupt-Dashboard, kein B2B/B2C.
  // Module müssen in modules/developer/<MMM-Name>/ liegen.
  developer: [
    {
      pageClass: "dev-git",
      modules: [
        {
          module: "developer/MMM-GitInfo",
          position: "top_left",
          header: "Git Repository"
        },
        {
          module: "developer/MMM-ServiceStatus",
          position: "top_right",
          header: "Services"
        }
      ]
    },
    {
      pageClass: "dev-page2",
      modules: [
        {
          module: "developer/MMM-LightSwitches",
          position: "top_left",
          header: "Lichtsteuerung"
        },
        {
          module: "developer/MMM-DeviceStatus",
          position: "top_left",
          header: "Geräte"
        },
        {
          module: "developer/MMM-EnergyDashboard",
          position: "top_right",
          header: "Energie"
        }
      ]
    },
    {
      pageClass: "dev-page3",
      modules: [
        {
          module: "developer/MMM-Launcher",
          position: "middle_center"
        }
      ]
    },
    {
      pageClass: "dev-calendar",
      modules: [
        {
          module: "developer/MMM-CompanyCalendar",
          position: "fullscreen_above",
          header: "Firmenkalender",
          config: {
            viewMode: "week",          // "week" | "month"
            fetchInterval: 15 * 60 * 1000,
            firstDayOfWeek: 1,
            maxEventsPerDay: 5,
            showLocation: true,
            mirrorConfigId: 1,         // ID aus mm_mirror_configs (Fallback: employees-Array)
            employees: [
              // Beispiel-Einträge – ICS-URLs der Mitarbeiter hier eintragen:
              // {
              //   name: "Max Mustermann",
              //   color: "#4a9eff",
              //   url: "https://example.com/max.ics"
              // },
              // {
              //   name: "Anna Schmidt",
              //   color: "#ff7043",
              //   url: "https://example.com/anna.ics"
              // },
            ]
          }
        }
      ]
    },
    // Weitere Developer-Seiten hier einfügen:
    // { pageClass: "dev-performance", modules: [ ... ] },
  ]
};

// ─────────────────────────────────────────────────────────────────────────────
// Seiten für den aktiven Modus zusammenstellen
// ─────────────────────────────────────────────────────────────────────────────

// Developer-Modus: nur developer-Seiten (kein shared Haupt-Dashboard)
// Alle anderen Modi: shared + moduspezifische Seiten
const activePages = USAGE_TYPE === "developer"
  ? PAGES.developer
  : [...PAGES.shared, ...PAGES[USAGE_TYPE]];

// MMM-pages erwartet ein Array von Arrays der pageClasses je Seite
const pagesMatrix = activePages.map((p) => [p.pageClass]);

// Alle Seiten-Module flach zusammenführen und die pageClass als CSS-Klasse setzen
const pageModules = activePages.flatMap((page) =>
  page.modules.map((mod) => ({
    ...mod,
    classes: page.pageClass
  }))
);

// ─────────────────────────────────────────────────────────────────────────────
// MagicMirror-Konfiguration
// ─────────────────────────────────────────────────────────────────────────────

let config = {
  address: process.env.MM_ADDRESS || "localhost",
  port: 8081,
  basePath: "/",
  ipWhitelist: ["127.0.0.1", "::ffff:127.0.0.1", "::1"],

  useHttps: false,
  httpsPrivateKey: "",
  httpsCertificate: "",

  language: "de",
  locale: "de-DE",
  logLevel: ["INFO", "LOG", "WARN", "ERROR"],
  timeFormat: 24,
  units: "metric",

  modules: [
    // ── Immer sichtbar (unabhängig von Seite und Modus) ───────────────────
    { module: "alert" },
    { module: "updatenotification", position: "top_bar" },

    // ── Globaler Diktierdienst (MediaRecorder + Whisper API) ─────────────
    // provider: "groq" (kostenlos, console.groq.com) | "openai" ($0.006/min)
    {
      module: "developer/MMM-Dictation",
      position: "bottom_right",
      config: {
        language: "de",
        provider: "groq",
        apiKey: GROQ_API_KEY || OPENAI_API_KEY,
      }
    },

    // ── Tastatur-Navigation (Pfeiltasten → MMM-pages) ─────────────────────
    {
      module: "MMM-KeyBindings",
      config: {
        enableKeyboard: true,
        // Ziffern 1–8 müssen explizit zur Abhörliste hinzugefügt werden
        // Alle Tasten, die als KEYPRESS weitergeleitet werden sollen
        handleKeys: [
          "1", "2", "3", "4", "5", "6", "7", "8",
          "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
          "Enter", "Escape", " ", "Delete", "Backspace", "r", "R",
          "."
        ],
        actions: [
          // Seiten blättern nur im DEFAULT-Modus (nicht im LAUNCHER/MODULE-Modus)
          {
            key: "ArrowRight",
            state: "KEY_PRESSED",
            mode: "DEFAULT",
            notification: "PAGE_INCREMENT"
          },
          {
            key: "ArrowLeft",
            state: "KEY_PRESSED",
            mode: "DEFAULT",
            notification: "PAGE_DECREMENT"
          }
          // Alle anderen Tasten werden per KEYPRESS-Notification weitergeleitet
        ]
      }
    },

    // ── Seiten-Steuerung ──────────────────────────────────────────────────
    {
      module: "MMM-pages",
      config: {
        modules: pagesMatrix,
        fixed: ["alert", "updatenotification", "MMM-KeyBindings", "MMM-Dictation"],
        timings: USAGE_TYPE === "developer"
          ? { default: 0 }
          : { default: PAGE_TIMING_MS, 1: 60 * 1000 },
        animationTime: 800
      }
    },

    // ── Alle Seiten-Module (automatisch mit pageClass versehen) ───────────
    ...pageModules
  ]
};

/*************** DO NOT EDIT THE LINE BELOW ***************/
if (typeof module !== "undefined") { module.exports = config; }
