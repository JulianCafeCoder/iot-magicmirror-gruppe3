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
const DISPLAY_MODE   = profile.DISPLAY_MODE   ?? "dark";  // "dark" | "light"

console.log(`[MagicMirror] ▶ Modus: ${USAGE_TYPE} | Ort: ${LOCATION.name} | Timing: ${PAGE_TIMING_MS}ms | Theme: ${DISPLAY_MODE}`);

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
    },
    {
      pageClass: "biz-calendar",
      modules: [
        {
          module: "developer/MMM-CompanyCalendar",
          position: "fullscreen_above",
          header: "Firmenkalender",
          config: {
            fetchInterval:   15 * 60 * 1000,
            firstDayOfWeek:  1,
            maxEventsPerDay: 5,
            showLocation:    true,
            mirrorConfigId:  1,
            employees: []
          }
        }
      ]
    },
    // Weitere Business-Seiten hier einfügen:
    // { pageClass: "biz-analytics", modules: [ ... ] },
  ],

  // ── Seiten nur für Nutzungsart "private" ────────────────────────────────
  private: [
    {
      pageClass: "priv-todos",
      modules: [
        {
          module: "B2C/MMM-TodoList",
          position: "top_left",
          header: "To-Do Liste",
          config: {
            userId: 2
          }
        },
        {
          module: "B2C/MMM-Stundenplan",
          position: "top_right",
          config: {
            klasse: "11BE13"
          }
        }
      ]
    },
    {
      pageClass: "priv-smarthome",
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
    // Weitere Private-Seiten hier einfügen:
    // { pageClass: "priv-fitness", modules: [ ... ] },
  ],

  // ── Seiten nur für Nutzungsart "developer" ───────────────────────────────
  // Developer sieht ALLE Seiten (shared + business + private + developer).
  // Diese Seiten sind zusätzlich zu den anderen Modi sichtbar.
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
      pageClass: "dev-launcher",
      modules: [
        {
          module: "developer/MMM-Launcher",
          position: "middle_center"
        }
      ]
    }
    // Weitere Developer-Seiten hier einfügen:
    // { pageClass: "dev-performance", modules: [ ... ] },
  ],

  // ── Letzte Seite für ALLE Modi (wird immer ans Ende angehängt) ───────────
  shared_end: [
    {
      pageClass: "shared-tools",
      modules: [
        {
          module: "developer/MMM-Launcher",
          position: "middle_center"
        }
      ]
    }
  ]
};

// ─────────────────────────────────────────────────────────────────────────────
// Seiten für den aktiven Modus zusammenstellen
// ─────────────────────────────────────────────────────────────────────────────

// Developer sieht alles: shared + business + private + developer
// Business/Private: shared + moduspezifische Seiten
const activePages = USAGE_TYPE === "developer"
  ? [...PAGES.shared, ...PAGES.business, ...PAGES.private, ...PAGES.developer]
  : [...PAGES.shared, ...PAGES[USAGE_TYPE], ...PAGES.shared_end];

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

    // ── Theme (light/dark – gesteuert über DISPLAY_MODE in profile.js) ────
    {
      module: "MMM-Theme",
      config: { mode: DISPLAY_MODE }
    },

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
          "1", "2", "3", "4", "5", "6", "7", "8", "9", "0",
          "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Tab",
          "Enter", "Escape", " ", "Delete", "Backspace",
          "a","b","c","d","e","f","g","h","i","j","k","l","m",
          "n","o","p","q","r","s","t","u","v","w","x","y","z",
          "A","B","C","D","E","F","G","H","I","J","K","L","M",
          "N","O","P","Q","R","S","T","U","V","W","X","Y","Z",
          ".", ",", "-", "!", "?"
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
        fixed: ["alert", "updatenotification", "MMM-KeyBindings", "MMM-Dictation", "MMM-page-indicator", "MMM-Theme"],
        timings: { default: 0 },  // kein Auto-Blättern – nur Pfeiltasten
        animationTime: 800
      }
    },

    // ── Seiten-Indikator (Punkte am unteren Rand) ─────────────────────────
    {
      module: "MMM-page-indicator",
      position: "bottom_bar",
      config: {
        pages: activePages.length,
        activeBright: true,
        inactiveDimmed: true,
        inactiveHollow: true
      }
    },

    // ── Alle Seiten-Module (automatisch mit pageClass versehen) ───────────
    ...pageModules
  ]
};

/*************** DO NOT EDIT THE LINE BELOW ***************/
if (typeof module !== "undefined") { module.exports = config; }
