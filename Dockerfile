FROM node:22-bookworm-slim

# Build tools needed by some npm dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/magicmirror

# Install dependencies first (layer-cached as long as package files don't change)
COPY package*.json ./
# --ignore-scripts skips the postinstall "git clean" that needs a git history
RUN npm ci --omit=dev --ignore-scripts

# Copy the rest of the project
COPY . .

# Bind on all interfaces so the Pi's browser can reach the container via localhost
# (overridden via MM_ADDRESS env var; locally npm start still uses "localhost")
ENV MM_ADDRESS=0.0.0.0

EXPOSE 8081

CMD ["node", "./serveronly"]
