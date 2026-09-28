# Frontend Security

This application handles patient identity, diagnoses, coverage and money. Treat every field as PHI unless you
can prove otherwise.

**The one rule this document exists to protect:**

> The frontend is not a security boundary. Everything below either makes attacks harder, makes mistakes less
> likely, or reduces exposure. None of it _enforces_ anything. The server enforces.

Anyone who writes "the UI prevents X" in a review, a ticket or a release note is wrong unless the server
prevents X too.

---

## 1. What the frontend can and cannot do

| The frontend **can**                                                | The frontend **cannot**                                            |
| ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Avoid creating new attack surface (no `innerHTML`, no `eval`)       | Enforce authorization — a user edits JS, or calls the API directly |
| Keep secrets out of the bundle, the URL and browser storage         | Keep the data it renders secret from the person using the browser  |
| Reduce what is exposed: minimal fields, short cache, no PHI in logs | Prevent screenshots, copy/paste, printing or a browser extension   |
| Validate input early so users fix mistakes before submitting        | Guarantee the payload the server receives is the one it validated  |
| Fail closed in the UI when it doesn't know a user's permissions     | Stop a crafted request that skips the UI entirely                  |
| Set app-level hints (`referrer`, `noindex`, `autocomplete=off`)     | Set security headers (CSP, HSTS, frame-ancestors) — that's infra   |

**Corollary for every feature:** if a rule matters (who may release a claim, which practice's patients are
visible, whether a payment may be voided), implement the UI for it **and** write down that the server must
enforce it. The clarification register is where that gets recorded, not a code comment.

---

## 2. Authentication and session

_Provisional — no backend exists. These are the constraints the backend must satisfy, decided now so the
frontend is not rewritten later._

- **Preferred: an httpOnly, `Secure`, `SameSite=Lax` (or `Strict`) session cookie.** JavaScript never reads
  it, so XSS cannot exfiltrate it, and the client keeps no credential at all. `credentials: 'include'` in the
  http client is the only code that depends on this.
- **If tokens are unavoidable:** keep the access token in memory only (a module variable, not a store, never
  persisted), keep the refresh token in an httpOnly cookie, and accept that a full page reload requires a
  silent refresh. A token in `localStorage` is a one-line XSS-to-account-takeover, and is not acceptable here.
- **Never** put a token in a URL, a query parameter or a fragment.
- Session expiry is handled centrally: a `401` triggers one redirect to sign-in with a return path, clears
  the query cache (§5) and does not retry.
- Sign-out clears the query cache and all client state, not just the route.
- Idle timeout is a requirement for a PHI application; the value comes from the client's policy, the
  enforcement is the server's session lifetime, and the UI's job is a warning before it happens.

**What the auth screens already do** (`features/auth`: sign in, change password, forgot password):

- Passwords and one-time codes live only in the form and the single call that sends them — the auth screens
  and Admin → Users' "New user" alike. They are not sent
  through `useMutation` (its cache and devtools would keep them), never logged, stored, or put in a URL; the
  forgot-password flow keeps the email and code in component memory between its steps.
- Wrong credentials get one message ("The email or password is incorrect"), never the server's wording, and
  the send-code step says "if this email has an account" — neither confirms that an account exists.
- A successful sign-in clears the query cache; `?redirect=` is limited to paths inside the app.
- Sign out (the account menu, after a confirmation) asks the server to end the session, then — whatever it
  answered — clears the query cache and goes to sign in. If the server could not be reached, the user is told
  that only this browser was signed out.
- Who is signed in comes from one query (`useCurrentUser`), cleared with everything else on sign-in and
  sign-out; no second copy is kept in a store.
