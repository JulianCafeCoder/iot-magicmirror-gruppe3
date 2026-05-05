Module.register("MMM-Theme", {
  start() {
    if (this.config.mode === "light") {
      document.body.classList.add("light-mode");
    }
  }
});
