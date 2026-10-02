import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { cn } from '@/lib/utils/cn'
import {
  ACCESS_LEVELS,
  MODULES,
  flagLetters,
  levelOf,
  type AccessLevel,
  type ModuleKey,
} from '../model/permissions'
import type { Role } from '../model/role'

/**
 * The prototype's permission table for one role: per module, the access level
 * (Edit / View / Hidden), the Delete tick — usable only under Edit — and the
 * C R U D flags they add up to.
 *
 * A real table, so a screen reader can move by row and column. Below `md` each
 * row stacks into two lines (module and flags; then the level and Delete);
 * changing a row's display drops its table semantics in some browsers, so the
 * roles are spelled out. The controls carry the module in their names either
 * way ("Patient access", "Delete Patient").
 */
export function PermissionMatrix({
  role,
  locked,
  onLevelChange,
  onDeleteChange,
}: {
  role: Role
  /** System roles: shown, not changed. */
  locked: boolean
  onLevelChange: (module: ModuleKey, level: AccessLevel) => void
  onDeleteChange: (module: ModuleKey, allowed: boolean) => void
}) {
  const head =
    'text-eyebrow text-n500 border-rule-structural border-b px-3 pt-3.5 pb-2.5 font-medium uppercase'
  return (
    <table role="table" className="w-full border-collapse text-left">
      <caption className="sr-only">{`Permissions of ${role.name}`}</caption>
      {/* Hidden from sight on a phone, where each row labels its own controls, but kept for a screen reader. */}
      <thead role="rowgroup" className="max-md:sr-only">
        <tr role="row">
          <th role="columnheader" scope="col" className={cn(head, 'pl-0')}>
            Module
          </th>
          <th role="columnheader" scope="col" className={head}>
            Access
          </th>
          <th role="columnheader" scope="col" className={cn(head, 'text-center')}>
            Delete
          </th>
          <th role="columnheader" scope="col" className={cn(head, 'pr-0')}>
            Flags
          </th>
        </tr>
      </thead>
      <tbody role="rowgroup">
        {MODULES.map((module) => {
          const flags = role.permissions[module.key]
          const level = levelOf(flags)
          return (
            <tr
              key={module.key}
              role="row"
              className="border-rule-row border-b max-md:grid max-md:grid-cols-[minmax(0,1fr)_auto] max-md:items-center max-md:gap-x-4 max-md:gap-y-2 max-md:py-3"
            >
              <th
                role="rowheader"
                scope="row"
                className="text-meta text-ink py-2.5 pr-3 font-medium max-md:col-start-1 max-md:row-start-1 max-md:p-0"
              >
                {module.label}
              </th>
              <td role="cell" className="px-3 py-2.5 max-md:col-start-1 max-md:row-start-2 max-md:p-0">
                <SegmentedControl
                  name={`access-${module.key}`}
                  label={`${module.label} access`}
                  value={level}
                  options={ACCESS_LEVELS}
                  onChange={(next) => onLevelChange(module.key, next)}
                  disabled={locked}
                />
              </td>
              <td
                role="cell"
                className="px-3 py-2.5 text-center max-md:col-start-2 max-md:row-start-2 max-md:p-0 max-md:text-left"
              >
                <label
                  className={cn(
                    'text-micro text-n600 relative inline-flex items-center gap-2 align-middle',
                    // A tap area the size of a finger around the small box; on a
                    // phone it stops at the row's edge, so it never widens the page.
                    "after:absolute after:-inset-2.5 after:content-[''] max-md:after:right-0",
                  )}
                >
                  <input
                    type="checkbox"
                    aria-label={`Delete ${module.label}`}
                    checked={flags.d}
                    disabled={locked || level !== 'edit'}
                    onChange={(event) => onDeleteChange(module.key, event.target.checked)}
                  />
                  {/* The column header names it on a wider screen. */}
                  <span aria-hidden="true" className="md:hidden">
                    Delete
                  </span>
                </label>
              </td>
              <td
                role="cell"
                className="text-micro text-ink py-2.5 pl-3 font-medium whitespace-nowrap tabular-nums max-md:col-start-2 max-md:row-start-1 max-md:p-0"
              >
                <span className="sr-only">Flags: </span>
                {flagLetters(flags)}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
