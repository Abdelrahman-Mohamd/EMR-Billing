import type { ReactNode } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { toast } from '@/stores/toast-store'
import { Button } from './Button'
import type { Column } from './DataTable'
import { Switch } from './Switch'

/**
 * The one way a table offers row actions and a fast Active / Inactive change —
 * the Coding rules pattern, shared so every table looks and behaves alike:
 *
 * - **Active** (`activeColumn`): a column holding a compact switch — on is
 *   Active, off is Inactive. It never edits anything else. Whether a change
 *   asks first is the feature's: Locations and Users confirm (as in the
 *   prototype); everything else changes at once, as Coding rules does.
 * - **Actions** (`actionsColumn`): the last column, right-aligned, holding
 *   small icon buttons — Edit (pencil), Delete (trash, in red) — each named
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
 * "Harborline: active", on or off. `pending` holds it still while a change is
 * being saved. Just the switch — no text beside or under it.
 */
export function activeColumn<T>({
  isActive,
  label,
  onChange,
  pending,
}: {
  isActive: (row: T) => boolean
  label: (row: T) => string
  onChange: (row: T, isActive: boolean) => void
  pending?: (row: T) => boolean
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
        disabled={pending?.(row) ?? false}
      />
    ),
  }
}

/**
 * Say that a fast Active / Inactive change did not go through — the toggle's
 * one message. One that did go through says nothing, as in Coding rules: the
 * switch, held still while saving, then shows the new state.
 */
export function statusChangeFailed(name: string, isActive: boolean, error: unknown): void {
  toast.error(
    `${name} was not ${isActive ? 'activated' : 'deactivated'}`,
    isApiError(error) ? userMessage(error) : 'Something went wrong. Please try again.',
  )
}
