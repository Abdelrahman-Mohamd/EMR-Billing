import { Mail } from 'lucide-react'
import { AuthTextButton } from './AuthTextButton'

/**
 * The email a forgot-password step is working with, shown once as a quiet
 * row instead of inside a sentence — a long address no longer breaks the copy
 * — with the way to change it right beside it.
 */
export function AuthEmailRow({
  email,
  onChange,
  disabled = false,
}: {
  email: string
  onChange?: () => void
  disabled?: boolean
}) {
  return (
    <div className="border-rule-structural bg-paper flex min-h-11 items-center gap-2.5 rounded-md border px-3 py-2">
      <Mail size={16} aria-hidden="true" className="text-n500 flex-none" />
      <span className="text-meta text-ink min-w-0 flex-1 font-medium [overflow-wrap:anywhere]">{email}</span>
      {onChange !== undefined && (
        <AuthTextButton
          onClick={onChange}
          disabled={disabled}
          aria-label="Change email"
          className="flex-none"
        >
          Change
        </AuthTextButton>
      )}
    </div>
  )
}
