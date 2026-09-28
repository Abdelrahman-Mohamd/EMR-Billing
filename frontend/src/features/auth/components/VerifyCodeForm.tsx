import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { toast } from '@/stores/toast-store'
import { Form, FormField, applyServerErrors } from '@/components/ui/Form'
import { Input } from '@/components/ui/Input'
import { Notice } from '@/components/ui/Notice'
import { sendOtp, verifyOtp } from '../api/auth-api'
import { verifyCodeSchema, type VerifyCodeValues } from '../schemas/password-schemas'
import { AuthEmailRow } from './AuthEmailRow'
import { AuthSubmitButton } from './AuthSubmitButton'
import { AuthTextButton } from './AuthTextButton'

/**
 * Forgot password, step 2: the code from the email, checked against `email`.
 *
 * One text field, not a row of digit boxes: the code's length and alphabet are
 * not specified, so nothing here assumes them. `autocomplete="one-time-code"`
 * lets a phone offer the code from the message.
 *
 * "Send a new code" repeats step 1's request for the same email. How often a
 * code may be resent, and for how long one is valid, are the server's rules;
 * it says so in its error if a limit is hit.
 */
export function VerifyCodeForm({
  email,
  onVerified,
  onChangeEmail,
}: {
  email: string
  onVerified: (otp: string) => void
  onChangeEmail: () => void
}) {
  const [failure, setFailure] = useState<string | null>(null)
  const [resending, setResending] = useState(false)
  const form = useForm<VerifyCodeValues>({
    resolver: zodResolver(verifyCodeSchema),
    defaultValues: { otp: '' },
  })
  const submitting = form.formState.isSubmitting

  const onSubmit = async (values: VerifyCodeValues) => {
    setFailure(null)
    try {
      await verifyOtp(email, values.otp)
    } catch (error) {
      setFailure(
        isApiError(error) && error.kind === 'validation'
          ? applyServerErrors(form, error)
          : userMessage(error),
      )
      return
    }
    onVerified(values.otp)
  }

  const resend = async () => {
    setFailure(null)
    setResending(true)
    try {
      await sendOtp({ email })
      form.resetField('otp')
      toast.success('A new code is on its way', 'Check your inbox for the latest one.')
    } catch (error) {
      setFailure(userMessage(error))
    } finally {
      setResending(false)
    }
  }

  const busy = submitting || resending

  return (
    <Form form={form} onSubmit={onSubmit} className="mt-8 flex flex-col gap-[18px]">
      <AuthEmailRow email={email} onChange={onChangeEmail} disabled={busy} />
      {failure !== null && <Notice tone="critical">{failure}</Notice>}
      <FormField name="otp" label="Code" required>
        {(field) => (
          <Input
            {...field}
            placeholder="Enter the code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            readOnly={busy}
          />
        )}
      </FormField>
      <AuthSubmitButton busy={submitting} label="Verify code" busyLabel="Verifying…" />
      <p className="text-meta text-n600 text-center" aria-live="polite">
        {resending ? (
          'Sending a new code…'
        ) : (
          <>
            Didn’t get a code?{' '}
            <AuthTextButton onClick={() => void resend()} disabled={submitting}>
              Send a new code
            </AuthTextButton>
          </>
        )}
      </p>
    </Form>
  )
}
