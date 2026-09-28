import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { Form, FormField, applyServerErrors } from '@/components/ui/Form'
import { Notice } from '@/components/ui/Notice'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { resetPassword } from '../api/auth-api'
import { resetPasswordSchema, type ResetPasswordValues } from '../schemas/password-schemas'
import { AuthEmailRow } from './AuthEmailRow'
import { AuthSubmitButton } from './AuthSubmitButton'
import { AuthTextButton } from './AuthTextButton'

/**
 * Forgot password, step 3: the new password, sent with the email and the code
 * from the earlier steps. If the server rejects the code here (it may have
 * expired since it was checked), the way out is to start again.
 */
export function NewPasswordForm({
  email,
  otp,
  onReset,
  onStartOver,
}: {
  email: string
  otp: string
  onReset: () => void
  onStartOver: () => void
}) {
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })
  const submitting = form.formState.isSubmitting

  const onSubmit = async (values: ResetPasswordValues) => {
    setFailure(null)
    try {
      await resetPassword(email, otp, values)
    } catch (error) {
      // Messages about the password land on its fields; one about the email
      // or the code has no field here and shows above the form.
      setFailure(
        isApiError(error) && error.kind === 'validation'
          ? applyServerErrors(form, error)
          : userMessage(error),
      )
      return
    }
    onReset()
  }

  return (
    <Form form={form} onSubmit={onSubmit} className="mt-8 flex flex-col gap-[18px]">
      <AuthEmailRow email={email} />
      {failure !== null && (
        <Notice tone="critical" action={<AuthTextButton onClick={onStartOver}>Start over</AuthTextButton>}>
          {failure}
        </Notice>
      )}
      <FormField name="password" label="New password" required>
        {(field) => (
          <PasswordInput
            {...field}
            placeholder="Enter a new password"
            autoComplete="new-password"
            readOnly={submitting}
          />
        )}
      </FormField>
      <FormField name="confirmPassword" label="Confirm new password" required>
        {(field) => (
          <PasswordInput
            {...field}
            placeholder="Enter the new password again"
            autoComplete="new-password"
            readOnly={submitting}
          />
        )}
      </FormField>
      <AuthSubmitButton busy={submitting} label="Reset password" busyLabel="Resetting password…" />
    </Form>
  )
}
