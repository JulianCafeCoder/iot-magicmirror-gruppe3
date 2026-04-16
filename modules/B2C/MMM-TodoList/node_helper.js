const NodeHelper = require("node_helper");
const Log = require("logger");
const fs = require("fs");
const path = require("path");

module.exports = NodeHelper.create({
  start() {
    this.todosFile = path.join(this.path, "todos.json");
    Log.info(`${this.name}: node_helper started. Todos file: ${this.todosFile}`);
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "LOAD_TODOS") {
      this.sendSocketNotification("TODOS_LOADED", this._readTodos());
    }

    if (notification === "TOGGLE_TODO") {
      const todos = this._readTodos();
      const todo = todos.find((t) => t.id === payload.id);
      if (todo) {
        todo.done = !todo.done;
        this._writeTodos(todos);
        this.sendSocketNotification("TODOS_LOADED", todos);
      }
    }

    if (notification === "ADD_TODO") {
      const todos = this._readTodos();
      const newTodo = {
        id: Date.now(),
        title: payload.title,
        category: payload.category || "Sonstiges",
        done: false
      };
      todos.push(newTodo);
      this._writeTodos(todos);
      this.sendSocketNotification("TODOS_LOADED", todos);
    }
  },

  _readTodos() {
    try {
      const raw = fs.readFileSync(this.todosFile, "utf-8");
      return JSON.parse(raw).todos || [];
    } catch (e) {
      Log.error(`${this.name}: Could not read todos.json – ${e.message}`);
      return [];
    }
  },

  _writeTodos(todos) {
    try {
      fs.writeFileSync(this.todosFile, JSON.stringify({ todos }, null, 2), "utf-8");
    } catch (e) {
      Log.error(`${this.name}: Could not write todos.json – ${e.message}`);
    }
  }
});
