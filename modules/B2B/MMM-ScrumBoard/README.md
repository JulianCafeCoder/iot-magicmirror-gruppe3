# MMM-ScrumBoard

Interaktives Scrum-Board für MagicMirror² mit Kanban-Ansicht und automatischem Burndown-Chart.  
Karten werden in PostgreSQL gespeichert – bei fehlendem Datenbankzugang greift das Modul auf `scrum-data.json` zurück.

---

## Datenbank einrichten

```bash
psql -U gruppe3 -d postgres -f modules/B2B/MMM-ScrumBoard/schema.sql
```

Das Script legt die Tabellen `scrum_sprints` und `scrum_cards` an und befüllt sie mit den initialen Sprint-Daten, falls die Tabellen noch leer sind.

---

## Bedienung (Tastatur)

Das Modul hat drei Modi:

### IDLE (Standard)

Das Board und der Burndown-Chart werden angezeigt.  
Keine Interaktion aktiv – Pfeiltasten blättern normal durch die Seiten.

| Taste | Aktion |
|-------|--------|
| `Enter` | Navigations-Modus aktivieren |

---

### BOARD (Navigieren & Bearbeiten)

Eine Karte ist mit einem weißen Rahmen markiert (Cursor).

| Taste | Aktion |
|-------|--------|
| `↑` / `↓` | Cursor durch alle Karten bewegen (Todo → In Progress → Done) |
| `n` | Neue Karte erstellen |
| `m` | Markierte Karte in nächste Spalte verschieben (Todo → In Progress → Done → Todo) |
| `d` | Markierte Karte löschen |
| `Esc` | Zurück zu IDLE |

> Beim Verschieben in **Done** wird `completed_at` automatisch gesetzt und im Burndown-Chart berücksichtigt. Beim Zurückverschieben wird es wieder gelöscht.

---

### NEW\_CARD (Neue Karte erstellen)

Ein Formular mit vier Feldern erscheint. Das aktive Feld ist hervorgehoben.

| Taste | Aktion |
|-------|--------|
| `↑` / `↓` | Zwischen Feldern wechseln |
| Buchstaben / Zahlen / `Backspace` | Text eingeben (Felder: Titel, Assignee) |
| `←` / `→` | Wert ändern (Story Points: ±1 · Spalte: durchschalten) |
| `0`–`9` | Story Points direkt setzen (0 = 10) |
| `Enter` | Weiter zum nächsten Feld / Karte speichern (letztes Feld) |
| `Esc` | Abbrechen, zurück zu BOARD |

#### Felder

| # | Feld | Eingabe |
|---|------|---------|
| 1 | **Titel** | Freier Text |
| 2 | **Story Points** | Zahl 1–99 (Pfeiltasten oder Zifferntasten) |
| 3 | **Assignee** | Freier Text |
| 4 | **Spalte** | `←` / `→` zum Durchschalten: Todo → In Progress → Done |

---

## Burndown-Chart

Der Chart berechnet sich automatisch aus den gespeicherten Karten:

- **Ideal-Linie** (gestrichelt): Lineare Abnahme von Gesamt-SP auf 0 über die Sprint-Laufzeit.
- **Aktuell-Linie** (orange): Verbleibende Story Points am Ende jedes vergangenen Tages.  
  Ein Datenpunkt erscheint, sobald der jeweilige Tag vorbei ist.

Karten, die in **Done** verschoben werden, reduzieren die Linie ab dem Tag der Fertigstellung.  
Wird eine Karte wieder zurückbewegt, verschwindet sie aus der Done-Auswertung.

---

## Konfiguration (`config/config.js`)

```js
{
  module: "MMM-ScrumBoard",
  position: "top_left",
  header: "Scrum Board",
  classes: "page-business",   // je nach gewünschter Seite anpassen
  config: {
    title: "Scrum Board",     // Modul-Überschrift (optional)
  }
}
```

---

## Datei-Übersicht

```
MMM-ScrumBoard/
├── MMM-ScrumBoard.js    – Client-seitige Logik & DOM-Rendering
├── MMM-ScrumBoard.css   – Styles
├── node_helper.js       – Server: PostgreSQL-CRUD & Burndown-Berechnung
├── schema.sql           – DB-Schema + Seed-Daten
├── scrum-data.json      – JSON-Fallback (wird automatisch genutzt wenn DB fehlt)
└── README.md            – Diese Datei
```
