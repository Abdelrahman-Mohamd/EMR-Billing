# UI kit

What exists, so nobody builds it twice. Run `npm run dev` and open `/dev/ui` to see all of it with its
states. Visual rules and layering are in [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md) §10.

**Before adding a component:** check this list, then check the feature next door. A near-duplicate with a
different name is the main way a UI kit rots.

---

## Tokens (`src/styles/index.css`)

Taken from the reviewed prototype. Use the token; a raw hex or an arbitrary value is a review block.

| Group      | Tokens                                                                                         |
| ---------- | ---------------------------------------------------------------------------------------------- |
| Surface    | `canvas` (white), `paper` (sunken)                                                             |
| Ink        | `ink`, `n50 … n800` — text, borders and fills all come from this ladder                        |
| Action     | `brand`, `brand-hover`, `brand-deep`, `brand-wash`, `brand-line` — only on something pressable |
| Status     | `critical`, `warning`, `success`, `info` (+ `-bg`), `sand*` for attention that is not danger   |
| Rules      | `rule-structural` (section), `rule-row` (table rows), `rule-section`                           |
| Type       | `text-eyebrow 13` · `micro 14` · `meta 15` · `body 16` · `row 17` · `lede 20` · `section 24`   |
| Radius     | `rounded-sm 4` (controls) · `rounded-md 6` (buttons, inputs, dialogs) · `rounded-card 8`       |
| Elevation  | `shadow-popover`, `shadow-dialog`, `shadow-drawer` — the only things that float                |
| Dimensions | `h-control 38` · `h-control-sm 32` · `h-control-xs 28` · `w-rail 72` · `w-rail-open 216`       |

House rules from the approved design: nothing below 13px, no letter-spacing on body text, weights no heavier
than semibold, structure from hairlines and space rather than boxes and shadows.

**Named sizes and `cn`.** The type scale is named (`text-meta`, `text-lede`), and tailwind-merge reads any
unknown `text-*` as a colour. `cn` is extended with the seven size names so a size and a colour survive each
other; without that, `cn('text-meta', 'text-ink')` silently drops the size. Add any new size name there.

**Stacking order.** Floating layers sit in one ladder, bottom to top: rail 30–40 · drawer 55 · dialog 60 ·
**popovers 70** (select list, date picker, menu) · info tips 80 · rail tooltips 90 · toasts 100. A popover must outrank the
dialog or drawer it opens from — at 50 a select inside a dialog opened _behind_ it and could not be clicked.
jsdom ignores stacking, so only a browser check catches a mistake here.

**Contrast rule.** `n400` is for icons, chevrons and dividers only. **Text uses `n500` or darker** — `n400`
measures 3.18:1 on white, under the 4.5:1 WCAG AA asks for at 13–15px; `n500` measures 4.71:1. That covers
field labels, table headers, cell sub-lines, placeholders and summaries.

## Components (`src/components/ui/`)

