import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Circle, FlaskConical, GitBranch, Plus } from 'lucide-react'
import { Tag } from '@/components/ui/Badge'
import { Button, buttonClass } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { RowActionButton, actionsColumn, StatusChangeDialog, activeColumn } from '@/components/ui/RowActions'
import { FilterBar, PageContainer, PageHeader } from '@/components/shared/PageLayout'
import { useInsurances } from '@/features/admin-insurances'
import { PracticeSelect, usePractices } from '@/features/admin-practices'
import { useProcedureCodes } from '@/features/admin-procedure-codes'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { toast } from '@/stores/toast-store'
import { ruleName, type CodingRule } from '../model/coding-rule'
import {
  useCodingRules,
  useCreateCodingRule,
  useDeleteCodingRule,
  useSetCodingRuleActive,
  useUpdateCodingRule,
} from '../queries/use-coding-rules'
import { toCodingRulePayload } from '../schemas/coding-rule-form'
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
 * The rules are the server's (schemas/coding-rule.ts, worked out on staging
 * 2026-10-20): each belongs to a practice, and the list asks for the chosen
 * practice's (`practice_id`) — its default rules (every payer) and its
 * insurances' rules. The practice is kept in the URL (`?practice=<id>`, an
 * opaque id) and chosen in the filter bar under the header, where the other
 * practice-scoped screens keep it; with none, the first practice — the
 * prototype shows the current practice. Every save, switch and delete waits
 * for the server and says what it answered. The insurances and procedure codes
 * come from their own features.
 *
 * Not built: the prototype's class rules (the server has none), and New,
 * Edit, Active and Delete offered only to users whose role allows them — there
 * is no permission model here yet (docs/FRONTEND_ARCHITECTURE.md §8). Nothing
 * here scrubs a claim: releasing a visit does, on the server.
 */
