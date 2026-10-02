import type { BillingException } from '../model/billing-exception'

/**
 * TEMPORARY DEVELOPMENT DATA — the prototype's open billing exceptions as it
 * seeds them, with its wording, owners and dates, so the screen can be seen
 * with content in development and tests. They point at the development mocks'
 * ids: patients and cases (`features/patients`), Aetna (insurance 3), Caleb
 * Wright (provider 6), Leonard Voss (referring physician 5) and code 97033.
 *
 * Loaded only when `__MOCK_DATA__` is true (see `exceptions-store.ts`), so a
 * production build never contains it.
 */
const open = (
  id: string,
  values: Omit<BillingException, 'id' | 'practiceId' | 'status' | 'resolvedAt' | 'resolvedBy'>,
): BillingException => ({ id, practiceId: 1, status: 'Open', resolvedAt: null, resolvedBy: null, ...values })

const session = (patientId: string, recordId: string) =>
  ({ kind: 'visit', patientId, dos: '2026-09-14', recordId }) as const

const DETECTED = '2026-09-14T17:30'
const DUE = '2026-09-17'

export const SAMPLE_EXCEPTIONS: readonly BillingException[] = [
  open('ex-1', {
    level: 'Patient',
    trigger: 'Character limit exceeded',
    detail: 'Patient name is 41 characters (limit 30).',
    record: session('p25', 'EMR-N-5590208'),
    fix: { type: 'patient-length', patientId: 'p25' },
    detectedAt: DETECTED,
    owner: null,
    due: DUE,
  }),
  open('ex-2', {
    level: 'Session',
    trigger: 'Missing mandatory rendering NPI',
    detail: 'Caleb Wright, PT has no NPI on file.',
    record: session('p21', 'EMR-N-5590207'),
    fix: { type: 'provider-npi', providerId: 6 },
    detectedAt: DETECTED,
    owner: null,
    due: DUE,
  }),
  open('ex-3', {
    level: 'Charge',
    trigger: 'New CPT code charged at $0.00',
    detail: '97033 Iontophoresis is missing from the Aetna and default fee schedules.',
    record: session('p14', 'EMR-N-5590206'),
    fix: { type: 'fee', procedureCode: '97033', insuranceId: 3 },
    detectedAt: DETECTED,
    owner: 'Tomás Herrera',
    due: DUE,
  }),
  open('ex-4', {
    level: 'Case',
    trigger: 'Invalid / dummy referring NPI',
    detail: 'Leonard Voss, MD carries NPI 9999999999.',
    record: session('p12', 'EMR-N-5590205'),
    fix: { type: 'referrer', referrerId: 5, caseId: 'p12-case' },
    detectedAt: DETECTED,
    owner: null,
    due: DUE,
  }),
  open('ex-5', {
    level: 'Patient',
    trigger: 'ZIP code mismatch with state',
    detail: 'ZIP 07030 belongs to NJ, but the state is NY.',
    record: session('p11', 'EMR-N-5590204'),
    fix: { type: 'patient-address', patientId: 'p11' },
    detectedAt: DETECTED,
    owner: null,
    due: DUE,
  }),
  open('ex-6', {
    level: 'Patient',
    trigger: 'Invalid patient phone number (dummy data)',
    detail: 'Phone 000-000-0000 is placeholder data.',
    record: session('p10', 'EMR-N-5590203'),
    fix: { type: 'patient-phone', patientId: 'p10' },
    detectedAt: DETECTED,
    owner: null,
    due: DUE,
  }),
  open('ex-7', {
    level: 'Payment',
    trigger: 'Unmapped payer remittance data',
    detail: 'Claim control number HPT-26-099102 was not found — $26.82 unapplied.',
    record: { kind: 'era', control: '60054-835-260909', payerName: 'Aetna' },
    fix: { type: 'era-claim' },
    detectedAt: '2026-09-09T07:10',
    owner: 'Keisha Morgan',
    due: '2026-09-16',
  }),
]