| Component                                                         | File              | Notes                                                                                                                                                                  |
| ----------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`, `buttonClass`                                           | Button.tsx        | `primary · default · quiet · danger · dangerFill`, 3 sizes, `loading`                                                                                                  |
| `Avatar`, `initialsOf`                                            | Avatar.tsx        | Picture, else initials ("Ahmed Mohamed" → AM), else a person icon; decorative                                                                                          |
| `Spinner`                                                         | Spinner.tsx       | Decorative; the busy thing announces itself                                                                                                                            |
| `Field`, `FormGrid`, `FormSection`, `FormNote`, `useFieldControl` | Field.tsx         | Label/description/error wiring; `asFieldset` for groups                                                                                                                |
| `Input`, `SearchInput`, `Textarea`, `controlClass`                | Input.tsx         | Prefix/suffix, read-only, invalid                                                                                                                                      |
| `PasswordInput`                                                   | PasswordInput.tsx | Masked by default, show/hide toggle (`aria-pressed`); never given a stored password                                                                                    |
| `Select`                                                          | Select.tsx        | Styled listbox, not native: arrows, Home/End, type-ahead, Enter, Escape                                                                                                |
| `SearchSelect`, `MultiSelect`                                     | SearchSelect.tsx  | Searchable combobox; single or multiple                                                                                                                                |
| `Combobox`                                                        | Combobox.tsx      | The engine behind Select / SearchSelect / MultiSelect — not used directly                                                                                              |
| `Checkbox`, `RadioGroup`                                          | Choice.tsx        | Real inputs; checkbox supports indeterminate                                                                                                                           |
| `InfoTip`                                                         | InfoTip.tsx       | Info icon + on-demand explanation; hover, focus, tap; portalled. Via `Field`'s `info` prop                                                                             |
| `Switch`                                                          | Switch.tsx        | `button role=switch`; Space/Enter; label clickable; on = colour + position + check. For `is_active`                                                                    |
| `DateInput`, `DateRangeInput`                                     | DateInput.tsx     | Typed MM/DD/YYYY plus a custom calendar with month and year jumps; ISO value; no business date rules                                                                   |
| `Form`, `FormField`, `FormActions`, `applyServerErrors`           | Form.tsx          | React Hook Form + Zod, and server errors back onto fields                                                                                                              |
| `DataTable`, `CellSub`                                            | DataTable.tsx     | Sorting/selection are reported, never applied locally; `rowLink` / `rowAction` open a row                                                                              |
| `Pagination`                                                      | Pagination.tsx    | Page numbers only, API-agnostic                                                                                                                                        |
| `Badge`, `StatusDot`, `Tag`, `Tone`                               | Badge.tsx         | Tone vocabulary shared by the whole product                                                                                                                            |
| `EmptyState`, `ErrorState`, `Skeleton`, `SkeletonRows`            | States.tsx        | Every list needs all three                                                                                                                                             |
| `Notice`                                                          | Notice.tsx        | Inline message attached to its subject                                                                                                                                 |
| `Toaster` (+ `toast`, `useToastStore`)                            | Toast.tsx         | One queue, mounted by the shell                                                                                                                                        |
| `Dialog`, `DialogClose`, `ConfirmDialog`                          | Dialog.tsx        | Focus trap, focus restore (`returnFocusTo` for a menu-opened dialog). `ConfirmDialog`: compact alert dialog — icon, question, context, Cancel (focused first) + action |
| `Drawer`                                                          | Drawer.tsx        | Side panel for detail beside a list                                                                                                                                    |
| `Menu`                                                            | Menu.tsx          | Overflow menu; `danger` items                                                                                                                                          |
| `TabNav`                                                          | TabNav.tsx        | Links, not ARIA tabs — each tab is a URL                                                                                                                               |
| `Card`, `CardHeader`, `CardBody`, `Section`                       | Card.tsx          | `Section` (space + rule) is the default grouping                                                                                                                       |
| `KeyValue`                                                        | KeyValue.tsx      | Read-only record view; empty shows a dash                                                                                                                              |

## Shared patterns (`src/components/shared/`)

| Component                                                 | Notes                                                              |
| --------------------------------------------------------- | ------------------------------------------------------------------ |
| `PageContainer`, `PageHeader`, `FilterBar`, `Breadcrumbs` | Screens compose these; there is no `ListPage` component on purpose |

The four standard screens are compositions, not components:

```
List    PageHeader → FilterBar → DataTable → Pagination
Detail  PageHeader → KeyValue → TabNav → sections
Form    PageHeader → Form(FormGrid + FormSection) → FormActions
Dialog  Dialog → FormGrid → footer buttons
```

## Shell (`src/app/layouts/`)

`AppShell` (rail + content) and `navigation.tsx`, which lists only the routes that exist. `AdminLayout` is the
Admin section list (a 248px column at desktop, a scrolling row of pills below 1024px); like the rail, it
lists only the Admin sections that exist.

## Placeholders

Every text-entry control carries a placeholder; choice controls (checkbox, radio) never do. The label always
names the field — a placeholder disappears on the first keystroke, is lighter than text, and is not reliably
announced, so it can only ever add guidance.

| Control                   | Pattern                                                              | Examples                                  |
| ------------------------- | -------------------------------------------------------------------- | ----------------------------------------- |
| Text, number, password    | `Enter …` — `your` for the user's own details, `the` / `a` otherwise | `Enter your email`, `Enter the member ID` |
| Free text (notes)         | `Add …`                                                              | `Add a note`                              |
| Search box                | `Search …` (what is being searched)                                  | `Search claims`                           |
| Select, searchable select | `Select …`                                                           | `Select a payer`, default `Select…`       |
| Date                      | The format, which is the useful guidance                             | `MM/DD/YYYY` (built into `DateInput`)     |
| Amount                    | The format                                                           | `0.00`                                    |

No personal or realistic example data (`e.g. Harborline Physical Therapy`) unless the example is the only way
to show a format. Shared primitives set a placeholder only where they know what fits (`DateInput`'s format,
`SearchInput`'s `Search`, the selects' `Select…`); everything else is the screen's to supply.

## Opening a row

A row opens through `rowLink` (it goes to a URL) or `rowAction` (it opens a drawer or a dialog). Either turns
the primary cell into one real link or button that covers the row: clickable anywhere with a mouse, tabbable
for everyone else. A cell holding its own controls sets `interactive: true` so it stays above that target.

There is no bare `onRowClick` — a row that answers only to a mouse click is invisible to a keyboard.

## Conventions

**`is_active` is a Switch.** Every boolean that says whether a record is active — organization, practice,
location, and any later entity with the same field — is edited with `Switch` labelled **Active**: on =
`true` = Active, off = `false` = Inactive. Never a checkbox. Rules that come with it:

- The switch sets the boolean and nothing else. What "inactive" _does_ (stop billing, hide from pickers, cut
  access, cascade to children) is a business rule and is never implied by the control.
- In tables and read-only views the state is a `StatusDot` — **Active** (success) / **Inactive** (inert) —
  not a switch. A list changes status in place only where the prototype does (today: a location's
  Deactivate / Reactivate row action, behind a confirmation).
- No other statuses (Pending, Suspended, Archived …) unless the requirements define them.

**Field notes are tooltips.** Optional context about a field — what it means, where its value is used, a
format or constraint worth knowing — goes in `info` on `Field` / `FormField`. It renders a small info icon
beside the label; the text opens on hover, keyboard focus or tap — styled exactly like the rail's tooltip
(brand-hover fill, white 14px medium text, square pointer) so every hint in the product looks the same — is read to screen readers as the icon's
description, and is portalled so no dialog or card clips it. Never a loose line of grey text under the input.

- `description` (visible under the control) is only for what the user needs _to complete_ the field right
  now — for example "Organizations could not be loaded" — and for nothing else.
- Errors, the required star and essential instructions stay visible. When a format matters, put it in the
  **error message** too, so it appears exactly when the user needs it.
- One or two short sentences, plain language. State only what the requirements or the prototype confirm.

**Page descriptions say what the user can do.** The line under a page title is one short sentence that
starts from the action — "Create and manage…", "Add and manage…", "View and update…", "Review…",
"Set up…" — and describes only what the page really offers (no "manage" on a read-only page). Not a
data-model explanation, not PRD wording, no internal terms. The same applies to dialog descriptions and
empty states: "Create your first practice. You add its first location at the same time." — not "A practice
is the billing entity…".

## Deliberately absent

| Not built        | Why, and what would trigger it                                                                                                                                                                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Button `Tooltip` | Field context uses `InfoTip`; the rail's labels are CSS (`.nav-tip`). Icon-only buttons (a location's Deactivate/Reactivate) carry an `aria-label` plus a native `title`. Build a hover label for buttons when a second icon-only control needs one a keyboard user can see |
| ARIA `Tabs`      | Every tab in the design is a URL, so `TabNav` renders links. `@radix-ui/react-tabs` arrives with the first in-page panel switch                                                                                                                                             |
| Virtualized rows | Paging first. Virtualization costs keyboard access, find-in-page and printing                                                                                                                                                                                               |

## Rules

- **No business logic in a primitive.** A `Button` never asks who the user is; a `Badge` never learns what
  "Denied" means. The feature decides; the component renders.
- **No sensitive data held in a primitive.** Components take what they render as props.
- **Accessibility is part of the component, not a later pass**: label wiring, keyboard operation, focus
  management, `aria-invalid`/`aria-describedby`, announced errors. A control that is not a native form
  element (the combobox `div`) is named with `aria-labelledby`, because `<label for>` cannot name it.
- **Anything pressable shows a pointer.** The base layer restores `cursor: pointer` on buttons, `role=button`
  and checkbox/radio labels, which Tailwind's reset removes.
- **Promote on the second real consumer.** A component only one feature uses belongs to that feature.
- Add a component here only when the approved design actually uses it.
