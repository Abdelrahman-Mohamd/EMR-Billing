import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Circle, FlaskConical, Plus, RefreshCw } from 'lucide-react'
import { Tag } from '@/components/ui/Badge'
import { Button, buttonClass } from '@/components/ui/Button'
import { CellSub, DataTable, type Column } from '@/components/ui/DataTable'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { RowActionButton, actionsColumn, activeColumn } from '@/components/ui/RowActions'
import { FilterBar, PageContainer, PageHeader } from '@/components/shared/PageLayout'
import { useInsuranceClasses, useInsurances } from '@/features/admin-insurances'
import { PracticeSelect, usePractices } from '@/features/admin-practices'
import { useProcedureCodes } from '@/features/admin-procedure-codes'
import { useCodingRules } from '../data/coding-rule-store'
import { ruleName, scopeKey, type CodingRule } from '../model/coding-rule'
import { CodingRuleDialog, type Option } from './CodingRuleDialog'
import { RuleTester } from './RuleTester'

/**
 * Admin → Coding rules, as the prototype has it, for one practice: its rules
 * — Rule (Replace / Drop), Code (→ replacement, or "dropped"), Applies to,
 * Why, Active, and Edit / Delete — with the line on when rules run under
 * them; "New rule" (a dialog; with no procedure codes yet, what is needed
 * first); and "Test the rules", a dialog opened from the header. Not paged, searched or
 * filtered: the prototype does none of these.
 *
 * Which rules a practice sees: the default rules (every payer) and the rules
 * of its own insurance classes and insurances. The practice is kept in the URL
 * (`?practice=<id>`, an opaque id) and chosen in the filter bar under the
 * header, where the other practice-scoped screens keep it; with none,
 * the first practice — the prototype shows the current practice.
 *
 * **Frontend only.** There is no backend for coding rules: they live in this
 * browser tab (`data/coding-rule-store.ts`). That is architecture, not
 * product: the screen shows no message about it. The insurances, classes and
 * procedure codes come from their own features.
 *
 * Not built: the prototype offers New, Edit, Active and Delete only to users
 * whose role allows them; there is no permission model here yet
 * (docs/FRONTEND_ARCHITECTURE.md §8). Nothing here scrubs a claim.
 */
