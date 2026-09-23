/* The business rules of the PRD, simulated in memory.
   Each function names the PRD section it implements. Where the PRD is silent
   the behaviour is the simplest reasonable one and is listed as an
   assumption in PROTOTYPE_COVERAGE.md. */

const E = (() => {
  const f = (c, id) => S.find(c, id)

  // ---------------------------------------------------------------- constants
  /** Character caps used by the Patient/Session exceptions (§4.4). The PRD
   *  gives no values — these are placeholders (assumption A-P09). */
  const LIMITS = { name: 30, addressLine: 35 }
  const DUMMY_NPIS = ['9999999999', '1234567890', '0000000000', '1111111111']
  const DUMMY_PHONES = ['000-000-0000', '111-111-1111', '999-999-9999', '123-456-7890']
  const ZIP_STATES = [
    [10, 27, 'MA'], [28, 29, 'RI'], [30, 38, 'NH'], [60, 69, 'CT'], [70, 89, 'NJ'],
    [100, 149, 'NY'], [150, 196, 'PA'], [197, 199, 'DE'], [200, 205, 'DC'], [206, 219, 'MD'],
  ]

  /** Scrubbing validation matrix, in the order the PRD lists it (§6.2). */
  const HOLDS = {
    missing: { label: 'Missing data', check: 'Data integrity', source: 'System default' },
    hold: { label: 'Provider hold', check: 'Provider claim hold', source: 'Provider profile' },
    auth: { label: 'Authorization hold', check: 'Authorization', source: 'Insurance settings' },
    cred: { label: 'Credentialing hold', check: 'Credentialing', source: 'Provider profile' },
    payer: { label: 'Payer rule hold', check: 'Payer rules', source: 'Payer / insurance settings' },
    coding: { label: 'Coding issue hold', check: 'AI coding quality', source: 'AI add-on' },
    audit: { label: 'Audit hold', check: 'Payer audit', source: 'Insurance settings' },
    manual: { label: 'Release bucket', check: 'Manual release required', source: 'Insurance settings' },
  }
  const HOLD_ORDER = ['missing', 'hold', 'auth', 'cred', 'payer', 'coding', 'audit', 'manual']

  const REJECTIONS = [
    { code: 'A7:33', reason: 'Subscriber and subscriber ID not found' },
    { code: 'A7:164', reason: 'Entity’s contract/member number is invalid' },
    { code: 'A7:562', reason: 'Entity’s National Provider Identifier (NPI) is invalid' },
    { code: 'A3:21', reason: 'Missing or invalid information (Box 17 referring provider)' },
  ]

  // ---------------------------------------------------------------- lookups
  const pc = (id) => f('procedureCodes', id)
  const pcByCode = (code) => DB.procedureCodes.find((p) => p.code === code) || null
  const coverages = (caseId) => DB.coverages.filter((c) => c.caseId === caseId).sort((a, b) => a.rank - b.rank)
  const coverage = (caseId, rank) => DB.coverages.find((c) => c.caseId === caseId && c.rank === rank) || null
  const insOf = (cov) => (cov ? f('insurances', cov.insuranceId) : null)
  const primaryIns = (caseId) => insOf(coverage(caseId, 1))

  // ---------------------------------------------------------------- insurance classes & effective rules (PRD V2 §10.3, CH-02)
  /** Rules a class defines and an insurance may override. */
  const RULES = [
    { key: 'authRequired', label: 'Authorization required' },
    { key: 'injuryDateRequired', label: 'Injury date required' },
    { key: 'specialtyModifiers', label: 'Apply specialty modifiers' },
    { key: 'acceptAssignment', label: 'Accept assignment' },
    { key: 'icdVersion', label: 'ICD version' },
  ]
  const classOf = (ins) => (ins && ins.classId ? f('insuranceClasses', ins.classId) : null)
  /** Effective value = the insurance's own value when set, otherwise its class's
   *  ("Effective value = COALESCE(insurance, class)"). The insurance hold exists
   *  on the insurance only. */
  const eff = (ins, key) => {
    if (!ins) return null
    if (key === 'insuranceHold') return !!ins.insuranceHold
    if (ins[key] !== null && ins[key] !== undefined) return ins[key]
    const cls = classOf(ins)
    return cls ? cls[key] : null
  }
  const inherited = (ins, key) => !!ins && (ins[key] === null || ins[key] === undefined)
  const bucketOf = (claim) => (claim && claim.bucketId ? f('releaseBuckets', claim.bucketId) : null)
  const linesOfVisit = (visitId) => DB.chargeLines.filter((l) => l.visitId === visitId && !l.dropped && !l.void)
  const claimLines = (claim) => claim.lineIds.map((id) => f('chargeLines', id)).filter((l) => l && !l.dropped)
  const claimTotal = (claim) => U.sum(claimLines(claim), (l) => l.amount)
  const claimsOfVisit = (visitId) => DB.claims.filter((c) => c.visitId === visitId)
  const activeClaimOfVisit = (visitId) =>
    claimsOfVisit(visitId).find((c) => !['Replaced', 'Voided', 'Cancelled'].includes(c.status) && c.rank === 1) || null
  const paymentsOfClaim = (claimId) => DB.payments.filter((p) => p.claimId === claimId)
  const claimPaid = (claim) =>
    U.round(U.sum(paymentsOfClaim(claim.id).filter((p) => p.kind === 'Insurance payment'), (p) => p.amount) -
      U.sum(paymentsOfClaim(claim.id).filter((p) => p.kind === 'Reversal' && p.reverses && f('payments', p.reverses)?.kind === 'Insurance payment'), (p) => p.amount))
  const claimBalance = (claim) => U.sum(claimLines(claim).filter((l) => !l.void), (l) => l.balIns + l.balPat)
  const claimInsBalance = (claim) => U.sum(claimLines(claim).filter((l) => !l.void), (l) => l.balIns)
  const visitTotal = (visit) => U.sum(linesOfVisit(visit.id), (l) => l.amount)
  const dxLabel = (code) => {
    const d = DB.icd10.find((x) => x.code === code)
    return d ? d.desc : ''
  }
  const carcKnown = (code) => DB.carc.some((c) => c.code === code)
  const carcDesc = (code) => (DB.carc.find((c) => c.code === code) || {}).desc || 'Unmapped reason code'

  // ---------------------------------------------------------------- pricing (§3.4, §10.3)
  const feeRow = (insId, pcId, dos) =>
    DB.feeSchedules.find(
      (r) => r.insuranceId === insId && r.procedureCodeId === pcId && (!r.from || r.from <= dos) && (!r.to || r.to >= dos),
    ) || null

  /** Payer-specific fee schedule overrides the default fee (§3.4). */
  const price = (pcId, units, insId, dos) => {
    const row = insId ? feeRow(insId, pcId, dos) : null
    const code = pc(pcId)
    if (row) {
      return { rate: row.billed, amount: U.round(row.billed * units), source: 'payer', row }
    }
    const rate = code ? code.defaultFee || 0 : 0
    return { rate, amount: U.round(rate * units), source: 'default', row: null }
  }
  const priceLine = (line, visit) => {
    const c = S.caseOf(visit)
    const ins = primaryIns(c.id)
    const p = price(line.procedureCodeId, line.units, ins ? ins.id : null, visit.dos)
    line.amount = p.amount
    line.rate = p.rate
    line.priceSource = p.source
    // A line that has never been billed carries its full amount as insurance balance.
    if (!line.billed) {
      line.balIns = p.amount
      line.balPat = 0
    }
    return p
  }
  const repriceVisit = (visit) => linesOfVisit(visit.id).forEach((l) => priceLine(l, visit))

  // ---------------------------------------------------------------- authorizations (§3.2, §10.4)
  const authRemaining = (a) => Math.max(0, a.qty - a.used)
  const authStatus = (a) => {
    if (DB.today < a.start) return { label: 'Not started', tone: 'info' }
    if (DB.today > a.end) return { label: 'Expired', tone: 'inert' }
    if (authRemaining(a) === 0) return { label: 'Exhausted', tone: 'critical' }
    if (authRemaining(a) <= 1) return { label: 'Last visit', tone: 'warning' }
    return { label: 'Active', tone: 'success' }
  }
  /** A usable authorization on the primary coverage: DOS inside the range, remaining > 0. */
  const authUsable = (visit) => {
    const cov = coverage(visit.caseId, 1)
    if (!cov) return null
    if (visit.authorizationId) {
      const linked = f('authorizations', visit.authorizationId)
      if (linked) return linked
    }
    return (
      DB.authorizations.find(
        (a) => a.coverageId === cov.id && a.start <= visit.dos && a.end >= visit.dos && authRemaining(a) > 0,
      ) || null
    )
  }

  // ---------------------------------------------------------------- providers
  /** Provider claim hold. V2 has one date and delays every visit before it (§10.3);
   *  the client (2026-09-23) asked for a window — a start and an end date — and for
   *  the locations and insurances it covers. While today is inside the window, the
   *  provider's work in it is stopped on both sides: visits wait in Delayed and
   *  unsent claims stop in the Provider hold. Naming no location or insurance means
   *  all of them. When the end date passes, everything flows normally again (A-P56). */
  const holdRunning = (prov) =>
    !!(prov && prov.claimHoldUntil && DB.today <= prov.claimHoldUntil && (!prov.claimHoldFrom || DB.today >= prov.claimHoldFrom))
  const holdCovers = (prov, dos, locationId, insId) => {
    if (!holdRunning(prov)) return false
    if (prov.claimHoldFrom ? dos < prov.claimHoldFrom : false) return false
    if (dos > prov.claimHoldUntil) return false
    const locs = prov.claimHoldLocations || []
    const inss = prov.claimHoldInsurances || []
    if (locs.length && !locs.includes(locationId)) return false
    if (inss.length && !inss.includes(insId)) return false
    return true
  }
  const holdWindow = (prov) => (prov.claimHoldFrom ? `${U.date(prov.claimHoldFrom)} – ${U.date(prov.claimHoldUntil)}` : `until ${U.date(prov.claimHoldUntil)}`)
  const holdScope = (prov) => {
    const locs = (prov.claimHoldLocations || []).map((id) => (f('locations', id) || {}).name).filter(Boolean)
    const inss = (prov.claimHoldInsurances || []).map((id) => (f('insurances', id) || {}).name).filter(Boolean)
    if (!locs.length && !inss.length) return 'every location and payer'
    return [locs.length ? locs.join(', ') : 'every location', inss.length ? inss.join(', ') : 'every payer'].join(' · ')
  }
  const holdText = (prov) => `on claim hold ${holdWindow(prov)} (${holdScope(prov)}) — ${prov.claimHoldReason}`
  /** A visit is held when the hold covers its date of service, its location and the
   *  payer that would be billed. */
  const holdActive = (prov, v) => {
    const c = v && S.caseOf(v)
    const cov = c ? coverage(c.id, 1) : null
    return holdCovers(prov, v.dos, v.locationId, cov ? cov.insuranceId : null)
  }
  const enrollment = (prov, insId) => (prov ? (prov.enrollments || []).find((e) => e.insuranceId === insId) : null)

  // ---------------------------------------------------------------- billing exceptions (§4.4)
  const zipState = (zip) => {
    const p = parseInt(String(zip || '').slice(0, 3), 10)
    const hit = ZIP_STATES.find(([a, b]) => p >= a && p <= b)
    return hit ? hit[2] : null
  }
  const npiValid = (npi) => /^\d{10}$/.test(npi || '') && !DUMMY_NPIS.includes(npi)

  const detectExceptions = (v) => {
    const out = []
    const c = S.caseOf(v)
    const p = S.patientOf(c)
    const cov = coverage(c.id, 1)
    const ins = insOf(cov)
    const ref = f('referrers', c.referrerId)
    const prov = f('providers', v.treatingProviderId)
    const add = (key, level, trigger, detail, fix) => out.push({ key, level, trigger, detail, fix })

    // Patient level
    const dummy = [p.phoneCell, p.phoneHome].find((ph) => DUMMY_PHONES.includes(ph))
    if (dummy) add('pt-phone', 'Patient', 'Invalid patient phone number (dummy data)', `Phone ${dummy} is placeholder data.`, { type: 'patient-phone', patientId: p.id })
    const zs = zipState(p.address.zip)
    if (p.address.zip && zs && zs !== p.address.state)
      add('pt-zip', 'Patient', 'ZIP code mismatch with state', `ZIP ${p.address.zip} belongs to ${zs}, but the state is ${p.address.state}.`, { type: 'patient-address', patientId: p.id })
    const fullName = `${p.firstName} ${p.middleName ? p.middleName + ' ' : ''}${p.lastName}`
    if (fullName.length > LIMITS.name || (p.address.line1 || '').length > LIMITS.addressLine)
      add('pt-len', 'Patient', 'Character limit exceeded',
        fullName.length > LIMITS.name
          ? `Patient name is ${fullName.length} characters (limit ${LIMITS.name}).`
          : `Address line is ${p.address.line1.length} characters (limit ${LIMITS.addressLine}).`,
        { type: 'patient-length', patientId: p.id })

    // Case level
    const needsInjury = ['Employment Related', 'Auto'].includes(c.injuryType) || (ins && eff(ins, 'injuryDateRequired'))
    if (needsInjury && !c.injuryDate)
      add('case-injury', 'Case', 'Missing mandatory EMR case fields', 'Injury date is missing.', { type: 'case', caseId: c.id })
    if (ins && ins.type === 'Workers Comp' && !c.employmentStatus)
      add('case-employment', 'Case', 'Missing mandatory EMR case fields', 'Employment status is missing.', { type: 'case', caseId: c.id })
    if (cov && cov.subscriber && (!cov.subscriber.name || !cov.subscriber.dob))
      add('case-subscriber', 'Case', 'Missing mandatory EMR case fields', 'Primary insurance subscriber details are incomplete.', { type: 'coverage', coverageId: cov.id })
    if (!ref)
      add('case-referrer', 'Case', 'Missing mandatory EMR case fields', 'No referring physician on the case.', { type: 'case', caseId: c.id })
    else if (!npiValid(ref.npi))
      add('case-refnpi', 'Case', 'Invalid / dummy referring NPI', `${ref.name} carries NPI ${ref.npi || '(blank)'}.`, { type: 'referrer', referrerId: ref.id, caseId: c.id })

    // Session level
    if (prov && !npiValid(prov.npi))
      add('ses-npi', 'Session', 'Missing mandatory rendering NPI', `${S.provName(prov)} has ${prov.npi ? 'an invalid NPI' : 'no NPI'} on file.`, { type: 'provider-npi', providerId: prov.id })

    // Charge level
    linesOfVisit(v.id).forEach((l) => {
      if (!l.amount) {
        const code = pc(l.procedureCodeId)
        add(`chg-zero-${l.id}`, 'Charge', 'New CPT code charged at $0.00',
          `${code.code} ${code.description} is missing from the ${ins ? ins.name : 'payer'} and default fee schedules.`,
          { type: 'fee', procedureCodeId: code.id, insuranceId: ins ? ins.id : null, lineId: l.id })
      }
    })
    return out
  }

  /** Keep the exceptions register in step with what the visit still fails. */
  const syncExceptions = (v, found) => {
    const open = DB.exceptions.filter((x) => x.visitId === v.id && x.status === 'Open')
    open.forEach((x) => {
      if (!found.some((fd) => fd.key === x.key)) {
        x.status = 'Resolved'
        x.resolvedAt = S.now()
        x.resolvedBy = S.session.userId || 'svc-emr'
        S.log('Billing exception resolved', { module: 'CHARGES', entityType: 'exception', entityId: x.id, detail: x.trigger })
      }
    })
    found.forEach((fd) => {
      if (!open.some((x) => x.key === fd.key)) {
        const ex = {
          id: U.id('ex'), key: fd.key, level: fd.level, trigger: fd.trigger, detail: fd.detail, fix: fd.fix,
          visitId: v.id, practiceId: S.patientOfVisit(v).practiceId, status: 'Open', detectedAt: S.now(),
          wi: S.workItem({ priority: fd.level === 'Charge' ? 'High' : 'Medium', due: U.addDays(DB.today, 2), next: 'Correct the source record' }),
        }
        DB.exceptions.unshift(ex)
        S.log('Billing exception raised', { module: 'CHARGES', entityType: 'exception', entityId: ex.id, detail: `${fd.level}: ${fd.trigger}` })
      }
    })
  }

  // ---------------------------------------------------------------- intake (§4.3, §4.4, §10.5)
  /** Where a visit lands on arrival or re-evaluation. Order is an assumption
   *  (A-P01): incomplete profile → exceptions → provider hold → authorization. */
  const intake = (v) => {
    const c = S.caseOf(v)
    const cov = coverage(c.id, 1)
    const ins = insOf(cov)
    const prov = f('providers', v.treatingProviderId)
    const before = v.status
    v.incompleteReason = ''
    v.delayReason = ''
    if (!v.manualPend) v.pendReason = ''

    if ((prov && prov.draft) || (ins && ins.draft)) {
      v.status = 'Incomplete'
      v.incompleteReason = prov && prov.draft ? `Draft provider profile: ${S.provName(prov)}` : `Draft insurance profile: ${ins.name}`
      syncExceptions(v, [])
    } else {
      const found = detectExceptions(v)
      syncExceptions(v, found)
      if (found.length) v.status = 'Exception'
      else if (holdActive(prov, v)) {
        v.status = 'Delayed'
        v.delayReason = `${S.provName(prov)} is ${holdText(prov)}`
      } else if (v.manualPend) v.status = 'Pended'
      else if (!cov) {
        v.status = 'Pended'
        v.pendReason = 'No primary insurance on the case'
      } else if (eff(ins, 'authRequired') && !authUsable(v)) {
        v.status = 'Pended'
        v.pendReason = 'No authorization available'
      } else v.status = 'Review'
    }
    if (before !== v.status && before) {
      S.log(`Visit moved to ${v.status === 'Review' ? 'Charge Review' : v.status}`, {
        module: 'CHARGES', entityType: 'visit', entityId: v.id,
        detail: v.pendReason || v.delayReason || v.incompleteReason || '',
      })
    }
    return v.status
  }

  // ---------------------------------------------------------------- coding rules (§6.1)
  /** Coding-rule precedence: the payer's own rule, then its insurance class, then the default.
   *  Class-level rules come from the meeting notes; V2 §6.1 names default and payer rules only. */
  const ruleFor = (code, insId) => {
    const active = DB.codingRules.filter((r) => r.active && r.fromCode === code)
    const ins = f('insurances', insId)
    const classScope = ins && ins.classId ? `class:${ins.classId}` : null
    return (
      active.find((r) => r.scope === insId) ||
      (classScope ? active.find((r) => r.scope === classScope) : null) ||
      active.find((r) => r.scope === 'default') ||
      null
    )
  }
  const applyCodingRules = (claim, ins, dos) => {
    const applied = []
    claimLines(claim).forEach((line) => {
      const code = pc(line.procedureCodeId)
      const rule = ruleFor(code.code, ins.id)
      if (!rule) return
      const scope = rule.scope === 'default' ? 'Default rule' : rule.scope.startsWith('class:') ? `${(f('insuranceClasses', rule.scope.slice(6)) || {}).name || 'Class'} class rule` : `${ins.name} rule`
      if (rule.type === 'Replace') {
        const to = pcByCode(rule.toCode)
        if (!to) return
        line.procedureCodeId = to.id
        const p = price(to.id, line.units, ins.id, dos)
        line.amount = p.amount
        line.rate = p.rate
        line.priceSource = p.source
        line.balIns = p.amount
        const toMods = [to.defaultModifier, to.defaultModifier2].filter(Boolean)
        const fromMods = [code.defaultModifier, code.defaultModifier2].filter(Boolean)
        if (toMods.length) line.modifiers = [...toMods, ...line.modifiers.filter((m) => !toMods.includes(m) && !fromMods.includes(m))]
        applied.push({ type: 'Replace', text: `${code.code} → ${to.code}`, scope, ruleId: rule.id })
      } else if (rule.type === 'Drop') {
        line.dropped = true
        applied.push({ type: 'Drop', text: `${code.code} dropped`, scope, ruleId: rule.id })
      }
    })
    claim.lineIds = claim.lineIds.filter((id) => !f('chargeLines', id).dropped)
    claim.total = claimTotal(claim)
    return applied
  }

  // ---------------------------------------------------------------- scrubbing (§6.2, §7.1)
  const scrub = (claim, opts = {}) => {
    const v = S.visitOf(claim)
    const c = S.caseOf(v)
    const p = S.patientOf(c)
    const cov = f('coverages', claim.coverageId)
    const ins = insOf(cov)
    const prov = f('providers', v.treatingProviderId)
    const bill = f('providers', v.billingProviderId)
    // Box 17 comes from the referring physician snapshot taken when the claim was created (PRD V2 §10.5, CH-11)
    const ref = f('referrers', claim.referrerId)
    const results = []
    const res = (key, status, detail, extra = {}) => results.push({ key, status, detail, ...extra })

    // 1 · coding rules — applied to the primary claim only; secondary claims
    //     reuse the primary's codes (assumption A-P12)
    const applied = claim.rank === 1 ? applyCodingRules(claim, ins, v.dos) : []
    res('rules', 'pass', applied.length ? applied.map((a) => `${a.text} (${a.scope})`).join(' · ') : 'No Replace or Drop rule matched this claim.', { name: 'Coding rules engine', source: 'Default & payer-specific rules' })

    // 2 · data integrity
    const missing = []
    if (!p.dob) missing.push('patient date of birth')
    if (!p.gender) missing.push('patient gender')
    if (!p.address.line1 || !p.address.city || !p.address.state || !p.address.zip) missing.push('patient address')
    if (!/^[A-Za-z .'-]+$/.test(`${p.firstName} ${p.lastName}`)) missing.push('special characters in patient name')
    if (!cov.memberId) missing.push('member ID')
    if (!cov.groupNumber) missing.push('group number')
    if (!v.locationId) missing.push('visit location')
    if (!bill) missing.push('billing provider')
    if (!ref) missing.push('referring physician')
    if (!prov || !npiValid(prov.npi)) missing.push('rendering provider NPI')
    if (claimLines(claim).length === 0) missing.push('charge lines')
    res('missing', missing.length ? 'fail' : 'pass', missing.length ? `Missing or invalid: ${missing.join(', ')}.` : 'Mandatory fields filled, digit lengths valid, no special characters.')

    // 3 · provider claim hold — the submission side of the same window (client 2026-09-23)
    if (!holdRunning(prov)) res('hold', 'skip', prov && prov.claimHoldUntil ? `${S.provName(prov, false)}'s hold is not running on ${U.date(DB.today)}.` : 'The rendering provider is not on claim hold.')
    else if (holdCovers(prov, v.dos, v.locationId, ins.id)) res('hold', 'fail', `${S.provName(prov, false)} is ${holdText(prov)}. The claim waits until the hold ends.`)
    else res('hold', 'pass', `${S.provName(prov, false)} is on claim hold ${holdWindow(prov)}, but it covers ${holdScope(prov)} — not this claim.`)

    // 4 · authorization
    if (!eff(ins, 'authRequired') || claim.rank > 1) res('auth', 'skip', claim.rank > 1 ? 'Not re-checked on a secondary claim.' : `${ins.name} does not require authorization.`)
    else if (claim.authId) res('auth', 'pass', `Authorization ${f('authorizations', claim.authId).number} already applied.`)
    else {
      const a = authUsable(v)
      if (a && authRemaining(a) > 0) res('auth', 'pass', `Authorization ${a.number} active ${U.date(a.start)}–${U.date(a.end)}, ${authRemaining(a)} of ${a.qty} ${a.unit.toLowerCase()} remaining.`)
      else res('auth', 'fail', 'No authorization with an active date range and remaining visits for this date of service.')
    }

    // 5 · credentialing
    const en = enrollment(prov, ins.id)
    if (en && en.status === 'Active' && (!en.effective || en.effective <= v.dos)) res('cred', 'pass', `${S.provName(prov, false)} is actively enrolled with ${ins.name}.`)
    else res('cred', 'fail', `${S.provName(prov, false)} is ${en ? en.status.toLowerCase() : 'not enrolled'} with ${ins.name} for this date of service.`)

    // 6 · payer rules — unit caps and conditional boxes
    const payerIssues = []
    claimLines(claim).forEach((l) => {
      if (ins.maxUnits && l.units > ins.maxUnits) payerIssues.push(`${pc(l.procedureCodeId).code} billed ${l.units} units (max ${ins.maxUnits})`)
    })
    if (c.injuryType === 'Auto' && !c.accidentState) payerIssues.push('Box 10b needs the accident state')
    if (eff(ins, 'injuryDateRequired') && !c.injuryDate) payerIssues.push('Box 14 needs the injury date')
    if (!ref) payerIssues.push('Box 17 needs a referring provider')
    if (['PIP', 'Workers Comp'].includes(ins.type) && !cov.claimNumber) payerIssues.push('Box 11b needs the claim number')
    res('payer', payerIssues.length ? 'fail' : 'pass', payerIssues.length ? payerIssues.join(' · ') + '.' : `Units within ${ins.name} limits; conditional boxes filled.`)

    // 7 · AI coding quality (add-on, simulated)
    if (!DB.settings.aiCoding) res('coding', 'skip', 'AI coding add-on is switched off.')
    else {
      const issues = []
      const dx = v.dx || []
      claimLines(claim).forEach((l) => {
        const code = pc(l.procedureCodeId)
        if (!l.pointers.length) issues.push(`${code.code} has no diagnosis pointer`)
        const pointed = l.pointers.map((ptr) => dx[ptr - 1]).filter(Boolean)
        if (code.code === '97750' && pointed.length && pointed.every((d) => /^[RZ]/.test(d)))
          issues.push(`97750 is not supported by ${pointed.join(', ')} alone — link a musculoskeletal diagnosis`)
      })
      res('coding', issues.length ? 'fail' : 'pass', issues.length ? issues.join(' · ') + '.' : 'Diagnosis-to-CPT consistency verified.')
    }

    // 8 · payer audit — the payer's claims are reviewed and documented before they go
    //     out (client 2026-09-23; not a V2 rule, see A-P57)
    if (!ins.auditRequired) res('audit', 'skip', `${ins.name} does not audit claims.`)
    else if (claim.audit) res('audit', 'pass', `Audited by ${S.userName(claim.audit.by)} — ${claim.audit.docs.join(', ')}${claim.audit.note ? ` · ${claim.audit.note}` : ''}.`)
    else res('audit', 'fail', `${ins.name} is marked Audit required: a reviewer must check this claim and record the documents attached before it is submitted.`)

    // 9 · manual release — insurance hold routes the claim to its release bucket (PRD V2 §6.2, CH-01)
    if (eff(ins, 'insuranceHold') && !claim.released) {
      claim.bucketId = ins.releaseBucketId
      const b = bucketOf(claim)
      res('manual', 'fail', `${ins.name} has the insurance hold checked — the claim waits in “${b ? b.name : 'its release bucket'}” until a user releases it.`)
    } else if (claim.released) {
      const b = f('releaseBuckets', claim.released.bucketId)
      res('manual', 'pass', `Released from “${b ? b.name : 'release bucket'}” by ${S.userName(claim.released.by)}.`)
    } else res('manual', 'skip', 'Insurance hold not checked — automatic submission.')

    results.forEach((r) => {
      if (!r.name) r.name = HOLDS[r.key] ? HOLDS[r.key].check : r.key
      if (!r.source) r.source = HOLDS[r.key] ? HOLDS[r.key].source : ''
    })
    claim.scrub = { at: S.now(), results, applied }
    const failed = HOLD_ORDER.find((k) => results.some((r) => r.key === k && r.status === 'fail'))
    if (failed) {
      const was = claim.status
      claim.status = 'Hold'
      if (was !== 'Hold' || claim.holdReason !== failed) claim.heldSince = DB.today
      claim.holdReason = failed
      if (!claim.wi) claim.wi = S.workItem()
      claim.wi.next = claim.wi.next || nextForHold(failed)
      claim.wi.due = claim.wi.due || U.addDays(DB.today, 2)
      if (failed !== 'manual') claim.bucketId = null
      S.log(failed === 'manual' ? `Claim waiting in release bucket — ${(bucketOf(claim) || {}).name || ''}` : `Claim held — ${HOLDS[failed].label}`, { module: 'BILLING', entityType: 'claim', entityId: claim.id, detail: results.find((r) => r.key === failed).detail })
      return 'Hold'
    }
    sendToClearinghouse(claim, opts.run)
    return 'Submitted'
  }
  const nextForHold = (k) =>
    ({
      missing: 'Complete the missing claim data',
      auth: 'Obtain or record an authorization',
      cred: 'Confirm provider enrollment with the payer',
      payer: 'Correct units or conditional boxes',
      coding: 'Review diagnosis pointers',
      manual: 'Review and release from the bucket',
    })[k] || ''

  let refSeq = 0
  const sendToClearinghouse = (claim, run) => {
    const v = S.visitOf(claim)
    const cov = f('coverages', claim.coverageId)
    const ins = insOf(cov)
    // Consume the authorization on the primary claim (assumption A-P07).
    if (claim.rank === 1 && eff(ins, 'authRequired') && !claim.authId) {
      const a = authUsable(v)
      if (a) {
        a.used += 1
        v.authorizationId = a.id
        claim.authId = a.id
      }
    }
    refSeq += 1
    claim.status = 'Submitted'
    claim.holdReason = null
    claim.sentDate = DB.today
    claim.format = ins.format
    claim.clearinghouseRef = run ? run.ref : `WS${DB.today.replace(/-/g, '')}-${String(refSeq).padStart(3, '0')}`
    claim.payerIcn = claim.payerIcn || `${DB.today.slice(2, 4)}${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`
    claim.slaDue = U.addDays(DB.today, ins.slaDays || 30)
    claim.total = claimTotal(claim)
    claimLines(claim).forEach((l) => (l.billed = true))
    claim.snapshot = snapshot(claim)
    S.log(`Claim submitted to Waystar (${claim.format === 'CMS1500' ? 'CMS-1500 print queue' : 'EDI 837P'})`, {
      module: 'BILLING', entityType: 'claim', entityId: claim.id, detail: `${ins.name} · ${U.money(claim.total)} · ref ${claim.clearinghouseRef}`,
    })
  }
  /** Freeze what was billed so later edits never change a sent claim (§10.5 intent). */
  const snapshot = (claim) =>
    claimLines(claim).map((l) => ({ lineId: l.id, code: pc(l.procedureCodeId).code, units: l.units, modifiers: [...l.modifiers], pointers: [...l.pointers], pos: l.pos, amount: l.amount }))

  // ---------------------------------------------------------------- claims
  const practicePrefix = (practiceId) => f('practices', practiceId).code.replace(/\d+$/, '')
  let claimSeq = 1200
  const newClaim = (visit, cov, extra = {}) => {
    const p = S.patientOfVisit(visit)
    claimSeq += 1
    const claim = {
      id: U.id('cl'),
      number: `${practicePrefix(p.practiceId)}-26-${String(claimSeq).padStart(6, '0')}`,
      visitId: visit.id,
      coverageId: cov.id,
      rank: cov.rank,
      format: insOf(cov).format,
      status: 'Scrubbing',
      holdReason: null,
      audit: null,
      frequency: '1',
      originalRef: null,
      sentDate: null,
      lineIds: linesOfVisit(visit.id).map((l) => l.id),
      total: 0,
      box19: '',
      // Snapshot of the case's referring physician at claim creation (PRD V2 §10.5, CH-11)
      referrerId: S.caseOf(visit).referrerId || null,
      bucketId: null,
      released: null,
      scrub: null,
      createdOn: DB.today,
      wi: S.workItem(),
      ...extra,
    }
    claim.total = claimTotal(claim)
    DB.claims.unshift(claim)
    return claim
  }
  const setClaimSeq = (n) => (claimSeq = Math.max(claimSeq, n))
  /** Environments never share numbering (environment.js). */
  const resetSequences = () => {
    refSeq = 0
    claimSeq = 1200
    runSeq = 0
    eraSeq = 0
  }

  /** Submission — single, bulk or scheduled (§5.1). Every attempt is logged
   *  into the day's batch metrics (§7.2). */
  let runSeq = 0
  const submit = (visitIds, mode) => {
    runSeq += 1
    const u = S.user()
    const run = {
      id: U.id('run'), date: DB.today, time: S.now().slice(11, 16), mode,
      by: mode === 'Scheduled' ? 'Scheduled submission job' : u.displayName,
      ref: `WS${DB.today.replace(/-/g, '')}-${String(40 + runSeq).padStart(3, '0')}`,
      claimIds: [], attempted: 0, sent: 0, held: {}, practiceId: S.session.practiceId,
    }
    const results = []
    visitIds.forEach((vid) => {
      const v = f('visits', vid)
      if (!v || v.status !== 'Released') return
      const cov = coverage(v.caseId, 1)
      if (!cov) return
      const claim = newClaim(v, cov)
      v.status = 'Billed'
      run.attempted += 1
      run.claimIds.push(claim.id)
      const outcome = scrub(claim, { run })
      if (outcome === 'Submitted') run.sent += 1
      else run.held[claim.holdReason] = (run.held[claim.holdReason] || 0) + 1
      results.push(claim)
    })
    if (run.attempted) DB.runs.unshift(run)
    S.log(`${mode} submission run`, { module: 'BILLING', entityType: 'run', entityId: run.id, detail: `${run.attempted} attempted · ${run.sent} sent · ${run.attempted - run.sent} held` })
    S.emit('claims.submitted', { run, results })
    return { run, results }
  }

  /** Re-scrub every held claim and every waiting visit — how "auto-resubmitted
   *  when the hold reason is resolved" (§7.1) is simulated. */
  const cascade = () => {
    const out = { toReview: [], stopped: [], holdsSent: [], stillHeld: 0, stillWaiting: 0 }
    // Charge Review is included: a hold entered today has to stop work that is already
    // waiting to be billed, not only work that was already waiting for something.
    DB.visits
      .filter((v) => ['Exception', 'Incomplete', 'Pended', 'Delayed', 'Review'].includes(v.status) && !v.manualPend)
      .forEach((v) => {
        const was = v.status
        repriceVisit(v)
        intake(v)
        if (v.status === 'Review' && was !== 'Review') out.toReview.push(v)
        else if (v.status !== 'Review') {
          if (was === 'Review') out.stopped.push(v)
          else out.stillWaiting += 1
        }
      })
    DB.claims
      // Claims waiting in a release bucket only leave by a user's release (PRD V2 §10.3; prototype assumption A-P37, C-013)
      .filter((c) => c.status === 'Hold' && c.holdReason !== 'manual')
      .forEach((c) => {
        const r = scrub(c, {})
        if (r === 'Submitted') {
          out.holdsSent.push(c)
          S.log('Hold resolved — claim auto-resubmitted', { module: 'BILLING', entityType: 'claim', entityId: c.id })
        } else out.stillHeld += 1
      })
    if (out.holdsSent.length) S.emit('hold.autoresubmitted', out)
    if (out.toReview.length) S.emit('visit.returned', out)
    return out
  }
  /** Record the review a payer's audit requires, then re-scrub: the claim goes out
   *  if nothing else holds it. */
  const recordAudit = (claim, data) => {
    claim.audit = { by: S.session.userId, at: S.now(), docs: data.docs, note: data.note || '' }
    S.log('Claim audit recorded', { module: 'BILLING', entityType: 'claim', entityId: claim.id, detail: `${claim.audit.docs.join(', ')}${claim.audit.note ? ` · ${claim.audit.note}` : ''}` })
    return scrub(claim, {})
  }

  const cascadeSummary = (out) => {
    const parts = []
    if (out.toReview.length) parts.push(`${U.plural(out.toReview.length, 'visit')} moved to Charge Review`)
    if (out.stopped.length) parts.push(`${U.plural(out.stopped.length, 'visit')} stopped before billing`)
    if (out.holdsSent.length) parts.push(`${U.plural(out.holdsSent.length, 'held claim')} re-scrubbed and submitted`)
    return parts.join(' · ')
  }

  // ---------------------------------------------------------------- visit actions
  const release = (v) => {
    v.status = 'Released'
    v.releasedOn = DB.today
    S.log('Visit released for claiming', { module: 'CHARGES', entityType: 'visit', entityId: v.id })
    S.emit('visit.released', v)
  }
  const pend = (v, reason) => {
    v.status = 'Pended'
    v.manualPend = true
    v.pendReason = reason
    S.log('Visit pended', { module: 'CHARGES', entityType: 'visit', entityId: v.id, detail: reason })
  }
  const returnToReview = (v) => {
    v.manualPend = false
    repriceVisit(v)
    const st = intake(v)
    S.log('Visit re-evaluated', { module: 'CHARGES', entityType: 'visit', entityId: v.id, detail: `Now: ${st}` })
    return st
  }

  // ---------------------------------------------------------------- clearinghouse (§7.1, §7.2)
  const respond = (claim, accept, rejection) => {
    if (accept) {
      claim.accepted = true
      S.log('Accepted by Waystar (277CA)', { module: 'BILLING', entityType: 'claim', entityId: claim.id, detail: `Payer claim # ${claim.payerIcn}` })
    } else {
      claim.status = 'Rejected'
      claim.rejection = { ...rejection, date: DB.today }
      claim.wi = claim.wi || S.workItem()
      claim.wi.next = 'Correct the rejected data and resubmit'
      claim.wi.due = U.addDays(DB.today, 2)
      claim.wi.priority = 'High'
      S.log('Rejected by clearinghouse', { module: 'BILLING', entityType: 'claim', entityId: claim.id, detail: `${rejection.code} ${rejection.reason}` })
    }
    S.emit('claim.response', { claim, accept })
  }
  const resubmit = (claim) => {
    claim.rejectionHistory = [...(claim.rejectionHistory || []), claim.rejection].filter(Boolean)
    claim.rejection = null
    claim.accepted = false
    claim.status = 'Scrubbing'
    S.log('Resubmitted after rejection', { module: 'BILLING', entityType: 'claim', entityId: claim.id })
    return scrub(claim, {})
  }
  /** A user releases a claim waiting in a release bucket (PRD V2 §6.2 "until a user
   *  releases it"). The prototype re-runs the other checks on release (assumption A-P38, Q-076). */
  const releaseFromBucket = (claim) => {
    const b = bucketOf(claim)
    claim.released = { by: S.session.userId, at: S.now(), bucketId: claim.bucketId }
    S.log('Released from release bucket', { module: 'BILLING', entityType: 'claim', entityId: claim.id, detail: b ? b.name : '' })
    const out = scrub(claim, {})
    S.emit('claim.released', claim)
    return out
  }
  const waitingInBucket = (bucketId) => DB.claims.filter((c) => c.status === 'Hold' && c.holdReason === 'manual' && c.bucketId === bucketId)

  /** Corrected (7) or void (8) claim — Box 22 carries the original reference (§5.2, §8). */
  const corrected = (orig, freq, newLines) => {
    const v = S.visitOf(orig)
    const cov = f('coverages', orig.coverageId)
    let lineIds = [...orig.lineIds]
    if (newLines) {
      claimLines(orig).forEach((l) => (l.void = true))
      lineIds = newLines.map((nl) => {
        const line = { id: U.id('ln'), visitId: v.id, procedureCodeId: nl.procedureCodeId, units: nl.units, modifiers: [...nl.modifiers], pointers: [...nl.pointers], pos: nl.pos || f('locations', v.locationId).pos, notes: '', amount: 0, balIns: 0, balPat: 0 }
        DB.chargeLines.push(line)
        priceLine(line, v)
        return line.id
      })
    }
    const claim = newClaim(v, cov, { frequency: freq, originalRef: orig.payerIcn || orig.clearinghouseRef, originalClaimId: orig.id, lineIds })
    claim.total = claimTotal(claim)
    orig.status = freq === '8' ? 'Voided' : 'Replaced'
    orig.replacedBy = claim.id
    if (freq === '8') claimLines(orig).forEach((l) => (l.void = true))
    S.log(freq === '8' ? 'Void claim created (frequency 8)' : 'Corrected claim created (frequency 7)', {
      module: 'BILLING', entityType: 'claim', entityId: claim.id, detail: `Replaces ${orig.number} · Box 22 original ref ${claim.originalRef}`,
    })
    S.log(freq === '8' ? `Voided by ${claim.number}` : `Replaced by ${claim.number}`, { module: 'BILLING', entityType: 'claim', entityId: orig.id })
    scrub(claim, {})
    return claim
  }

  // ---------------------------------------------------------------- ERA / posting (§9.1)
  /** How a payer adjudicates one claim, for the simulated 835. */
  const adjudicate = (claim, outcome = 'paid', carc = 'CO-50', rarc = '') => {
    const cov = f('coverages', claim.coverageId)
    const ins = insOf(cov)
    const v = S.visitOf(claim)
    const lines = claimLines(claim).map((l) => {
      const charge = l.amount
      if (outcome === 'denied') return { lineId: l.id, cpt: pc(l.procedureCodeId).code, charge, allowed: 0, contractual: 0, pr: 0, prCode: '', paid: 0, denied: true, carc, rarc, extra: [] }
      if (claim.rank > 1) {
        // A secondary pays what the primary left to the patient (assumption A-P13)
        const bal = l.balIns
        return { lineId: l.id, cpt: pc(l.procedureCodeId).code, charge, allowed: bal, contractual: 0, pr: 0, prCode: '', paid: bal, extra: [] }
      }
      void v
      // The payer decides what it allows. V2 stores no allowed amount (CH-08), so the
      // simulated payer reads its own contract table, never the fee schedule.
      const k = DB.payerContracts.find((x) => x.insuranceId === ins.id && x.procedureCodeId === l.procedureCodeId)
      const allowed = U.round(k ? Math.min(k.allowed * l.units, charge) : charge * 0.8)
      const coins = ins.type === 'Medicare' ? 0.2 : ['Workers Comp', 'PIP'].includes(ins.type) ? 0 : 0.1
      const pr = U.round(allowed * coins)
      return {
        lineId: l.id, cpt: pc(l.procedureCodeId).code, charge, allowed, contractual: U.round(charge - allowed),
        pr, prCode: pr ? 'PR-2' : '', paid: U.round(allowed - pr), extra: [],
      }
    })
    return { claimId: claim.id, claimNumber: claim.number, patient: S.pfull(S.patientOfVisit(v)), outcome, carc: outcome === 'denied' ? carc : '', rarc, lines, status: 'pending' }
  }

  let eraSeq = 0
  const createEra = (insId, entries, opts = {}) => {
    eraSeq += 1
    const ins = f('insurances', insId)
    const era = {
      id: U.id('era'),
      practiceId: ins.practiceId,
      insuranceId: insId,
      control: `${ins.payerId}-835-${DB.today.replace(/-/g, '').slice(2)}-${String(eraSeq).padStart(3, '0')}`,
      received: S.now(),
      status: 'Pending',
      claims: entries,
    }
    if (opts.unmatched) {
      era.claims.push({
        claimId: null, claimNumber: `${practicePrefix(ins.practiceId)}-26-0994${String(eraSeq).padStart(2, '0')}`,
        patient: 'Unknown patient', outcome: 'paid', lines: [{ lineId: null, cpt: '97110', charge: 90, allowed: 71.2, contractual: 18.8, pr: 0, prCode: '', paid: 71.2, extra: [] }], status: 'pending',
      })
    }
    DB.eras.unshift(era)
    S.log('ERA (835) received', { module: 'PAYMENTS', entityType: 'era', entityId: era.id, detail: `${ins.name} · ${era.claims.length} claims` })
    return era
  }
  const eraTotal = (era) => U.sum(era.claims, (c) => U.sum(c.lines, (l) => l.paid))

  /** Apply one adjudicated claim: payments, adjustments, balances, denials,
   *  and the next-rank claim ("created after the primary remit posts", §10.5). */
  const applyAdjudication = (claim, ec, batch) => {
    const out = { secondary: null, denials: 0, paid: 0 }
    const cov = f('coverages', claim.coverageId)
    const ins = insOf(cov)
    const postDate = DB.today
    ec.lines.forEach((el) => {
      const line = f('chargeLines', el.lineId)
      if (!line) return
      if (el.denied) {
        const den = {
          id: U.id('dn'), chargeLineId: line.id, claimId: claim.id, carc: el.carc, rarc: el.rarc || '', receivedDate: postDate,
          status: 'Open', notes: '', practiceId: S.patientOfVisit(S.visitOf(claim)).practiceId,
          wi: S.workItem({ priority: line.amount >= 80 ? 'High' : 'Medium', due: U.addDays(postDate, 7), next: denialNext(el.carc) }),
        }
        DB.denials.unshift(den)
        out.denials += 1
        S.log('Denial received via ERA (835)', { module: 'DENIALS', entityType: 'denial', entityId: den.id, detail: `${el.cpt} · ${el.carc} ${carcDesc(el.carc)}` })
        return
      }
      if (el.paid > 0) {
        DB.payments.push({ id: U.id('pm'), chargeLineId: line.id, claimId: claim.id, insuranceId: ins.id, kind: 'Insurance payment', amount: el.paid, pr: el.pr, prCode: el.prCode, allowed: el.allowed, reasonCode: '', checkNumber: batch.checkNumber, checkDate: batch.checkDate, postedDate: postDate, batchId: batch.id })
        out.paid += el.paid
      }
      if (el.contractual > 0) DB.payments.push({ id: U.id('pm'), chargeLineId: line.id, claimId: claim.id, insuranceId: ins.id, kind: 'Adjustment', amount: el.contractual, reasonCode: 'CO-45', checkNumber: batch.checkNumber, checkDate: batch.checkDate, postedDate: postDate, batchId: batch.id })
      ;(el.extra || []).forEach((x) => DB.payments.push({ id: U.id('pm'), chargeLineId: line.id, claimId: claim.id, insuranceId: ins.id, kind: 'Adjustment', amount: x.amount, reasonCode: x.code, checkNumber: batch.checkNumber, checkDate: batch.checkDate, postedDate: postDate, batchId: batch.id }))
      const extra = U.sum(el.extra || [], (x) => x.amount)
      const remaining = U.round(line.balIns - el.paid - el.contractual - extra)
      const next = coverage(S.visitOf(claim).caseId, claim.rank + 1)
      if (next && remaining > 0) {
        line.balIns = remaining
      } else {
        line.balIns = 0
        line.balPat = U.round(line.balPat + Math.max(0, remaining))
      }
    })
    if (ec.outcome === 'denied') {
      claim.status = 'Denied'
      claim.ar = 'Denied'
      S.log('Claim denied — cloned into Denial & A/R', { module: 'BILLING', entityType: 'claim', entityId: claim.id, detail: `${ec.carc} ${carcDesc(ec.carc)}` })
    } else {
      claim.status = 'Paid'
      claim.paidDate = postDate
      claim.ar = null
      S.log('Payment posted', { module: 'PAYMENTS', entityType: 'claim', entityId: claim.id, detail: `${ins.name} paid ${U.money(out.paid)} · batch ${batch.checkNumber}` })
      const nextCov = coverage(S.visitOf(claim).caseId, claim.rank + 1)
      const leftover = claimInsBalance(claim)
      if (nextCov && leftover > 0 && !DB.claims.some((c) => c.visitId === claim.visitId && c.rank === nextCov.rank && !['Replaced', 'Voided', 'Cancelled'].includes(c.status))) {
        const sec = newClaim(S.visitOf(claim), nextCov, { lineIds: [...claim.lineIds], box29: claimPaid(claim), primaryClaimId: claim.id })
        sec.total = claimTotal(sec)
        S.log(`${nextCov.rank === 2 ? 'Secondary' : 'Tertiary'} claim created after primary remit`, { module: 'BILLING', entityType: 'claim', entityId: sec.id, detail: `${insOf(nextCov).name} · Box 29 amount paid ${U.money(sec.box29)}` })
        scrub(sec, {})
        out.secondary = sec
        S.emit('claim.secondary', sec)
      }
    }
    return out
  }
  const denialNext = (carc) =>
    ({
      'CO-197': 'Request a retro-authorization and appeal',
      'CO-50': 'Send medical-necessity documentation with an appeal',
      'CO-16': 'Correct the missing information and resend',
      'CO-18': 'Confirm duplicate and close',
      'CO-29': 'Check proof of timely filing',
      'CO-204': 'Bill the patient or write off',
    })[carc] || 'Review the denial reason'

  const postEra = (era) => {
    const ins = f('insurances', era.insuranceId)
    const batch = { id: U.id('bt'), practiceId: era.practiceId, source: 'ERA', insuranceId: ins.id, checkNumber: era.control, checkDate: DB.today, checkAmount: 0, status: 'Posted', postedOn: DB.today, postedBy: S.session.userId, eraId: era.id }
    const summary = { posted: 0, paid: 0, denials: 0, secondary: [], exceptions: 0 }
    era.claims.forEach((ec, idx) => {
      if (ec.status === 'posted') return
      const claim = ec.claimId ? f('claims', ec.claimId) : DB.claims.find((c) => c.number === ec.claimNumber)
      if (!claim) {
        raisePaymentException(era, idx, 'Unmapped payer remittance data', `Claim control number ${ec.claimNumber} was not found — ${U.money(U.sum(ec.lines, (l) => l.paid))} unapplied.`)
        ec.status = 'exception'
        summary.exceptions += 1
        return
      }
      const unmapped = U.uniq(ec.lines.flatMap((l) => (l.extra || []).map((x) => x.code)).filter((code) => !carcKnown(code)))
      if (unmapped.length) {
        raisePaymentException(era, idx, 'Unmapped adjustment reason code', `${unmapped.join(', ')} on claim ${claim.number} has no mapping in the adjustment code list.`)
        ec.status = 'exception'
        summary.exceptions += 1
        return
      }
      const r = applyAdjudication(claim, ec, batch)
      ec.status = 'posted'
      summary.posted += 1
      summary.paid += r.paid
      summary.denials += r.denials
      if (r.secondary) summary.secondary.push(r.secondary)
    })
    batch.checkAmount = U.round(summary.paid)
    if (summary.posted) DB.batches.unshift(batch)
    era.status = era.claims.every((c) => c.status === 'posted') ? 'Posted' : era.claims.some((c) => c.status === 'posted') ? 'Partially posted' : 'Exceptions'
    S.log('ERA posted', { module: 'PAYMENTS', entityType: 'era', entityId: era.id, detail: `${summary.posted} claims · ${U.money(summary.paid)} · ${summary.exceptions} exceptions` })
    S.emit('era.posted', summary)
    return summary
  }
  const raisePaymentException = (era, idx, trigger, detail) => {
    if (DB.exceptions.some((x) => x.eraId === era.id && x.eraIdx === idx && x.status === 'Open')) return
    const ex = {
      id: U.id('ex'), key: `pay-${era.id}-${idx}`, level: 'Payment', trigger, detail, fix: { type: trigger.startsWith('Unmapped adjustment') ? 'carc' : 'era-claim' },
      eraId: era.id, eraIdx: idx, visitId: null, practiceId: era.practiceId, status: 'Open', detectedAt: S.now(),
      wi: S.workItem({ priority: 'High', due: U.addDays(DB.today, 1), next: 'Map the remittance and post it' }),
    }
    DB.exceptions.unshift(ex)
    S.log('Payment exception raised', { module: 'PAYMENTS', entityType: 'exception', entityId: ex.id, detail })
  }
  /** Re-post a single ERA claim after its payment exception was fixed. */
  const postEraClaim = (era, idx) => {
    const ec = era.claims[idx]
    const claim = ec.claimId ? f('claims', ec.claimId) : DB.claims.find((c) => c.number === ec.claimNumber)
    const batch = { id: U.id('bt'), practiceId: era.practiceId, source: 'ERA', insuranceId: era.insuranceId, checkNumber: era.control, checkDate: DB.today, checkAmount: 0, status: 'Posted', postedOn: DB.today, postedBy: S.session.userId, eraId: era.id }
    const r = applyAdjudication(claim, ec, batch)
    batch.checkAmount = U.round(r.paid)
    DB.batches.unshift(batch)
    ec.status = 'posted'
    era.status = era.claims.every((c) => c.status === 'posted') ? 'Posted' : 'Partially posted'
    return r
  }

  /** Manual posting from a check batch — the batch must balance to the check (§10.5 payment). */
  const postBatch = (batch) => {
    const summary = { posted: 0, paid: 0, secondary: [] }
    const byClaim = U.groupBy(batch.entries, (e) => e.claimId)
    Object.entries(byClaim).forEach(([claimId, entries]) => {
      const claim = f('claims', claimId)
      const ec = {
        claimId, claimNumber: claim.number, outcome: 'paid',
        lines: entries.map((e) => ({ lineId: e.lineId, cpt: e.cpt, charge: e.charge, allowed: e.allowed, contractual: e.contractual, pr: e.pr, prCode: e.pr ? 'PR-2' : '', paid: e.paid, extra: e.otherAdj ? [{ code: e.otherCode || 'CO-45', amount: e.otherAdj }] : [] })),
      }
      const r = applyAdjudication(claim, ec, batch)
      summary.posted += 1
      summary.paid += r.paid
      if (r.secondary) summary.secondary.push(r.secondary)
    })
    batch.status = 'Posted'
    batch.postedOn = DB.today
    batch.postedBy = S.session.userId
    S.log('Check batch posted', { module: 'PAYMENTS', entityType: 'batch', entityId: batch.id, detail: `Check ${batch.checkNumber} · ${U.money(summary.paid)} · ${summary.posted} claims` })
    S.emit('era.posted', summary)
    return summary
  }

  const postPatientPayment = (patientId, amount, method, ref) => {
    // Oldest open patient balance first (assumption A-P14)
    let left = U.round(amount)
    const lines = DB.chargeLines
      .filter((l) => l.balPat > 0 && S.patientOfVisit(f('visits', l.visitId)).id === patientId)
      .sort((a, b) => U.cmp(f('visits', a.visitId).dos, f('visits', b.visitId).dos))
    const applied = []
    lines.forEach((l) => {
      if (left <= 0) return
      const amt = Math.min(left, l.balPat)
      l.balPat = U.round(l.balPat - amt)
      left = U.round(left - amt)
      const claim = DB.claims.find((c) => c.lineIds.includes(l.id) && c.rank === 1) || null
      const pm = { id: U.id('pm'), chargeLineId: l.id, claimId: claim ? claim.id : null, insuranceId: null, kind: 'Patient payment', amount: amt, reasonCode: '', method, checkNumber: ref || method, checkDate: DB.today, postedDate: DB.today, batchId: null }
      DB.payments.push(pm)
      applied.push(pm)
    })
    if (left > 0) {
      DB.payments.push({ id: U.id('pm'), chargeLineId: null, claimId: null, patientId, insuranceId: null, kind: 'Patient payment', amount: left, reasonCode: '', method, checkNumber: ref || method, checkDate: DB.today, postedDate: DB.today, batchId: null, unapplied: true })
    }
    S.log('Patient payment posted', { module: 'PAYMENTS', entityType: 'patient', entityId: patientId, detail: `${U.money(amount)} ${method}${left > 0 ? ` · ${U.money(left)} unapplied credit` : ''}` })
    return { applied, unapplied: left }
  }

  /** Reversals are posted, never deleted (§10.6). Prototype stores a separate
   *  "Reversal" row with a positive amount that restores the balance (Q51). */
  const reversePayment = (pm, reason) => {
    const line = f('chargeLines', pm.chargeLineId)
    if (line) {
      if (pm.kind === 'Patient payment') line.balPat = U.round(line.balPat + pm.amount)
      else line.balIns = U.round(line.balIns + pm.amount)
    }
    pm.reversed = true
    const rev = { ...pm, id: U.id('pm'), kind: 'Reversal', reverses: pm.id, reasonCode: reason || '', postedDate: DB.today, reversed: false }
    DB.payments.push(rev)
    if (pm.claimId && pm.kind === 'Insurance payment') {
      const claim = f('claims', pm.claimId)
      if (claim && claim.status === 'Paid' && claimPaid(claim) <= 0) claim.status = 'Submitted'
    }
    S.log('Payment reversed', { module: 'PAYMENTS', entityType: 'payment', entityId: pm.id, detail: `${pm.kind} ${U.money(pm.amount)}${reason ? ' · ' + reason : ''}` })
    return rev
  }

  // ---------------------------------------------------------------- SLA & A/R (§9.2)
  const runSla = () => {
    const escalated = []
    DB.claims
      .filter((c) => c.status === 'Submitted' && !c.ar && c.slaDue && c.slaDue < DB.today && claimPaid(c) === 0)
      .forEach((c) => {
        c.ar = 'Delayed'
        c.arSince = DB.today
        c.wi = { ...S.workItem(), ...(c.wi || {}), priority: claimTotal(c) >= 150 ? 'High' : 'Medium', due: U.addDays(DB.today, 5), next: 'Call payer for claim status' }
        S.log('Payer SLA exceeded — cloned into Denial & A/R (Delayed)', { module: 'AR', entityType: 'claim', entityId: c.id, detail: `SLA due ${U.date(c.slaDue)}, no payment acknowledgement` })
        escalated.push(c)
      })
    S.emit('sla.escalated', escalated)
    return escalated
  }

  // ---------------------------------------------------------------- denials
  const appealDenial = (den, method, notes) => {
    den.status = 'Appealed'
    den.appealedOn = DB.today
    den.notes = notes || den.notes
    den.wi.next = 'Await appeal decision'
    den.wi.due = U.addDays(DB.today, 30)
    S.log('Appeal submitted', { module: 'DENIALS', entityType: 'denial', entityId: den.id, detail: `${method}${notes ? ' · ' + notes : ''}` })
    S.emit('denial.worked', den)
  }
  const writeOffDenial = (den, code, notes) => {
    const line = f('chargeLines', den.chargeLineId)
    const amt = line ? line.balIns : 0
    if (line && amt > 0) {
      DB.payments.push({ id: U.id('pm'), chargeLineId: line.id, claimId: den.claimId, insuranceId: null, kind: 'Adjustment', amount: amt, reasonCode: code, checkNumber: 'WRITE-OFF', checkDate: DB.today, postedDate: DB.today, batchId: null })
      line.balIns = 0
    }
    den.status = 'Written off'
    den.notes = notes || den.notes
    den.wi.next = ''
    S.log('Denial written off', { module: 'DENIALS', entityType: 'denial', entityId: den.id, detail: `${U.money(amt)} · ${code}` })
    S.emit('denial.worked', den)
  }
  const resolveDenial = (den, amount, notes) => {
    const line = f('chargeLines', den.chargeLineId)
    const claim = f('claims', den.claimId)
    if (line && amount > 0) {
      const ins = insOf(f('coverages', claim.coverageId))
      DB.payments.push({ id: U.id('pm'), chargeLineId: line.id, claimId: claim.id, insuranceId: ins.id, kind: 'Insurance payment', amount, reasonCode: '', checkNumber: 'APPEAL', checkDate: DB.today, postedDate: DB.today, batchId: null })
      line.balIns = U.round(Math.max(0, line.balIns - amount))
    }
    den.status = 'Resolved'
    den.notes = notes || den.notes
    den.wi.next = ''
    if (claim && DB.denials.filter((d) => d.claimId === claim.id).every((d) => d.status !== 'Open' && d.status !== 'Appealed')) {
      if (amount > 0) {
        claim.status = 'Paid'
        claim.ar = null
      }
    }
    S.log('Denial resolved', { module: 'DENIALS', entityType: 'denial', entityId: den.id, detail: amount > 0 ? `Paid on appeal ${U.money(amount)}` : notes || '' })
    S.emit('denial.worked', den)
  }

  // ---------------------------------------------------------------- EMR ingestion (§2.3, §4.1, §4.2)
  /** One payload from the EMR. Returns { result, visit, detail }. */
  const receivePayload = (pl) => {
    const loc = f('locations', pl.locationId)
    const logRow = { id: U.id('emr'), at: S.now(), locationId: loc.id, recordId: pl.recordId, patient: pl.patientLabel || '', result: '', detail: '' }
    DB.emrLog.unshift(logRow)
    const done = (result, detail, visit) => {
      logRow.result = result
      logRow.detail = detail
      logRow.visitId = visit ? visit.id : null
      S.emit('emr.received', { result, visit })
      return { result, detail, visit }
    }
    if (loc.emr.link !== 'Linked' || loc.emr.election !== 'Integrated') {
      return done('Blocked', `${loc.name} is ${loc.emr.election === 'Integrated' ? 'not linked' : 'EMR-only'} — payload not accepted into billing.`)
    }
    // Reconciliation by Internal Record ID (§4.2)
    const existing = DB.visits.find((v) => v.recordId === pl.recordId && v.status !== 'Inactive')
    if (existing) {
      const claim = activeClaimOfVisit(existing.id)
      const sentish = claim && ['Scrubbing', 'Submitted', 'Rejected', 'Paid', 'Denied'].includes(claim.status)
      if (sentish) {
        const up = { id: U.id('up'), visitId: existing.id, claimId: claim.id, receivedAt: S.now(), status: 'Open', payload: { lines: pl.lines, dx: pl.dx || existing.dx, treatingProviderId: pl.providerId || existing.treatingProviderId }, practiceId: S.patientOfVisit(existing).practiceId, wi: S.workItem({ due: U.addDays(DB.today, 1), next: 'Choose: inactivate, corrected claim or submit anyway' }) }
        DB.updates.unshift(up)
        S.log('Updated note received for a submitted claim', { module: 'CHARGES', entityType: 'visit', entityId: existing.id, detail: `Record ${pl.recordId} → Updated Charges queue` })
        return done('Updated queue', `Record ${pl.recordId} matches submitted claim ${claim.number} — stored in the Updated Charges queue.`, existing)
      }
      // In Charges / Claims / Billing or Held → replace
      const fresh = buildVisit(pl, existing)
      existing.status = 'Inactive'
      existing.supersededBy = fresh.id
      existing.inactiveReason = 'Superseded by a re-sent EMR note'
      existing.inactiveOn = DB.today
      claimsOfVisit(existing.id).filter((c) => c.status === 'Hold').forEach((c) => {
        c.status = 'Cancelled'
        S.log('Held claim cancelled — record superseded', { module: 'BILLING', entityType: 'claim', entityId: c.id })
      })
      DB.exceptions.filter((x) => x.visitId === existing.id && x.status === 'Open').forEach((x) => (x.status = 'Resolved'))
      S.log('Record replaced by re-sent note', { module: 'CHARGES', entityType: 'visit', entityId: existing.id, detail: `Superseded by the incoming payload for record ${pl.recordId}` })
      intake(fresh)
      return done('Replaced', `Record ${pl.recordId} replaced the earlier version; the old record moved to Inactive Records.`, fresh)
    }
    const v = buildVisit(pl, null)
    intake(v)
    const where = { Review: 'Charge Review', Pended: 'Pended', Delayed: 'Delayed', Exception: 'Billing Exceptions', Incomplete: 'Incomplete Profiles bucket' }[v.status]
    return done('Accepted', `New record ${pl.recordId} → ${where}.`, v)
  }

  /** Create the visit + charge lines described by a payload (patient/case/provider
   *  resolved or created as drafts by the caller). */
  const buildVisit = (pl, prior) => {
    const c = f('cases', pl.caseId)
    const v = {
      id: U.id('v'), caseId: c.id, dos: pl.dos, locationId: pl.locationId, billingProviderId: pl.billingProviderId,
      treatingProviderId: pl.providerId, authorizationId: null, dx: (c.dx || []).map((d) => d.code), status: 'Review',
      pendReason: '', source: 'EMR', recordId: pl.recordId, createdOn: DB.today,
      wi: S.workItem(), replaces: prior ? prior.id : null,
    }
    DB.visits.unshift(v)
    pl.lines.forEach((l) => {
      const line = { id: U.id('ln'), visitId: v.id, procedureCodeId: l.procedureCodeId, units: l.units, modifiers: [...(l.modifiers || [])], pointers: [...(l.pointers || [1])], pos: l.pos || f('locations', pl.locationId).pos, notes: '', amount: 0, balIns: 0, balPat: 0 }
      DB.chargeLines.push(line)
      priceLine(line, v)
    })
    S.log('Session received from EMR', { module: 'CHARGES', entityType: 'visit', entityId: v.id, userId: 'u8', detail: `Record ${pl.recordId} · ${U.plural(pl.lines.length, 'charge line')}` })
    return v
  }

  // ---------------------------------------------------------------- updated charges (§5.2)
  const resolveUpdate = (up, action, freq) => {
    const claim = f('claims', up.claimId)
    const v = f('visits', up.visitId)
    let result = null
    if (action === 'inactivate') {
      up.status = 'Inactivated'
      up.resolvedOn = DB.today
      S.log('Update inactivated — existing claim kept', { module: 'CHARGES', entityType: 'visit', entityId: v.id })
    } else if (action === 'corrected') {
      result = corrected(claim, freq, freq === '8' ? null : up.payload.lines)
      up.status = freq === '8' ? 'Voided' : 'Corrected claim'
      up.resolvedOn = DB.today
      up.resultClaimId = result.id
    } else if (action === 'anyway') {
      const nv = { ...U.clone(v), id: U.id('v'), recordId: `${v.recordId}-R`, status: 'Billed', createdOn: DB.today, replaces: null }
      DB.visits.unshift(nv)
      up.payload.lines.forEach((l) => {
        const line = { id: U.id('ln'), visitId: nv.id, procedureCodeId: l.procedureCodeId, units: l.units, modifiers: [...l.modifiers], pointers: [...l.pointers], pos: l.pos || f('locations', nv.locationId).pos, notes: '', amount: 0, balIns: 0, balPat: 0 }
        DB.chargeLines.push(line)
        priceLine(line, nv)
      })
      result = newClaim(nv, f('coverages', claim.coverageId))
      S.log('Submitted anyway as a fresh claim', { module: 'BILLING', entityType: 'claim', entityId: result.id, detail: `Update to ${claim.number} force-submitted` })
      scrub(result, {})
      up.status = 'Submitted anyway'
      up.resolvedOn = DB.today
      up.resultClaimId = result.id
    }
    S.emit('update.resolved', up)
    return result
  }

  /** amount − payments − adjustments, computed from posted rows (reversals add back). */
  const lineBalanceComputed = (line) => {
    const rows = DB.payments.filter((pm) => pm.chargeLineId === line.id)
    const out = U.sum(rows.filter((pm) => pm.kind !== 'Reversal'), (pm) => pm.amount)
    const back = U.sum(rows.filter((pm) => pm.kind === 'Reversal'), (pm) => pm.amount)
    return U.round(line.amount - out + back)
  }

  // ---------------------------------------------------------------- dashboard helpers
  const agingBucket = (days) => (days <= 30 ? '0–30' : days <= 60 ? '31–60' : days <= 90 ? '61–90' : days <= 120 ? '91–120' : '120+')
  const AGING = ['0–30', '31–60', '61–90', '91–120', '120+']

  return {
    LIMITS, DUMMY_NPIS, DUMMY_PHONES, HOLDS, HOLD_ORDER, REJECTIONS, AGING,
    pc, pcByCode, coverages, coverage, insOf, primaryIns, linesOfVisit, claimLines, claimTotal, claimsOfVisit,
    activeClaimOfVisit, paymentsOfClaim, claimPaid, claimBalance, claimInsBalance, visitTotal, dxLabel, carcKnown,
    carcDesc, feeRow, price, priceLine, repriceVisit, authRemaining, authStatus, authUsable, holdActive, holdCovers, holdRunning, holdWindow, holdScope, holdText, recordAudit, enrollment,
    zipState, npiValid, detectExceptions, syncExceptions, intake, ruleFor, scrub, newClaim, setClaimSeq, resetSequences, submit, cascade,
    cascadeSummary, release, pend, returnToReview, respond, resubmit, releaseFromBucket, waitingInBucket, corrected, adjudicate, createEra,
    eraTotal, applyAdjudication, postEra, postEraClaim, postBatch, postPatientPayment, reversePayment, runSla,
    appealDenial, writeOffDenial, resolveDenial, receivePayload, buildVisit, resolveUpdate, agingBucket, snapshot,
    sendToClearinghouse, denialNext, nextForHold, raisePaymentException,
    RULES, classOf, eff, inherited, bucketOf, lineBalanceComputed,
  }
})()
