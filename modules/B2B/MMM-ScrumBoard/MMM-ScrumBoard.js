Module.register("MMM-ScrumBoard", {
  defaults: {
    updateInterval: 60000,
    title: "Scrum Board",
    sprintName: "Sprint 1",
    sprintDays: 10,
    cards: [
      // To Do
      { id: 1, title: "Repository einrichten", points: 3, column: "todo", assignee: "Alle" },
      { id: 2, title: "B2B und B2C trennen", points: 2, column: "todo", assignee: "Julian" },
      { id: 3, title: "To do Liste", points: 5, column: "todo", assignee: "Julian" },
      // Busy
      { id: 4, title: "Flyer", points: 8, column: "busy", assignee: "Alle" },
      { id: 5, title: "Rauchen", points: 5, column: "busy", assignee: "Alle" },
      { id: 5, title: "Burn Down Chart", points: 5, column: "busy", assignee: "Julian" },
      // Done
      { id: 6, title: "Rasberry Pi einrichten", points: 3, column: "done", assignee: "Alle", timeSpent: "3h" },
      { id: 7, title: "Magic Mirror initial Screen anzeigen", points: 2, column: "done", assignee: "Alle", timeSpent: "2h 30min" },
      { id: 8, title: "Lokale Umgebung erstellen", points: 5, column: "done", assignee: "Julia", timeSpent: "1h" },
    ],
    // Burndown data: ideal and actual story points remaining per day
    burndown: {
      totalPoints: 41,
      // actual remaining points at end of each day (day 0 = sprint start)
      actual: [41, 38, 33, 33, 27, 27, 22, 18, null, null, null]
    }
  },

  start() {
    Log.info(`${this.name} started.`);
  },

  getStyles() {
    return ["MMM-ScrumBoard.css"];
  },

  getHeader() {
    return this.config.title;
  },

  getDom() {
    const wrapper = document.createElement("div");
    wrapper.className = "scrum-wrapper";

    wrapper.appendChild(this._buildBoard());
    wrapper.appendChild(this._buildBurndown());

    return wrapper;
  },

  _buildBoard() {
    const board = document.createElement("div");
    board.className = "scrum-board";

    const columns = [
      { key: "todo", label: "To Do", icon: "circle" },
      { key: "busy", label: "In Progress", icon: "spinner" },
      { key: "done", label: "Done", icon: "check-circle" }
    ];

    for (const col of columns) {
      const cards = this.config.cards.filter((c) => c.column === col.key);

      const colEl = document.createElement("div");
      colEl.className = `scrum-column scrum-column--${col.key}`;

      // Column header
      const header = document.createElement("div");
      header.className = "scrum-column-header";
      header.innerHTML = `<i class="fas fa-${col.icon}"></i> ${col.label}`;

      const badge = document.createElement("span");
      badge.className = "scrum-column-count";
      badge.textContent = cards.length;
      header.appendChild(badge);
      colEl.appendChild(header);

      // Cards
      for (const card of cards) {
        colEl.appendChild(this._buildCard(card));
      }

      board.appendChild(colEl);
    }

    return board;
  },

  _buildCard(card) {
    const el = document.createElement("div");
    el.className = `scrum-card scrum-card--${card.column}`;

    const titleEl = document.createElement("div");
    titleEl.className = "scrum-card-title";
    titleEl.textContent = card.title;
    el.appendChild(titleEl);

    const meta = document.createElement("div");
    meta.className = "scrum-card-meta";

    const assignee = document.createElement("span");
    assignee.className = "scrum-card-assignee";
    assignee.innerHTML = `<i class="fas fa-user"></i> ${card.assignee}`;
    meta.appendChild(assignee);

    const points = document.createElement("span");
    points.className = "scrum-card-points";
    points.textContent = `${card.points} SP`;
    meta.appendChild(points);

    el.appendChild(meta);

    if (card.column === "done" && card.timeSpent) {
      const time = document.createElement("div");
      time.className = "scrum-card-time";
      time.innerHTML = `<i class="fas fa-clock"></i> ${card.timeSpent}`;
      el.appendChild(time);
    }

    return el;
  },

  _buildBurndown() {
    const container = document.createElement("div");
    container.className = "scrum-burndown";

    const titleEl = document.createElement("div");
    titleEl.className = "scrum-burndown-title";
    titleEl.innerHTML = `<i class="fas fa-chart-line"></i> Burndown – ${this.config.sprintName}`;
    container.appendChild(titleEl);

    const { totalPoints, actual } = this.config.burndown;
    const days = this.config.sprintDays;

    const W = 500;
    const H = 200;
    const PAD = { top: 14, right: 20, bottom: 62, left: 38 };
    const chartW = W - PAD.left - PAD.right;
    const chartH = H - PAD.top - PAD.bottom;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("class", "scrum-burndown-svg");

    const xScale = (day) => PAD.left + (day / days) * chartW;
    const yScale = (pts) => PAD.top + chartH - (pts / totalPoints) * chartH;

    // Grid lines & Y labels
    const yTicks = [0, 10, 20, 30, 40, totalPoints];
    for (const tick of yTicks) {
      if (tick > totalPoints) continue;
      const y = yScale(tick);
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", PAD.left);
      line.setAttribute("x2", PAD.left + chartW);
      line.setAttribute("y1", y);
      line.setAttribute("y2", y);
      line.setAttribute("class", "bd-gridline");
      svg.appendChild(line);

      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", PAD.left - 5);
      label.setAttribute("y", y + 4);
      label.setAttribute("class", "bd-label bd-label--y");
      label.textContent = tick;
      svg.appendChild(label);
    }

    // X labels (every 2 days)
    for (let d = 0; d <= days; d += 2) {
      const x = xScale(d);
      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", x);
      label.setAttribute("y", PAD.top + chartH + 16);
      label.setAttribute("class", "bd-label bd-label--x");
      label.textContent = d === 0 ? "Start" : `T${d}`;
      svg.appendChild(label);
    }

    // Ideal line
    const idealPath = document.createElementNS("http://www.w3.org/2000/svg", "line");
    idealPath.setAttribute("x1", xScale(0));
    idealPath.setAttribute("y1", yScale(totalPoints));
    idealPath.setAttribute("x2", xScale(days));
    idealPath.setAttribute("y2", yScale(0));
    idealPath.setAttribute("class", "bd-ideal");
    svg.appendChild(idealPath);

    // Actual line
    const actualPoints = actual
      .map((v, i) => (v !== null ? `${xScale(i)},${yScale(v)}` : null))
      .filter(Boolean);

    if (actualPoints.length > 1) {
      const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      polyline.setAttribute("points", actualPoints.join(" "));
      polyline.setAttribute("class", "bd-actual");
      svg.appendChild(polyline);
    }

    // Dots for actual data points
    actual.forEach((v, i) => {
      if (v === null) return;
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", xScale(i));
      circle.setAttribute("cy", yScale(v));
      circle.setAttribute("r", 3);
      circle.setAttribute("class", "bd-dot");
      svg.appendChild(circle);
    });

    // Axes
    const axisX = document.createElementNS("http://www.w3.org/2000/svg", "line");
    axisX.setAttribute("x1", PAD.left);
    axisX.setAttribute("x2", PAD.left + chartW);
    axisX.setAttribute("y1", PAD.top + chartH);
    axisX.setAttribute("y2", PAD.top + chartH);
    axisX.setAttribute("class", "bd-axis");
    svg.appendChild(axisX);

    const axisY = document.createElementNS("http://www.w3.org/2000/svg", "line");
    axisY.setAttribute("x1", PAD.left);
    axisY.setAttribute("x2", PAD.left);
    axisY.setAttribute("y1", PAD.top);
    axisY.setAttribute("y2", PAD.top + chartH);
    axisY.setAttribute("class", "bd-axis");
    svg.appendChild(axisY);

    // Legend – placed well below x-axis labels
    const legendData = [
      { label: "Ideal", cls: "bd-legend-ideal" },
      { label: "Aktuell", cls: "bd-legend-actual" }
    ];
    const legendY = PAD.top + chartH + 42; // 42px below chart axis
    legendData.forEach(({ label, cls }, i) => {
      const lx = PAD.left + i * 100;
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", lx);
      line.setAttribute("x2", lx + 20);
      line.setAttribute("y1", legendY - 3);
      line.setAttribute("y2", legendY - 3);
      line.setAttribute("class", cls);
      svg.appendChild(line);

      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", lx + 24);
      text.setAttribute("y", legendY);
      text.setAttribute("class", "bd-label bd-label--legend");
      text.textContent = label;
      svg.appendChild(text);
    });

    container.appendChild(svg);
    return container;
  }
});
