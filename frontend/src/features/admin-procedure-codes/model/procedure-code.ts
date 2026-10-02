/**
 * A procedure code as the prototype shows and edits it — its fields, and no
 * others. **Frontend-only:** no backend exists for procedure codes, so this is
 * the screen's own shape, not a contract; field names here say nothing about
 * what a server will send.
 */
export interface ProcedureCode {
  /** The CPT / HCPCS code — five letters or digits, in capitals. Also the record's identity here. */
  code: string
  description: string
  /** One of PROCEDURE_TYPES. */
  procedureType: string
  /** Units follow the 8-minute rule. */
  isTimed: boolean
  /** Modifier override (client, 2026-09-30): when on, `modifiers` replace a line's own. */
  modifierOverride: boolean
  /** Up to four, only while the override is on. */
  modifiers: readonly string[]
  /** Default fee per unit, in dollars. */
  defaultFee: number
  isActive: boolean
  /** The prototype's "New from EMR" mark on a code the EMR sent first; cleared once the code is saved. */
  isNewFromEmr: boolean
}

/** The procedure types the prototype offers. */
export const PROCEDURE_TYPES = ['Evaluation', 'Therapeutic', 'Modality', 'Supply / DME'] as const

/** The prototype's four modifier inputs. */
export const MODIFIER_SLOTS = 4
