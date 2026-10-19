# syntax=docker/dockerfile:1
#
# The Billing frontend: a static single-page app, built once and served by
# nginx. One image runs in any environment: the API address is given when the
# container starts (API_BASE_URL), not when the image is built. See
# docs/DEPLOYMENT.md.

# ---- Build: install from the lockfile, compile, drop the source maps.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Hidden source maps are for an error tracker, never served (docs/SECURITY.md).
RUN npm run build && find dist -name '*.map' -delete

# ---- Serve: nginx as a non-root user, on port 8080.
FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/default.conf.template docker/security-headers.conf.template /etc/nginx/app/
# Run by the image's entrypoint before nginx starts: writes /config.js and the
# server config from the container's environment.
COPY --chmod=755 docker/40-app-config.sh /docker-entrypoint.d/40-app-config.sh
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
