import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormGrid, FormSection } from '@/components/ui/Field'
import { Form, FormField } from '@/components/ui/Form'
import { Input } from '@/components/ui/Input'
import { useCreateFeeRow } from '@/features/admin-fee-schedules'
import { useSetProcedureCodeDefaultFee, type ProcedureCode } from '@/features/admin-procedure-codes'
import { providerName, useCorrectProviderNpi, type Provider } from '@/features/admin-providers'
import { userMessage } from '@/lib/api/api-error'
import type { BillingException } from '../../model/billing-exception'
import { feeFixSchema, npiFixSchema, type FeeFixValues, type NpiFixValues } from '../../schemas/resolve-forms'
import { ResolveFrame } from './ResolveFrame'

/** Takes only what an amount can hold, as the prototype's money fields do. */
const amountOnly = (value: string) => value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1')

/** "Add rendering NPI": the session's rendering provider has no individual NPI, or a placeholder. */
export function ProviderNpiFix({
  exception,
  provider,
  onDone,
  onClose,
}: {
  exception: BillingException
  provider: Provider
  onDone: (label: string) => void
  onClose: () => void
}) {
  const formId = useId()
  const correct = useCorrectProviderNpi()
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<NpiFixValues>({ resolver: zodResolver(npiFixSchema), defaultValues: { npi: '' } })
  return (
    <ResolveFrame
      exception={exception}
      title={`Add rendering NPI — ${providerName(provider)}`}
      description="The rendering provider’s individual NPI is required before claim assembly."
      formId={formId}
      busy={correct.isPending}
      failure={failure}
      onClose={onClose}
    >
      <Form
        id={formId}
        form={form}
        onSubmit={async (values) => {
          setFailure(null)
          try {
            // The NPI alone: the rest of the provider stays as it is.
            await correct.mutateAsync({ id: provider.id, npi: values.npi })
            onDone('Provider NPI saved')
          } catch (error) {
            setFailure(userMessage(error))
          }
        }}
      >
        <FormGrid>
          <FormField name="npi" label="Individual NPI" required span={6}>
            {(field) => (
              <Input
                {...field}
                placeholder="Enter NPI"
                maxLength={10}
                inputMode="numeric"
                autoComplete="off"
              />
            )}
          </FormField>
        </FormGrid>
      </Form>
    </ResolveFrame>
  )
}

/**
 * "Price 97033": the code is in neither the payer's fee schedule nor has a
 * default fee, so it was charged at $0.00. Set a default fee, the payer's
 * rate, or both.
 */
export function FeeFix({
  exception,
  code,
  insurance,
  onDone,
  onClose,
}: {
  exception: BillingException
  code: ProcedureCode
  /** The case's primary insurance, whose fee schedule can take a row. */
  insurance: { id: number; name: string } | null
  onDone: (label: string) => void
  onClose: () => void
}) {
  const formId = useId()
  const setDefaultFee = useSetProcedureCodeDefaultFee()
  const createFeeRow = useCreateFeeRow()
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<FeeFixValues>({
    resolver: zodResolver(feeFixSchema),
    defaultValues: { defaultFee: '', billed: '' },
  })
  const year = new Date().getFullYear()

  const money = (name: 'defaultFee' | 'billed', label: string, placeholder: string, info?: string) => (
    <FormField name={name} label={label} span={6} {...(info === undefined ? {} : { info })}>
      {(field) => (
        <Input
          {...field}
          onChange={(event) => field.onChange(amountOnly(event.target.value))}
          prefix="$"
          placeholder={placeholder}
          inputMode="decimal"
          autoComplete="off"
        />
      )}
    </FormField>
  )

  return (
    <ResolveFrame
      exception={exception}
      title={`Price ${code.code} — ${code.description}`}
      description="This code is missing from both the payer-specific and the default fee schedule, so it was charged at $0.00. Set a default fee, add a payer rate, or both."
      formId={formId}
      busy={setDefaultFee.isPending || createFeeRow.isPending}
      failure={failure}
      onClose={onClose}
    >
      <Form
        id={formId}
        form={form}
        onSubmit={async (values) => {
          setFailure(null)
          if (values.defaultFee !== '') {
            try {
              // The fee alone: the rest of the code stays as it is.
              await setDefaultFee.mutateAsync({ id: code.id, defaultFee: Number(values.defaultFee) })
            } catch (error) {
              setFailure(userMessage(error))
              return
            }
          }
          // A new row runs for the current year, as the fee schedules' own form starts one.
          if (values.billed !== '' && insurance !== null) {
            try {
              await createFeeRow.mutateAsync({
                insuranceId: insurance.id,
                values: {
                  procedureCodeId: String(code.id),
                  billed: values.billed,
                  from: `${year}-01-01`,
                  to: `${year}-12-31`,
                },
              })
            } catch (error) {
              // The server's reason — an overlapping price, an inactive payer — and the dialog stays.
              setFailure(userMessage(error))
              return
            }
          }
          onDone(`${code.code} priced`)
        }}
      >
        <FormGrid>
          {money(
            'defaultFee',
            'Default fee per unit',
            'Enter default fee',
            'Used when no payer row matches.',
          )}
          {insurance !== null && (
            <FormSection title={`${insurance.name} fee schedule`}>
              {money('billed', 'Billed per unit', 'Enter billed price')}
            </FormSection>
          )}
        </FormGrid>
      </Form>
    </ResolveFrame>
  )
}
