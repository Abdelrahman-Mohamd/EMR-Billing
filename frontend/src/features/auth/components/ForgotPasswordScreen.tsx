import { useRef, useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { buttonClass } from '@/components/ui/Button'
import { AuthLayout } from './AuthLayout'
import { authActionClass } from './AuthTextButton'
import { NewPasswordForm } from './NewPasswordForm'
import { SendCodeForm } from './SendCodeForm'
import { VerifyCodeForm } from './VerifyCodeForm'

/**
 * Forgot password: send a code to the email, verify it, set a new password.
 * Three backend operations, one screen.
 *
 * The flow holds only what the next request needs — the email after step 1,
 * the email and code after step 2 — in memory, never in the URL or storage.
 * Nothing from a response is used: whether verifying returns a token, or
 * resetting signs the user in, is not known, so the flow ends by sending the
 * user to sign in with the new password.
 */
type Step =
  | { name: 'email'; email: string }
  | { name: 'code'; email: string }
  | { name: 'password'; email: string; otp: string }
  | { name: 'done' }

const light = (text: string) => <span className="text-n500 font-light">{text}</span>

export function ForgotPasswordScreen() {
  const [step, setStep] = useState<Step>({ name: 'email', email: '' })
  const titleRef = useRef<HTMLHeadingElement>(null)

  // A new step replaces the form under the user's focus. Moving focus to the
  // new heading tells a screen reader where they are, and a keyboard user
  // starts from the top of the step.
  const goTo = (next: Step) => {
    setStep(next)
    requestAnimationFrame(() => titleRef.current?.focus())
  }

  const screen: { documentTitle: string; title: ReactNode; lede: ReactNode; body: ReactNode } = (() => {
    switch (step.name) {
      case 'email':
        return {
          documentTitle: 'Reset password',
          title: <>Reset {light('your password')}</>,
          lede: 'Enter the email you sign in with, and we will send you a code.',
          body: <SendCodeForm defaultEmail={step.email} onSent={(email) => goTo({ name: 'code', email })} />,
        }
      case 'code':
        return {
          documentTitle: 'Enter the code',
          title: <>Check {light('your email')}</>,
          // Worded so it does not confirm whether an account exists.
          lede: 'If this email has an account, we sent it a code. Enter it below.',
          body: (
            <VerifyCodeForm
              email={step.email}
              onVerified={(otp) => goTo({ name: 'password', email: step.email, otp })}
              onChangeEmail={() => goTo({ name: 'email', email: step.email })}
            />
          ),
        }
      case 'password':
        return {
          documentTitle: 'Choose a new password',
          title: <>Choose {light('a new password')}</>,
          lede: 'You will use it the next time you sign in.',
          body: (
            <NewPasswordForm
              email={step.email}
              otp={step.otp}
              onReset={() => goTo({ name: 'done' })}
              onStartOver={() => goTo({ name: 'email', email: step.email })}
            />
          ),
        }
      case 'done':
        return {
          documentTitle: 'Password reset',
          title: <>Password {light('reset')}</>,
          lede: 'Your password has been changed. Sign in with your new password.',
          body: (
            <Link to="/login" className={buttonClass('primary', 'md', 'mt-8 h-[50px] w-full text-[15px]')}>
              Sign in
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          ),
        }
    }
  })()

  return (
    <AuthLayout
      documentTitle={screen.documentTitle}
      title={screen.title}
      lede={screen.lede}
      titleRef={titleRef}
    >
      {screen.body}
      {/* One way back, in the same place on every step. */}
      {step.name !== 'done' && (
        <div className="border-rule-row mt-8 border-t pt-6 text-center">
          <Link to="/login" className={`${authActionClass} inline-flex items-center gap-1.5`}>
            <ArrowLeft size={14} aria-hidden="true" />
            Back to sign in
          </Link>
        </div>
      )}
    </AuthLayout>
  )
}
