/**
 * Where to go after signing in, from a `?redirect=` value someone else may
 * have written.
 *
 * Only a path inside this application is accepted. Anything else — another
 * origin, a protocol-relative `//evil.example`, a backslash trick, a
 * `javascript:` URL — falls back to the start page. Honouring an arbitrary
 * redirect after login is an open redirect: a phishing link that lands on a
 * real sign-in page and then forwards the user somewhere hostile
 * (docs/SECURITY.md §5).
 */
const HOME = '/'
const SIGN_IN = '/login'
/** A throwaway origin to resolve against; only used to compare with itself. */
const PROBE = 'https://app.invalid'

export function safeRedirect(value: string | undefined): string {
  if (value === undefined || value === '') return HOME
  // Must be an absolute path; "//host" and "/\host" are other origins in disguise.
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return HOME
  // No control characters: some browsers strip them, turning "/\t/host" into "//host".
  if ([...value].some((char) => char.charCodeAt(0) < 0x20 || char.charCodeAt(0) === 0x7f)) return HOME

  let url: URL
  try {
    url = new URL(value, PROBE)
  } catch {
    return HOME
  }
  if (url.origin !== PROBE) return HOME

  const target = `${url.pathname}${url.search}${url.hash}`
  // Never send someone back to the page they are leaving.
  return url.pathname === SIGN_IN ? HOME : target
}
