import { useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { currentUserQuery, useCurrentUser } from '@/features/auth'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { clearSession, expectSessionEnd } from '@/lib/auth/session'
import { toast } from '@/stores/toast-store'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormGrid } from '@/components/ui/Field'
import { Form, FormField, applyServerErrors } from '@/components/ui/Form'
import { Input } from '@/components/ui/Input'
import { Notice } from '@/components/ui/Notice'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { ErrorState, SkeletonRows } from '@/components/ui/States'
import { Switch } from '@/components/ui/Switch'
import { useCreateUser, useUpdateUser, useUser } from '../queries/use-users'
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
 * - **Edit**: starts from the user as the server has them now
 *   (`GET /users/{id}`; Save waits for it). Name, email, Active, and a **New
 *   password** — empty keeps the current one (the save then carries no
 *   password). A stored password is never fetched, shown or pre-filled.
 *
 * A password lives only in this form while it is open, and in the one request
 * that sends it.
 *
 * On the signed-in user's own row (user, 2026-10-19): Active cannot be turned
 * off (the server would sign them out and lock them out); a new password is
 * warned about before the save and, once saved, goes to sign-in — the server
 * ends every session of a user whose password is set here, this one too; a
 * new name or email shows in the account menu at once, and a new email is the
 * one to sign in with next time.
 */
export function UserDialog({ user, onClose }: { user: User | null; onClose: () => void }) {
  const formId = useId()
  const [submitting, setSubmitting] = useState(false)
  const current = useUser(user?.id ?? null)
  const ready = user === null || current.isSuccess

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={user ? user.name : 'New user'}
      description={
        user
          ? "Update this user's name, email, password or status. Passwords are never shown here."
          : 'Add a person who can sign in to billing.'
      }
      size="md"
      dismissible={!submitting}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={submitting} disabled={!ready}>
            {user ? 'Save user' : 'Create user'}
          </Button>
        </>
      }
    >
      {user === null ? (
        <UserForm formId={formId} user={null} onSubmittingChange={setSubmitting} onDone={onClose} />
      ) : current.isSuccess ? (
        <UserForm formId={formId} user={current.data} onSubmittingChange={setSubmitting} onDone={onClose} />
      ) : current.isError ? (
        isApiError(current.error) && current.error.kind === 'not_found' ? (
          <ErrorState
            title="This user no longer exists"
            description="They may have been deleted. Close this and the list will be up to date."
          />
        ) : (
          <ErrorState onRetry={() => void current.refetch()} />
        )
      ) : (
        <SkeletonRows rows={3} columns={1} />
      )}
    </Dialog>
  )
}

function UserForm({
  formId,
  user,
  onSubmittingChange,
  onDone,
}: {
  formId: string
  /** `null` creates a new user. */
  user: User | null
  onSubmittingChange: (submitting: boolean) => void
  onDone: () => void
}) {
  const create = useCreateUser()
  const update = useUpdateUser()
  const queryClient = useQueryClient()
  const me = useCurrentUser()
  const self = user !== null && me.data?.id === user.id
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<UserFormValues | NewUserFormValues>({
    resolver: zodResolver(user ? userFormSchema : newUserFormSchema),
    defaultValues: user
      ? { name: user.name, email: user.email, password: '', isActive: user.isActive }
      : // New users start active, as in the prototype.
        { name: '', email: '', password: '', isActive: true },
  })
  const submitting = form.formState.isSubmitting
  const typedPassword = useWatch({ control: form.control, name: 'password' })
  const ownNewPassword = self && typedPassword !== ''

  const onSubmit = async (values: UserFormValues | NewUserFormValues) => {
    setFailure(null)
    onSubmittingChange(true)
    // The save ends this session: the refusals it brings read as that.
    const endsSession = self && values.password !== ''
    if (endsSession) expectSessionEnd('password-changed')
    try {
      const message = user ? await update(user.id, values) : await create(values)
      if (endsSession) {
        // The server's words, then sign-in with the new password.
        toast.success(message ?? 'User saved')
        onDone()
        clearSession('password-changed')
        return
      }
      const newEmail = self && values.email.trim().toLowerCase() !== user.email.trim().toLowerCase()
      // The server's words; ours only when it sent none.
      toast.success(
        message ?? (user ? 'User saved' : 'User created'),
        newEmail ? 'Sign in with your new email next time.' : undefined,
      )
      // The account menu shows who is signed in: a new name or email shows there now.
      if (self) void queryClient.invalidateQueries({ queryKey: currentUserQuery().queryKey })
      onDone()
    } catch (error) {
      if (endsSession) expectSessionEnd(null)
      // The server's words about a field go on the field, and anything else
      // above the form; nothing here ever repeats what was typed into the password.
      const leftover = applyServerErrors(form, error)
      setFailure(isApiError(error) && error.kind !== 'validation' ? userMessage(error) : leftover)
    } finally {
      onSubmittingChange(false)
    }
  }

  return (
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
        <FormField
          name="password"
          label={user ? 'New password' : 'Password'}
          required={user === null}
          info={
            user
              ? 'Leave it empty to keep the current password.'
              : 'The user signs in with this password, and can change it later from Change password.'
          }
        >
          {(field) => (
            <PasswordInput
              {...field}
              placeholder={user ? 'Enter a new password' : 'Enter password'}
              // A password for someone else: the browser must not fill in,
              // or offer to save over, the admin's own.
              autoComplete="new-password"
              readOnly={submitting}
            />
          )}
        </FormField>
        {ownNewPassword && (
          <div className="col-span-12">
            <Notice tone="warning">
              Saving a new password for your own account signs you out everywhere, this browser included. You
              will sign in again with the new password.
            </Notice>
          </div>
        )}
        <FormField name="isActive">
          {(field) => (
            <Switch
              label="Active"
              name={field.name}
              checked={field.value === true}
              onCheckedChange={field.onChange}
              onBlur={field.onBlur}
              disabled={submitting || self}
              {...(self
                ? { info: 'You cannot deactivate your own account: it would sign you out and lock you out.' }
                : {})}
            />
          )}
        </FormField>
      </FormGrid>
    </Form>
  )
}
