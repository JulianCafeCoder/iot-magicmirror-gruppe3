Module.register("MMM-ServiceStatus", {
  defaults: {
    updateInterval: 30 * 1000,
  },

  // ── State ─────────────────────────────────────────────────────────────────
  _serverServices: [],
  services: [],

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  start() {
    Log.info(`${this.name}: started`);
    this.sendSocketNotification("INIT");
  },

  getStyles() { return ["MMM-ServiceStatus.css"]; },

  // ── Socket ────────────────────────────────────────────────────────────────

  socketNotificationReceived(notification, payload) {
    if (notification === "SERVICE_STATUS") {
      this._serverServices = payload;
      this._checkMicAndRender();
    }
  },

  // ── Mic check: actually request getUserMedia to verify real access ─────────
  async _checkMicAndRender() {
    let micOnline = false;
    let micDetail = "";
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const label = stream.getAudioTracks()[0]?.label || "";
      stream.getTracks().forEach((t) => t.stop());
      micOnline = true;
      micDetail = label ? label.substring(0, 28) : "Zugriff OK";
    } catch (e) {
      micOnline = false;
      micDetail = e.name === "NotAllowedError"  ? "Kein Zugriff"
               :  e.name === "NotFoundError"    ? "Kein Gerät"
               :  e.name === "NotReadableError" ? "Gerät belegt"
               :  e.message || e.name;
    }
    this.services = [
      ...this._serverServices,
      { id: "mic", label: "Mikrofon", online: micOnline, detail: micDetail },
    ];
    this._render();
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
      const stateText = svc.detail || (svc.online ? "Online" : "Offline");
      row.innerHTML = `
        <span class="svc-dot"></span>
        <span class="svc-label">${svc.label}</span>
        <span class="svc-state">${stateText}</span>`;
      wrap.appendChild(row);
    });

    return wrap;
  },
});
