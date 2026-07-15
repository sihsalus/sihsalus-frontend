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

ENV CI=true \
    IBM_TELEMETRY_DISABLED=true \
    TURBO_TELEMETRY_DISABLED=1 \
    DO_NOT_TRACK=1
RUN --mount=type=cache,target=/root/.yarn/berry/cache \
    yarn install --immutable

RUN --mount=type=cache,target=/app/node_modules/.cache \
    yarn turbo run build --filter='./packages/apps/*' --filter='./packages/libs/*'

# Stage 2: Init container image
# Runs at deployment time: assembles built modules into SPA_OUTPUT_DIR,
# patches index.html with env vars (SPA_PATH, API_URL, SPA_CONFIG_URLS, SPA_DEFAULT_LOCALE,
# SIHSALUS_PUBLIC_SPA_URL),
# and copies config files. The infra repo mounts a shared volume at SPA_OUTPUT_DIR;
# a stock nginx serves from it — no runtime substitution needed.
FROM node:24-alpine AS init
WORKDIR /app

RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

ENV NODE_ENV=production \
    IBM_TELEMETRY_DISABLED=true \
    TURBO_TELEMETRY_DISABLED=1 \
    DO_NOT_TRACK=1
ENV SPA_OUTPUT_DIR=/spa
ENV SIHSALUS_PUBLIC_SPA_URL=

# Build provenance — supplied by CI (--build-arg) and promoted to env so the
# assemble step (run as CMD at container start) can stamp build-info.json.
ARG APP_VERSION=""
ARG GIT_SHA=""
ARG BUILD_TIME=""
ENV APP_VERSION=${APP_VERSION}
ENV GIT_SHA=${GIT_SHA}
ENV BUILD_TIME=${BUILD_TIME}

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/apps ./packages/apps
COPY --from=builder /app/packages/libs ./packages/libs
COPY --from=builder /app/packages/tooling/scripts/ ./packages/tooling/scripts/
COPY config/ ./config/
COPY assets/ ./assets/

CMD ["node", "packages/tooling/scripts/assemble-importmap.js"]

# Stage 3: Hardened init container image
# Same runtime behavior as `init`, but runs as a non-root user and keeps the
# published image target explicit for secure container workflows.
FROM node:24-alpine AS secure-init
WORKDIR /app

RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

ENV NODE_ENV=production \
    IBM_TELEMETRY_DISABLED=true \
    TURBO_TELEMETRY_DISABLED=1 \
    DO_NOT_TRACK=1
ENV SPA_OUTPUT_DIR=/spa
ENV SIHSALUS_PUBLIC_SPA_URL=

# Build provenance — supplied by CI (--build-arg) and promoted to env so the
# assemble step (run as CMD at container start) can stamp build-info.json.
ARG APP_VERSION=""
ARG GIT_SHA=""
ARG BUILD_TIME=""
ENV APP_VERSION=${APP_VERSION}
ENV GIT_SHA=${GIT_SHA}
ENV BUILD_TIME=${BUILD_TIME}

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/packages/apps ./packages/apps
COPY --from=builder --chown=node:node /app/packages/libs ./packages/libs
COPY --from=builder --chown=node:node /app/packages/tooling/scripts/ ./packages/tooling/scripts/
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
ENV SIHSALUS_PUBLIC_SPA_URL=

# Build provenance — assemble runs here at build time, so env is enough.
ARG APP_VERSION=""
ARG GIT_SHA=""
ARG BUILD_TIME=""
ENV APP_VERSION=${APP_VERSION}
ENV GIT_SHA=${GIT_SHA}
ENV BUILD_TIME=${BUILD_TIME}

COPY config/ ./config/
COPY assets/ ./assets/

RUN yarn assemble

# Stage 5: Lightweight precompiled SPA server
FROM nginx:1.31-alpine AS spa-nginx

COPY nginx.spa.conf /etc/nginx/conf.d/default.conf
COPY --from=spa-artifact /app/dist/spa/ /usr/share/nginx/html/
