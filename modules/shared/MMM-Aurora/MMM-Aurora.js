Module.register("MMM-Aurora", {
  defaults: {},

  getStyles() {
    return ["MMM-Aurora.css"];
  },

  getDom() {
    const scene = document.createElement("div");
    scene.className = "mmaurora-scene";

    // Three soft aurora bands + a subtle horizon glow
    ["band-1", "band-2", "band-3", "horizon"].forEach((cls) => {
      const div = document.createElement("div");
      div.className = `mmaurora-${cls}`;
      scene.appendChild(div);
    });

    return scene;
  }
});