- Nothing from an auth response is used yet: how the session is carried (this section's cookie, or a token),
  and whether verifying a code or resetting a password returns anything, are not known.

## 3. Authorization

The permission model (`can(key, level)`, route/section/action gates) is described in
[FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md) § 8. Security-relevant points:

- Gating exists so users don't see doors they can't open. It is **not** access control.
- Never fetch data a user may not see and then hide it. Don't request it. The backend must also refuse it.
- Ids in the URL are not capabilities. `/claims/abc123` must 403/404 server-side for a user outside that
  practice — an IDOR the UI cannot detect. Assume every id is guessable and enumerable.
- A 403 is a legitimate, expected response. Handle it as a state, not as a crash.
- Fail closed while permissions are unknown: guard first, render after.

## 4. Sensitive data in the browser

**Browser storage (`localStorage`, `sessionStorage`, IndexedDB, cookies the JS writes) may not hold patient,
claim, coverage, guarantor or payment data.** Lint blocks the two globals outside `lib/storage`. Storage is
per-origin, survives sign-out, is readable by any script on the origin, and stays on shared or lost machines.

Allowed in storage: UI preferences that reveal nothing (rail collapsed, table density, last-used tab). Nothing
keyed by a patient or claim id — even a key leaks.

**URLs.** Ids only, and only opaque ones. Never a name, date of birth, SSN, member id, diagnosis or amount in
a path, query or fragment: URLs land in history, bookmarks, referrer headers, proxy logs and screen shares.
`<meta name="referrer" content="same-origin">` is set, but do not rely on it.

**Memory and the query cache.** Cached PHI is dropped on sign-out (`queryClient.clear()`) and has a short
`gcTime` (5 min). Don't raise `gcTime` for convenience on PHI-bearing queries.

**The clipboard, downloads and exports.** Any export is PHI leaving the controlled system: it needs a
server-side audit entry, and the file should be generated server-side so the browser never assembles a full
dataset. No silent clipboard writes.

**Printing and screenshots** cannot be prevented. Don't claim otherwise; handle it with policy, watermarking
server-side if required, and audit trails.

## 5. XSS and injection

- React escapes by default; the escape hatch is `dangerouslySetInnerHTML`, which is **banned** by lint. If
  server HTML must ever be rendered, it is sanitized in one reviewed module and the rule is disabled there
  with a comment naming the source.
- No `eval`, `new Function`, `setTimeout('string')`, or dynamic `<script>` injection.
- URLs that come from data are validated before use in `href`/`src` (`https:` or a known-relative path only) —
  `javascript:` URLs are a click away from script execution. This matters for the payer-portal links the
  product stores.
- Redirects after login use an allow-list of internal paths, never an arbitrary `?next=` value (open redirect).
- `target="_blank"` always with `rel="noopener noreferrer"`.
- Untrusted content is never interpolated into a template that becomes markup — including toasts and error
  messages built from server text.

## 6. CSRF

Cookie-based sessions are CSRF-able by design. Required (server-side, listed here so it is not forgotten):
`SameSite=Lax` or `Strict` on the session cookie, plus a CSRF token or an `Origin`/`Sec-Fetch-Site` check on
every state-changing request. The frontend's part is to send the token if one is issued and to keep all
mutations on `POST`/`PUT`/`PATCH`/`DELETE` — never a `GET` that changes data.

## 7. Input and output

- Validate at the boundaries with Zod (environment, API responses, route params, forms). This is for
  correctness and UX. The server validates independently.
- Response validation is also a defence: a payload that doesn't match its schema is rejected rather than
  rendered, which limits what a compromised or wrong upstream can push into the UI.
- Numbers that are money are parsed and formatted through one utility, never with `parseFloat` at a call site,
  and never rendered from a raw string that could contain markup.

## 8. Logging and error messages

- **No PHI in any log**, including `console.warn`/`console.error`, an error tracker, analytics, or a breadcrumb.
  Log ids, kinds and counts — not names, not payloads, not query results.
- Users see `userMessage(error)`: a short, actionable sentence. Never a stack, a SQL fragment, an internal
  hostname, or a raw 500 body.
- `ApiError.detail` is for developers and never rendered.
- A correlation id (`x-request-id`) is the safe thing to show a user to quote to support.
- Production builds ship **hidden** source maps (`sourcemap: 'hidden'`): uploadable to an error tracker, not
  served next to the bundle.

## 9. Configuration and build

- **Every `VITE_*` variable is public.** It is compiled into the bundle and readable by anyone. API keys,
  client secrets and connection strings must never be one. `.env*` is gitignored; `.env.example` documents
  names only, never values.
- Environment is parsed and validated at startup (`lib/config/env.ts`); a wrong value fails loudly at boot
  instead of behaving strangely later.
- The environment name is displayed in non-production builds so staging is never mistaken for production.
- No test fixtures, seed data or demo accounts in a production bundle. Mocks are excluded from the production
  build, not merely unused.
- Dependencies: lockfile committed, `npm audit` in CI, no new dependency without the four-question
  justification, and no `postinstall`-scripted package without reading what it does.

## 10. What infrastructure and the backend must provide

The frontend cannot set any of this. It belongs in the deployment ticket:

| Control                                                             | Why it matters here                                         |
| ------------------------------------------------------------------- | ----------------------------------------------------------- |
| HTTPS everywhere + HSTS                                             | Session cookie and PHI in transit                           |
| `Content-Security-Policy` (no `unsafe-inline`, strict `script-src`) | The real XSS mitigation                                     |
| `X-Frame-Options: DENY` / `frame-ancestors 'none'`                  | Clickjacking a "Release claims" button                      |
| `X-Content-Type-Options: nosniff`                                   | Uploaded-file confusion                                     |
| `Referrer-Policy: same-origin`                                      | Ids leaking to third parties                                |
| `Cache-Control: no-store` on API responses                          | PHI in disk cache on shared machines                        |
| Authorization on every endpoint                                     | The UI's gating is cosmetic                                 |
| Rate limiting and lockout                                           | Credential stuffing, enumeration                            |
| Audit logging of reads and exports                                  | HIPAA-style accountability; the UI can't prove who saw what |
| Short session lifetime + server idle timeout                        | Unattended workstations                                     |
| Minimal API responses                                               | An over-broad payload leaks even if the UI hides fields     |

## 11. Threats we accept and name

- A signed-in user can read everything their session can request, with devtools. Mitigation is scoping and
  server-side audit, not UI.
- A malicious browser extension sees the whole DOM. Mitigation is device policy.
- Screenshots, photos, printing and copy/paste are out of scope for the frontend.
- A compromised dependency can exfiltrate anything on the page. Mitigations: small dependency set, lockfile,
  audit in CI, CSP with a strict `connect-src`.

## 12. Before any production release

- [ ] No `VITE_*` value is a secret.
- [ ] No PHI in URLs, storage, logs or analytics.
- [ ] Sign-out clears the query cache and client state.
- [ ] `401` and `403` behave correctly everywhere, including deep links.
- [ ] Source maps are hidden, not published.
- [ ] Mocks, fixtures and demo users are absent from the bundle.
- [ ] `npm audit` clean at moderate and above, or exceptions written down.
- [ ] Security headers verified on the deployed origin (§10).
- [ ] Every UI-enforced rule has a server-side counterpart recorded in the clarification register.
