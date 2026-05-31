# Dockerfile

# Stage 1: Build local @sihsalus/* modules — deterministic, no network required
FROM node:24-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare yarn@4.13.0 --activate

# Copy root manifests first
COPY package.json yarn.lock .yarnrc.yml turbo.json tsconfig.base.json ./
COPY .yarn/ ./.yarn/

# Copy workspaces (required so Yarn can resolve workspace:* deps)
COPY packages/ ./packages/

# Some apps import shared illustrations and other static assets at build time.
COPY assets/ ./assets/

ENV CI=true
RUN --mount=type=cache,target=/root/.yarn/berry/cache \
    yarn install --immutable

RUN --mount=type=cache,target=/app/node_modules/.cache \
    yarn turbo run build --filter='./packages/apps/*'

# Stage 2: Init container image
# Runs at deployment time: assembles built modules into SPA_OUTPUT_DIR,
# patches index.html with env vars (SPA_PATH, API_URL, SPA_CONFIG_URLS, SPA_DEFAULT_LOCALE),
# and copies config files. The infra repo mounts a shared volume at SPA_OUTPUT_DIR;
# a stock nginx serves from it — no runtime substitution needed.
FROM node:24-alpine AS init
WORKDIR /app

RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

ENV NODE_ENV=production
ENV SPA_OUTPUT_DIR=/spa

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/apps ./packages/apps
COPY --from=builder /app/packages/tooling/scripts/assemble-importmap.js ./packages/tooling/scripts/assemble-importmap.js
COPY config/ ./config/
COPY assets/ ./assets/

CMD ["node", "packages/tooling/scripts/assemble-importmap.js"]

# Stage 3: Hardened init container image
# Same runtime behavior as `init`, but runs as a non-root user and keeps the
# published image target explicit for secure container workflows.
FROM node:24-alpine AS secure-init
WORKDIR /app

RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

ENV NODE_ENV=production
ENV SPA_OUTPUT_DIR=/spa

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/packages/apps ./packages/apps
COPY --from=builder --chown=node:node /app/packages/tooling/scripts/assemble-importmap.js ./packages/tooling/scripts/assemble-importmap.js
COPY --chown=node:node config/ ./config/
COPY --chown=node:node assets/ ./assets/

USER node

CMD ["node", "packages/tooling/scripts/assemble-importmap.js"]

# Stage 4: Precompiled SPA artifact
# Produces a self-contained /app/dist/spa tree suitable for static nginx serving.
FROM builder AS spa-artifact
WORKDIR /app

ENV NODE_ENV=production
ENV SPA_OUTPUT_DIR=/app/dist/spa
ENV API_URL=/openmrs
ENV SPA_PATH=/openmrs/spa
ENV SPA_CONFIG_URLS=/openmrs/spa/frontend.json
ENV SPA_DEFAULT_LOCALE=es

COPY config/ ./config/
COPY assets/ ./assets/

RUN yarn assemble

# Stage 5: Lightweight precompiled SPA server
FROM nginx:1.31-alpine AS spa-nginx

COPY nginx.spa.conf /etc/nginx/conf.d/default.conf
COPY --from=spa-artifact /app/dist/spa/ /usr/share/nginx/html/
