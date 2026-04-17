Module.register("MMM-GitInfo", {
  defaults: {
    updateInterval: 5 * 60 * 1000,  // alle 5 Minuten
    maxCommits:     15,              // sichtbare Commits in der Liste
    // repoPath: optional – wenn nicht gesetzt, nutzt der node_helper
    // automatisch das MagicMirror-Verzeichnis (global.root_path auf dem Pi)
  },

  // ── State ─────────────────────────────────────────────────────────────────
  data:    null,   // { commits, branch, totalCommits, contributors, weeklyCount, fetchedAt }
  error:   null,
  _timer:  null,

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  start() {
    Log.info(`${this.name}: started`);
    this._fetch();
    this._timer = setInterval(() => this._fetch(), this.config.updateInterval);
  },

  suspend() { clearInterval(this._timer); },
  resume()  { this._fetch(); this._timer = setInterval(() => this._fetch(), this.config.updateInterval); },

  getStyles() { return ["MMM-GitInfo.css"]; },
  getHeader() { return "Git Repository"; },

  // ── Socket ────────────────────────────────────────────────────────────────

  socketNotificationReceived(notification, payload) {
    if (notification === "GIT_DATA") {
      this.error = null;
      this.data  = payload;
      this.updateDom(0);
      // Debug-Ping zurück an node_helper – erscheint im Backend-Terminal
      this.sendSocketNotification("GIT_DATA_ACK", {
        branch: payload.branch,
        commits: payload.commits ? payload.commits.length : -1,
      });
    }
    if (notification === "GIT_ERROR") {
      this.error = payload.message;
      this.updateDom(0);
    }
  },

  _fetch() {
    // repoPath nur senden wenn explizit konfiguriert – sonst nutzt der
    // node_helper automatisch global.root_path (MagicMirror-Verzeichnis)
    this.sendSocketNotification("GIT_FETCH", {
      repoPath: this.config.repoPath || null,
    });
  },

  // ── DOM ───────────────────────────────────────────────────────────────────

  getDom() {
    const wrap = document.createElement("div");
    wrap.className = "gitinfo-wrap";

    if (this.error) {
      wrap.innerHTML = `<div class="gitinfo-error"><i class="fas fa-circle-exclamation"></i> ${this.error}</div>`;
      return wrap;
    }

    if (!this.data) {
      wrap.innerHTML = `<div class="gitinfo-loading"><i class="fas fa-spinner fa-spin"></i> Lade Git-Daten…</div>`;
      return wrap;
    }

    wrap.appendChild(this._buildHeader());
    wrap.appendChild(this._buildStats());
    wrap.appendChild(this._buildCommitList());
    wrap.appendChild(this._buildFooter());

    return wrap;
  },

  // ── Branch + Commit-Zähler ────────────────────────────────────────────────

  _buildHeader() {
    const { branch, totalCommits } = this.data;
    const el = document.createElement("div");
    el.className = "gitinfo-header";
    el.innerHTML = `
      <span class="gitinfo-branch">
        <i class="fas fa-code-branch"></i> ${this._esc(branch)}
      </span>
      <span class="gitinfo-total">
        <i class="fas fa-circle-dot"></i> ${totalCommits} Commits
      </span>`;
    return el;
  },

  // ── Wöchentliche Aktivität + Contributors ────────────────────────────────

  _buildStats() {
    const { weeklyCount, contributors } = this.data;
    const el = document.createElement("div");
    el.className = "gitinfo-stats";

    const weekly = document.createElement("span");
    weekly.className = "gitinfo-stat";
    weekly.innerHTML = `<i class="fas fa-fire"></i> ${weeklyCount} diese Woche`;
    el.appendChild(weekly);

    if (contributors.length > 0) {
      const sep = document.createElement("span");
      sep.className = "gitinfo-sep";
      sep.textContent = "·";
      el.appendChild(sep);

      const contrib = document.createElement("span");
      contrib.className = "gitinfo-stat";
      const names = contributors.slice(0, 3).map((c) => this._esc(c.name)).join(", ");
      contrib.innerHTML = `<i class="fas fa-users"></i> ${names}`;
      el.appendChild(contrib);
    }

    return el;
  },

  // ── Commit-Liste ──────────────────────────────────────────────────────────

  _buildCommitList() {
    const list = document.createElement("div");
    list.className = "gitinfo-commits";

    const visible = this.data.commits.slice(0, this.config.maxCommits);

    visible.forEach((commit, idx) => {
      const item = document.createElement("div");
      item.className = "gitinfo-commit";
      item.style.animationDelay = `${idx * 30}ms`;

      item.innerHTML = `
        <div class="gitinfo-commit-dot"></div>
        <div class="gitinfo-commit-body">
          <div class="gitinfo-commit-subject">${this._esc(commit.subject)}</div>
          <div class="gitinfo-commit-meta">
            <span class="gitinfo-commit-hash">${this._esc(commit.short)}</span>
            <span class="gitinfo-commit-author">${this._esc(commit.author)}</span>
            <span class="gitinfo-commit-when">${this._esc(commit.when)}</span>
          </div>
        </div>`;

      list.appendChild(item);
    });

    return list;
  },

  // ── Letzte Aktualisierung ─────────────────────────────────────────────────

  _buildFooter() {
    const el = document.createElement("div");
    el.className = "gitinfo-footer";
    el.innerHTML = `<i class="fas fa-rotate"></i> Aktualisiert ${this.data.fetchedAt}`;
    return el;
  },

  // ── Hilfsfunktion: HTML-Escaping ─────────────────────────────────────────

  _esc(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  },
});
