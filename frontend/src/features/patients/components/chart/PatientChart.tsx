import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  Ban,
  ChevronDown,
  FileCheck,
  FileText,
  Hash,
  Landmark,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Trash2,
  User,
  Users,
} from 'lucide-react'
import { toast } from '@/stores/toast-store'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { Menu } from '@/components/ui/Menu'
import { EmptyState } from '@/components/ui/States'
import { PageContainer } from '@/components/shared/PageLayout'
import { useInsurances } from '@/features/admin-insurances'
import { cn } from '@/lib/utils/cn'
import { formatIsoDate, todayIso } from '@/lib/utils/dates'
import { usePatientRecords } from '../../data/patient-records-store'
import type { PatientCase } from '../../model/case'
import { ageOn, fullName } from '../../model/patient'
import { casesOf, leadCase, primaryInsuranceId } from '../../model/roster'
import { PatientStatusDialog } from '../PatientStatusDialog'
import { CaseEditor } from './CaseEditor'
import { CaseSection } from './CaseSection'
import { InsuranceSection } from './InsuranceSection'
import { ProfileSection } from './ProfileSection'
import { scrollToSection, useScrollSpy, useScrollToHashOnce } from './chart-scroll'

/**
 * A patient's chart — one page, read top to bottom (user, 2026-10-02): the
 * patient (Profile, then their Insurance), then the chosen case — its header,
 * details, insurance, diagnoses and authorizations.
 *
 * Beside it (from 1024px) or above it (a sticky row of pills), the chart's
 * menu: Patient — Profile, Insurance — then the prototype's case card, where
 * the case is switched or a new one started, with the case's parts under it.
 * The links jump to each part and mark the one being read. Above everything:
 * back to Patients; the name with Active / Inactive; Billing ID, EMR ID, date
 * of birth and age, phone and the case's primary insurance; More (Deactivate
 * or Reactivate, Delete patient).
 *
 * The case shown is in the URL (`?case=<id>`); with none, the first open case.
 *
 * Not built, because what they show does not exist yet: the Ledger, the
 * "New charge" button and the Visits & claims list (Charges, Claims and
 * Payments come later). With no visits, Delete is always offered; the
 * prototype refuses it for a patient with visits.
 */
