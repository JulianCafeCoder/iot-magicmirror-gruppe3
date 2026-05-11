# ─────────────────────────────────────────────────────────────────────────────
#  Dockerfile — baut ein Container-Image für den MagicMirror-Server
# ─────────────────────────────────────────────────────────────────────────────
#
#  Warum Docker?
#    Auf dem Raspberry Pi wollen wir den Spiegel nach Reboot zuverlässig
#    starten, ohne uns um Node-Versionen, npm-Caches oder Systemupdates zu
#    sorgen. Mit Docker hat MagicMirror eine isolierte Umgebung — Updates
#    am Host brechen nichts.
#
#  Was läuft im Container?
#    Nicht der grafische Spiegel (das macht Chromium auf dem Pi selbst),
#    sondern nur der Server: "node ./serveronly". Er hört auf Port 8081
#    und liefert die HTML-Seite + die Modul-Daten aus.
#
#  Build-Strategie:
#    1. Erst package*.json kopieren und Dependencies installieren — diese
#       Layer wird gecached und nur neu gebaut, wenn sich Dependencies ändern.
#    2. Dann den restlichen Code kopieren — bei jedem Code-Change neu, aber
#       das geht schnell.
# ─────────────────────────────────────────────────────────────────────────────

# Schlankes Node-Image (Debian Bookworm slim, ARM- und x86-tauglich)
FROM node:22-bookworm-slim

# Build-Tools für native npm-Module (manche Dependencies brauchen Python+g++)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Arbeitsverzeichnis im Container
WORKDIR /opt/magicmirror

# ── Dependencies-Layer ────────────────────────────────────────────────────────
# Nur die Paket-Manifeste kopieren, damit Docker bei reinen Code-Änderungen
# nicht alle Dependencies neu installiert (Cache-Trick).
COPY package*.json ./
# --omit=dev          : keine Dev-Dependencies im Container
# --ignore-scripts    : MagicMirror hat einen postinstall, der "git clean"
#                       ruft — den brauchen wir hier nicht und er würde
#                       fehlschlagen (im Image gibt es keinen .git-Ordner).
RUN npm ci --omit=dev --ignore-scripts

# ── Code-Layer ────────────────────────────────────────────────────────────────
# Restlichen Projekt-Code kopieren. .dockerignore stellt sicher, dass
# node_modules, .git etc. außen vor bleiben.
COPY . .

# Default-Bind auf alle Interfaces, damit der Chromium-Host (außerhalb des
# Containers, network_mode=host) den Server erreicht. Lokal ohne Docker
# wird "npm start" weiterhin auf localhost binden.
ENV MM_ADDRESS=0.0.0.0

# Dokumentation für Tools — der eigentliche Port wird in docker-compose gemappt
EXPOSE 8081

# Default-Befehl beim Container-Start: nur den Server hochfahren
CMD ["node", "./serveronly"]
