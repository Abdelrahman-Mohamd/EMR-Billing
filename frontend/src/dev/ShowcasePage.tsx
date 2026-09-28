import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Download, Plus, Trash2 } from 'lucide-react'
import { PageContainer, PageHeader, FilterBar } from '@/components/shared/PageLayout'
import { Button } from '@/components/ui/Button'
import { Badge, StatusDot, Tag } from '@/components/ui/Badge'
import { Card, CardBody, CardHeader, Section } from '@/components/ui/Card'
import { Checkbox, RadioGroup } from '@/components/ui/Choice'
import { Switch } from '@/components/ui/Switch'
import { CellSub, DataTable, type Sort } from '@/components/ui/DataTable'
import { DateInput, DateRangeInput } from '@/components/ui/DateInput'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { Drawer } from '@/components/ui/Drawer'
import { Field, FormGrid, FormNote, FormSection } from '@/components/ui/Field'
import { Form, FormActions, FormField } from '@/components/ui/Form'
import { Input, SearchInput, Textarea } from '@/components/ui/Input'
import { KeyValue } from '@/components/ui/KeyValue'
import { Menu } from '@/components/ui/Menu'
import { Notice } from '@/components/ui/Notice'
import { Pagination } from '@/components/ui/Pagination'
import { Select } from '@/components/ui/Select'
import { MultiSelect, SearchSelect } from '@/components/ui/SearchSelect'
import { EmptyState, ErrorState, Skeleton, SkeletonRows } from '@/components/ui/States'
import { Spinner } from '@/components/ui/Spinner'
import { toast } from '@/stores/toast-store'

/**
 * Development-only component showcase.
 *
 * It exists so the UI system can be seen and exercised in one place — states
 * included — without standing up a feature. It is not a second application:
 * no data layer, no business rules, and it never ships (the route 404s
 * outside a development build, and nothing links to it in production).
 */
/** Invented sample rows. No real patient, payer or claim data — ever. */
interface DemoRow {
  id: string
  number: string
  payer: string
  amount: string
  status: ReactNode
}

const DEMO_ROWS: DemoRow[] = [
  {
    id: '1',
    number: 'CLM-10241',
    payer: 'Northbrook Health',
    amount: '$182.40',
    status: <Badge tone="warning">On hold</Badge>,
  },
  {
    id: '2',
    number: 'CLM-10242',
    payer: 'Riverside Mutual',
    amount: '$96.00',
    status: <Badge tone="success">Paid</Badge>,
  },
  {
    id: '3',
    number: 'CLM-10243',
    payer: 'Statewide Care',
    amount: '$240.75',
    status: <Badge tone="critical">Denied</Badge>,
  },
]

const PAYERS = [
  { value: 'p1', label: 'Northbrook Health', description: 'Commercial · 87726' },
  { value: 'p2', label: 'Riverside Mutual', description: 'Commercial · 61425' },
  { value: 'p3', label: 'Statewide Care Plan', description: 'Medicaid · 33017' },
  { value: 'p4', label: 'Harbor Point Auto', description: 'No-fault · 55012' },
]

const demoSchema = z.object({
  name: z.string().min(1, 'Enter a name.'),
  payer: z.string().min(1, 'Select a payer.'),
  startDate: z.string().min(1, 'Choose a date.'),
  notes: z.string().max(200, 'Keep it under 200 characters.').optional(),
})
type DemoValues = z.infer<typeof demoSchema>

export default function ShowcasePage() {
  return (
    <PageContainer>
      <PageHeader
        title="Component showcase"
        description="Every core primitive with its states. Development only — this route does not exist in a production build."
      />
      <Buttons />
      <Inputs />
      <Selection />
      <FormDemo />
      <TableDemo />
      <Feedback />
      <Overlays />
      <DisplayBits />
      <PagePatterns />
    </PageContainer>
  )
}

function Row({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-3 py-3">
      <p className="text-micro text-n500 w-40 flex-none pt-2">{title}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  )
}

function Buttons() {
  return (
    <Section title="Buttons">
      <Row title="Variants">
        <Button variant="primary">Primary</Button>
        <Button>Secondary</Button>
        <Button variant="quiet">Quiet</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="dangerFill">Destructive</Button>
      </Row>
      <Row title="Sizes">
        <Button size="md" icon={<Plus size={16} />}>
          Medium
        </Button>
        <Button size="sm" icon={<Plus size={16} />}>
          Small
        </Button>
        <Button size="xs">Extra small</Button>
      </Row>
      <Row title="States">
        <Button loading>Saving</Button>
        <Button disabled>Disabled</Button>
        <Button variant="primary" icon={<Download size={16} />}>
          With icon
        </Button>
      </Row>
    </Section>
  )
}

