import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { toast } from '@/stores/toast-store'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormGrid } from '@/components/ui/Field'
import { Form, FormField, applyServerErrors } from '@/components/ui/Form'
import { Input } from '@/components/ui/Input'
import { Notice } from '@/components/ui/Notice'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Switch } from '@/components/ui/Switch'
import { useCreateUser, useUpdateUser } from '../queries/use-users'
import {
  newUserFormSchema,
  userFormSchema,
  type NewUserFormValues,
  type User,
  type UserFormValues,
} from '../schemas/user'

/**
 * Create or edit a user.
 *
 * - **Create**: name, email, password and Active — the user payload.
 * - **Edit**: name, email and Active. There is **no password field**: a
 *   stored password is never fetched, shown or pre-filled, and changing
 *   someone's password from Admin is not defined. A user changes their own
 *   password (Change password) or resets it (Forgot password).
 *
 * The password lives only in this form while it is open, and in the one
 * request that sends it.
 */
export function UserDialog({ user, onClose }: { user: User | null; onClose: () => void }) {
  const formId = useId()
  const create = useCreateUser()
  const update = useUpdateUser()
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<UserFormValues | NewUserFormValues>({
    resolver: zodResolver(user ? userFormSchema : newUserFormSchema),
    defaultValues: user
      ? { name: user.name, email: user.email, isActive: user.isActive }
      : // New users start active, as in the prototype.
        { name: '', email: '', password: '', isActive: true },
  })
  const submitting = form.formState.isSubmitting

  const onSubmit = async (values: UserFormValues | NewUserFormValues) => {
    setFailure(null)
    try {
      if (user) {
        await update.mutateAsync({ id: user.id, values })
        toast.success('User saved')
      } else if ('password' in values) {
        await create(values)
        toast.success('User created')
      }
      onClose()
    } catch (error) {
      // The server's words about a field go on the field; nothing here ever
      // repeats what was typed into the password.
      const leftover = applyServerErrors(form, error)
      setFailure(isApiError(error) && error.kind !== 'validation' ? userMessage(error) : leftover)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={user ? user.name : 'New user'}
      description={
        user
          ? "Update this user's name, email or status. Passwords are never shown here."
          : 'Add a person who can sign in to billing.'
      }
      size="md"
      dismissible={!submitting}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={submitting}>
            {user ? 'Save user' : 'Create user'}
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
          <FormField name="name" label="Name" required>
            {(field) => (
              <Input {...field} placeholder="Enter user name" autoComplete="off" readOnly={submitting} />
            )}
          </FormField>
          <FormField name="email" label="Email" required>
            {(field) => (
              <Input
                {...field}
                type="email"
                inputMode="email"
                placeholder="Enter email address"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                readOnly={submitting}
              />
            )}
          </FormField>
          {user === null && (
            <FormField
              name="password"
              label="Password"
              required
              info="The user signs in with this password, and can change it later from Change password."
            >
              {(field) => (
                <PasswordInput
                  {...field}
                  placeholder="Enter password"
                  // A password for someone else: the browser must not fill in,
                  // or offer to save over, the admin's own.
                  autoComplete="new-password"
                  readOnly={submitting}
                />
              )}
            </FormField>
          )}
          <FormField name="isActive">
            {(field) => (
              <Switch
                label="Active"
                name={field.name}
                checked={field.value === true}
                onCheckedChange={field.onChange}
                onBlur={field.onBlur}
                disabled={submitting}
              />
            )}
          </FormField>
        </FormGrid>
      </Form>
    </Dialog>
  )
}
