import { useNavigate } from '@tanstack/react-router'
import { CircleCheck } from 'lucide-react'
import { EmptyState } from '@/components/ui/States'
import { TabNav } from '@/components/ui/TabNav'
import { FilterBar, PageContainer, PageHeader } from '@/components/shared/PageLayout'
import { useInsurances } from '@/features/admin-insurances'
import { PracticeSelect } from '@/features/admin-practices'
import { useProviders } from '@/features/admin-providers'
import { useReferringPhysicians } from '@/features/admin-referring-physicians'
import { useBillingExceptions } from '../data/exceptions-store'
import type { ExceptionLevel } from '../model/billing-exception'
import { ExceptionList } from './ExceptionList'

export type ExceptionsTab = 'open' | 'incomplete' | 'resolved'

/**
 * Exceptions, as the prototype has it: the data problems caught on incoming
 * records before a claim is built, in three lists — Billing exceptions (open,
 * by level), Incomplete profiles and Resolved — each a URL. As on the other
 * practice-scoped screens, the practice filter is in the URL (`?practice=`).
 *
 * Incomplete profiles lists the draft providers and insurances the EMR
 * created, with the sessions waiting on them. Neither drafts nor sessions
 * exist here yet, so it shows the prototype's empty state.
 */
export function ExceptionsScreen({
  tab,
  practiceFilter,
  level,
}: {
  tab: ExceptionsTab
  practiceFilter: number | undefined
  level: ExceptionLevel | undefined
}) {
  const navigate = useNavigate()
  const store = useBillingExceptions()
  // The Resolve forms read these lists. Asking for them with the page means a
  // form opens on its record at once, not on a loading step first.
  useProviders()
  useReferringPhysicians()
  useInsurances()
  const exceptions = store.exceptions.filter(
    (exception) => practiceFilter === undefined || exception.practiceId === practiceFilter,
  )
  const openCount = exceptions.filter((exception) => exception.status === 'Open').length
  const resolvedCount = exceptions.filter((exception) => exception.status === 'Resolved').length
  const search = practiceFilter === undefined ? {} : { practice: practiceFilter }
  const setPractice = (value: string | null) =>
    void navigate({ to: '.', search: value === null ? {} : { practice: Number(value) } })

  return (
    <PageContainer>
      <PageHeader
        title="Exceptions"
        description="Resolve the data problems caught before a claim is built."
      />

      <FilterBar {...(practiceFilter === undefined ? {} : { onReset: () => setPractice(null) })}>
        <PracticeSelect
          aria-label="Filter by practice"
          value={practiceFilter === undefined ? null : String(practiceFilter)}
          onChange={setPractice}
          placeholder="All practices"
          clearable
          className="w-full sm:w-64"
        />
      </FilterBar>

      <TabNav
        label="Exception lists"
        items={[
          {
            label: 'Billing exceptions',
            link: { to: '/exceptions', search, activeOptions: { exact: true, includeSearch: false } },
            count: openCount,
            countTone: openCount > 0 ? 'alert' : 'default',
          },
          {
            label: 'Incomplete profiles',
            link: { to: '/exceptions/incomplete', search },
            // Alerting once drafts exist; there are none here yet.
            count: 0,
          },
          { label: 'Resolved', link: { to: '/exceptions/resolved', search }, count: resolvedCount },
        ]}
      />

      <div className="mt-4">
        {tab === 'incomplete' ? (
          <div className="pt-6">
            <EmptyState
              icon={<CircleCheck size={20} />}
              title="No incomplete profiles"
              description="When an EMR session references a provider or insurance that does not exist yet, a draft profile is created and the session waits here."
            />
          </div>
        ) : (
          // Keyed by tab: each list keeps its own pills, sort and page, as the prototype's do.
          <ExceptionList
            key={tab}
            status={tab === 'open' ? 'Open' : 'Resolved'}
            exceptions={exceptions}
            ready={store.ready}
            initialLevel={level}
          />
        )}
      </div>
    </PageContainer>
  )
}
