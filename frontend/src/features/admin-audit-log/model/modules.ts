/**
 * Labels for the modules an entry belongs to (the activity log's `log_name`).
 * The names the backend has been seen to send that need more than a capital
 * letter are listed; any other is shown as sent, capitalised
 * ("organizations" → "Organizations"), rather than disappearing.
 */
const MODULE_LABELS: Readonly<Record<string, string>> = {
  auth: 'Authentication',
}

export function moduleLabel(value: string): string {
  return MODULE_LABELS[value] ?? value.charAt(0).toUpperCase() + value.slice(1)
}
