Module.register("MMM-ServiceStatus", {
  defaults: {
    updateInterval: 30 * 1000,
  },

  // ── State ─────────────────────────────────────────────────────────────────
  services: [],   // [{ id, label, online }]

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  start() {
    Log.info(`${this.name}: started`);
    this.sendSocketNotification("INIT");
  },

  getStyles() { return ["MMM-ServiceStatus.css"]; },

  // ── Socket ────────────────────────────────────────────────────────────────

  socketNotificationReceived(notification, payload) {
    if (notification === "SERVICE_STATUS") {
      this.services = payload;
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
    const wrap = document.createElement("div");
    wrap.className = "svcstatus-wrap";

    if (this.services.length === 0) {
      wrap.innerHTML = `<div class="svcstatus-loading"><i class="fas fa-spinner fa-spin"></i></div>`;
      return wrap;
    }

    this.services.forEach((svc) => {
      const row = document.createElement("div");
      row.className = `svcstatus-row ${svc.online ? "svc-online" : "svc-offline"}`;
      row.innerHTML = `
        <span class="svc-dot"></span>
        <span class="svc-label">${svc.label}</span>
        <span class="svc-state">${svc.online ? "Online" : "Offline"}</span>`;
      wrap.appendChild(row);
    });

    return wrap;
  },
});
