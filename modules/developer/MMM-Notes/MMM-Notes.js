Module.register("MMM-Notes", {
  defaults: {},

  _active: true,
  _text:   "",

  start() {
    Log.info(`${this.name}: gestartet`);
    try {
      this._text = localStorage.getItem("mmm_notes") || "";
    } catch (_) {}
  },

  getDom() {
    const w = document.createElement("div");
    w.id = "mmm-notes-root";
    return w;
  },

  notificationReceived(notification, payload) {
    if (notification === "MODULE_DOM_CREATED") { this._render(); return; }
    if (notification === "MODULE_ACTIVATED") {
      this._active = (payload.id === this.name);
      this._render();
      if (this._active) {
        setTimeout(() => {
          const ta = document.getElementById("mmm-notes-ta");
          if (ta) ta.focus();
        }, 80);
      }
    }
    if (!this._active) return;

    // Esc closes the module (textarea absorbs other keys natively)
    if (notification === "KEYPRESS" && payload.keyName === "Escape") {
      this._deactivate();
    }
  },

  _save(text) {
    this._text = text;
    try { localStorage.setItem("mmm_notes", text); } catch (_) {}
  },

  _deactivate() {
    this._active = false;
    this._render();
    this.sendNotification("MODULE_DEACTIVATED", { id: this.name });
  },

  _render() {
    const root = document.getElementById("mmm-notes-root");
    if (!root) return;
    if (!this._active) { root.innerHTML = ""; return; }

    const lines = this._text.split("\n").filter(Boolean).length;
    const hasText = this._text.length > 0;

    root.innerHTML = `
      <div class="nt-card">
        <div class="nt-label">Notizen</div>
        <textarea id="mmm-notes-ta" class="nt-textarea" placeholder="Notiz eingeben…" spellcheck="false">${this._escape(this._text)}</textarea>
        <div class="nt-hint">Tippen zum Schreiben · Esc beenden</div>
        <div class="nt-footer">
          <span class="nt-count">${lines} ${lines === 1 ? "Zeile" : "Zeilen"}</span>
          ${hasText ? `<div class="nt-btn" id="mmm-notes-clear">Leeren</div>` : ""}
        </div>
      </div>`;

    const ta = document.getElementById("mmm-notes-ta");
    if (ta) {
      ta.addEventListener("input", (e) => {
        this._save(e.target.value);
        // Update footer count without full re-render (to keep focus)
        const l = e.target.value.split("\n").filter(Boolean).length;
        const cnt = document.querySelector(".nt-count");
        if (cnt) cnt.textContent = `${l} ${l === 1 ? "Zeile" : "Zeilen"}`;
      });
    }

    const clearBtn = document.getElementById("mmm-notes-clear");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        this._save("");
        this._render();
        setTimeout(() => { const t = document.getElementById("mmm-notes-ta"); if (t) t.focus(); }, 40);
      });
    }
  },

  _escape(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  },
});
