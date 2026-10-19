/**
 * Public surface of the auth feature. Other features and routes import from
 * here only (docs/FRONTEND_ARCHITECTURE.md §3).
 */
export { SignInScreen } from './components/SignInScreen'
export { ForgotPasswordScreen } from './components/ForgotPasswordScreen'
// The signed-in person's menu (Change password, Sign out), for the app shell.
export { AccountMenu } from './components/AccountMenu'
export { safeRedirect } from './model/safe-redirect'
// Who is signed in — for a record of who did something (EMR integration requests).
export { currentUserQuery, useCurrentUser } from './queries/use-current-user'
// The app shell: a session that ends by itself goes to sign-in, saying why.
export { useSessionEndRedirect } from './queries/use-session-end'
