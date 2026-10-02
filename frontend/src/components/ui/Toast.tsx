import { useEffect, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useToastStore, type Toast as ToastData, type ToastTone } from '@/stores/toast-store'

const ICON: Record<ToastTone, ReactNode> = {
  success: <CheckCircle2 size={18} />,
  error: <XCircle size={18} />,
  warning: <AlertTriangle size={18} />,
  info: <Info size={18} />,
}

const TONE: Record<ToastTone, string> = {
  success: 'bg-success-bg text-success',
  error: 'bg-critical-bg text-critical',
  warning: 'bg-warning-bg text-warning',
  info: 'bg-info-bg text-info',
}

/** How long a toast stays. Errors stay longer because they carry instructions. */
const DURATION: Record<ToastTone, number> = { success: 5000, info: 5000, warning: 7000, error: 9000 }

/** Mounted once, in the app shell. */
export function Toaster() {
  const toasts = useToastStore((state) => state.toasts)
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[100] flex flex-col gap-2">
      {toasts.map((item) => (
        <ToastItem key={item.id} toast={item} />
      ))}
    </div>
  )
}

function ToastItem({ toast }: { toast: ToastData }) {
  const dismiss = useToastStore((state) => state.dismiss)

  // A timer is outside React, which is what an effect is for.
  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), DURATION[toast.tone])
    return () => clearTimeout(timer)
  }, [toast.id, toast.tone, dismiss])

  return (
    <div
      // An error interrupts; everything else waits for a pause.
      role={toast.tone === 'error' ? 'alert' : 'status'}
      className="animate-toast-in rounded-card bg-canvas shadow-popover ring-rule-structural pointer-events-auto flex w-[min(400px,calc(100vw-32px))] items-start gap-3 p-3.5 ring-1"
    >
      <span
        aria-hidden="true"
        className={cn('grid size-8 flex-none place-items-center rounded-md', TONE[toast.tone])}
      >
        {ICON[toast.tone]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-meta text-ink leading-tight font-medium">{toast.title}</p>
        {toast.description !== undefined && (
          <p className="text-micro text-n500 mt-[3px] leading-snug">{toast.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        aria-label="Dismiss"
        // The after: box widens the hit area to a comfortable touch target without changing the drawn size.
        className="text-n400 hover:bg-n50 hover:text-ink relative grid size-6 flex-none place-items-center rounded-sm after:absolute after:-inset-2 after:content-['']"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  )
}
