/**
 * The modules an entry belongs to (the activity log's `log_name`), as staging
 * sends them (2026-10-20), in the order the filter offers them. The list is
 * filtered by one at a time (`?log_name=visits`; the server takes a single
 * name).
 */
export const MODULES = [
  'auth',
  'users',
  'organizations',
  'practices',
  'locations',
  'insurance_classes',
  'insurances',
  'release_buckets',
  'referring_physicians',
  'providers',
  'procedure_codes',
  'fee_schedules',
  'coding_rules',
  'patients',
  'patient_cases',
  'case_insurances',
  'case_diagnoses',
  'authorizations',
  'visits',
  'charge_lines',
  'claims',
] as const

/**
 * Labels for the modules: the names that need more than a capital letter are
 * listed; any other is shown as sent, its underscores as spaces, capitalised
 * ("case_diagnoses" → "Case diagnoses"), rather than disappearing.
 */
const MODULE_LABELS: Readonly<Record<string, string>> = {
  auth: 'Authentication',
}

export function moduleLabel(value: string): string {
  const label = MODULE_LABELS[value] ?? value.replaceAll('_', ' ')
  return label.charAt(0).toUpperCase() + label.slice(1)
}