export function CodingRulesScreen({ practiceFilter }: { practiceFilter: number | undefined }) {
  const navigate = useNavigate()
  const practices = usePractices()
  const insurances = useInsurances()
  const classes = useInsuranceClasses()
  const procedureCodes = useProcedureCodes()
  const store = useCodingRules()
  /** `undefined`: no dialog. `null`: adding. A rule: editing it. */
  const [editing, setEditing] = useState<CodingRule | null | undefined>(undefined)
  const [deleting, setDeleting] = useState<CodingRule | null>(null)
  const [needsCodes, setNeedsCodes] = useState(false)
  const [testing, setTesting] = useState(false)

  const practice = practices.data?.find((item) => item.id === practiceFilter) ?? practices.data?.[0]
  const payers = (insurances.data ?? []).filter((item) => item.practiceId === practice?.id)
  const practiceClasses = (classes.data ?? []).filter((item) => item.practiceId === practice?.id)
  const loading =
    practices.isPending || insurances.isPending || classes.isPending || !procedureCodes.ready || !store.ready
  const failed = practices.isError || insurances.isError || classes.isError

  const choose = (value: string | null) =>
    void navigate({
      to: '/admin/coding-rules',
      search: value === null ? {} : { practice: Number(value) },
      replace: true,
    })

  // The default rules and this practice's own, in the order they were added.
  const rows = store.rules.filter((rule) =>
    rule.scope.kind === 'default'
      ? true
      : rule.scope.kind === 'class'
        ? practiceClasses.some((item) => item.id === (rule.scope.kind === 'class' ? rule.scope.classId : -1))
        : payers.some((item) => item.id === (rule.scope.kind === 'insurance' ? rule.scope.insuranceId : -1)),
  )

  const appliesTo = (rule: CodingRule) => {
    const { scope } = rule
    if (scope.kind === 'default') return 'Default (all payers)'
    if (scope.kind === 'class')
      return `${practiceClasses.find((item) => item.id === scope.classId)?.name ?? 'Class'} class`
    return `${payers.find((item) => item.id === scope.insuranceId)?.name ?? 'Payer'} only`
  }

  const codeOptions: Option[] = [...procedureCodes.codes]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((code) => ({ value: code.code, label: `${code.code} — ${code.description}` }))
  // The tester's codes show as short chips: the code, with its description in the list.
  const testerCodeOptions = [...procedureCodes.codes]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((code) => ({ value: code.code, label: code.code, description: code.description }))
  // The prototype offers the active classes; a rule already on an inactive class keeps it.
  const scopeOptions = (rule: CodingRule | null): Option[] => [
    { value: 'default', label: 'Default — all payers' },
    ...practiceClasses
      .filter((item) => item.isActive || (rule !== null && scopeKey(rule.scope) === `class:${item.id}`))
      .map((item) => ({ value: `class:${item.id}`, label: `Class — ${item.name}` })),
    ...payers.map((item) => ({
      value: `insurance:${item.id}`,
      label: `${item.name} only (overrides default)`,
    })),
  ]

  const openNew = () => (procedureCodes.codes.length === 0 ? setNeedsCodes(true) : setEditing(null))

  const columns: ReadonlyArray<Column<CodingRule>> = [
    {
      key: 'type',
      header: 'Rule',
      hideOnMobile: true,
      cell: (rule) => <Tag tone={rule.type === 'Replace' ? 'brand' : 'attention'}>{rule.type}</Tag>,
    },
    {
      key: 'code',
      header: 'Code',
      primary: true,
      cell: (rule) => (
        <span className="block">
          {/* On a phone, where its column is hidden, the rule type leads. */}
          <span className="mb-1 block sm:hidden">
            <Tag tone={rule.type === 'Replace' ? 'brand' : 'attention'}>{rule.type}</Tag>
          </span>
          <span className="whitespace-nowrap tabular-nums">
            {rule.fromCode}
            <span className="text-n500 font-normal"> → </span>
            {rule.type === 'Replace' ? rule.toCode : <span className="text-n500 font-normal">dropped</span>}
          </span>
          {/* Until their columns appear, what it applies to and why ride under the code. */}
          <span className="md:hidden">
            <CellSub>{appliesTo(rule)}</CellSub>
          </span>
          {rule.note !== '' && (
            <span className="xl:hidden">
              <CellSub>
                <span className="[overflow-wrap:anywhere]">{rule.note}</span>
              </CellSub>
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'scope',
      header: 'Applies to',
      hideBelow: 'md',
      cell: (rule) => <span className="break-words">{appliesTo(rule)}</span>,
    },
    {
      key: 'note',
      header: 'Why',
      hideBelow: 'xl',
      cell: (rule) => <span className="block min-w-32 break-words">{rule.note}</span>,
    },
    activeColumn<CodingRule>({
      isActive: (rule) => rule.isActive,
      label: (rule) => `${ruleName(rule)}, ${appliesTo(rule)}`,
      onChange: (rule, next) => store.setActive(rule.id, next),
    }),
    actionsColumn<CodingRule>((rule) => (
      <>
        <RowActionButton
          action="edit"
          label={`Edit rule ${ruleName(rule)}`}
          onClick={() => setEditing(rule)}
        />
        <RowActionButton
          action="delete"
          label={`Delete rule ${ruleName(rule)}`}
          onClick={() => setDeleting(rule)}
        />
      </>
    )),
  ]

  return (
    <PageContainer>
      <PageHeader
        title="Coding rules"
        description="Replace and Drop rules run during scrubbing; payer-specific rules override default rules."
        actions={
          practices.data !== undefined && practices.data.length > 0 ? (
            <>
              {/* A dialog, so it is one click away however long the list grows. */}
              <Button
                icon={<FlaskConical size={16} aria-hidden="true" />}
                onClick={() => setTesting(true)}
                disabled={loading}
              >
                Test the rules
              </Button>
              <Button
                variant="primary"
                icon={<Plus size={16} aria-hidden="true" />}
                onClick={openNew}
                disabled={loading}
              >
                New rule
              </Button>
            </>
          ) : undefined
        }
      />

      {/* Where every practice-scoped screen keeps its practice. This list is
          one practice's, so a practice is always chosen: no "All practices". */}
      {!failed && practices.data?.length !== 0 && (
        <FilterBar>
          <PracticeSelect
            aria-label="Practice"
            value={practice === undefined ? null : String(practice.id)}
            onChange={choose}
            className="w-full sm:w-64"
          />
        </FilterBar>
      )}

      {failed ? (
        <ErrorState
          onRetry={() => {
            void practices.refetch()
            void insurances.refetch()
            void classes.refetch()
          }}
        />
      ) : !practices.isPending && practice === undefined ? (
        <EmptyState
          icon={<RefreshCw size={20} />}
          title="No practice yet"
          description="Coding rules belong to a practice. Create the practice and its primary location first."
        />
      ) : (
        <div>
          <DataTable
            caption={practice === undefined ? 'Coding rules' : `Coding rules of ${practice.name}`}
            columns={columns}
            rows={rows}
            getRowId={(rule) => rule.id}
            loading={loading}
            empty={
              <EmptyState
                icon={<RefreshCw size={20} />}
                title="No coding rules yet"
                description={`Coding rules are optional. A Replace rule swaps one CPT / HCPCS code for another and a Drop rule removes a code during scrubbing; a payer-specific rule overrides a default rule.${procedureCodes.codes.length > 0 ? '' : ' Rules act on procedure codes, so add those first.'}`}
              />
            }
          />
          <p className="text-micro text-n500 mt-3">
            Rules run on fresh submissions, resubmissions and corrected claims, and change the billing record
            itself.
          </p>
        </div>
      )}

      {testing && (
        <RuleTester
          insurances={payers}
          rules={store.rules}
          codeOptions={testerCodeOptions}
          appliesTo={appliesTo}
          onClose={() => setTesting(false)}
        />
      )}

      {editing !== undefined && (
        <CodingRuleDialog
          key={editing?.id ?? 'new'}
          rule={editing}
          codeOptions={codeOptions}
          scopeOptions={scopeOptions(editing)}
          onSave={(values) => (editing === null ? store.create(values) : store.update(editing.id, values))}
          onClose={() => setEditing(undefined)}
        />
      )}

      <Dialog
        open={needsCodes}
        onOpenChange={setNeedsCodes}
        title="Cannot add a coding rule yet"
        description="Replace and Drop rules act on CPT / HCPCS codes during scrubbing. There are no procedure codes yet."
        size="sm"
        footer={
          <Button variant="quiet" onClick={() => setNeedsCodes(false)}>
            Close
          </Button>
        }
      >
        <div className="flex flex-wrap items-start gap-3">
          <Circle size={18} className="text-n400 mt-0.5 flex-none" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="text-meta text-ink block font-medium">
              Procedure codes<span className="sr-only"> — still needed</span>
            </span>
            <span className="text-micro text-n500 block">
              Shared by every practice, maintained by a System Admin.
            </span>
          </span>
          <Link to="/setup/procedure-codes" className={buttonClass('default', 'sm')}>
            Add a procedure code
          </Link>
        </div>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title="Delete this rule?"
        description={
          deleting === null
            ? ''
            : `${deleting.type} ${deleting.fromCode} will no longer run during scrubbing.`
        }
        confirmLabel="Delete rule"
        tone="destructive"
        onConfirm={() => {
          if (deleting !== null) store.remove(deleting.id)
          setDeleting(null)
        }}
      />
    </PageContainer>
  )
}
