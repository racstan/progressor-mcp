# Progressor as a container: `docker run -i --rm ghcr.io/racstan/progressor-mcp` is a stdio MCP
# server, and other commands (daemon, dashboard...) work as arguments. The dashboard listens on
# every address inside the container (PROGRESSOR_HOST) on port 4800, so publish it with
# -p 127.0.0.1:4800:4800 and open http://localhost:4800. The project list and settings live in
# /data; mount a volume there to keep them. See "Run it with Docker" in the README.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json tsconfig.build.json CHANGELOG.md ./
COPY scripts ./scripts
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
# git: steps are linked to their commits. tini: passes signals on and reaps child processes.
RUN apk add --no-cache git tini \
 && git config --system --add safe.directory '*' \
 && mkdir -p /data && chown node:node /data
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY LICENSE.md README.md ./

ARG VERSION=dev
LABEL io.modelcontextprotocol.server.name="io.github.racstan/progressor-mcp" \
      org.opencontainers.image.title="Progressor" \
      org.opencontainers.image.description="Your AI's plan, saved in your project and shown live on a dashboard. Free for personal and other noncommercial use." \
      org.opencontainers.image.source="https://github.com/racstan/progressor-mcp" \
      org.opencontainers.image.url="https://github.com/racstan/progressor-mcp#readme" \
      org.opencontainers.image.licenses="PolyForm-Noncommercial-1.0.0" \
      org.opencontainers.image.authors="Rachit Asthana" \
      org.opencontainers.image.version="${VERSION}"

ENV NODE_ENV=production \
    PROGRESSOR_CONTAINER=1 \
    PROGRESSOR_HOST=0.0.0.0 \
    PROGRESSOR_PORT=4800 \
    PROGRESSOR_REGISTRY=/data/projects.json \
    PROGRESSOR_SETTINGS=/data/settings.json
VOLUME /data
EXPOSE 4800
USER node
ENTRYPOINT ["/sbin/tini", "--", "node", "/app/dist/cli.js"]
