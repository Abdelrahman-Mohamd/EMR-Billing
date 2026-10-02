import type { ReactNode } from 'react'
import { Link, type LinkProps } from '@tanstack/react-router'
import { CheckCircle2, Circle } from 'lucide-react'
import { Button, buttonClass } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'

export interface Need {
  ok: boolean
  label: string
  why: string
  /** Where to fix it, when it is still needed. */
  action?: { label: string; link: LinkProps }
}

/**
 * The prototype's "Cannot add … yet": what is needed first, each with whether
 * it is there and where to add it — as Coding rules has it for procedure codes.
 */
export function NeedsDialog({
  title,
  description,
  needs,
  onClose,
}: {
  title: string
  description: string
  needs: readonly Need[]
  onClose: () => void
}): ReactNode {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={title}
      description={description}
      size="md"
      footer={
        <Button variant="quiet" onClick={onClose}>
          Close
        </Button>
      }
    >
      <ul className="grid gap-4">
        {needs.map((need) => (
          <li key={need.label} className="flex flex-wrap items-start gap-3">
            {need.ok ? (
              <CheckCircle2 size={18} className="text-success mt-0.5 flex-none" aria-hidden="true" />
            ) : (
              <Circle size={18} className="text-n400 mt-0.5 flex-none" aria-hidden="true" />
            )}
            <span className="min-w-0 flex-1">
              <span className="text-meta text-ink block font-medium">
                {need.label}
                <span className="sr-only">{need.ok ? ' — done' : ' — still needed'}</span>
              </span>
              <span className="text-micro text-n500 block">{need.why}</span>
            </span>
            {!need.ok && need.action !== undefined && (
              <Link {...need.action.link} className={buttonClass('default', 'sm')}>
                {need.action.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </Dialog>
  )
}
