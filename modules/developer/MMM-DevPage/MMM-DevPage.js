Module.register("MMM-DevPage", {
  defaults: {
    text: "Diese Seite ist noch leer.",
  },

  getStyles() { return []; },

  getDom() {
    const wrap = document.createElement("div");
    wrap.className = "devpage-wrap";
    wrap.style.padding = "20px";
    wrap.style.color = "#aaa";
    wrap.style.fontSize = "1.2em";
    wrap.style.textAlign = "center";
    wrap.textContent = this.config.text;
    return wrap;
  },
});