export function PatientChart({ patientId, caseId }: { patientId: string; caseId: string | undefined }) {
  const navigate = useNavigate()
  const records = usePatientRecords()
  const insurances = useInsurances()
  const [changingStatus, setChangingStatus] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [addingCase, setAddingCase] = useState(false)

  const patient = records.patients.find((item) => item.id === patientId)
  const cases = patient === undefined ? [] : casesOf(records.cases, patient.id)
  const current = cases.find((item) => item.id === caseId) ?? leadCase(cases)
  const sections =
    current === undefined
      ? ['profile', 'insurance', 'case']
      : ['profile', 'insurance', 'case', 'diagnoses', 'authorizations']
  const drawn = records.ready && patient !== undefined
  const active = useScrollSpy(sections, drawn)
  useScrollToHashOnce(drawn)

  if (!records.ready) return <PageContainer>{null}</PageContainer>
  if (patient === undefined)
    return (
      <PageContainer>
        <div className="pt-8">
          <EmptyState
            icon={<Users size={20} />}
            title="Patient not found"
            description="This patient is not in the list. They may have been deleted."
            action={
              <Link to="/patients" className="text-brand-deep font-medium">
                Back to patients
              </Link>
            }
          />
        </div>
      </PageContainer>
    )

  const coverages = records.coverages.filter((coverage) => coverage.patientId === patient.id)
  const insuranceNameOf = (item: PatientCase | undefined) =>
    insurances.data?.find((entry) => entry.id === primaryInsuranceId(item, coverages))?.name ?? 'No insurance'
  const insuranceName = insuranceNameOf(current)
  // Choosing a case keeps the reader where they are, as in the prototype.
  const pickCase = (id: string) =>
    void navigate({
      to: '/patients/$patientId',
      params: { patientId: patient.id },
      search: { case: id },
      resetScroll: false,
    })
  const phone = patient.phoneCell || patient.phoneHome
  const authCount =
    current === undefined ? 0 : records.authorizations.filter((auth) => auth.caseId === current.id).length

  return (
    // One grid, two arrangements. Below 1024px: the header, the menu as a
    // sticky row of pills, then the chart. From 1024px: the menu as a sticky
    // column at the left, beside the header and the chart.
    <div className="grid min-h-full grid-cols-1 [grid-template-areas:'head'_'menu'_'body'] lg:grid-cols-[248px_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:[grid-template-areas:'menu_head'_'menu_body']">
      <header className="page-x border-rule-structural bg-canvas flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b pt-5 pb-4 [grid-area:head]">
        <div className="min-w-0 flex-1 basis-72">
          <Link
            to="/patients"
            className="text-micro text-brand-deep hover:text-ink relative inline-flex items-center gap-1.5 font-medium no-underline after:absolute after:-inset-x-1 after:-inset-y-2.5 after:content-['']"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Patients
          </Link>
          <h1 className="text-ink mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[clamp(24px,3vw,30px)] leading-tight font-medium">
            <span className="min-w-0 break-words">
              {patient.lastName} <span className="text-n600 font-normal">{patient.firstName}</span>
            </span>
            <Badge tone={patient.isActive ? 'success' : 'inert'}>
              {patient.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </h1>
          <p className="text-meta text-n500 mt-2 flex flex-wrap gap-x-2.5 gap-y-1">
            <span>Billing ID {patient.billingId ?? '—'}</span>
            <Dot />
            <span>EMR {patient.emrId ?? '—'}</span>
            <Dot />
            <span>
              {formatIsoDate(patient.dob)} · {ageOn(patient.dob, todayIso())}y
            </span>
            <Dot />
            <span>{phone || 'No phone'}</span>
            <Dot />
            <span className="break-words">{insuranceName}</span>
          </p>
        </div>
        <Menu
          label={`More actions for ${fullName(patient)}`}
          trigger={
            <Button
              icon={<MoreHorizontal size={16} aria-hidden="true" />}
              aria-label={`More actions for ${fullName(patient)}`}
            >
              More
            </Button>
          }
          items={[
            {
              label: patient.isActive ? 'Deactivate patient' : 'Reactivate patient',
              icon: patient.isActive ? <Ban size={16} /> : <RotateCcw size={16} />,
              onSelect: () => setChangingStatus(true),
            },
            {
              label: 'Delete patient',
              icon: <Trash2 size={16} />,
              danger: true,
              onSelect: () => setDeleting(true),
            },
          ]}
        />
      </header>

      <ChartMenu active={active}>
        <MenuGroup label="Patient" />
        <MenuLink id="profile" active={active} icon={<User size={18} />}>
          Profile
        </MenuLink>
        <MenuLink id="insurance" active={active} icon={<Landmark size={18} />} count={coverages.length}>
          Insurance
        </MenuLink>
        <div aria-hidden="true" className="bg-rule-section -mx-3 my-3 hidden h-px lg:block" />
        {current === undefined ? (
          <button
            type="button"
            onClick={() => setAddingCase(true)}
            className="rounded-card text-meta text-brand-deep hover:bg-brand-wash/50 mx-1 flex h-[38px] flex-none items-center gap-2 border border-dashed border-[var(--color-brand-line)] px-3 font-medium lg:mx-0 lg:mb-1 lg:h-auto lg:py-3"
          >
            <Plus size={16} aria-hidden="true" />
            New case
          </button>
        ) : (
          <Menu
            label="Switch case"
            align="start"
            trigger={
              <button
                type="button"
                aria-label={`Case: ${current.name}. Switch case or add a new one`}
                className="from-brand-wash to-canvas lg:rounded-card mx-1 flex h-[38px] max-w-[260px] flex-none items-center gap-2 rounded-full bg-gradient-to-b px-3 text-left shadow-[inset_0_0_0_1px_var(--color-brand-line)] hover:shadow-[inset_0_0_0_1px_var(--color-brand)] lg:mx-0 lg:mb-1 lg:block lg:h-auto lg:w-full lg:max-w-none lg:py-2.5"
              >
                {/* Below 1024px a pill in the row: "Case  Neck pain ▾". */}
                <span className="text-eyebrow text-n500 font-medium uppercase lg:hidden">Case</span>
                <span className="text-meta text-ink min-w-0 truncate font-medium lg:hidden">
                  {current.name}
                </span>
                <ChevronDown size={14} aria-hidden="true" className="text-n500 flex-none lg:hidden" />
                {/* From 1024px the prototype's case card. */}
                <span className="hidden items-center lg:flex">
                  <span className="text-eyebrow text-n500 font-medium uppercase">Case</span>
                  <ChevronDown size={14} aria-hidden="true" className="text-n500 ml-auto" />
                </span>
                <span className="text-meta text-ink mt-1 hidden leading-tight font-medium break-words lg:block">
                  {current.name}
                </span>
                <span className="text-micro text-n500 mt-0.5 hidden lg:block">
                  {cases.length > 1 && `${cases.length} cases · `}
                  {current.startOfCare === ''
                    ? 'No start of care'
                    : `Since ${formatIsoDate(current.startOfCare)}`}
                  {!current.isActive && ' · Closed'}
                </span>
              </button>
            }
            items={[
              ...cases.map((item) => ({
                label: item.name,
                description: `${insuranceNameOf(item)} · ${item.isActive ? 'Open' : 'Closed'}`,
                selected: item.id === current.id,
                onSelect: () => {
                  if (item.id !== current.id) pickCase(item.id)
                },
              })),
              'separator' as const,
              { label: 'New case', icon: <Plus size={16} />, onSelect: () => setAddingCase(true) },
            ]}
          />
        )}
        {current !== undefined && (
          <>
            <MenuLink id="case" active={active} icon={<FileText size={18} />}>
              Case details
            </MenuLink>
            <MenuLink
              id="diagnoses"
              active={active}
              icon={<Hash size={18} />}
              count={current.diagnoses.length}
            >
              Diagnoses
            </MenuLink>
            <MenuLink id="authorizations" active={active} icon={<FileCheck size={18} />} count={authCount}>
              Authorizations
            </MenuLink>
          </>
        )}
      </ChartMenu>

      <div className="page-x min-w-0 pb-16 [grid-area:body]">
        <ProfileSection patientId={patient.id} />
        <InsuranceSection patientId={patient.id} />
        <CaseSection patientId={patient.id} caseId={current?.id} />
      </div>

      {addingCase && <CaseEditor patientId={patient.id} item={null} onClose={() => setAddingCase(false)} />}
      {changingStatus && (
        <PatientStatusDialog
          patient={patient}
          onConfirm={(isActive) => records.setPatientActive(patient.id, isActive)}
          onClose={() => setChangingStatus(false)}
        />
      )}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${fullName(patient)}?`}
        description="The patient and their cases are removed. This cannot be undone."
        confirmLabel="Delete patient"
        tone="destructive"
        onConfirm={() => {
          records.deletePatient(patient.id)
          toast.success('Patient deleted')
          void navigate({ to: '/patients' })
        }}
      />
    </div>
  )
}

const Dot = () => (
  <span aria-hidden="true" className="text-n300">
    ·
  </span>
)

/**
 * The chart's menu. From 1024px, a column that stays put like the rail; below,
 * one row of pills that sticks to the top while the chart scrolls and slides
 * sideways to keep the part being read in view.
 */
function ChartMenu({ active, children }: { active: string | undefined; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const nav = ref.current
    if (nav === null || nav.scrollWidth <= nav.clientWidth) return
    const link = nav.querySelector<HTMLElement>('[aria-current]')
    if (link === null) return
    const left = link.offsetLeft - nav.offsetLeft
    if (left < nav.scrollLeft || left + link.offsetWidth > nav.scrollLeft + nav.clientWidth)
      nav.scrollTo({ left: Math.max(0, left - 16) })
  }, [active])
  return (
    <nav
      ref={ref}
      aria-label="Patient chart"
      className="border-rule-structural bg-canvas sticky top-0 z-20 flex items-center gap-1 overflow-x-auto border-b px-4 py-2.5 [grid-area:menu] lg:h-dvh lg:flex-col lg:items-stretch lg:gap-0.5 lg:self-start lg:overflow-x-visible lg:overflow-y-auto lg:border-r lg:border-b-0 lg:px-3 lg:pt-4 lg:pb-6"
    >
      {children}
    </nav>
  )
}

function MenuGroup({ label }: { label: string }) {
  return (
    <p className="text-eyebrow text-n500 mt-1 mb-1.5 hidden px-3 font-medium uppercase lg:block">{label}</p>
  )
}

function MenuLink({
  id,
  active,
  icon,
  count,
  children,
}: {
  id: string
  active: string | undefined
  icon: ReactNode
  count?: number
  children: ReactNode
}) {
  const on = active === id
  return (
    <a
      href={`#${id}`}
      aria-current={on ? 'location' : undefined}
      onClick={(event) => {
        event.preventDefault()
        scrollToSection(id)
      }}
      className={cn(
        'text-meta flex h-[38px] min-w-0 flex-none items-center gap-2.5 rounded-full px-3 whitespace-nowrap no-underline',
        on
          ? 'bg-brand-wash text-brand-deep [&_svg]:text-brand font-medium'
          : 'text-n600 hover:bg-n50 hover:text-ink [&_svg]:text-n400',
      )}
    >
      <span aria-hidden="true" className="flex-none">
        {icon}
      </span>
      {children}
      {count !== undefined && (
        <span className="text-micro ml-auto pl-1 tabular-nums opacity-80">
          <span className="sr-only"> (</span>
          {count}
          <span className="sr-only">)</span>
        </span>
      )}
    </a>
  )
}
