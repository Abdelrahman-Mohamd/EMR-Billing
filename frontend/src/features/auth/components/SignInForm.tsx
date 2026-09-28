import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useRouter } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { Button } from '@/components/ui/Button'
import { Form, FormField, applyServerErrors } from '@/components/ui/Form'
import { Input } from '@/components/ui/Input'
import { Notice } from '@/components/ui/Notice'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { signIn } from '../api/auth-api'
import { signInSchema, type SignInValues } from '../schemas/sign-in-schema'
import { authActionClass } from './AuthTextButton'

/** One message for a wrong email *or* a wrong password: saying which one was
 *  wrong tells an attacker which accounts exist. */
const WRONG_CREDENTIALS = 'The email or password is incorrect.'

/**
 * Sign-in deliberately does not go through `useMutation`. TanStack Query keeps
 * a mutation's variables — here, the password — in its cache and shows them in
 * devtools until the entry is collected. React Hook Form already tracks the
 * submitting state, and the result is a navigation, not data to cache, so the
 * password lives only in the form and the one call that sends it.
 */
export function SignInForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  })
  const submitting = form.formState.isSubmitting

  const onSubmit = async (values: SignInValues) => {
    setFailure(null)
    try {
      await signIn(values)
    } catch (error) {
      if (isApiError(error) && error.kind === 'unauthenticated') {
        setFailure(WRONG_CREDENTIALS)
        // Keep the email, clear the password, and put the cursor where the fix
        // almost always is.
        form.resetField('password')
        form.setFocus('password')
      } else if (isApiError(error) && error.kind === 'validation') {
        // The server's field messages go on the fields it names.
        setFailure(applyServerErrors(form, error))
      } else {
        setFailure(userMessage(error))
      }
      return
    }
    // A new session must never be shown what the previous one had cached.
    queryClient.clear()
    router.history.push(redirectTo)
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
            // "username", not "email": it is what password managers look for
            // beside a current-password field.
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            // Read-only rather than disabled while sending: a disabled field
            // drops focus and vanishes from the tab order mid-request.
            readOnly={submitting}
          />
        )}
      </FormField>

      <FormField name="password" label="Password" required>
        {(field) => (
          <PasswordInput
            {...field}
            placeholder="Enter your password"
            autoComplete="current-password"
            readOnly={submitting}
          />
        )}
      </FormField>

      <div className="-mt-1.5 flex justify-end">
        <Link to="/forgot-password" className={authActionClass}>
          Forgot your password?
        </Link>
      </div>

      <Button
        type="submit"
        variant="primary"
        block
        loading={submitting}
        iconAfter={<ArrowRight size={16} aria-hidden="true" />}
        className="mt-2 h-[50px] text-[15px]"
      >
        {submitting ? 'Signing in…' : 'Sign in'}
      </Button>
    </Form>
  )
}