function Inputs() {
  const [date, setDate] = useState('2026-09-25')
  const [range, setRange] = useState({ from: '2026-09-01', to: '2026-09-30' })
  return (
    <Section title="Inputs">
      <FormGrid className="py-3">
        <Field label="Text" span={4} info="Optional context lives behind the info icon, not under the field.">
          <Input placeholder="Enter the practice name" />
        </Field>
        <Field label="Required" span={4} required>
          <Input placeholder="Enter the member ID" />
        </Field>
        <Field label="With error" span={4} error="Enter a valid member ID.">
          <Input defaultValue="12-34" />
        </Field>
        <Field label="Amount" span={4}>
          <Input type="number" prefix="$" placeholder="0.00" />
        </Field>
        <Field label="Disabled" span={4} disabled>
          <Input defaultValue="Locked" />
        </Field>
        <Field label="Read only" span={4}>
          <Input readOnly defaultValue="Set by the EMR" />
        </Field>
        <Field label="Search" span={6}>
          <SearchInput placeholder="Search claims" />
        </Field>
        <Field label="Date" span={3}>
          <DateInput value={date} onChange={setDate} />
        </Field>
        <Field
          label="Notes"
          span={12}
          description="Visible help only when the user needs it to fill the field."
        >
          <Textarea placeholder="Add a note" />
        </Field>
        <Field label="Date range" span={6}>
          <DateRangeInput
            from={range.from}
            to={range.to}
            onFromChange={(from) => setRange((r) => ({ ...r, from }))}
            onToChange={(to) => setRange((r) => ({ ...r, to }))}
          />
        </Field>
      </FormGrid>
    </Section>
  )
}

function Selection() {
  const [plain, setPlain] = useState<string | null>('a')
  const [single, setSingle] = useState<string | null>('p1')
  const [many, setMany] = useState<string[]>(['p1', 'p3'])
  const [radio, setRadio] = useState<'all' | 'mine'>('all')
  const [checked, setChecked] = useState(true)
  const [active, setActive] = useState(true)
  return (
    <Section title="Selection">
      <FormGrid className="py-3">
        <Field label="Select" span={4} description="Short lists. Long ones use the searchable version.">
          <Select
            value={plain}
            onChange={setPlain}
            clearable
            options={[
              { value: 'a', label: 'Option A', description: 'With a second line' },
              { value: 'b', label: 'Option B' },
              { value: 'c', label: 'Option C', disabled: true },
            ]}
          />
        </Field>
        <Field label="Searchable" span={4}>
          <SearchSelect
            options={PAYERS}
            value={single}
            onChange={setSingle}
            clearable
            placeholder="Select a payer"
          />
        </Field>
        <Field label="Multiple" span={4}>
          <MultiSelect options={PAYERS} value={many} onChange={setMany} placeholder="Select payers" />
        </Field>
        <Field label="Checkboxes" span={6} asFieldset>
          <Checkbox
            label="Do not send batch statements"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          <Checkbox label="Partly selected" indeterminate checked={false} onChange={() => undefined} />
          <Checkbox label="Disabled" disabled />
        </Field>
        <Field label="Status" span={6} asFieldset description="The is_active convention: on = Active.">
          <Switch label="Active" checked={active} onCheckedChange={setActive} />
          <Switch label="Disabled" checked={false} onCheckedChange={() => undefined} disabled />
        </Field>
        <Field label="Radios" span={6} asFieldset description="Grouped in a fieldset with a legend.">
          <RadioGroup
            name="showcase-scope"
            value={radio}
            onValueChange={setRadio}
            options={[
              { value: 'all', label: 'All practices', description: 'Everything the account can see.' },
              { value: 'mine', label: 'This practice only' },
            ]}
          />
        </Field>
      </FormGrid>
    </Section>
  )
}

