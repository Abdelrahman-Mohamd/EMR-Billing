# Billing System — prototype and requirements analysis

A clickable prototype of the **Billing System** (centralized revenue cycle management for Physical Therapy and multi-specialty billing), built from `Billing System PRD v2.docx` to validate requirements, workflows and UX before development starts.

**▶ Open the prototype:** https://abdelrahman-mohamd.github.io/EMR-Billing/

No install, no sign-up: pick an environment, choose an account, and use it like the real thing. Nothing is saved — refreshing starts over.

---

## What is in here

| | |
|---|---|
| [`prototype/`](prototype/) | The clickable prototype: plain HTML, CSS and JavaScript, in-memory data, no backend. See [`prototype/README.md`](prototype/README.md). |
| [`BILLING_SYSTEM_GUIDE.html`](BILLING_SYSTEM_GUIDE.html) | A standalone visual guide to the whole business cycle: diagrams, workflows, roles, records, statuses, glossary and a worked billing example. Download it and open it in a browser. |
| [`PROTOTYPE_COVERAGE.md`](PROTOTYPE_COVERAGE.md) | Every PRD V2 requirement mapped to the screen that demonstrates it, with status, workflow and the assumptions the prototype had to make. |
| [`PRD_CLARIFICATION_QUESTIONS.md`](PRD_CLARIFICATION_QUESTIONS.md) | The open questions: 84 questions, 14 contradictions and 20 forced assumptions, each quoting the PRD passage it comes from. |
| [`PRD_V1_TO_V2_CHANGELOG.md`](PRD_V1_TO_V2_CHANGELOG.md) | What changed between PRD v1 and v2, and what each change meant for the prototype. |
| [`PROJECT_MEMORY.md`](PROJECT_MEMORY.md) | Working notes: modules, features, business rules, entities, workflows, decisions and progress. |

## How to read the prototype

The screens are the product: they behave as the real application would. What the requirements leave open is attached to them as **review notes** — a small `Review notes · n` control at the bottom right, with numbered markers next to the fields they concern. Each note is one of three kinds:

- **Assumption** — the PRD does not define this; here is what the prototype does instead.
- **Client question** — something we need confirmed, with its ID from the clarification register.
- **Note** — short context about the screen or what is simulated.

Hide them with the control, the checkbox on the start screen, or <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>N</kbd>.

Two starting points are offered on the first screen:

- **Demo Data** — a practice that has been billing for months: patients, claims, holds, denials, remittances and history.
- **Fresh System** — day one of a new installation, to see the order in which records must be created.

Systems outside the Billing System (the EMR, the Waystar clearinghouse, payer remittances, scheduled jobs) are simulated from the review-notes popover under **Prototype…**, or <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd>.

## Status

The prototype is **not the product**: no backend, no persistence, no real authentication, no real integrations. It exists to agree on requirements and behaviour. All people, practices, payers and identifiers in it are fictional.
