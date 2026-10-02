import type { CodingRule } from '../model/coding-rule'

/**
 * TEMPORARY DEVELOPMENT DATA — not records from any system.
 *
 * The prototype's four coding rules, so the screen can be seen with content in
 * development and tests. They point at the development insurances mock's ids
 * (1 Medicare Part B and 4 UnitedHealthcare at Harborline; 9 Medicare Part B
 * at Northgate) and the procedure codes sample. Loaded only when
 * `__MOCK_DATA__` is true (see `coding-rule-store.ts`), so a production build
 * never contains them.
 */
export const SAMPLE_CODING_RULES: readonly CodingRule[] = [
  {
    id: 'sample-1',
    type: 'Replace',
    fromCode: '97014',
    toCode: 'G0283',
    scope: { kind: 'insurance', insuranceId: 1 },
    note: 'Medicare requires G0283 for unattended e-stim.',
    isActive: true,
  },
  {
    id: 'sample-2',
    type: 'Drop',
    fromCode: '97010',
    toCode: '',
    scope: { kind: 'default' },
    note: 'Hot/cold packs are bundled for most payers.',
    isActive: true,
  },
  {
    id: 'sample-3',
    type: 'Replace',
    fromCode: '97014',
    toCode: 'G0283',
    scope: { kind: 'insurance', insuranceId: 9 },
    note: 'Northgate Medicare contract.',
    isActive: true,
  },
  {
    id: 'sample-4',
    type: 'Drop',
    fromCode: '97035',
    toCode: '',
    scope: { kind: 'insurance', insuranceId: 4 },
    note: 'Paused — UHC ultrasound policy under review.',
    isActive: false,
  },
]
