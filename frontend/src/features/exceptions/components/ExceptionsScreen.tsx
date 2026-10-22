import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ScanSearch } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ChoicePills } from '@/components/ui/FilterPills'
import { TabNav } from '@/components/ui/TabNav'
import { FilterBar, PageContainer, PageHeader } from '@/components/shared/PageLayout'
import { useInsurances } from '@/features/admin-insurances'
import { PracticeSelect } from '@/features/admin-practices'
import { useProcedureCodes } from '@/features/admin-procedure-codes'
import { useProviders } from '@/features/admin-providers'
import { useReferringPhysicians } from '@/features/admin-referring-physicians'
import { EXCEPTION_TYPES, reasonLabel, typeLabel } from '../model/billing-exception'
import { useBillingExceptions, useExceptionGroups } from '../queries/use-billing-exceptions'
import { ExceptionList } from './ExceptionList'
import { ScanDialog } from './ScanDialog'

/**
 * Exceptions: the server's billing exceptions — the data problems it found on
 * patients, cases and visits before a claim is built — as a queue: by type
 * (Patient, Case, Charge — tabs, each a URL), then by reason within the type
 * (one-choice chips under the tabs), each with the server's count (`GET /billing-exceptions/grouped`), over the list itself.
 * The practice, type and reason are in the URL (`?practice=&type=&reason=`,
 * opaque values) and asked of the server, which filters the list. "Scan
 * practice" has the server check a whole practice again.
 *
 * A fixed problem leaves the list by itself: the server re-checks a record
 * whenever it is saved. Not built, because the server has none of it: the
 * prototype's Resolved list, owner and due date, Payment-level exceptions and
 * Incomplete profiles (draft providers and insurances from the EMR).
 */
export function ExceptionsScreen({
  practiceFilter,
  type,
  reason,
}: {
  practiceFilter: number | undefined
  type: string | undefined
  reason: string | undefined
}) {
  const navigate = useNavigate()
  const [scanning, setScanning] = useState(false)
  const practiceOnly = practiceFilter === undefined ? {} : { practiceId: practiceFilter }
  const groups = useExceptionGroups(practiceOnly)
  const exceptions = useBillingExceptions({
    ...practiceOnly,
    ...(type === undefined ? {} : { type }),
    ...(reason === undefined ? {} : { reason }),
  })
  // The Resolve forms read these lists. Asking for them with the page means a
  // form opens on its record at once, not on a loading step first.
  useProviders()
  useReferringPhysicians()
  useInsurances()
  useProcedureCodes()

  const show = (next: {
    practice?: number | undefined
    type?: string | undefined
    reason?: string | undefined
  }) =>
    void navigate({
      to: '/exceptions',
      search: Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined)),
    })

  // The known types always, then any other the server sends, each with its count.
  const counted = groups.data?.types ?? []
  const types = [
    ...EXCEPTION_TYPES,
    ...counted.map((item) => item.type).filter((value) => !EXCEPTION_TYPES.some((known) => known === value)),
  ].map((value) => ({ value, total: counted.find((item) => item.type === value)?.total ?? 0 }))
  const ofType = counted.find((item) => item.type === type)
  const base = practiceFilter === undefined ? {} : { practice: practiceFilter }

  return (
    <PageContainer>
      <PageHeader
        title="Exceptions"
        description="Resolve the data problems caught before a claim is built."
        actions={
          <Button icon={<ScanSearch size={16} aria-hidden="true" />} onClick={() => setScanning(true)}>
            Scan practice
          </Button>
        }
      />

      <FilterBar {...(practiceFilter === undefined ? {} : { onReset: () => show({ type, reason }) })}>
        <PracticeSelect
          aria-label="Filter by practice"
          value={practiceFilter === undefined ? null : String(practiceFilter)}
          onChange={(value) => show({ practice: value === null ? undefined : Number(value), type, reason })}
          placeholder="All practices"
          clearable
          className="w-full sm:w-64"
        />
      </FilterBar>

      {/* The queue's two levels, each its own device: the type as tabs (each a
          URL), then — once a type is chosen — its reasons as one-choice chips. */}
      <TabNav
        label="Exception types"
        items={[
          {
            label: 'All',
            link: { to: '/exceptions', search: base, activeOptions: { exact: true, includeSearch: true } },
            count: groups.data?.total ?? 0,
          },
          ...types.map((item) => ({
            label: typeLabel(item.value),
            link: { to: '/exceptions' as const, search: { ...base, type: item.value } },
            count: item.total,
          })),
        ]}
      />
      {ofType !== undefined && ofType.reasons.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span aria-hidden="true" className="text-eyebrow text-n500 font-medium uppercase">
            Reason
          </span>
          <ChoicePills
            label="Reason"
            value={reason ?? ''}
            options={[
              { value: '', label: 'All reasons', count: ofType.total },
              ...ofType.reasons.map((item) => ({
                value: item.reason,
                label: reasonLabel(item.reason),
                count: item.total,
              })),
            ]}
            onChange={(next) => show({ ...base, type, reason: next === '' ? undefined : next })}
          />
        </div>
      )}

      <div className="mt-4">
        <ExceptionList
          // Keyed by the filter: each list starts on its first page.
          key={`${practiceFilter ?? ''}:${type ?? ''}:${reason ?? ''}`}
          exceptions={exceptions.data ?? []}
          loading={exceptions.isPending}
          failed={exceptions.isError}
          onRetry={() => void exceptions.refetch()}
          filtered={type !== undefined || reason !== undefined}
        />
      </div>

      {scanning && <ScanDialog practiceId={practiceFilter} onClose={() => setScanning(false)} />}
    </PageContainer>
  )
}
