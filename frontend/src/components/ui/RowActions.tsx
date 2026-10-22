import type { ReactNode } from 'react'
import { Ban, Pencil, RefreshCw, RotateCcw, Trash2 } from 'lucide-react'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { toast } from '@/stores/toast-store'
import { Button } from './Button'
import type { Column } from './DataTable'
import { ConfirmDialog } from './Dialog'
import { Switch } from './Switch'

/**
 * The one way a table offers row actions and a fast Active / Inactive change —
 * the Coding rules pattern, shared so every table looks and behaves alike:
 *
 * - **Active** (`activeColumn`): a column holding a compact switch — on is
 *   Active, off is Inactive. It never edits anything else. **Every switch asks
 *   first** (the user's decision, 2026-10-07): `StatusChangeDialog` below, or
 *   the feature's own confirmation where it has more to say (Locations, Users,
 *   Patients). The dialog stays open, its button busy, until the change is
 *   saved; then the switch shows the new state at once (the feature writes it
 *   into its cached list) and the toast says so in the server's words
 *   (`statusChanged`) — or why not (`statusChangeFailed`).
 * - **Actions** (`actionsColumn`): the last column, right-aligned, holding
 *   small icon buttons — Edit (pencil), Re-check (arrows), Delete (trash, in red) — each named
 *   for its row ("Edit Harborline") with the plain verb as its tooltip.
 *   A table offers only the actions its feature supports; a read-only table
 *   has no actions column.
 *
 * Both columns are `interactive`, so their controls stay clickable, and both
 * show at every width — the actions are how a row is opened.
 */

export function RowActions({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center justify-end gap-1.5">{children}</span>
}

const ACTION = {
  edit: { icon: <Pencil size={14} aria-hidden="true" />, title: 'Edit', variant: 'default' },
  recheck: { icon: <RefreshCw size={14} aria-hidden="true" />, title: 'Re-check', variant: 'default' },
  delete: { icon: <Trash2 size={14} aria-hidden="true" />, title: 'Delete', variant: 'danger' },
} as const

/** One icon button in the actions column. */
export function RowActionButton({
  action,
  label,
  title,
  onClick,
}: {
  action: keyof typeof ACTION
  /** The full accessible name, naming the row: "Edit Harborline", "Delete the 97110 row". */
  label: string
  /** The tooltip, when the feature's verb is not the plain one ("Remove" rather than "Delete"). */
  title?: string
  onClick: () => void
}) {
  const { icon, title: verb, variant } = ACTION[action]
  return (
    <Button
      size="xs"
      variant={variant}
      icon={icon}
      aria-label={label}
      title={title ?? verb}
      onClick={onClick}
    />
  )
}

/** The last column: the row's actions, right-aligned. */
export function actionsColumn<T>(cell: (row: T) => ReactNode): Column<T> {
  return {
    key: 'actions',
    header: <span className="sr-only">Actions</span>,
    align: 'right',
    interactive: true,
    cell: (row) => <RowActions>{cell(row)}</RowActions>,
  }
}

/**
 * The Active column: a compact switch per row.
 *
 * `label` names the row ("Harborline"); the switch is announced as
 * "Harborline: active", on or off. Its `onChange` opens the confirmation
 * (`StatusChangeDialog`); nothing changes on the click itself. Just the switch
 * — no text beside or under it. `disabled` turns a row's switch off (the
 * signed-in user's own, in Users).
 */
export function activeColumn<T>({
  isActive,
  label,
  onChange,
  disabled,
}: {
  isActive: (row: T) => boolean
  label: (row: T) => string
  onChange: (row: T, isActive: boolean) => void
  disabled?: (row: T) => boolean
}): Column<T> {
  return {
    key: 'active',
    header: 'Active',
    interactive: true,
    cell: (row) => (
      <Switch
        label={<span className="sr-only">{`${label(row)}: active`}</span>}
        checked={isActive(row)}
        onCheckedChange={(next) => onChange(row, next)}
        disabled={disabled?.(row) ?? false}
      />
    ),
  }
}

/**
 * Say that a fast Active / Inactive change went through — in the server's
 * words when it sent some (the user's decision, 2026-10-07), otherwise
 * "Harborline activated" / "Harborline deactivated". Every switch says it once
 * the change is saved. A switch that asks first says it from its confirmation
 * instead (Locations, Users, Patients).
 */
export function statusChanged(name: string, isActive: boolean, serverMessage: string | null = null): void {
  toast.success(serverMessage ?? `${name} ${isActive ? 'activated' : 'deactivated'}`)
}

/**
 * Say that a fast Active / Inactive change did not go through. With a switch
 * that moves at once (an optimistic update), it has already moved back.
 */
export function statusChangeFailed(name: string, isActive: boolean, error: unknown): void {
  toast.error(
    `${name} was not ${isActive ? 'activated' : 'deactivated'}`,
    isApiError(error) ? userMessage(error) : 'Something went wrong. Please try again.',
  )
}

/**
 * The confirmation every Active switch opens: "Deactivate Harborline?" /
 * "Reactivate Harborline?", as Locations has it. Confirming runs `onConfirm`
 * (the feature's save) with the button busy and the dialog open until it is
 * done; then it closes and the toast says how it went — the server's message
 * when the save returns one (`statusChanged`), or the server's reason when it
 * is refused (`statusChangeFailed`).
 */
export function StatusChangeDialog({
  name,
  isActive,
  onConfirm,
  onClose,
}: {
  /** The row, as the switch names it: "Harborline". */
  name: string
  /** Its status now; the dialog offers the other one. */
  isActive: boolean
  /** The save. When it resolves with a string, that is the server's message. */
  onConfirm: () => unknown
  onClose: () => void
}) {
  const deactivating = isActive
  const confirm = async () => {
    try {
      const message = await onConfirm()
      statusChanged(name, !isActive, typeof message === 'string' ? message : null)
    } catch (error) {
      statusChangeFailed(name, !isActive, error)
    }
  }
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={deactivating ? `Deactivate ${name}?` : `Reactivate ${name}?`}
      description={deactivating ? 'Its status becomes Inactive.' : 'Its status becomes Active again.'}
      confirmLabel={deactivating ? 'Deactivate' : 'Reactivate'}
      tone={deactivating ? 'destructive' : 'default'}
      icon={deactivating ? <Ban size={20} /> : <RotateCcw size={20} />}
      onConfirm={confirm}
    />
  )
}
