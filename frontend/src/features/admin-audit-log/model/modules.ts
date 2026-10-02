/**
 * The modules an audit entry can belong to, and the ones the prototype's
 * Audit log offers as filters — in the prototype's order, with its labels.
 */
export const AUDIT_MODULES = [
  { value: 'CHARGES', label: 'Charges' },
  { value: 'BILLING', label: 'Billing' },
  { value: 'PAYMENTS', label: 'Payments' },
  { value: 'DENIALS', label: 'Denial Management' },
  { value: 'AR', label: 'AR Follow-up' },
  { value: 'PATIENT', label: 'Patient' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'INTEGRATION', label: 'EMR Integration' },
  { value: 'MONTHEND', label: 'Month End' },
] as const

/** A module's label; an unknown module shows as sent rather than disappearing. */
export function moduleLabel(value: string): string {
  return AUDIT_MODULES.find((module) => module.value === value)?.label ?? value
}
