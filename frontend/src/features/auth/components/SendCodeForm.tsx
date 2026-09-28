import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { Form, FormField, applyServerErrors } from '@/components/ui/Form'
import { Input } from '@/components/ui/Input'
import { Notice } from '@/components/ui/Notice'
import { sendOtp } from '../api/auth-api'
import { sendCodeSchema, type SendCodeValues } from '../schemas/password-schemas'
import { AuthSubmitButton } from './AuthSubmitButton'

/** Forgot password, step 1: the email to send a code to. */
export function SendCodeForm({
  defaultEmail,
  onSent,
}: {
  defaultEmail: string
  onSent: (email: string) => void
}) {
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<SendCodeValues>({
    resolver: zodResolver(sendCodeSchema),
    defaultValues: { email: defaultEmail },
  })
  const submitting = form.formState.isSubmitting

  const onSubmit = async (values: SendCodeValues) => {
    setFailure(null)
    try {
      await sendOtp(values)
    } catch (error) {
      setFailure(
        isApiError(error) && error.kind === 'validation'
          ? applyServerErrors(form, error)
          : userMessage(error),
      )
      return
    }
    onSent(values.email)
  }

  return (
    <Form form={form} onSubmit={onSubmit} className="mt-8 flex flex-col gap-[18px]">
      {failure !== null && <Notice tone="critical">{failure}</Notice>}
      <FormField name="email" label="Email" required>
        {(field) => (
          <Input
            {...field}
            type="email"
            inputMode="email"
            placeholder="Enter your email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            readOnly={submitting}
          />
        )}
      </FormField>
      <AuthSubmitButton busy={submitting} label="Send code" busyLabel="Sending…" />
    </Form>
  )
}
