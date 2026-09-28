import { AuthLayout } from './AuthLayout'
import { SignInForm } from './SignInForm'

/** The sign-in page: the shared signed-out frame around the sign-in form. */
export function SignInScreen({ redirectTo }: { redirectTo: string }) {
  return (
    <AuthLayout
      documentTitle="Sign in"
      title={
        <>
          Sign in <span className="text-n500 font-light">to Billing</span>
        </>
      }
      lede="Use your email and password."
    >
      <SignInForm redirectTo={redirectTo} />
    </AuthLayout>
  )
}
