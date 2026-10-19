# Deployment notes

Notes on the frontend's Docker image (`frontend/Dockerfile`).

- **Configured at run time, not build time.** The image holds no environment; the same image runs in
  staging and production. At start-up the container writes `/config.js` from:

  | Variable          | Required | Values                                                   |
  | ----------------- | -------- | -------------------------------------------------------- |
  | `API_BASE_URL`    | Yes      | The Billing API, e.g. `https://…/api/v1` (http or https) |
  | `APP_ENVIRONMENT` | No       | `development`, `staging` or `production` (default)       |

  Both are public (sent to every browser). A missing or malformed value stops the container (exit 2) with a
  message naming it.

- **Container:** nginx, non-root (`nginxinc/nginx-unprivileged`), port **8080**, `/healthz` returns 200
  (also the image's `HEALTHCHECK`). Logs to stdout/stderr.
- **Serves plain HTTP.** TLS, the HTTPS redirect and HSTS are expected in front of it.
- **Security headers are set by the container:** CSP (scripts from its own origin only; `connect-src`
  allows the origin of `API_BASE_URL`), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: same-origin`,
  `Permissions-Policy`. A proxy in front should not replace them.
- **Caching:** `/assets/*` is fingerprinted and `immutable` for a year; `index.html` is `no-cache` and
  `/config.js` `no-store`, so a new release is picked up on the next load.
- **Routing:** every non-file path serves `index.html` (deep links work on reload); a missing `/assets/*`
  file is a 404. Source maps are not in the image.
- **Backend:** the API must allow this frontend's origin (CORS).
