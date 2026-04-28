/**
 * MMM-Launcher — 2×2 interactive panel
 *
 * All four sub-modules (Timer, Stoppuhr, Würfel, Notizen) are rendered
 * in one 2×2 grid by this single module.
 *
 * Keyboard modes (MMM-KeyBindings):
 *   DEFAULT   → arrow keys = page navigation, Enter = enter card-select
 *   LAUNCHER  → arrow keys = move cursor, Enter = activate card, Esc = back
 *   MODULE    → keys go to active card, Esc = back to LAUNCHER
 */
Module.register("MMM-Launcher", {
  defaults: {},

  /* ── global state ─────────────────────────────────────────── */
  _mode:   "idle",   // idle | selecting | active
  _cursor: 0,        // 0=Timer 1=Stoppuhr 2=Würfel 3=Notizen
  _firstRender: true, // animate cards only on first build after page appears

  /* ── Timer ───────────────────────────────────────────────── */
  _tm: {
    total: 300, remaining: 300,
    state: "stopped",   // stopped | running | done | editing
    interval: null,
    editVals: [0, 5, 0], editField: 1,   // H M S
  },

  /* ── Stoppuhr ────────────────────────────────────────────── */
  _sw: {
    elapsed: 0, base: 0, startTs: 0,
    running: false, interval: null, laps: [],
  },

  /* ── Würfel ──────────────────────────────────────────────── */
  _dc: {
    TYPES: [4,6,8,10,12,20], typeIdx: 1,
    sides: 6, value: null, rolling: false,
  },
  DICE_DOTS: {
    1: [[50,50]],
    2: [[25,25],[75,75]],
    3: [[25,25],[50,50],[75,75]],
    4: [[25,25],[75,25],[25,75],[75,75]],
    5: [[25,25],[75,25],[50,50],[25,75],[75,75]],
    6: [[25,25],[75,25],[25,50],[75,50],[25,75],[75,75]],
  },

  /* ── Notizen ─────────────────────────────────────────────── */
  _nt: { text: "", dictating: false, status: "" },

  /* ── lifecycle ───────────────────────────────────────────── */
  getStyles() { return ["MMM-Launcher.css"]; },

  start() {
    try { this._nt.text = localStorage.getItem("mmm_notes") || ""; } catch (_) {}
    Log.info(`${this.name}: gestartet`);
  },

  getDom() {
    const w = document.createElement("div");
    w.id = "mmm-launcher-root";
    this._buildDom(w);
    return w;
  },

  /* ── notifications ───────────────────────────────────────── */
  notificationReceived(notification, payload) {
    if (notification === "DICTATION_STATUS" && payload.requester === "MMM-Launcher") {
      const labels = {
        listening:   "Zuhören…",
        sound:       "Ton erkannt…",
        speech:      "Sprache erkannt…",
        processing:  "Verarbeitung…",
      };
      this._nt.status = labels[payload.status] || "";
      this._updateNotesUi();
      return;
    }

    if (notification === "DICTATION_RESULT" && payload.requester === "MMM-Launcher") {
      const sep = this._nt.text.length > 0 && !this._nt.text.endsWith("\n") ? " " : "";
      this._nt.text += sep + payload.transcript;
      this._nt.status = "";
      try { localStorage.setItem("mmm_notes", this._nt.text); } catch (_) {}
      this._updateNotesUi();
      const ta = document.getElementById("mmm-nt-ta");
      if (ta) { ta.value = this._nt.text; ta.setSelectionRange(ta.value.length, ta.value.length); }
      return;
    }

    if (notification === "DICTATION_ERROR" && payload.requester === "MMM-Launcher") {
      this._nt.dictating = false;
      const errorLabels = {
        "audio-capture":  "Kein Mikrofon gefunden",
        "not-allowed":    "Mikrofon-Zugriff verweigert",
        "NotAllowedError":"Mikrofon-Zugriff verweigert",
        "not-supported":  "Spracherkennung nicht unterstützt",
        "network":        "Netzwerkfehler (Internet benötigt)",
        "no-match":       "Sprache nicht erkannt – nochmal versuchen",
        "aborted":        "",
      };
      this._nt.status = errorLabels[payload.error] || `Fehler: ${payload.error}`;
      this._updateNotesUi();
      if (this._nt.status) {
        setTimeout(() => { this._nt.status = ""; this._updateNotesUi(); }, 4000);
      }
      return;
    }

    // Reset animation flag when this page becomes visible again
    if (notification === "NEW_PAGE") {
      this._firstRender = true;
      return;
    }

    if (notification === "TIMER_SET") {
      const secs = payload && payload.seconds;
      if (typeof secs !== "number" || secs <= 0) return;
      if (this._tm.state === "running") this._tmPause();
      this._tm.total = secs;
      this._tm.remaining = secs;
      this._tm.state = "stopped";
      this._render();
      setTimeout(() => { if (this._tm.state === "stopped") this._tmStart(); }, 600);
      return;
    }

    if (notification === "TIMER_START") {
      if (this._tm.state !== "running" && this._tm.remaining > 0) this._tmStart();
      return;
    }

    if (notification === "TIMER_STOP") {
      if (this._tm.state === "running") { this._tmPause(); this._render(); }
      return;
    }

    if (notification === "TIMER_RESET") {
      this._tmPause();
      this._tm.remaining = this._tm.total;
      this._tm.state = "stopped";
      this._render();
      return;
    }

    if (notification === "STOPWATCH_START") {
      if (!this._sw.running) {
        this._sw.startTs = Date.now();
        this._sw.interval = setInterval(() => {
          this._sw.elapsed = this._sw.base + Date.now() - this._sw.startTs;
          this._render(true);
        }, 30);
        this._sw.running = true;
        this._render();
      }
      return;
    }

    if (notification === "STOPWATCH_STOP") {
      if (this._sw.running) {
        this._sw.base = this._sw.elapsed;
        clearInterval(this._sw.interval);
        this._sw.interval = null;
        this._sw.running = false;
        this._render();
      }
      return;
    }

    if (notification === "STOPWATCH_RESET") {
      clearInterval(this._sw.interval);
      this._sw.interval = null;
      this._sw.running = false;
      this._sw.elapsed = 0;
      this._sw.base = 0;
      this._sw.laps = [];
      this._render();
      return;
    }

    if (notification === "STOPWATCH_LAP") {
      if (this._sw.running) {
        const last = this._sw.laps.reduce((a, b) => a + b, 0);
        this._sw.laps.push(this._sw.elapsed - last);
        this._render();
      }
      return;
    }

    if (notification === "NOTES_OPEN") {
      this._cursor = 3;
      this._mode = "active";
      this.sendNotification("KEYPRESS_MODE_CHANGED", "MODULE");
      this._render();
      setTimeout(() => { const t = document.getElementById("mmm-nt-ta"); if (t) t.focus(); }, 100);
      return;
    }

    if (notification !== "KEYPRESS") return;
    const key = payload.keyName;

    if (this._mode === "idle") {
      if (key === "Enter") this._enterSelecting();
      return;
    }

    if (this._mode === "selecting") {
      if (key === "ArrowRight") { this._moveCursor(1);  return; }
      if (key === "ArrowLeft")  { this._moveCursor(-1); return; }
      if (key === "ArrowDown")  { this._moveCursor(2);  return; }
      if (key === "ArrowUp")    { this._moveCursor(-2); return; }
      if (key === "Enter")      { this._activateCard(); return; }
      if (key === "Return")     { this._enterIdle();    return; }
      return;
    }

    if (this._mode === "active") {
      if (this._cursor === 0) this._tmKey(key);
      else if (this._cursor === 1) this._swKey(key);
      else if (this._cursor === 2) this._dcKey(key);
      else if (this._cursor === 3) { if (key === "Return") this._backToSelecting(); }
    }
  },

  /* ── mode transitions ────────────────────────────────────── */
  _enterSelecting() {
    this._mode = "selecting";
    this.sendNotification("KEYPRESS_MODE_CHANGED", "LAUNCHER");
    this._render();
  },
  _enterIdle() {
    this._mode = "idle";
    this.sendNotification("KEYPRESS_MODE_CHANGED", "DEFAULT");
    this._render();
  },
  _activateCard() {
    this._mode = "active";
    this.sendNotification("KEYPRESS_MODE_CHANGED", "MODULE");
    this._render();
    if (this._cursor === 3) {
      setTimeout(() => { const t = document.getElementById("mmm-nt-ta"); if (t) t.focus(); }, 60);
    }
  },
  _backToSelecting() {
    this._mode = "selecting";
    this.sendNotification("KEYPRESS_MODE_CHANGED", "LAUNCHER");
    this._render();
  },
  _moveCursor(d) {
    this._cursor = ((this._cursor + d) % 4 + 4) % 4;
    this._render();
  },

  /* ── Timer key handling ──────────────────────────────────── */
  _tmKey(key) {
    const tm = this._tm;
    if (tm.state === "editing") {
      if (key >= "0" && key <= "9") {
        const max = tm.editField === 0 ? 23 : 59;
        let v = tm.editVals[tm.editField] * 10 + parseInt(key);
        if (v > max) v = parseInt(key);
        tm.editVals[tm.editField] = v;
        this._render(); return;
      }
      if (key === "ArrowRight") { tm.editField = Math.min(2, tm.editField + 1); this._render(); return; }
      if (key === "ArrowLeft")  { tm.editField = Math.max(0, tm.editField - 1); this._render(); return; }
      if (key === "Delete")    { tm.editVals[tm.editField] = Math.floor(tm.editVals[tm.editField] / 10); this._render(); return; }
      if (key === "Enter") {
        tm.total = tm.editVals[0]*3600 + tm.editVals[1]*60 + tm.editVals[2];
        tm.remaining = tm.total;
        tm.state = "stopped"; this._render(); return;
      }
      if (key === "Return") { tm.state = "stopped"; this._render(); return; }
      return;
    }
    if (key === " ") {
      if (tm.state === "running") { this._tmPause(); }
      else if (tm.remaining > 0) { this._tmStart(); }
      return;
    }
    if (key === "Enter") {
      this._tmPause();
      tm.editVals = [Math.floor(tm.total/3600), Math.floor((tm.total%3600)/60), tm.total%60];
      tm.editField = 1; tm.state = "editing"; this._render(); return;
    }
    if (key === "Return") { this._tmPause(); tm.remaining = tm.total; this._backToSelecting(); }
  },
  _tmStart() {
    const tm = this._tm;
    tm.state = "running";
    tm.interval = setInterval(() => {
      if (tm.remaining <= 0) {
        clearInterval(tm.interval); tm.interval = null; tm.state = "done"; this._render(); return;
      }
      tm.remaining--; this._render(true);
    }, 1000);
    this._render();
  },
  _tmPause() {
    const tm = this._tm;
    if (tm.interval) { clearInterval(tm.interval); tm.interval = null; }
    if (tm.state === "running") tm.state = "stopped";
  },

  /* ── Stoppuhr key handling ───────────────────────────────── */
  _swKey(key) {
    const sw = this._sw;
    if (key === " ") {
      if (sw.running) {
        sw.base = sw.elapsed;
        clearInterval(sw.interval); sw.interval = null; sw.running = false;
      } else {
        sw.startTs = Date.now();
        sw.interval = setInterval(() => { sw.elapsed = sw.base + Date.now() - sw.startTs; this._render(true); }, 30);
        sw.running = true;
      }
      this._render(); return;
    }
    if (key === "Enter" && sw.running) {
      const last = sw.laps.reduce((a,b) => a+b, 0);
      sw.laps.push(sw.elapsed - last); this._render(); return;
    }
    if (key === "r" || key === "R") {
      clearInterval(sw.interval); sw.interval = null;
      sw.running = false; sw.elapsed = 0; sw.base = 0; sw.laps = [];
      this._render(); return;
    }
    if (key === "Return") { this._backToSelecting(); }
  },

  /* ── Würfel key handling ─────────────────────────────────── */
  _dcKey(key) {
    const dc = this._dc;
    if (key === " " || key === "Enter") { this._dcRoll(); return; }
    if (key === "ArrowRight") {
      dc.typeIdx = Math.min(dc.TYPES.length-1, dc.typeIdx+1);
      dc.sides = dc.TYPES[dc.typeIdx]; dc.value = null; this._render(); return;
    }
    if (key === "ArrowLeft") {
      dc.typeIdx = Math.max(0, dc.typeIdx-1);
      dc.sides = dc.TYPES[dc.typeIdx]; dc.value = null; this._render(); return;
    }
    if (key === "Return") { this._backToSelecting(); }
  },
  _dcRoll() {
    const dc = this._dc;
    if (dc.rolling) return;
    dc.rolling = true; dc.value = null; this._render();
    setTimeout(() => {
      dc.value = Math.floor(Math.random() * dc.sides) + 1;
      dc.rolling = false; this._render();
    }, 620);
  },

  /* ── helpers ─────────────────────────────────────────────── */
  _p(n) { return String(n).padStart(2, "0"); },
  _fmtSec(s) {
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
    return h > 0 ? `${this._p(h)}:${this._p(m)}:${this._p(sec)}` : `${this._p(m)}:${this._p(sec)}`;
  },
  _fmtMs(ms) {
    return { m: Math.floor(ms/60000), s: Math.floor((ms%60000)/1000), cs: Math.floor((ms%1000)/10) };
  },

  /* ── render ──────────────────────────────────────────────── */
  _render(tickOnly = false) {
    const root = document.getElementById("mmm-launcher-root");
    if (!root) return;
    if (tickOnly) { this._tickUpdate(); return; }
    this._buildDom(root);
  },

  _tickUpdate() {
    // Timer: update number + progress bar in-place
    const tm = this._tm;
    const tmNum = document.getElementById("lp-tm-num");
    if (tmNum) {
      tmNum.className = `lp-bignum${tm.state === "done" ? " lp-bignum--pulse" : ""}`;
      tmNum.textContent = this._fmtSec(tm.remaining);
    }
    const tmPb = document.getElementById("lp-tm-pb");
    if (tmPb) {
      const p = tm.total > 0 && tm.remaining < tm.total ? (tm.remaining / tm.total) * 100 : 0;
      tmPb.style.width = `${p}%`;
    }
    // Stopwatch: update number in-place
    const swNum = document.getElementById("lp-sw-num");
    if (swNum) {
      const d = this._fmtMs(this._sw.elapsed);
      swNum.innerHTML = `${this._p(d.m)}:${this._p(d.s)}<span class="lp-cs">${this._p(d.cs)}</span>`;
    }
  },

  /* ── targeted notes-card UI update (no full rebuild) ────────── */
  _updateNotesUi() {
    const micBtn = document.getElementById("mmm-nt-mic");
    if (micBtn) {
      micBtn.className = `lp-btn lp-btn--sm lp-btn--mic${this._nt.dictating ? " lp-btn--recording" : ""}`;
      micBtn.textContent = this._nt.dictating ? "● Stopp" : "🎤";
    }
    const statusEl = document.getElementById("mmm-nt-status");
    if (statusEl) {
      const isError = this._nt.status && !this._nt.dictating;
      statusEl.textContent = this._nt.status;
      statusEl.style.display = this._nt.status ? "" : "none";
      statusEl.className = `lp-nt-status${isError ? " lp-nt-status--error" : ""}`;
    }
    const hint = document.querySelector("#mmm-launcher-root .lp-hint");
    if (hint) hint.textContent = this._hintText();
  },

  _buildDom(root) {
    const sel = this._mode === "selecting";
    const act = this._mode === "active";
    const anim = this._firstRender;
    this._firstRender = false;

    root.innerHTML = `
      <div class="lp-grid">
        ${this._timerCard(sel, act, anim)}
        ${this._stopwatchCard(sel, act, anim)}
        ${this._diceCard(sel, act, anim)}
        ${this._notesCard(sel, act, anim)}
      </div>
      <div class="lp-hint">${this._hintText()}</div>`;

    // Re-attach notes textarea listeners after DOM rebuild
    if (act && this._cursor === 3) {
      const ta = document.getElementById("mmm-nt-ta");
      if (ta) {
        ta.addEventListener("input", (e) => {
          this._nt.text = e.target.value;
          try { localStorage.setItem("mmm_notes", e.target.value); } catch (_) {}
          const cnt = document.getElementById("mmm-nt-count");
          const lines = e.target.value.split("\n").filter(Boolean).length;
          if (cnt) cnt.textContent = `${lines} ${lines === 1 ? "Zeile" : "Zeilen"}`;
        });
        // nativeKeyHandler skips textarea elements, so we catch Escape directly
        ta.addEventListener("keydown", (e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            if (this._nt.dictating) {
              this._nt.dictating = false;
              this.sendNotification("DICTATION_STOP");
              this._render();
            } else {
              this._backToSelecting();
            }
          }
        });
      }

      const micBtn = document.getElementById("mmm-nt-mic");
      if (micBtn) {
        micBtn.addEventListener("click", () => {
          if (this._nt.dictating) {
            this._nt.dictating = false;
            this._nt.status = "";
            this.sendNotification("DICTATION_STOP");
          } else {
            this._nt.dictating = true;
            this._nt.status = "Verbindung…";
            this.sendNotification("DICTATION_START", { requester: "MMM-Launcher", language: "de" });
          }
          this._updateNotesUi();
          setTimeout(() => { const t = document.getElementById("mmm-nt-ta"); if (t) t.focus(); }, 40);
        });
      }

      const clearBtn = document.getElementById("mmm-nt-clear");
      if (clearBtn) {
        clearBtn.addEventListener("click", () => {
          this._nt.text = "";
          try { localStorage.removeItem("mmm_notes"); } catch (_) {}
          this._render();
          setTimeout(() => { const t = document.getElementById("mmm-nt-ta"); if (t) t.focus(); }, 40);
        });
      }
    }
  },

  _cardCls(idx, anim) {
    const sel = this._mode === "selecting" && this._cursor === idx;
    const act = this._mode === "active"    && this._cursor === idx;
    const a = anim ? " lp-card--anim" : "";
    if (act) return `lp-card lp-card--active${a}`;
    if (sel) return `lp-card lp-card--selected${a}`;
    return `lp-card${a}`;
  },

  _hintText() {
    if (this._mode === "idle")      return "Enter &nbsp;→&nbsp; Modul auswählen";
    if (this._mode === "selecting") return "◀ ▶ ▲ ▼ navigieren &nbsp;·&nbsp; Enter öffnen &nbsp;·&nbsp; Esc zurück";
    // active
    if (this._cursor === 0) return this._tm.state === "editing"
      ? "◀▶ Feld · 0‑9 Wert · Enter bestätigen · Del löschen · Esc abbrechen"
      : "Leertaste Start/Pause · Enter einstellen · Esc zurück";
    if (this._cursor === 1) return "Leertaste Start/Stopp · Enter Runde · R Reset · Esc zurück";
    if (this._cursor === 2) return "◀▶ Würfeltyp · Leertaste / Enter würfeln · Esc zurück";
    if (this._cursor === 3) return this._nt.dictating
      ? "Sprechen… · Esc oder Stopp-Taste zum Abbrechen"
      : "Tippen · Mikrofon-Taste zum Diktieren · Esc zurück";
    return "";
  },

  /* ── Timer card ──────────────────────────────────────────── */
  _timerCard(sel, act, anim) {
    const tm = this._tm;
    const isAct = act && this._cursor === 0;
    const isDone = tm.state === "done";
    // 0% when not yet started (remaining === total), full % while running/paused
    const progress = tm.total > 0 && tm.remaining < tm.total ? (tm.remaining / tm.total) * 100 : 0;

    let body;
    if (isAct && tm.state === "editing") {
      const labels = ["H","M","S"];
      body = `
        <div class="lp-edit-row">
          ${labels.map((l,i) => `
            <div class="lp-field">
              <div class="lp-field-lbl">${l}</div>
              <div class="lp-field-val${i===tm.editField?" lp-field-val--focus":""}">${this._p(tm.editVals[i])}</div>
            </div>`).join("")}
        </div>`;
    } else {
      body = `<div class="lp-bignum${isDone?" lp-bignum--pulse":""}" id="lp-tm-num">${this._fmtSec(tm.remaining)}</div>`;
    }

    return `
      <div class="${this._cardCls(0, anim)}">
        <div class="lp-label">Timer</div>
        ${body}
        <div class="lp-spacer"></div>
        <div class="lp-actions">
          <div class="lp-btn lp-btn--primary">${tm.state==="running"?"Pause":isDone?"Neu":tm.remaining<tm.total?"Weiter":"Start"}</div>
          ${tm.remaining<tm.total&&tm.state!=="running"?`<div class="lp-btn">Reset</div>`:""}
        </div>
        <div class="lp-progress-track">
          <div class="lp-progress-bar${isDone?" lp-progress-bar--pulse":""}" id="lp-tm-pb" style="width:${progress}%"></div>
        </div>
      </div>`;
  },

  /* ── Stoppuhr card ───────────────────────────────────────── */
  _stopwatchCard(sel, act, anim) {
    const sw = this._sw;
    const d = this._fmtMs(sw.elapsed);
    const lapRows = [...sw.laps].reverse().slice(0,3).map((l,i) => {
      const li = sw.laps.length - i;
      const ld = this._fmtMs(l);
      return `<div class="lp-lap"><span>Runde ${li}</span><span>${this._p(ld.m)}:${this._p(ld.s)}.${this._p(ld.cs)}</span></div>`;
    }).join("");

    return `
      <div class="${this._cardCls(1, anim)}">
        <div class="lp-label">Stoppuhr</div>
        <div class="lp-bignum" id="lp-sw-num">${this._p(d.m)}:${this._p(d.s)}<span class="lp-cs">${this._p(d.cs)}</span></div>
        <div class="lp-spacer"></div>
        ${lapRows ? `<div class="lp-laps">${lapRows}</div>` : ""}
        <div class="lp-actions">
          <div class="lp-btn lp-btn--primary">${sw.running?"Stopp":sw.elapsed>0?"Weiter":"Start"}</div>
          ${sw.running?`<div class="lp-btn">Runde</div>`:""}
          ${!sw.running&&sw.elapsed>0?`<div class="lp-btn">Reset</div>`:""}
        </div>
      </div>`;
  },

  /* ── Würfel card ─────────────────────────────────────────── */
  _diceCard(sel, act, anim) {
    const dc = this._dc;
    const showDots = dc.sides === 6 && dc.value !== null && !dc.rolling;
    let dieInner;
    if (dc.rolling) {
      dieInner = `<div class="lp-die-text">···</div>`;
    } else if (showDots) {
      dieInner = (this.DICE_DOTS[dc.value]||[]).map(([x,y]) =>
        `<div class="lp-dot" style="left:${x}%;top:${y}%"></div>`).join("");
    } else {
      dieInner = `<div class="lp-die-text${dc.value?" lp-die-text--val":""}">${dc.value||"?"}</div>`;
    }
    const typeButtons = dc.TYPES.map((s,i) =>
      `<div class="lp-type-btn${i===dc.typeIdx?" lp-type-btn--active":""}">W${s}</div>`
    ).join("");

    return `
      <div class="${this._cardCls(2, anim)}">
        <div class="lp-label">Würfel</div>
        <div class="lp-dice-row">
          <div class="lp-die${dc.rolling?" lp-die--spin":""}">${dieInner}</div>
          ${dc.value&&dc.sides!==6?`<div class="lp-bignum" style="margin-bottom:0">${dc.value}</div>`:""}
        </div>
        <div class="lp-types">${typeButtons}</div>
        <div class="lp-spacer"></div>
        <div class="lp-actions"><div class="lp-btn lp-btn--primary">Würfeln</div></div>
      </div>`;
  },

  /* ── Notizen card ────────────────────────────────────────── */
  _notesCard(sel, act, anim) {
    const isAct = act && this._cursor === 3;
    const lines = this._nt.text.split("\n").filter(Boolean).length;
    const esc = (s) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    const micCls = `lp-btn lp-btn--sm lp-btn--mic${this._nt.dictating ? " lp-btn--recording" : ""}`;
    const isError = this._nt.status && !this._nt.dictating;

    return `
      <div class="${this._cardCls(3, anim)}">
        <div class="lp-label">Notizen</div>
        <textarea id="mmm-nt-ta" class="lp-textarea"
          placeholder="Notiz eingeben…"
          spellcheck="false"
          ${isAct ? "" : "readonly tabindex='-1'"}
        >${esc(this._nt.text)}</textarea>
        <div id="mmm-nt-status"
             class="lp-nt-status${isError ? " lp-nt-status--error" : ""}"
             style="${this._nt.status ? "" : "display:none"}"
        >${this._nt.status}</div>
        <div class="lp-nt-footer">
          <span id="mmm-nt-count" class="lp-nt-count">${lines} ${lines===1?"Zeile":"Zeilen"}</span>
          <div class="lp-nt-actions">
            ${isAct ? `<div class="${micCls}" id="mmm-nt-mic">${this._nt.dictating ? "● Stopp" : "🎤"}</div>` : ""}
            ${this._nt.text ? `<div class="lp-btn lp-btn--sm" id="mmm-nt-clear">Leeren</div>` : ""}
          </div>
        </div>
      </div>`;
  },
});