function FormDemo() {
  const form = useForm<DemoValues>({
    resolver: zodResolver(demoSchema),
    defaultValues: { name: '', payer: '', startDate: '', notes: '' },
  })
  return (
    <Section title="Form">
      <Form
        form={form}
        onSubmit={(values) => toast.success('Form submitted', `${values.name} · ${values.payer}`)}
        className="py-3"
      >
        <FormGrid>
          <FormSection title="Details" />
          <FormNote>Validation comes from one Zod schema; the type is inferred from it.</FormNote>
          <FormField name="name" label="Name" required span={6}>
            {(field) => <Input {...field} placeholder="Enter a name" />}
          </FormField>
          <FormField name="payer" label="Payer" required span={6}>
            {(field) => (
              <SearchSelect
                options={PAYERS}
                value={typeof field.value === 'string' && field.value !== '' ? field.value : null}
                onChange={(value) => field.onChange(value ?? '')}
                placeholder="Select a payer"
              />
            )}
          </FormField>
          <FormField name="startDate" label="Start date" required span={4}>
            {(field) => (
              <DateInput
                value={typeof field.value === 'string' ? field.value : ''}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          </FormField>
          <FormField name="notes" label="Notes" span={8} description="Optional.">
            {(field) => <Textarea {...field} rows={2} />}
          </FormField>
        </FormGrid>
        <FormActions>
          <Button variant="quiet" type="button" onClick={() => form.reset()}>
            Reset
          </Button>
          <Button variant="primary" type="submit" loading={form.formState.isSubmitting}>
            Save
          </Button>
        </FormActions>
      </Form>
    </Section>
  )
}

function TableDemo() {
  const [status, setStatus] = useState<string | null>('all')
  const [sort, setSort] = useState<Sort>({ key: 'number', direction: 'asc' })
  const [selected, setSelected] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [state, setState] = useState<'data' | 'loading' | 'empty' | 'error'>('data')

  return (
    <Section
      title="Data table"
      aside={
        <Select
          aria-label="Table state"
          options={[
            { value: 'data', label: 'With data' },
            { value: 'loading', label: 'Loading' },
            { value: 'empty', label: 'Empty' },
            { value: 'error', label: 'Error' },
          ]}
          value={state}
          onChange={(value) => setState((value ?? 'data') as typeof state)}
          className="w-44"
        />
      }
    >
      <FilterBar
        search={<SearchInput placeholder="Search claims" />}
        onReset={() => setSelected([])}
        actions={
          <Button size="sm" icon={<Download size={16} />}>
            Export
          </Button>
        }
      >
        <Select
          className="w-44"
          aria-label="Status filter"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'All statuses' },
            { value: 'hold', label: 'On hold' },
          ]}
        />
      </FilterBar>

      <DataTable
        caption="Sample claims"
        rows={state === 'data' ? DEMO_ROWS : []}
        getRowId={(row) => row.id}
        loading={state === 'loading'}
        error={state === 'error'}
        onRetry={() => setState('data')}
        empty={
          <EmptyState
            title="No claims match these filters"
            description="Clear a filter, or widen the date range."
          />
        }
        sort={sort}
        onSortChange={setSort}
        selectedIds={selected}
        onSelectionChange={setSelected}
        rowAction={{
          label: (row) => `Open ${row.number}`,
          onAction: (row) => toast.info('Row opened', row.number),
        }}
        columns={[
          {
            key: 'number',
            header: 'Claim',
            sortable: true,
            primary: true,
            cell: (row) => (
              <>
                {row.number}
                <CellSub>Submitted 09/18/2026</CellSub>
              </>
            ),
          },
          { key: 'payer', header: 'Payer', cell: (row) => row.payer, hideOnMobile: true },
          { key: 'status', header: 'Status', cell: (row) => row.status },
          { key: 'amount', header: 'Amount', align: 'right', sortable: true, cell: (row) => row.amount },
          {
            key: 'actions',
            header: '',
            align: 'right',
            interactive: true,
            cell: () => (
              <Menu
                items={[
                  { label: 'Open', onSelect: () => undefined },
                  'separator',
                  { label: 'Void', danger: true, onSelect: () => undefined },
                ]}
              />
            ),
          },
        ]}
        footer={<Pagination page={page} pageCount={9} onPageChange={setPage} summary="1–3 of 27" />}
      />
    </Section>
  )
}

function Feedback() {
  return (
    <Section title="Feedback">
      <div className="flex flex-col gap-2 py-3">
        <Notice tone="info" title="Scheduled submission:">
          Every day at 18:00. Last run yesterday.
        </Notice>
        <Notice tone="warning" title="Waiting for a payer audit:">
          Record the documents attached and the claim goes out.
        </Notice>
        <Notice tone="critical" title="Credentialing hold:">
          The rendering provider is not enrolled with this payer.
        </Notice>
        <Notice tone="success">Everything in this batch reached the clearinghouse.</Notice>
      </div>
      <Row title="Toasts">
        <Button size="sm" onClick={() => toast.success('Saved', 'The change is stored.')}>
          Success
        </Button>
        <Button size="sm" onClick={() => toast.error('Could not save', 'Check the highlighted fields.')}>
          Error
        </Button>
        <Button size="sm" onClick={() => toast.warning('Hold applied', 'Two visits moved to Delayed.')}>
          Warning
        </Button>
        <Button size="sm" onClick={() => toast.info('Nothing to submit')}>
          Info
        </Button>
      </Row>
      <Row title="Loading">
        <Spinner />
        <Skeleton width={180} />
        <div className="w-full max-w-md">
          <SkeletonRows rows={2} columns={3} />
        </div>
      </Row>
      <div className="grid gap-4 py-3 sm:grid-cols-2">
        <Card>
          <EmptyState
            title="No referring physicians yet"
            description="Add the referring physicians your cases are billed with."
            action={
              <Button variant="primary" size="sm" icon={<Plus size={16} />}>
                Add a physician
              </Button>
            }
          />
        </Card>
        <Card>
          <ErrorState onRetry={() => toast.info('Retried')} />
        </Card>
      </div>
    </Section>
  )
}

