# 0007 — Frontend permissions are UX; the server is the boundary

**Status:** Accepted · 2026-09-25

## Context

The product has roles and per-module permissions, and the prototype already models them. It is easy — and
common — for a team to start describing the frontend's role checks as "access control", and then to ship an
endpoint whose only protection is a hidden button.

There is also no backend yet, so the real permission model is unknown: role names, key format, and whether
custom roles can grant beyond their base role are all open.

## Decision

Two statements, both binding:

1. **The frontend's permission model exists to prevent mistakes and reduce noise, not to protect data.** Every
   rule the UI applies must also be enforced server-side, or it is not enforced. No document, ticket or
   release note may claim the UI prevents unauthorized access.
2. **When the model is known**, it is implemented once: a permission matrix fetched per session and exposed as
   `can(key, level)` in `lib/permissions`, applied at three points — route guard, section visibility, action
   availability. `if (user.role === 'admin')` scattered through components is banned; components ask about
   capability, never about role.

Until the backend model exists, none of it is implemented. Guessing a matrix would mean writing feature code
against a shape that is likely wrong.

## Consequences

- Features built before auth exists must not invent role checks. They render what they render, and gating is
  added at the three defined points afterwards.
- A 403 from the server is a normal, expected state that every screen handles calmly — the UI being out of
  date is not a crash.
- Data a user may not see is never fetched and hidden; it is not requested, and the server refuses it anyway.
- Every UI-side rule gets a line in the clarification register stating what the server must enforce.

## Revisit when

The backend publishes its RBAC model. That is also when route guards and the `can()` implementation are
written.
