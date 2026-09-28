import { create } from 'zustand'

/**
 * The application's notification queue. Client state with no server origin,
 * so it belongs in Zustand (docs/FRONTEND_ARCHITECTURE.md §6).
 *
 * A toast carries a short message only. Never put patient, claim or payment
 * detail in one: toasts are read aloud by screen readers, stay on screen
 * during a screen share, and are the easiest thing in the app to shoulder-surf.
 */
export type ToastTone = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  tone: ToastTone
  title: string
  description?: string
}

interface ToastState {
  toasts: Toast[]
  show: (toast: Omit<Toast, 'id'>) => string
  dismiss: (id: string) => void
  clear: () => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show: (toast) => {
    const id = crypto.randomUUID()
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }))
    return id
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
  clear: () => set({ toasts: [] }),
}))

/**
 * Call from an event handler or a mutation callback:
 *   toast.success('Claim released')
 * Reading the store outside React keeps this usable from non-component code.
 */
export const toast = {
  success: (title: string, description?: string) => showToast('success', title, description),
  error: (title: string, description?: string) => showToast('error', title, description),
  warning: (title: string, description?: string) => showToast('warning', title, description),
  info: (title: string, description?: string) => showToast('info', title, description),
}

function showToast(tone: ToastTone, title: string, description?: string): string {
  return useToastStore.getState().show({ tone, title, ...(description === undefined ? {} : { description }) })
}