export function CodingRulesScreen({ practiceFilter }: { practiceFilter: number | undefined }) {
  const navigate = useNavigate()
  const practices = usePractices()
  const insurances = useInsurances()
  const procedureCodes = useProcedureCodes()
  /** `undefined`: no dialog. `null`: adding. A rule: editing it. */
  const [editing, setEditing] = useState<CodingRule | null | undefined>(undefined)
  /** The row whose Active switch was flipped, waiting for confirmation. */
  const [statusOf, setStatusOf] = useState<CodingRule | null>(null)
  const [deleting, setDeleting] = useState<CodingRule | null>(null)
  const [needsCodes, setNeedsCodes] = useState(false)
  const [testing, setTesting] = useState(false)

  const practice = practices.data?.find((item) => item.id === practiceFilter) ?? practices.data?.[0]
  const rules = useCodingRules(practice?.id)
  const create = useCreateCodingRule()
  const update = useUpdateCodingRule()
  const setActive = useSetCodingRuleActive()
  const remove = useDeleteCodingRule()
  const payers = (insurances.data ?? []).filter((item) => item.practiceId === practice?.id)
  const loading =
    practices.isPending ||
    insurances.isPending ||
    procedureCodes.isPending ||
    (practice !== undefined && rules.isPending)
  const failed = practices.isError || insurances.isError || rules.isError

  const choose = (value: string | null) =>
    void navigate({
      to: '/admin/coding-rules',
      search: value === null ? {} : { practice: Number(value) },
      replace: true,
    })

  // The practice's rules, in the server's order.
  const rows = rules.data ?? []

  const appliesTo = (rule: CodingRule) => {
    const { scope } = rule
    if (scope.kind === 'default') return 'Default (all payers)'
    const name = rule.insuranceName || payers.find((item) => item.id === scope.insuranceId)?.name
    return `${name ?? 'Payer'} only`
  }

  const codeOptions: Option[] = [...(procedureCodes.data ?? [])].map((code) => ({
    value: String(code.id),
    label: `${code.code} — ${code.description}`,
  }))
  // The tester's codes show as short chips: the code, with its description in the list.
  const testerCodeOptions = [...(procedureCodes.data ?? [])].map((code) => ({
    value: String(code.id),
    label: code.code,
    description: code.description,
  }))
  const scopeOptions: Option[] = payers.map((item) => ({ value: `insurance:${item.id}`, label: item.name }))

  const openNew = () => ((procedureCodes.data ?? []).length === 0 ? setNeedsCodes(true) : setEditing(null))

  const columns: ReadonlyArray<Column<CodingRule>> = [
    {
      key: 'type',
      header: 'Rule',
      cell: (rule) => <Tag tone={rule.type === 'Replace' ? 'brand' : 'attention'}>{rule.type}</Tag>,
    },
    {
      key: 'code',
      header: 'Code',
      primary: true,
      cell: (rule) => (
        <span className="block">
          <span className="whitespace-nowrap tabular-nums">
            {rule.fromCode}
            <span className="text-n500 font-normal"> → </span>
            {rule.type === 'Replace' ? rule.toCode : <span className="text-n500 font-normal">dropped</span>}
          </span>
        </span>
      ),
    },
    {
      key: 'scope',
      header: 'Applies to',
      cell: (rule) => <span className="break-words">{appliesTo(rule)}</span>,
    },
    {
      key: 'note',
      header: 'Why',
      cell: (rule) => <span className="block min-w-32 break-words">{rule.note}</span>,
    },
    activeColumn<CodingRule>({
      isActive: (rule) => rule.isActive,
      label: (rule) => `${ruleName(rule)}, ${appliesTo(rule)}`,
      // Asks first (StatusChangeDialog below).
      onChange: (rule) => setStatusOf(rule),
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
        description="Replace or drop a CPT / HCPCS code for an insurance: the rule changes a visit’s charge lines when it is released."
        actions={
          practices.data !== undefined && practices.data.length > 0 ? (
            <>
              {/* A dialog, so it is one click away however long the list grows. */}
              <Button
                icon={<FlaskConical size={16} aria-hidden="true" />}
                onClick={() => setTesting(true)}
                // Nothing to test until there is a rule.
                disabled={loading || rows.length === 0}
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
            void rules.refetch()
          }}
        />
      ) : !practices.isPending && practice === undefined ? (
        <EmptyState
          icon={<GitBranch size={20} />}
          title="No practice yet"
          description="Coding rules belong to a practice. Create the practice and its primary location first."
        />
      ) : (
        <DataTable
          caption={practice === undefined ? 'Coding rules' : `Coding rules of ${practice.name}`}
          columns={columns}
          rows={rows}
          getRowId={(rule) => String(rule.id)}
          loading={loading}
          empty={
            // What a rule is and the one next step — the page header already says when rules run.
            (procedureCodes.data ?? []).length === 0 ? (
              <EmptyState
                icon={<GitBranch size={20} />}
                title="No coding rules yet"
                description="Rules act on procedure codes, and there are none yet."
                action={
                  <Link to="/setup/procedure-codes" className={buttonClass('default', 'sm')}>
                    Add a procedure code
                  </Link>
                }
              />
            ) : (
              <EmptyState
                icon={<GitBranch size={20} />}
                title={
                  practice === undefined ? 'No coding rules yet' : `No coding rules for ${practice.name}`
                }
                description="Rules are optional. A Replace rule swaps one code for another; a Drop rule removes it."
                action={
                  <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={openNew}>
                    New rule
                  </Button>
                }
              />
            )
          }
          footer={
            rows.length > 0
              ? `${rows.length} ${rows.length === 1 ? 'rule' : 'rules'} · active rules change a visit’s charge lines when it is released`
              : undefined
          }
        />
      )}

      {testing && (
        <RuleTester
          practiceId={practice?.id ?? 0}
          insurances={payers}
          codeOptions={testerCodeOptions}
          onClose={() => setTesting(false)}
        />
      )}

      {editing !== undefined && (
        <CodingRuleDialog
          key={editing?.id ?? 'new'}
          rule={editing}
          codeOptions={codeOptions}
          scopeOptions={scopeOptions}
          onSave={async (values) => {
            const payload = toCodingRulePayload(values)
            const message =
              editing === null
                ? await create.mutateAsync({ practice_id: practice?.id ?? 0, ...payload })
                : await update.mutateAsync({ id: editing.id, payload })
            toast.success(message ?? 'Rule saved', 'It runs when a visit is released.')
          }}
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
        onConfirm={async () => {
          if (deleting === null) return
          try {
            const message = await remove.mutateAsync(deleting.id)
            toast.success(message ?? `Rule ${ruleName(deleting)} deleted`)
          } catch (error) {
            toast.error(
              `Rule ${ruleName(deleting)} was not deleted`,
              isApiError(error) ? userMessage(error) : 'Something went wrong. Please try again.',
            )
          }
        }}
      />
      {statusOf !== null && (
        <StatusChangeDialog
          name={`Rule ${ruleName(statusOf)}`}
          isActive={statusOf.isActive}
          onConfirm={() => setActive.mutateAsync({ id: statusOf.id, isActive: !statusOf.isActive })}
          onClose={() => setStatusOf(null)}
        />
      )}
    </PageContainer>
  )
}
