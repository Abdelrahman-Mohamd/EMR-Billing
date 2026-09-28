import type { ReactNode } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * An inline message attached to the thing it is about — the banner above a
 * form, the line under a card. Use a toast only for something that happened
 * elsewhere or a moment ago.
 *
 * Tone means the same as everywhere else (see Badge): critical blocks,
 * warning needs attention, info is context, success confirms.
 */
export type NoticeTone = 'neutral' | 'info' | 'warning' | 'critical' | 'success'

const TONE: Record<NoticeTone, { box: string; icon: ReactNode }> = {
  neutral: { box: 'bg-n50 text-n600 shadow-[inset_3px_0_0_var(--color-n300)]', icon: <Info size={16} /> },
  info: { box: 'bg-info-bg text-info shadow-[inset_3px_0_0_var(--color-info)]', icon: <Info size={16} /> },
  warning: {
    box: 'bg-warning-bg text-warning-deep shadow-[inset_3px_0_0_var(--color-warning)]',
    icon: <AlertTriangle size={16} />,
  },
  critical: {
    box: 'bg-critical-bg text-critical shadow-[inset_3px_0_0_var(--color-critical)]',
    icon: <AlertCircle size={16} />,
  },
  success: {
    box: 'bg-success-bg text-success shadow-[inset_3px_0_0_var(--color-success)]',
    icon: <CheckCircle2 size={16} />,
  },
}

export function Notice({
  tone = 'neutral',
  title,
  children,
  action,
  className,
}: {
  tone?: NoticeTone
  /** Leads the message in bold, e.g. "Waiting for a payer audit:". */
  title?: string
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  const style = TONE[tone]
  return (
    <div
      // Critical and warning notices are announced; context is not.
      role={tone === 'critical' ? 'alert' : tone === 'warning' ? 'status' : undefined}
      className={cn(
        'rounded-card text-micro flex items-start gap-3 px-4 py-3 leading-relaxed',
        style.box,
        className,
      )}
    >
      <span aria-hidden="true" className="mt-0.5 flex-none">
        {style.icon}
      </span>
      <div className="min-w-0 flex-1">
        {title !== undefined && <strong className="font-medium">{title} </strong>}
        {children}
      </div>
      {action !== undefined && <div className="flex-none">{action}</div>}
    </div>
  )
}
