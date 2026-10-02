import { useId, useState } from 'react'
import { formatMoney } from '@/lib/utils/money'
import { todayIso } from '@/lib/utils/dates'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Field, FormGrid } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { SearchSelect } from '@/components/ui/SearchSelect'
import type { ProcedureCode } from '@/features/admin-procedure-codes'
import { lookUpPrice, type FeeRow } from '../model/fee-row'

interface InsuranceOption {
  id: number
  name: string
  label: string
  description?: string | undefined
}

/**
 * The prototype's Price lookup card: pick an insurance, a code and a number
 * of units, and see what a charge line would be billed today and where the
 * price comes from. A read-out only — it changes nothing.
 */
export function PriceLookup({
  insurances,
  codes,
  rows,
  initialInsuranceId,
}: {
  insurances: readonly InsuranceOption[]
  codes: readonly ProcedureCode[]
  rows: readonly FeeRow[]
  initialInsuranceId: number | null
}) {
  const titleId = useId()
  const [insuranceId, setInsuranceId] = useState<string | null>(
    initialInsuranceId === null ? null : String(initialInsuranceId),
  )
  // The prototype starts the lookup on 97110 when the list has it.
  const [code, setCode] = useState<string | null>(
    codes.find((candidate) => candidate.code === '97110')?.code ?? codes[0]?.code ?? null,
  )
  const [units, setUnits] = useState('2')

  const insurance = insurances.find((candidate) => String(candidate.id) === insuranceId)
  const procedureCode = codes.find((candidate) => candidate.code === code)
  const unitCount = Math.max(1, Number(units) || 1)
  const result =
    insurance !== undefined && procedureCode !== undefined
      ? lookUpPrice({
          rows,
          insuranceId: insurance.id,
          procedureCode: procedureCode.code,
          defaultFee: procedureCode.defaultFee,
          units: unitCount,
          date: todayIso(),
        })
      : null

  return (
    <Card labelledBy={titleId}>
      <CardHeader id={titleId} title="Price lookup" />
      <CardBody>
        <p className="text-micro text-n500 mb-4 leading-relaxed">
          How a charge line is priced: the payer’s billed price when a row is effective, otherwise the code’s
          default fee. What a payer allows is known from its remittance.
        </p>
        <FormGrid>
          <Field label="Insurance">
            <SearchSelect
              value={insuranceId}
              onChange={setInsuranceId}
              options={insurances.map((option) => ({
                value: String(option.id),
                label: option.label,
                ...(option.description === undefined ? {} : { description: option.description }),
              }))}
              placeholder="Select an insurance"
              searchPlaceholder="Search insurances"
            />
          </Field>
          <Field label="Code" span={8}>
            <SearchSelect
              value={code}
              onChange={setCode}
              options={codes.map((option) => ({
                value: option.code,
                label: `${option.code} — ${option.description}`,
              }))}
              placeholder="Select a code"
              searchPlaceholder="Search codes"
            />
          </Field>
          <Field label="Units" span={4}>
            <Input
              type="number"
              min={1}
              max={12}
              inputMode="numeric"
              value={units}
              onChange={(event) => setUnits(event.target.value)}
            />
          </Field>
        </FormGrid>
        <dl
          aria-live="polite"
          className="bg-n50 rounded-card mt-4 grid grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-2"
        >
          <div>
            <dt className="text-eyebrow text-n500 font-medium uppercase">Charge</dt>
            <dd className="text-ink mt-1 text-[22px] leading-tight font-medium tabular-nums">
              {result === null ? '—' : formatMoney(result.amount)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-eyebrow text-n500 font-medium uppercase">Source</dt>
            <dd className="text-meta text-ink mt-1 [overflow-wrap:anywhere]">
              {result === null || insurance === undefined
                ? 'Choose an insurance and a code.'
                : result.source === 'payer'
                  ? `${insurance.name} schedule · ${formatMoney(result.rate)} × ${unitCount}`
                  : `Default fee · ${formatMoney(result.rate)} × ${unitCount}`}
            </dd>
          </div>
        </dl>
      </CardBody>
    </Card>
  )
}
