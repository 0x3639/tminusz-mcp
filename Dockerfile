# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS base
WORKDIR /app

# Install dependencies first (layer cached unless package files change).
COPY package.json package-lock.json ./
RUN npm ci

# Copy config, source, and the vendored corpus submodule.
COPY tsconfig.json vitest.config.ts ./
COPY src ./src
COPY zenon-developer-commons ./zenon-developer-commons

# Build the search index (extracts PDFs + indexes markdown) into /app/data.
# Self-contained: the running container needs no submodule checkout or network.
RUN npm run build-index

ENV PORT=3000
EXPOSE 3000

# Streamable-HTTP transport. stdio is not containerizable (the client must spawn it).
CMD ["npm", "run", "start:http"]