function Overlays() {
  const [dialog, setDialog] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [drawer, setDrawer] = useState(false)
  return (
    <Section title="Overlays">
      <Row title="Open">
        <Button onClick={() => setDialog(true)}>Dialog</Button>
        <Button variant="danger" onClick={() => setConfirm(true)}>
          Destructive confirm
        </Button>
        <Button onClick={() => setDrawer(true)}>Drawer</Button>
        <Menu
          trigger={<Button size="sm">Menu</Button>}
          items={[
            { label: 'Duplicate', onSelect: () => toast.info('Duplicated') },
            'separator',
            {
              label: 'Delete',
              danger: true,
              icon: <Trash2 size={15} />,
              onSelect: () => toast.warning('Deleted'),
            },
          ]}
        />
      </Row>

      <Dialog
        open={dialog}
        onOpenChange={setDialog}
        title="Edit practice"
        description="Update the practice's billing details."
        footer={
          <>
            <Button variant="quiet" onClick={() => setDialog(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setDialog(false)}>
              Save
            </Button>
          </>
        }
        footerNote="Last edited 09/24/2026"
      >
        <FormGrid>
          <Field label="Legal name" span={8}>
            <Input defaultValue="Harborline Physical Therapy, PLLC" />
          </Field>
          <Field label="Tax ID" span={4}>
            <Input defaultValue="84-7729301" />
          </Field>
        </FormGrid>
      </Dialog>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Void this claim?"
        description="A voided claim cannot be reopened. The payer is notified with frequency code 8."
        confirmLabel="Void claim"
        tone="destructive"
        onConfirm={() => {
          toast.warning('Claim voided')
        }}
      />

      <Drawer open={drawer} onOpenChange={setDrawer} title="Submission run" description="09/24/2026 at 18:00">
        <KeyValue
          items={[
            { label: 'Attempted', value: '34' },
            { label: 'Sent', value: '31' },
            { label: 'Held', value: '3' },
            { label: 'Batch', value: 'BAT-0918' },
          ]}
        />
      </Drawer>
    </Section>
  )
}

function DisplayBits() {
  return (
    <Section title="Status and display">
      <Row title="Badges">
        <Badge tone="critical">Denied</Badge>
        <Badge tone="warning">On hold</Badge>
        <Badge tone="attention">Waiting</Badge>
        <Badge tone="success">Paid</Badge>
        <Badge tone="info">Submitted</Badge>
        <Badge tone="inert">Draft</Badge>
        <Badge tone="brand" dot={false}>
          Selected
        </Badge>
      </Row>
      <Row title="Status">
        <StatusDot tone="success">Active</StatusDot>
        <StatusDot tone="critical">Invalid NPI</StatusDot>
        <StatusDot tone="inert">Inactive</StatusDot>
      </Row>
      <Row title="Tags">
        <Tag>Auth required</Tag>
        <Tag tone="brand">Class rule</Tag>
        <Tag tone="attention">Audit required</Tag>
      </Row>
      <div className="grid gap-4 py-3 sm:grid-cols-2">
        <Card>
          <CardHeader title="Organization" aside={<Button size="xs">Manage</Button>} />
          <CardBody>
            <KeyValue
              items={[
                { label: 'Name', value: 'Harborline Rehab Group' },
                { label: 'Practices', value: '2' },
                { label: 'Tax ID', value: '' },
              ]}
            />
          </CardBody>
        </Card>
      </div>
    </Section>
  )
}

function PagePatterns() {
  return (
    <Section title="Page patterns">
      <p className="text-meta text-n500 py-2">
        Screens compose the blocks above rather than extending a page component. The four arrangements are:
      </p>
      <KeyValue
        items={[
          { label: 'List page', value: 'PageHeader → FilterBar → DataTable → Pagination', wide: true },
          {
            label: 'Detail page',
            value: 'PageHeader → KeyValue summary → TabNav → section content',
            wide: true,
          },
          {
            label: 'Form page',
            value: 'PageHeader → Form(FormGrid + FormSection) → FormActions',
            wide: true,
          },
          { label: 'Dialog form', value: 'Dialog → FormGrid → footer buttons', wide: true },
        ]}
      />
    </Section>
  )
}
