# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Start (Electron, Wayland)
npm start                  # Wayland
npm run start:x11          # X11
npm run start:dev          # Electron dev mode

# Server only (for Docker / Pi)
npm run server

# Config validation
npm run config:check

# Tests
npm test                   # all tests
npm run test:unit          # unit tests only
npm run test:e2e           # end-to-end tests only
npm run test:electron      # electron tests only

# Linting
npm run lint:js            # ESLint (auto-fix)
npm run lint:css           # Stylelint (auto-fix)
npm run lint:prettier      # Prettier (auto-fix)

# Module-specific dependencies (only needed for MMM-LightSwitches)
cd modules/developer/MMM-LightSwitches && npm install
```

## Architecture

This is a [MagicMirror²](https://magicmirror.builders) installation with profile-based multi-page configuration and custom modules.

### Profile-based configuration

`config/config.js` is the single MagicMirror config file, but it is not edited directly for device-specific settings. Instead it reads `config/profile.js` (git-ignored, device-specific) which sets:

- `USAGE_TYPE` — `"business"` | `"private"` | `"developer"`
- `LOCATION` — `{ lat, lon, name }` for the weather module
- `PAGE_TIMING_MS` — auto-scroll interval (0 = disabled)

Copy the template to get started: `cp config/profile.example.js config/profile.js`

### Page/module system

Pages are defined in the `PAGES` object inside `config/config.js`:

- `PAGES.shared` — shown in all modes (main dashboard)
- `PAGES.business` — business-only pages
- `PAGES.private` — private-only pages
- `PAGES.developer` — developer-only pages (developer mode sees ALL sections combined)

Each page entry is `{ pageClass: "unique-css-class", modules: [...] }`. At runtime, `config.js` assembles all active pages, assigns `classes: pageClass` to each module config, and passes the `pagesMatrix` (array of arrays) to **MMM-pages** for visibility control.

Navigation: `←`/`→` arrow keys via **MMM-KeyBindings** → `PAGE_DECREMENT`/`PAGE_INCREMENT` notifications → **MMM-pages**. **MMM-page-indicator** shows dots at the bottom.

### Module directory structure

```
modules/
  B2B/              # Business modules (school/work context)
    MMM-ScrumBoard
  B2C/              # Consumer modules
    MMM-TodoList    # PostgreSQL + JSON fallback
    MMM-Stundenplan # School timetable from PostgreSQL
  developer/        # Developer/smart-home modules
    MMM-CompanyCalendar
    MMM-Dictation   # Voice input: MediaRecorder → Whisper → LLaMA → action
    MMM-EnergyDashboard
    MMM-LightSwitches  # MQTT light control (has own package.json)
    MMM-ServiceStatus
    MMM-GitInfo
    MMM-Launcher
    MMM-Notes / MMM-Timer / MMM-Stopwatch / MMM-Dice
  MMM-KeyBindings/  # Third-party: keyboard event routing
  MMM-pages/        # Third-party: page visibility manager
  MMM-page-indicator/ # Third-party: page dots indicator
```

### Module anatomy

Every MagicMirror module has two parts:

1. **Client-side** (`MMM-Name.js`) — runs in the browser, extends `Module`. Key methods: `start()`, `getDom()`, `notificationReceived()`, `socketNotificationReceived()`. Send to node helper: `this.sendSocketNotification(name, payload)`.
2. **Server-side** (`node_helper.js`) — runs in Node.js, extends `NodeHelper`. Key method: `socketNotificationReceived()`. Send to client: `this.sendSocketNotification(name, payload)`.

### Database (PostgreSQL)

Several modules read from a shared PostgreSQL instance at `10.93.135.91:5432`, user/db `gruppe3/postgres`. The connection host can be overridden with the `PG_HOST` environment variable. Modules fall back gracefully when the DB is unavailable.

Schema files must be applied in order (CompanyCalendar schema first, as others reference `mm_users`):

```bash
psql -U gruppe3 -d postgres -f modules/developer/MMM-CompanyCalendar/schema.sql
psql -U gruppe3 -d postgres -f modules/B2C/MMM-TodoList/schema.sql
psql -U gruppe3 -d postgres -f modules/B2C/MMM-Stundenplan/schema.sql
psql -U gruppe3 -d postgres -f modules/developer/MMM-EnergyDashboard/schema.sql
```

### Voice dictation (MMM-Dictation)

Pipeline: browser `MediaRecorder` → base64 audio → node helper → `curl` to Whisper API (Groq or OpenAI) → transcript → for `VOICE_COMMAND` mode: second `curl` to LLaMA/GPT with a hardcoded system prompt → JSON action object → broadcast notification.

API keys come from `config/profile.js` (`GROQ_API_KEY`, `OPENAI_API_KEY`). Groq is the default (free tier).

### Smart-home hardware

`MMM-LightSwitches` publishes/subscribes to MQTT topics `home/lights/<n>/set` and `home/lights/<n>/status` (broker at `localhost:1883`). The physical counterpart is an ESP32 sketch in `hardware/esp32-lights/`; WLAN and MQTT credentials live in `hardware/esp32-lights/config.h` (git-ignored, copy from `config.h.example`).

### Docker / Raspberry Pi

The `Dockerfile` builds a server-only image (`node ./serveronly`) that binds on `0.0.0.0:8081`. `docker-compose.yml` uses `network_mode: host` (Linux/Pi only) and mounts `config/profile.js` as read-only. The Pi's Chromium connects to `localhost:8081`; `scripts/kiosk.sh` handles autostart.

### Adding a new page

1. Add an entry to the appropriate section in `PAGES` inside `config/config.js` with a unique `pageClass`.
2. Restart MagicMirror — the page appears automatically in the rotation.
