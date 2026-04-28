Module.register("MMM-DeviceStatus", {
  defaults: {},

  deviceData: null,

  start() {
    Log.info(`${this.name}: started`);
    this.sendSocketNotification("DEVICE_INIT");
  },

  getStyles() { return ["MMM-DeviceStatus.css"]; },

  socketNotificationReceived(notification, payload) {
    if (notification === "DEVICE_DATA") {
      this.deviceData = payload;
      this.updateDom(300);
    }
  },

  getDom() {
    const wrap = document.createElement("div");
    wrap.className = "ds-wrap";

    if (!this.deviceData) {
      wrap.innerHTML = `<div class="ds-loading"><i class="fas fa-spinner fa-spin"></i> Lade Geräte…</div>`;
      return wrap;
    }

    const { devices, updatedAt, source } = this.deviceData;

    const grid = document.createElement("div");
    grid.className = "ds-grid";
    devices.forEach(d => grid.appendChild(this._card(d)));
    wrap.appendChild(grid);

    const t  = new Date(updatedAt);
    const ts = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
    const footer = document.createElement("div");
    footer.className = "ds-footer";
    footer.innerHTML = source === "dummy"
      ? `<i class="fas fa-flask"></i> Demo-Daten · ${ts} Uhr`
      : `<i class="fas fa-circle ds-live"></i> Live · ${ts} Uhr`;
    wrap.appendChild(footer);

    return wrap;
  },

  _card(d) {
    const LABELS = {
      active:   "Aktiv",
      done:     "Fertig",
      idle:     "Bereit",
      off:      "Aus",
      error:    "Fehler",
      charging: "Lädt",
    };

    const card = document.createElement("div");
    card.className = `ds-card ds-s-${d.status}`;

    const pulse = (d.status === "active" || d.status === "charging")
      ? `<span class="ds-pulse"></span>`
      : "";

    card.innerHTML = `
      <div class="ds-icon-wrap">
        ${pulse}
        <i class="fas ${d.icon}"></i>
      </div>
      <div class="ds-body">
        <div class="ds-name">${d.name}</div>
        <div class="ds-info">${d.info}</div>
      </div>
      <div class="ds-badge ds-b-${d.status}">${LABELS[d.status] ?? d.status}</div>
    `;

    return card;
  },
});
