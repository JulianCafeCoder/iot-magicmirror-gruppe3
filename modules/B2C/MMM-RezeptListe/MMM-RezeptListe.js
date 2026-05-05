Module.register("MMM-RezeptListe", {
  defaults: {
    title: "Rezept Liste",
    updateInterval: 60 * 60 * 1000, // 1 Stunde
    maxItems: 8,
  },

  recipes: null,
  recipeInfo: null,

  start() {
    Log.info(`${this.name} started.`);
    this.sendSocketNotification("INIT");
    this._updateTimer = setInterval(() => {
      this.sendSocketNotification("INIT");
    }, this.config.updateInterval);
  },

  suspend() {
    if (this._updateTimer) {
      clearInterval(this._updateTimer);
      this._updateTimer = null;
    }
  },

  resume() {
    if (!this._updateTimer) {
      this._updateTimer = setInterval(() => {
        this.sendSocketNotification("INIT");
      }, this.config.updateInterval);
    }
  },

  getStyles() {
    return ["MMM-RezeptListe.css"];
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "REZEPT_DATA") {
      if (Array.isArray(payload)) {
        this.recipeInfo = null;
        this.recipes = this._groupRecipes(payload);
      } else {
        this.recipeInfo = payload.recipeInfo || null;
        this.recipes = this._groupRecipes(payload.recipes || []);
      }
      this.updateDom(300);
    }
  },

  _groupRecipes(rows) {
    const groups = {};

    rows.forEach((row) => {
      const key = row.rezepte_id ?? row.id ?? row.name ?? row.title ?? JSON.stringify(row);
      if (!groups[key]) {
        groups[key] = {
          id: row.rezepte_id ?? row.id ?? null,
          title: row.name || row.title || row.rezept || "",
          description: row.beschreibung || row.description || "",
          instructions: row.anweisung || row.instructions || "",
          category: row.kategorie || row.category || "",
          ingredients: [],
        };
      }

      const ingredientName = row.zutaten_name || row.zutat || row.ingredient || null;
      if (ingredientName) {
        groups[key].ingredients.push({
          name: ingredientName,
          quantity: row.menge != null ? row.menge : "",
          unit: row.einheit_symbol || row.einheit || "",
          note: row.bemerkung || "",
        });
      }
    });

    return Object.values(groups);
  },

  getDom() {
    const wrapper = document.createElement("div");
    wrapper.className = "rezept-wrapper";

    const header = document.createElement("div");
    header.className = "rezept-header";
    header.textContent = this.config.title;
    wrapper.appendChild(header);

    if (!this.recipes) {
      const loading = document.createElement("div");
      loading.className = "rezept-loading";
      loading.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Lade Rezepte…`;
      wrapper.appendChild(loading);
      return wrapper;
    }

    if (this.recipes.length === 0) {
      const empty = document.createElement("div");
      empty.className = "rezept-empty";
      empty.textContent = "Keine Rezepte gefunden.";
      wrapper.appendChild(empty);
      return wrapper;
    }

    if (this.recipeInfo && this.recipes.length > 0 && !this.recipes[0].title) {
      this.recipes[0].title = this.recipeInfo.name;
    }

    const content = document.createElement("div");
    content.className = "rezept-content";

    const listPanel = document.createElement("div");
    listPanel.className = "rezept-list-panel";

    const list = document.createElement("div");
    list.className = "rezept-list";

    this.recipes.slice(0, this.config.maxItems).forEach((recipe) => {
      list.appendChild(this._buildRecipeItem(recipe));
    });

    if (this.recipes.length > this.config.maxItems) {
      const more = document.createElement("div");
      more.className = "rezept-more";
      more.textContent = `+ ${this.recipes.length - this.config.maxItems} weitere Rezepte`;
      list.appendChild(more);
    }

    listPanel.appendChild(list);

    const topRow = document.createElement("div");
    topRow.className = "rezept-top-row";
    topRow.appendChild(listPanel);
    content.appendChild(topRow);

    if (this.recipeInfo) {
      const bottomRow = document.createElement("div");
      bottomRow.className = "rezept-bottom-row";

      const descPanel = document.createElement("div");
      descPanel.className = "rezept-info-panel rezept-desc-panel";
      const descriptionHtml = (this.recipeInfo.beschreibung || "Keine Beschreibung vorhanden.").replace(/\n/g, "<br>");
      descPanel.innerHTML = `
        <div class="rezept-info-title">Beschreibung</div>
        <div class="rezept-info-description">${descriptionHtml}</div>
      `;
      bottomRow.appendChild(descPanel);

      const stepsPanel = document.createElement("div");
      stepsPanel.className = "rezept-info-panel rezept-steps-panel";
      const instructionsHtml = (this.recipeInfo.anweisung || "Keine Anweisungen vorhanden.").replace(/\n/g, "<br>");
      stepsPanel.innerHTML = `
        <div class="rezept-info-title">Anweisung</div>
        <div class="rezept-info-description">${instructionsHtml}</div>
      `;
      bottomRow.appendChild(stepsPanel);

      content.appendChild(bottomRow);
    }

    wrapper.appendChild(content);
    return wrapper;
  },

  _buildRecipeItem(recipe) {
    const item = document.createElement("div");
    item.className = "rezept-item";

    const title = document.createElement("div");
    title.className = "rezept-title";
    title.textContent = recipe.title || this.recipeInfo?.name || "Unbenanntes Rezept";
    item.appendChild(title);

    if (recipe.description) {
      const description = document.createElement("div");
      description.className = "rezept-description";
      description.textContent = recipe.description;
      item.appendChild(description);
    }

    if (recipe.category) {
      const category = document.createElement("div");
      category.className = "rezept-category";
      category.textContent = recipe.category;
      item.appendChild(category);
    }

    if (recipe.ingredients.length > 0) {
      const ingredients = document.createElement("div");
      ingredients.className = "rezept-ingredients";
      ingredients.innerHTML = `<div class="rezept-ingredients-title">Zutaten</div>`;
      const list = document.createElement("ul");
      list.className = "rezept-ingredient-list";

      recipe.ingredients.forEach((ingredient) => {
        const itemLine = document.createElement("li");
        itemLine.className = "rezept-ingredient-item";
        const amount = `${ingredient.quantity !== "" ? ingredient.quantity : ""}${ingredient.unit ? ` ${ingredient.unit}` : ""}`.trim();
        itemLine.innerHTML = `<span class="rezept-ingredient-name">${ingredient.name}</span>${amount ? ` <span class="rezept-ingredient-amount">${amount}</span>` : ""}${ingredient.note ? ` <span class="rezept-ingredient-note">(${ingredient.note})</span>` : ""}`;
        list.appendChild(itemLine);
      });

      ingredients.appendChild(list);
      item.appendChild(ingredients);
    }

    if (recipe.instructions) {
      const instructions = document.createElement("div");
      instructions.className = "rezept-instructions";
      instructions.innerHTML = `<div class="rezept-instructions-title">Anleitung</div><div class="rezept-instructions-text">${recipe.instructions}</div>`;
      item.appendChild(instructions);
    }

    return item;
  },
});
