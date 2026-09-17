# Billing System — clickable prototype

A client-facing prototype of the Billing System described in `../Billing System PRD v2.docx` (migrated from V1 on 2026-09-16 — see `../PRD_V1_TO_V2_CHANGELOG.md`). It is built to validate requirements, workflows and UX before development starts. **It is not the application:**
- plain HTML/CSS/JavaScript
- in-memory data
- no backend, no persistence, no real authentication or integrations

## The product, and notes about it

The Billing System screens are the point of the prototype and read like a real product. What the requirements leave open is attached to them as **Review notes** — a small control at the bottom right and numbered markers on the areas a note is about.

```
Billing System                                   Review notes · 2
─────────────────────────────────────────────────
  Payment SLA (days)   [ 14 ]  ①
```

Click a marker (or the control) and a small popover says which of three things it is — **Assumption**, **Client question** or **Note** — in two sentences, with the clarification-register ID and the PRD section and page. Nothing else: no guide application, no walkthrough, no onboarding.

Turn them off with **Hide notes**, the checkbox on the start screen, or **Alt + Shift + N**, and the prototype is the product alone.

## Open it

- **Online:** https://abdelrahman-mohamd.github.io/EMR-Billing/
- **Double-click `index.html`.** It runs from the file system in Chrome, Edge or Firefox with no install and no internet (fonts and images are bundled).
- **Or serve the folder,** for example with `npx serve .` or `python -m http.server`, and open the printed URL.

Refreshing the page discards everything and returns to the start screen. The date in the system is fixed at **Tuesday, September 15, 2026**.

## Start screen

| | Demo Data | Fresh System |
|---|---|---|
| Use it to | See the finished system quickly | Understand how the system works from the beginning |
| Starts with | 2 practices, 29 patients, 95 claims, payments, denials, holds, history; 7 user accounts | Day one: only the two V2-seeded roles (System Admin, Practice Admin), one System Administrator account and the standard ICD-10 / CARC / RARC lists |
| Sign in as | Start as **Tomás Herrera** (Practice Admin) | **System Administrator** (and any user you create) |

The same screen has the **Review notes** checkbox.

## Prototype controls

The Billing System has no simulate buttons and no environment controls. They live in the review-notes popover under **Prototype…**, or directly with **Alt + Shift + S**:

- **Simulate** — EMR push, Waystar response, ERA arrival, payer SLA check, scheduled submission. The application then handles the event exactly as it would a real one.
- **Data** — switch environment (resets the session, after confirmation), reset the current environment, or go back to the start screen.

## Demo Data accounts

| Account | Role | What it shows |
|---|---|---|
| Tomás Herrera | Practice Admin | The main account: billing for Harborline Physical Therapy |
| Dana Whitfield | System Admin | Everything, every practice, unmasked SSN and portal passwords |
| Renee Castillo | Organization Admin | Both practices of Harborline Rehab Group, cross-practice reports |
| Ivy Bennett | Domain Admin | EMR integration requests and billing election |
| Owen Park | Billing Viewer (custom role) | View-only, Admin hidden, Bay Ridge location only |
| Keisha Morgan, Ahmed Siddiqui | Practice Admin | Other practice staff |

Which of these roles V2 defines and which are assumptions is a review note on the sign-in screen.

## Where to look for what

| Question | Where |
|---|---|
| How does the Billing System behave? | The prototype itself |
| What is assumed or unresolved on this screen? | Review notes |
| How does the whole business cycle work? | `../BILLING_SYSTEM_GUIDE.html` |
| What exactly is unresolved, in full? | `../PRD_CLARIFICATION_QUESTIONS.md` |
| What does the prototype cover of PRD V2? | `../PROTOTYPE_COVERAGE.md` |

## Files

```
index.html                    script order: application first, then the prototype layer

css/tokens.css                design tokens taken from EMR-V.2 src/index.css
css/base.css                  reset, type, scrollbars, motion
css/components.css            buttons, fields, tables, tabs, dialogs, drawers, toasts…
css/screens.css               login, dashboard, chart, CMS-1500, print
css/prototype.css             PROTOTYPE LAYER: start screen, review notes, simulator dialogs

js/util.js                    formatting and date helpers
js/icons.js                   inline Lucide icons
js/store.js                   session, roles and permissions, scoping, audit log, events
js/engine.js                  PRD V2 business rules: pricing, effective insurance-class rules,
                              intake, exceptions, scrubbing, release buckets, submission,
                              clearinghouse, ERA posting, secondary claims, SLA
js/data.js                    Demo Data seed, system roles and standard code lists
js/ui.js                      UI kit: forms, tables, dialogs, menus, toasts, prerequisites
js/shell.js                   router (with two neutral hooks), sidebar, sign-in, Company switcher
js/screens/*.js               one file per module
js/app.js                     boot

js/prototype/environment.js   PROTOTYPE LAYER: start screen, Demo / Fresh data sets, switch, reset
js/prototype/simulators.js    EMR push, Waystar response, ERA arrival, SLA check, scheduled job
js/prototype/review-notes.js  the review notes and the annotation layer
js/prototype/boot.js          attaches the prototype layer to the application's hooks
```

The application files never refer to anything in `js/prototype/`.

## What changed for PRD V2

- **Admin → Insurance classes** (new): rule defaults per class. **Admin → Insurances**: class required, each rule Inherit / Yes / No with the effective value shown, insurance hold + release bucket.
- **Admin → Release buckets** (new) and **Claims → Release buckets** (new): claims for held insurances wait here until a user releases them.
- **Cases** no longer hold location, billing provider or discipline; **visits** get them from the EMR payload or manual entry.
- **Charge lines** carry their own place of service (defaulting from the location) and an internal note.
- **Claims** keep a snapshot of the referring physician (Box 17).
- **Fee schedules** hold the billed price only; payer allowed amounts exist only inside the simulated payer.
- **Procedure codes** have a type and an active flag; inactive codes are not offered on new lines.
- **Patients**: emergency contact removed, SSN optional.

Coverage against PRD V2, the assumptions made, the open questions and the review-note architecture are in `../PROTOTYPE_COVERAGE.md` (section 10 for the notes).
