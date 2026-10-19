#!/bin/sh
# Run by the nginx image's entrypoint before nginx starts. From the container's
# environment it writes:
#   - /config.js, the app's run-time settings (the API address, the environment);
#   - the server config, whose Content-Security-Policy allows calls to the API.
# A missing or malformed value stops the container with a clear message
# instead of serving an app that cannot reach its API.
set -eu

: "${API_BASE_URL:?API_BASE_URL is required, e.g. https://billing-api.example.com/api/v1}"
APP_ENVIRONMENT="${APP_ENVIRONMENT:-production}"

case "$API_BASE_URL" in
  http://* | https://*) ;;
  *)
    echo "API_BASE_URL must start with http:// or https://" >&2
    exit 1
    ;;
esac
case "$API_BASE_URL" in
  *'"'* | *'\'* | *' '* | *"'"*)
    echo "API_BASE_URL contains a character a URL cannot have" >&2
    exit 1
    ;;
esac
case "$APP_ENVIRONMENT" in
  development | staging | production) ;;
  *)
    echo "APP_ENVIRONMENT must be development, staging or production" >&2
    exit 1
    ;;
esac

# The API's origin (scheme://host[:port]), for connect-src.
API_ORIGIN=$(printf '%s' "$API_BASE_URL" | sed -E 's|^(https?://[^/?#]+).*|\1|')
export API_ORIGIN

mkdir -p /tmp/app-config
printf 'window.__APP_CONFIG__ = { apiBaseUrl: "%s", environment: "%s" };\n' \
  "$API_BASE_URL" "$APP_ENVIRONMENT" > /tmp/app-config/config.js

envsubst '${API_ORIGIN}' < /etc/nginx/app/security-headers.conf.template > /etc/nginx/conf.d/security-headers.inc
cp /etc/nginx/app/default.conf.template /etc/nginx/conf.d/default.conf

echo "app config: environment=${APP_ENVIRONMENT}, API origin=${API_ORIGIN}"
