import type { ProcedureCode } from '../model/procedure-code'

/**
 * TEMPORARY DEVELOPMENT DATA — not records from any system.
 *
 * The prototype's procedure codes, so the screen can be seen with content in
 * development and tests. Loaded only when `__MOCK_DATA__` is true (see
 * `procedure-code-store.ts`), so a production build never contains it.
 */
const row = (
  code: string,
  description: string,
  isTimed: boolean,
  defaultFee: number,
  procedureType: string,
  extra: Partial<ProcedureCode> = {},
): ProcedureCode => ({
  code,
  description,
  procedureType,
  isTimed,
  modifierOverride: false,
  modifiers: [],
  defaultFee,
  isActive: true,
  isNewFromEmr: false,
  ...extra,
})

export const SAMPLE_PROCEDURE_CODES: readonly ProcedureCode[] = [
  row('97161', 'PT evaluation, low complexity', false, 120, 'Evaluation'),
  row('97162', 'PT evaluation, moderate complexity', false, 140, 'Evaluation'),
  row('97163', 'PT evaluation, high complexity', false, 160, 'Evaluation'),
  row('97164', 'PT re-evaluation', false, 90, 'Evaluation'),
  row('97110', 'Therapeutic exercise', true, 35, 'Therapeutic'),
  row('97112', 'Neuromuscular re-education', true, 38, 'Therapeutic'),
  row('97116', 'Gait training', true, 32, 'Therapeutic'),
  row('97140', 'Manual therapy techniques', true, 34, 'Therapeutic', {
    modifierOverride: true,
    modifiers: ['GP', '59'],
  }),
  row('97530', 'Therapeutic activities', true, 40, 'Therapeutic'),
  row('97535', 'Self-care / home management training', true, 36, 'Therapeutic'),
  row('97035', 'Ultrasound therapy', true, 18, 'Modality'),
  row('97010', 'Hot or cold packs', false, 12, 'Modality'),
  row('97014', 'Electrical stimulation, unattended', false, 16, 'Modality'),
  row('G0283', 'Electrical stimulation, unattended (Medicare)', false, 16, 'Modality'),
  row('97750', 'Physical performance test', true, 45, 'Evaluation'),
  row('97033', 'Iontophoresis', true, 0, 'Modality', { isNewFromEmr: true }),
  row('97039', 'Unlisted modality (retired locally)', false, 20, 'Modality', { isActive: false }),
]
