const NodeHelper = require("node_helper");
const Log        = require("logger");

// ── Dummy-Geräteliste ─────────────────────────────────────────────────────────
// status: "active" | "done" | "idle" | "off" | "error" | "charging"
// Später: echte Daten per MQTT, REST-API (Home Assistant, ioBroker, etc.)
const DEVICES = [
  { id: "waschmaschine", name: "Waschmaschine", icon: "fa-tshirt",        status: "active",   info: "28 min übrig",         group: "haushalt"  },
  { id: "spuelmaschine", name: "Spülmaschine",  icon: "fa-utensils",      status: "done",     info: "Programm fertig",       group: "haushalt"  },
  { id: "rasenroboter",  name: "Rasenmäher",    icon: "fa-leaf",          status: "active",   info: "Zone 2 von 3",          group: "garten"    },
  { id: "saugroboter",   name: "Saugroboter",   icon: "fa-robot",         status: "charging", info: "Lädt · 68 %",           group: "haushalt"  },
  { id: "server",        name: "Home Server",   icon: "fa-server",        status: "active",   info: "CPU 12 % · 42 °C",      group: "tech"      },
  { id: "klimaanlage",   name: "Klimaanlage",   icon: "fa-snowflake",     status: "off",      info: "Nicht aktiv",           group: "klima"     },
  { id: "trockner",      name: "Trockner",      icon: "fa-wind",          status: "idle",     info: "Bereit",                group: "haushalt"  },
  { id: "smarttv",       name: "Smart TV",      icon: "fa-tv",            status: "active",   info: "Netflix · Wohnzimmer",  group: "media"     },
  { id: "nas",           name: "NAS",           icon: "fa-hdd",           status: "active",   info: "4 TB frei",             group: "tech"      },
  { id: "router",        name: "Router",        icon: "fa-wifi",          status: "active",   info: "24 Geräte online",      group: "tech"      },
];

module.exports = NodeHelper.create({

  start() {
    Log.info(`${this.name}: gestartet`);
    this._timer = setInterval(() => this._push(), 60 * 1000);
  },

  socketNotificationReceived(notification) {
    if (notification === "DEVICE_INIT") this._push();
  },

  _push() {
    this.sendSocketNotification("DEVICE_DATA", {
      devices:   DEVICES,
      updatedAt: Date.now(),
      source:    "dummy",
    });
  },
});
