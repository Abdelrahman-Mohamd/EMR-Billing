import { useId, useState, type RefObject } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { toast } from '@/stores/toast-store'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormGrid } from '@/components/ui/Field'
import { Form, FormField, applyServerErrors } from '@/components/ui/Form'
import { Notice } from '@/components/ui/Notice'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { changePassword } from '../api/auth-api'
import { changePasswordSchema, type ChangePasswordValues } from '../schemas/password-schemas'

/**
 * Change the signed-in user's password, from the account menu.
 *
 * Mounted only while open, so every opening starts empty and nothing typed
 * outlives it. On success it closes and the user stays signed in — nothing
 * says a change ends the session. On failure it stays open with what was
 * typed; a wrong current password lands on its field.
 *
 * Called directly, not through `useMutation`: the passwords must not sit in
 * the query cache (docs/SECURITY.md §2).
 */
export function ChangePasswordDialog({
  onClose,
  returnFocusTo,
}: {
  onClose: () => void
  /** The account button: the menu item that opened this is gone when it closes. */
  returnFocusTo: RefObject<HTMLElement | null>
}) {
  const formId = useId()
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })
  const submitting = form.formState.isSubmitting

  const onSubmit = async (values: ChangePasswordValues) => {
    setFailure(null)
    try {
      await changePassword(values)
    } catch (error) {
      setFailure(
        isApiError(error) && error.kind === 'validation'
          ? applyServerErrors(form, error)
          : userMessage(error),
      )
      return
    }
    toast.success('Password changed', 'Use the new password the next time you sign in.')
    onClose()
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="Change password"
      description="Update the password you sign in with."
      size="sm"
      dismissible={!submitting}
      returnFocusTo={returnFocusTo}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={submitting}>
            {submitting ? 'Changing password…' : 'Change password'}
          </Button>
        </>
      }
    >
      <Form id={formId} form={form} onSubmit={onSubmit}>
        <FormGrid>
          {failure !== null && (
            <div className="col-span-12">
              <Notice tone="critical">{failure}</Notice>
            </div>
          )}
          <FormField name="currentPassword" label="Current password" required>
            {(field) => (
              <PasswordInput
                {...field}
                placeholder="Enter current password"
                autoComplete="current-password"
                readOnly={submitting}
              />
            )}
          </FormField>
          <FormField name="newPassword" label="New password" required>
            {(field) => (
              <PasswordInput
                {...field}
                placeholder="Enter new password"
                autoComplete="new-password"
                readOnly={submitting}
              />
            )}
          </FormField>
          <FormField name="confirmPassword" label="Confirm new password" required>
            {(field) => (
              <PasswordInput
                {...field}
                placeholder="Confirm new password"
                autoComplete="new-password"
                readOnly={submitting}
              />
            )}
          </FormField>
        </FormGrid>
      </Form>
    </Dialog>
  )
}
