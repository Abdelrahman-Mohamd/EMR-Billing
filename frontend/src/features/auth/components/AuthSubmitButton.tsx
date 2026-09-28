import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'

/**
 * The signed-out pages' main button: full width, 50px, as on the approved
 * sign-in page. While busy it shows the working label and cannot be pressed
 * again, so a request is never sent twice.
 */
export function AuthSubmitButton({
  busy,
  label,
  busyLabel,
}: {
  busy: boolean
  label: string
  busyLabel: string
}) {
  return (
    <Button
      type="submit"
      variant="primary"
      block
      loading={busy}
      iconAfter={<ArrowRight size={16} aria-hidden="true" />}
      className="mt-2 h-[50px] text-[15px]"
    >
      {busy ? busyLabel : label}
    </Button>
  )
}
