const NodeHelper = require("node_helper");
const Log        = require("logger");
const { execFile } = require("child_process");

module.exports = NodeHelper.create({

  start() {
    // global.root_path ist in Node.js-Kontext verfügbar (gesetzt von MagicMirror app.js)
    this.repoPath = global.root_path;
    Log.info(`${this.name}: node_helper ready – repo: ${this.repoPath}`);
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "GIT_FETCH") {
      // Falls per Config ein abweichender Pfad angegeben wurde, diesen nutzen
      if (payload.repoPath) this.repoPath = payload.repoPath;
      this._fetchAll();
    }
  },

  // ── Alle Git-Daten sammeln und gebündelt senden ───────────────────────────

  async _fetchAll() {
    try {
      const [commits, branch, totalCommits, contributors, weeklyCount] =
        await Promise.all([
          this._gitLog(),
          this._gitBranch(),
          this._gitTotalCommits(),
          this._gitContributors(),
          this._gitWeeklyCount(),
        ]);

      this.sendSocketNotification("GIT_DATA", {
        commits,
        branch,
        totalCommits,
        contributors,
        weeklyCount,
        fetchedAt: new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
      });
    } catch (err) {
      Log.error(`${this.name}: git fetch failed – ${err.message}`);
      this.sendSocketNotification("GIT_ERROR", { message: err.message });
    }
  },

  // ── Commit-Historie (letzte 20) ───────────────────────────────────────────

  _gitLog() {
    // Felder durch \x00 (Null-Byte) getrennt – sicher auch bei Sonderzeichen im Subject
    const fmt = ["%H", "%h", "%s", "%an", "%ar", "%ad"].join("%x00");
    return this._git([
      "log",
      `--format=${fmt}%x00`,
      "--date=format:%d.%m.%Y %H:%M",
      "-n", "20",
    ]).then((stdout) => {
      const parts  = stdout.split("\0").map((s) => s.trim());
      const commits = [];
      // Je Commit 6 Felder
      for (let i = 0; i + 5 < parts.length; i += 6) {
        if (!parts[i]) continue;
        commits.push({
          hash:    parts[i],
          short:   parts[i + 1],
          subject: parts[i + 2],
          author:  parts[i + 3],
          when:    parts[i + 4],
          date:    parts[i + 5],
        });
      }
      return commits;
    });
  },

  // ── Aktueller Branch ──────────────────────────────────────────────────────

  _gitBranch() {
    return this._git(["branch", "--show-current"])
      .then((s) => s.trim() || "main");
  },

  // ── Gesamtzahl Commits ────────────────────────────────────────────────────

  _gitTotalCommits() {
    return this._git(["rev-list", "--count", "HEAD"])
      .then((s) => parseInt(s.trim(), 10) || 0);
  },

  // ── Top-5 Contributor (Name + Commit-Anzahl) ──────────────────────────────

  _gitContributors() {
    // Output: "   42\tJulian Bienek\n   7\tBot\n..."
    return this._git(["shortlog", "-sn", "--no-merges", "HEAD"])
      .then((stdout) =>
        stdout
          .trim()
          .split("\n")
          .slice(0, 5)
          .map((line) => {
            const match = line.match(/^\s*(\d+)\s+(.+)$/);
            return match ? { count: parseInt(match[1], 10), name: match[2].trim() } : null;
          })
          .filter(Boolean)
      );
  },

  // ── Commits der letzten 7 Tage ────────────────────────────────────────────

  _gitWeeklyCount() {
    return this._git(["log", "--since=7 days ago", "--oneline"])
      .then((stdout) => stdout.trim().split("\n").filter(Boolean).length);
  },

  // ── Basis: Git ausführen ─────────────────────────────────────────────────

  _git(args) {
    return new Promise((resolve, reject) => {
      execFile("git", ["-C", this.repoPath, ...args], { timeout: 8000 }, (err, stdout, stderr) => {
        if (err) {
          reject(new Error(stderr || err.message));
        } else {
          resolve(stdout);
        }
      });
    });
  },
});
