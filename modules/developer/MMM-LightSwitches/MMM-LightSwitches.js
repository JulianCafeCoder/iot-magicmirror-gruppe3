Module.register("MMM-LightSwitches", {
  defaults: {
    lights: [
      { id: 1, name: "Wohnzimmer",    icon: "fa-couch"       },
      { id: 2, name: "Küche",         icon: "fa-utensils"    },
      { id: 3, name: "Schlafzimmer",  icon: "fa-bed"         },
      { id: 4, name: "Bad",           icon: "fa-bath"        },
      { id: 5, name: "Kinderzimmer",  icon: "fa-child"       },
      { id: 6, name: "Arbeitszimmer", icon: "fa-laptop"      },
      { id: 7, name: "Flur",          icon: "fa-door-open"   },
      { id: 8, name: "Keller",        icon: "fa-stairs"      },
    ],
  },

  // ── State ─────────────────────────────────────────────────────────────────
  lightState: {},   // { 1: false, 2: true, … }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  start() {
    Log.info(`${this.name}: started`);
    this.config.lights.forEach((l) => { this.lightState[l.id] = false; });
    this.sendSocketNotification("INIT");
  },

  getStyles() { return ["MMM-LightSwitches.css"]; },

  // ── Notifications von anderen Modulen ────────────────────────────────────

  notificationReceived(notification, payload) {
    // KEYPRESS kommt von MMM-KeyBindings – Tasten "1" bis "8"
    if (notification === "KEYPRESS") {
      const key = payload.keyName;
      if (key >= "1" && key <= "8") {
        const id = parseInt(key);
        this.sendSocketNotification("TOGGLE_LIGHT", { id });
      }
    }
  },

  // ── Socket-Nachrichten vom node_helper ───────────────────────────────────

  socketNotificationReceived(notification, payload) {
    if (notification === "LIGHT_STATE") {
      this.lightState = payload;
      this._render();
    }
  },

  // ── DOM ───────────────────────────────────────────────────────────────────

  getDom() { return this._buildDom(); },

  _render() {
    const wrapper = document.getElementById(this.identifier);
    if (!wrapper) return;
    const content = wrapper.querySelector(".module-content");
    if (!content) return;
    content.innerHTML = "";
    content.appendChild(this._buildDom());
  },

  _buildDom() {
    const grid = document.createElement("div");
    grid.className = "ls-grid";

    this.config.lights.forEach((light) => {
      const on = !!this.lightState[light.id];

      const card = document.createElement("div");
      card.className = `ls-card ${on ? "ls-on" : "ls-off"}`;

      card.innerHTML = `
        <div class="ls-key">${light.id}</div>
        <div class="ls-icon"><i class="fas ${this._esc(light.icon)}"></i></div>
        <div class="ls-name">${this._esc(light.name)}</div>
        <div class="ls-badge">${on ? "AN" : "AUS"}</div>`;

      grid.appendChild(card);
    });

    return grid;
  },

  // ── HTML-Escaping ─────────────────────────────────────────────────────────

  _esc(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  },
});
