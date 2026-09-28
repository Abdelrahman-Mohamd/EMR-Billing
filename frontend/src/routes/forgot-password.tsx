import { createFileRoute } from '@tanstack/react-router'
import { ForgotPasswordScreen } from '@/features/auth'

/** Signed out, like `/login`: no rail. Nothing about the flow goes in the URL. */
export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordScreen,
})
