/* PROTOTYPE LAYER — simulators for the external systems the Billing System talks to.
   None of these exist in the product: in production the EMR pushes notes, Waystar sends
   acknowledgements and remittances, and schedulers run on their own. Each simulator
   produces the event and then lets the real application logic handle it.
   Opened from the review-notes popover (Prototype...) or with Alt + Shift + S. */

// ================================================================ EMR push (§2.3, §4.1, §4.2)

const Sim = (() => {
  let recSeq = 5591200
  const nextRec = () => `EMR-N-${++recSeq}`
  // Falls back to any active code, so scenarios also work in the Fresh System
  const line = (code, units, pointers = [1]) => {
    const pc = E.pcByCode(code) || DB.procedureCodes.find((x) => x.isActive)
    return pc ? { procedureCodeId: pc.id, units, modifiers: pc.defaultModifier ? [pc.defaultModifier] : [], pointers } : null
  }
  const lines = (...ls) => ls.filter(Boolean)
  const freshProvider = () => DB.providers.find((p) => p.practiceId === S.session.practiceId && !p.draft && p.isActive && E.npiValid(p.npi) && !p.claimHoldUntil)
  const freshInsurance = () => DB.insurances.find((i) => i.practiceId === S.session.practiceId && !i.draft && i.isActive)
  const freshReferrer = () => DB.referrers.find((r) => r.practiceId === S.session.practiceId && E.npiValid(r.npi))
  const primaryLoc = () => S.locationsOfPractice().find((l) => l.isPrimary) || S.locationsOfPractice()[0]
  const pr1 = () => S.session.practiceId === 'pr1'
  const caseIn = (id) => {
    const c = S.find('cases', id)
    return c && S.patientOf(c).practiceId === S.session.practiceId ? c : null
  }
  const firstCleanCase = () =>
    DB.cases.find((c) => {
      const p = S.patientOf(c)
      const ins = E.primaryIns(c.id)
      return p.practiceId === S.session.practiceId && c.isActive && ins && !ins.draft && !E.eff(ins, 'authRequired') && S.locAllowed(where(c).locationId) && c.dx.length && S.find('referrers', c.referrerId) && E.npiValid(S.find('referrers', c.referrerId).npi) && !DB.visits.some((v) => v.caseId === c.id && ['Exception', 'Incomplete'].includes(v.status))
    })
  /** What the EMR sends for location and billing provider. PRD V2 sets both on each
   *  visit "from the EMR payload" (CH-04); the simulated EMR reuses the episode's last visit. */
  const where = (c) => {
    const last = DB.visits.filter((v) => v.caseId === c.id && v.locationId).sort((a, b) => U.cmp(b.dos, a.dos))[0]
    const loc = last ? last.locationId : (S.locationsOfPractice().find((l) => l.isPrimary) || {}).id
    const bill = last ? last.billingProviderId : (DB.providers.find((x) => x.practiceId === S.session.practiceId && !x.draft && x.isActive) || {}).id
    return { locationId: loc, billingProviderId: bill }
  }
  const provFor = (c) => S.find('providers', where(c).billingProviderId)

  const PRESETS = [
    {
      key: 'clean', title: 'Clean session for an existing patient', expect: 'New Internal Record ID, integrated location, nothing missing → Charge review.',
      available: () => !!(caseIn('c1') || firstCleanCase()) && !!DB.procedureCodes.some((x) => x.isActive),
      why: 'Needs a patient whose case has a referring physician, a diagnosis and a primary insurance that does not require authorization, plus an active procedure code.',
      preview: () => { const c = caseIn('c1') || firstCleanCase(); return { c, prov: provFor(c), lines: lines(line('97110', 2), line('97140', 1), line('97530', 1)) } },
    },
    {
      key: 'newpatient', title: 'New patient from the EMR', expect: 'The patient chart and case arrive with the session; the patient is created, then the visit → Charge review.',
      available: () => !!(freshProvider() && freshInsurance() && primaryLoc() && DB.procedureCodes.some((x) => x.isActive)),
      why: 'Needs a location, a provider with an NPI, an insurance and an active procedure code — the payload names them.',
      preview: () => ({ newPatient: true, prov: freshProvider(), lines: lines(line('97162', 1), line('97110', 2)) }),
    },
    {
      key: 'unknownProvider', title: 'Session by a clinician billing has never seen', expect: 'A draft provider profile is created (first finalized note) and the session is quarantined → Incomplete profiles.',
      available: () => pr1() || (Env.isFresh() && !!Fresh.readyCase() && DB.procedureCodes.some((x) => x.isActive)),
      why: 'Needs a patient with a completed case (referring physician, diagnosis, coverage) and an active procedure code.',
      preview: () => { const c = caseIn('c7') || Fresh.readyCase(); return { c, newProvider: true, lines: lines(line('97110', 2), line('97140', 1)) } },
    },
    {
      key: 'unknownIns', title: 'Session with an insurance billing does not know', expect: 'A draft insurance profile is created and the session is quarantined → Incomplete profiles.',
      available: () => pr1() || (Env.isFresh() && !!freshProvider() && !!primaryLoc() && DB.procedureCodes.some((x) => x.isActive)),
      why: 'Needs a location, a provider with an NPI and an active procedure code.',
      preview: () => ({ newPatient: true, newInsurance: true, prov: S.find('providers', 'P1') || freshProvider(), lines: lines(line('97161', 1), line('97110', 1)) }),
    },
    {
      key: 'refnpi', demoOnly: true, title: 'Session with a dummy referring NPI', expect: 'Case-level billing exception (placeholder NPI 9999999999) → Billing exceptions.',
      available: () => pr1() && !!caseIn('c12'), preview: () => { const c = caseIn('c12'); return { c, prov: provFor(c), lines: [line('97140', 1), line('97110', 2)] } },
    },
    {
      key: 'zero', demoOnly: true, title: 'New CPT code charged at $0.00', expect: 'Charge-level billing exception: 97033 is in neither fee schedule → Billing exceptions.',
      available: () => pr1() && !!caseIn('c14'), preview: () => { const c = caseIn('c14'); return { c, prov: provFor(c), lines: [line('97033', 1), line('97110', 2)] } },
    },
    {
      key: 'hold', demoOnly: true, title: 'Session by a provider on claim hold', expect: 'Jordan Okafor is on hold until 09/30 (pending credentialing) → Delayed.',
      available: () => pr1() && !!caseIn('c13'), preview: () => ({ c: caseIn('c13'), prov: S.find('providers', 'P4'), lines: [line('97110', 2), line('97140', 1)] }),
    },
    {
      key: 'auth', demoOnly: true, title: 'Payer needs an authorization that is used up', expect: 'Empire BCBS requires authorization and none is left → Pended.',
      available: () => pr1() && !!caseIn('c3'), preview: () => { const c = caseIn('c3'); return { c, prov: S.find('providers', 'P3'), lines: [line('97110', 2), line('97530', 1)] } },
    },
    {
      key: 'resendReview', title: 'Re-send a note that is still in Charge review', expect: 'Same Internal Record ID, not yet submitted → the payload replaces the record; the old one goes to Inactive records.',
      available: () => !!Sim.reviewVisit(), why: 'Needs a visit that arrived from the EMR and is still in Charge review.', preview: () => { const v = Sim.reviewVisit(); return { v, c: S.caseOf(v), prov: S.find('providers', v.treatingProviderId), lines: E.linesOfVisit(v.id).map((l, i) => ({ procedureCodeId: l.procedureCodeId, units: l.units + (i === 0 ? 1 : 0), modifiers: [...l.modifiers], pointers: [...l.pointers] })) } },
    },
    {
      key: 'resendSubmitted', title: 'Re-send a note whose claim was already submitted', expect: 'Same Internal Record ID, claim already submitted → stored in the Updated charges queue for a decision.',
      available: () => !!Sim.submittedVisit(), why: 'Needs a visit that arrived from the EMR and whose claim was submitted.', preview: () => { const v = Sim.submittedVisit(); return { v, c: S.caseOf(v), prov: S.find('providers', v.treatingProviderId), lines: [...E.linesOfVisit(v.id).map((l) => ({ procedureCodeId: l.procedureCodeId, units: l.units, modifiers: [...l.modifiers], pointers: [...l.pointers] })), line('97112', 1)] } },
    },
    {
      key: 'blocked', title: 'Session from an EMR-only location', expect: 'Staten Island Annex is not integrated → payload blocked from billing.',
      available: () => DB.locations.some((l) => l.practiceId === S.session.practiceId && (l.emr.election !== 'Integrated' || l.emr.link !== 'Linked')),
      why: 'Needs a location that is not integrated with the EMR.',
      preview: () => ({ blocked: DB.locations.find((l) => l.practiceId === S.session.practiceId && (l.emr.election !== 'Integrated' || l.emr.link !== 'Linked')), lines: lines(line('97110', 2)) }),
    },
  ]

  const reviewVisit = () => DB.visits.find((v) => v.status === 'Review' && v.source === 'EMR' && S.inScopeVisit(v))
  const submittedVisit = () =>
    DB.visits.find((v) => {
      if (v.source !== 'EMR' || !S.inScopeVisit(v)) return false
      const c = E.activeClaimOfVisit(v.id)
      return c && c.status === 'Submitted' && !DB.updates.some((u) => u.visitId === v.id && u.status === 'Open')
    })

  const describe = (key) => {
    const p = PRESETS.find((x) => x.key === key)
    if (!p.available()) return null
    const pv = p.preview()
    const loc = pv.blocked || (pv.c ? S.find('locations', where(pv.c).locationId) : primaryLoc())
    const billProv = pv.c ? S.find('providers', where(pv.c).billingProviderId) : pv.prov
    const who = pv.newPatient ? (pv.newInsurance ? 'New patient · Oscar Health' : 'New patient · Aetna') : pv.c ? `${S.pfull(S.patientOf(pv.c))} · ${E.primaryIns(pv.c.id)?.name || 'no insurance'}` : 'Walk-in patient'
    const provText = pv.newProvider ? 'Priya Raman, PT (not in billing yet)' : pv.prov ? S.provName(pv.prov) : '—'
    return { p, pv, loc, billProv, who, provText, record: pv.v ? pv.v.recordId : '(new Internal Record ID)' }
  }

  const open = () => {
    const st = S.view('sim', { key: 'clean', dos: DB.today, result: null })
    const shown = PRESETS.filter((p) => !(p.demoOnly && Env.isFresh()))
    const firstOk = shown.find((x) => x.available())
    if (!firstOk) {
      // Day one: nothing an EMR push could attach to yet
      UI.closeAll()
      UI.modal({
        title: 'Simulate an EMR push',
        size: 'md',
        cls: 'proto-layer',
        body: Dep.panel({
          title: 'Nothing an EMR session could be billed against yet',
          text: 'A finalized EMR note arrives for a location, names the providers and patient, and carries procedure codes (PRD V2 §2.3, §4.1, §10.5). The payload is only accepted into billing if its location is linked and elected Integrated.',
          needs: [
            { ok: !!primaryLoc(), label: 'A location', action: { label: 'Open Practices & locations', hash: '#/admin/practices' } },
            { ok: !!freshProvider(), label: 'A provider with an NPI', action: { label: 'Add a provider', hash: '#/admin/providers' } },
            { ok: !!freshInsurance(), label: 'An insurance', action: { label: 'Add an insurance', hash: '#/admin/insurances' } },
            { ok: DB.procedureCodes.some((x) => x.isActive), label: 'An active procedure code', action: { label: 'Add a procedure code', hash: '#/admin/codes' } },
            { ok: S.locationsOfPractice().some((l) => l.emr.link === 'Linked' && l.emr.election === 'Integrated'), label: 'A location linked to the EMR and elected Integrated', why: 'Without it every payload is blocked — which is itself a scenario worth sending once the rest exists.', action: { label: 'Open EMR integration', hash: '#/admin/integration' } },
          ],
        }),
        foot: UI.btn({ label: 'Close', variant: 'primary', act: 'layer.close' }),
      })
      return
    }
    if (!shown.find((x) => x.key === st.key) || !shown.find((x) => x.key === st.key).available()) st.key = firstOk.key
    const d = describe(st.key)
    const choices = shown.map((p) => {
      const ok = p.available()
      return `<label class="choice ${p.key === st.key ? 'selected' : ''}" style="${ok ? '' : 'opacity:.5;cursor:not-allowed'}"><input type="radio" name="sim-preset" value="${p.key}" ${p.key === st.key ? 'checked' : ''} ${ok ? '' : 'disabled'} data-change="sim.pick"><span><span class="c-title">${U.esc(p.title)}</span><span class="c-desc" style="display:block">${ok ? U.esc(p.expect) : Env.isFresh() && p.why ? 'Not available yet — ' + U.esc(p.why) : 'Not available with this practice’s data.'}</span></span></label>`
    }).join('')
    const res = st.result
    const body = `${UI.notice('info', 'Simulated EMR.', 'In production the EMR pushes a payload every time a clinical note is finalized at an integrated location. Pick a scenario and send it; the Billing System then handles it exactly as it would a real note.', 'zap')}
      <div class="section-title mt-16 mb-8">Scenario</div><div class="choice-list">${choices}</div>
      <div class="section-title mt-24 mb-8">Payload</div>
      <div class="card card-pad">${UI.kv([['Location', d.loc ? `${d.loc.name} · ${d.loc.emr.election}` : ''], ['Patient', d.who], ['Billing provider', d.billProv ? S.provName(d.billProv) : '—'], ['Rendering provider', d.provText], ['Internal Record ID', d.record], ['Charges', UI.codesText(d.pv.lines)]])}
        <div class="field mt-12" style="max-width:220px"><label class="field-label" for="sim-dos">Date of service</label><div class="control"><input id="sim-dos" type="date" value="${st.dos}" max="${DB.today}" data-change="sim.dos"></div></div></div>
      ${d.loc && !d.pv.blocked && (d.loc.emr.link !== 'Linked' || d.loc.emr.election !== 'Integrated') ? `<div class="mt-16">${UI.notice('warning', `${U.esc(d.loc.name)} is not integrated with the EMR.`, 'This payload will be blocked from billing (PRD V2 §2.3). Link the location and elect it Integrated in Admin → EMR integration to accept sessions from it.', 'plug')}</div>` : ''}
      ${res ? `<div class="mt-16">${UI.notice(res.tone, `${res.result}:`, U.esc(res.detail) + (res.link ? ` <a href="${res.link}" data-act="go" data-hash="${res.link}">${res.linkText}</a>` : ''), res.tone === 'success' ? 'circleCheck' : res.tone === 'critical' ? 'ban' : 'info')}</div>` : ''}`
    // Picking another scenario redraws the open drawer in place — sliding it
    // out and back in on every click would make the choice feel like a reload.
    const openBody = document.querySelector('[data-sim-drawer] .drawer-body')
    if (openBody) {
      const top = openBody.scrollTop
      openBody.innerHTML = body
      openBody.scrollTop = top
      return
    }
    UI.closeAll()
    const h = UI.drawer({
      title: 'Simulate an EMR push',
      desc: `${U.esc(S.practice().name)} · payloads are reconciled by Internal Record ID (§4.2)`,
      wide: true,
      cls: 'proto-layer',
      body,
      foot: UI.btn({ label: 'Close', variant: 'quiet', act: 'layer.close' }) + UI.btn({ label: 'Send to billing', icon: 'send', variant: 'primary', act: 'sim.send', demo: 'sim-send' }),
    })
    h.el.dataset.simDrawer = '1'
  }

  const send = () => {
    const st = S.view('sim', {})
    const d = describe(st.key)
    if (!d) return
    const { pv } = d
    const dos = st.dos || DB.today
    let caseId = pv.c ? pv.c.id : null
    let providerId = pv.prov ? pv.prov.id : null
    let patientLabel = pv.c ? S.pfull(S.patientOf(pv.c)) : ''
    let locationId = d.loc.id
    let billingProviderId = d.billProv ? d.billProv.id : null
    if (pv.blocked) {
      patientLabel = 'Walk-in patient'
    }
    if (pv.newPatient && !pv.blocked) {
      const n = DB.patients.length
      const names = [['Imani', 'Clarke', 'Female'], ['Mateo', 'Alvarez', 'Male'], ['Chloe', 'Bennett', 'Female'], ['Rohan', 'Mehta', 'Male'], ['Ava', 'Sullivan', 'Female']]
      const [first, last, gender] = names[n % names.length]
      let ins = DB.insurances.find((i) => i.practiceId === S.session.practiceId && i.type === 'Commercial' && !i.draft && !E.eff(i, 'authRequired') && !i.insuranceHold) || freshInsurance()
      if (pv.newInsurance) {
        ins = DB.insurances.find((i) => i.draft && i.practiceId === S.session.practiceId && i.name === 'Healthfirst')
        if (!ins) {
          ins = { id: U.id('i'), practiceId: S.session.practiceId, code: null, name: 'Healthfirst', classId: null, type: '', payerId: '', address: { line1: '', city: '', state: '', zip: '' }, phone: '', fax: '', icdVersion: null, acceptAssignment: null, specialtyModifiers: null, authRequired: null, injuryDateRequired: null, insuranceHold: false, releaseBucketId: null, maxUnits: 6, slaDays: 30, format: '837P', portalUrl: '', portalUser: '', portalPassword: '', isActive: true, draft: true, draftFrom: `EMR session on ${U.date(DB.today)}` }
          DB.insurances.push(ins)
          S.log('Draft insurance profile created from EMR', { module: 'ADMIN', entityType: 'insurance', entityId: ins.id, detail: ins.name })
        }
      }
      const loc = primaryLoc()
      const p = { id: U.id('p'), practiceId: S.session.practiceId, billingId: 10412 + n + 40, emrId: 56370000 + n * 17, firstName: first, middleName: '', lastName: last, gender, dob: `19${70 + (n % 25)}-0${1 + (n % 8)}-1${n % 9}`, address: { line1: `${100 + n} Fourth Avenue`, line2: '', city: 'Brooklyn', state: 'NY', zip: '11217' }, phoneCell: `718-555-01${String(n % 90).padStart(2, '0')}`, phoneHome: '', email: '', ssn: '', guarantor: null, noStatements: false, notes: '', isActive: true }
      DB.patients.unshift(p)
      const ref = DB.referrers.find((r) => r.practiceId === S.session.practiceId && E.npiValid(r.npi))
      const c = { id: U.id('c'), patientId: p.id, name: 'Default', referrerId: ref ? ref.id : null, injuryType: 'Other', injuryDate: null, startOfCare: dos, dischargeDate: null, accidentState: '', employmentStatus: '', isActive: true, dx: [{ code: 'M25.561', desc: E.dxLabel('M25.561') }] }
      DB.cases.push(c)
      DB.coverages.push({ id: U.id('cv'), caseId: c.id, insuranceId: ins.id, rank: 1, memberId: `W${String(700000000 + n * 7919)}`, groupNumber: '0184421', claimNumber: '', subscriber: null, employer: null })
      S.log('Patient chart and case received from EMR', { module: 'PATIENT', entityType: 'patient', entityId: p.id, userId: 'u8', detail: `${S.pfull(p)} · Default case` })
      caseId = c.id
      patientLabel = S.pfull(p)
      locationId = loc.id
      billingProviderId = providerId || DB.providers.find((x) => x.practiceId === S.session.practiceId && !x.draft).id
    }
    if (pv.newProvider) {
      let draft = DB.providers.find((x) => x.draft && x.practiceId === S.session.practiceId && x.lastName === 'Raman')
      if (!draft) {
        draft = { id: U.id('P'), practiceId: S.session.practiceId, code: `EMR-${7800 + DB.providers.length}`, firstName: 'Priya', lastName: 'Raman', credential: '', specialty: '', npi: '', taxonomy: '', stateLicense: '', claimHoldUntil: null, claimHoldReason: '', isActive: true, draft: true, draftFrom: `First finalized EMR note on ${U.date(DB.today)}`, enrollments: [] }
        DB.providers.push(draft)
        S.log('Draft provider profile created from first finalized note', { module: 'ADMIN', entityType: 'provider', entityId: draft.id, userId: 'u8', detail: 'Priya Raman' })
      }
      providerId = draft.id
    }
    const payload = {
      locationId, billingProviderId: billingProviderId || providerId, recordId: pv.v ? pv.v.recordId : nextRec(), caseId, providerId, dos,
      lines: pv.lines, patientLabel, dx: pv.c ? pv.c.dx.map((x) => x.code) : ['M25.561'],
    }
    const out = E.receivePayload(payload)
    const v = out.visit
    const map = {
      Blocked: { tone: 'critical', link: '#/admin/integration', linkText: S.can('INTEGRATION', 'r') ? 'See the payload log' : '' },
      'Updated queue': { tone: 'info', link: '#/charges/updated', linkText: 'Open the Updated queue' },
      Replaced: { tone: 'info', link: v ? `#/charges/visit/${v.id}` : '', linkText: 'Open the new record' },
      Accepted: { tone: v && v.status === 'Review' ? 'success' : 'warning', link: v ? `#/charges/visit/${v.id}` : '', linkText: 'Open the visit' },
    }[out.result]
    st.result = { result: out.result === 'Accepted' && v ? `Accepted → ${UI.VISIT_LABEL[v.status]}` : out.result, detail: out.detail, ...map }
    if (!map.linkText) st.result.link = ''
    UI.toast(map.tone === 'critical' ? 'critical' : map.tone === 'success' ? 'success' : 'info', `EMR payload: ${st.result.result}`, U.esc(out.detail), 6500)
    R.refresh()
    open()
  }

  ACT['sim.emr'] = () => {
    S.view('sim', { key: 'clean', dos: DB.today, result: null }).result = null
    open()
  }
  ACT['sim.pick'] = (el) => {
    const st = S.view('sim', {})
    st.key = el.value
    st.result = null
    open()
  }
  ACT['sim.dos'] = (el) => {
    S.view('sim', {}).dos = el.value && el.value <= DB.today ? el.value : DB.today
  }
  ACT['sim.send'] = () => send()

  const reset = () => {
    recSeq = 5591200
  }
  return { reviewVisit, submittedVisit, PRESETS, reset }
})()

// ================================================================ clearinghouse response (§7.1–7.2)
ACT['cl.respond'] = (el) => {
  UI.closeMenu()
  const c = S.find('claims', el.dataset.id)
  const h = UI.modal({
    title: 'Simulate the Waystar response',
    desc: `In production the clearinghouse acknowledgement (277CA) arrives on its own. Pick an outcome for ${c.number} to see what the system does next.`,
    size: 'md',
    cls: 'proto-layer',
    body: UI.form([
      { name: 'outcome', type: 'radio', required: true, options: [{ value: 'accept', label: 'Accepted', desc: 'The claim stays Submitted and waits for the payer’s remittance (835).' }, { value: 'reject', label: 'Rejected', desc: 'The claim moves to Rejections & Reasons and counts in today’s live rejections.' }] },
      { name: 'code', label: 'Rejection reason', type: 'select', requiredIf: (v) => v.outcome === 'reject', options: E.REJECTIONS.map((r) => ({ value: r.code, label: `${r.code} — ${r.reason}` })) },
    ], { outcome: 'accept' }),
    foot: UI.btn({ label: 'Cancel', variant: 'quiet', act: 'layer.close' }) + UI.btn({ label: 'Apply response', variant: 'primary', act: 'cl.respondSave' }),
  })
  h.el.dataset.id = c.id
}
ACT['cl.respondSave'] = (el) => {
  const layer = el.closest('.layer')
  const vals = UI.submitForm(UI.formOf(layer))
  if (!vals) return
  const c = S.find('claims', layer.dataset.id)
  E.respond(c, vals.outcome === 'accept', vals.outcome === 'reject' ? E.REJECTIONS.find((r) => r.code === vals.code) : null)
  UI.closeTop()
  UI.toast(vals.outcome === 'accept' ? 'success' : 'warning', vals.outcome === 'accept' ? `${c.number} accepted by Waystar` : `${c.number} rejected`, vals.outcome === 'accept' ? 'It now waits for the payer’s remittance.' : 'It is now in Claims → Rejections.')
  R.refresh()
}

// ================================================================ ERA arrival (§9.1)
const EraSim = {
  data() {
    const claims = DB.claims.filter((c) => S.inScopeClaim(c) && c.status === 'Submitted' && !DB.eras.some((e) => e.status === 'Pending' && e.claims.some((x) => x.claimId === c.id)))
    const byPayer = U.groupBy(claims, (c) => E.insOf(S.find('coverages', c.coverageId)).id)
    const payers = Object.keys(byPayer).map((id) => ({ value: id, label: `${S.find('insurances', id).name} — ${U.plural(byPayer[id].length, 'submitted claim')}` }))
    const st = S.view('erasim', { payer: payers.find((p) => p.value === 'i1')?.value || (payers[0] || {}).value })
    if (payers.length && !byPayer[st.payer]) st.payer = payers[0].value
    return { byPayer, payers, st }
  },
  body({ byPayer, payers, st }) {
    const opts = [{ value: 'paid', label: 'Paid' }, ...['CO-50', 'CO-197', 'CO-16', 'CO-204'].map((c) => ({ value: c, label: `Denied ${c}` }))]
    return `<div class="form-grid"><div class="field span-8"><label class="field-label" for="erasim-payer">Payer</label><div class="control"><select id="erasim-payer" data-change="era.simPayer">${payers.map((p) => `<option value="${p.value}" ${p.value === st.payer ? 'selected' : ''}>${U.esc(p.label)}</option>`).join('')}</select><span class="chev">${I('chevronDown', 'icon-14')}</span></div></div></div>
      <div class="tbl-wrap scroll-x mt-16"><table class="tbl"><thead><tr><th>Claim</th><th>Patient</th><th>DOS</th><th class="r">Charge</th><th>Outcome</th></tr></thead><tbody>${byPayer[st.payer]
        .slice(0, 8)
        .map((c) => { const r = Cl.row(c); return `<tr><td class="ink fw-500">${c.number}<span class="sub">${RANK_LABEL[c.rank]}</span></td><td>${U.esc(r.name)}</td><td>${U.date(r.dos)}</td><td class="r num">${U.money(c.total)}</td><td><select class="mini-select" data-era-claim="${c.id}" aria-label="Outcome for ${c.number}">${opts.map((o) => `<option value="${o.value}">${o.label}</option>`).join('')}</select></td></tr>` })
        .join('')}</tbody></table></div>
      <label class="check-row mt-16"><input type="checkbox" id="erasim-unmatched"><span>Include a remittance line with an unknown claim control number<span class="desc">Produces a payment-level billing exception (§4.4).</span></span></label>`
  },
}
ACT['era.simulate'] = () => {
  const d = EraSim.data()
  if (!d.payers.length) {
    const held = DB.claims.filter((c) => S.inScopeClaim(c) && c.status === 'Hold').length
    Dep.modal({
      cls: 'proto-layer',
      title: 'No claims are waiting for payment',
      text: 'A remittance (ERA 835) is the payer’s answer to claims it has received (PRD V2 §9.1), so the simulated ERA is built from claims in Submitted status.',
      needs: [
        { ok: DB.visits.some((v) => ['Released', 'Billed'].includes(v.status) && S.inScopeVisit(v)), label: 'A released charge', why: 'Charges are reviewed and released before a claim is built.', action: { label: 'Open Charge review', hash: '#/charges/review' } },
        { ok: false, label: 'A submitted claim', why: held ? `${U.plural(held, 'claim')} on hold or waiting in a release bucket — fix or release ${held === 1 ? 'it' : 'them'} first.` : 'Submit released charges; claims that pass scrubbing are sent to Waystar.', action: held ? { label: 'Open Holds', hash: '#/claims/holds' } : { label: 'Open Ready to submit', hash: '#/charges/ready' } },
      ],
    })
    return
  }
  const h = UI.modal({
    title: 'Simulate an ERA (835) arrival',
    desc: 'In production Waystar delivers remittances automatically. Pick a payer and how it adjudicated each claim, then post the ERA from the inbox.',
    size: 'lg',
    cls: 'proto-layer',
    body: EraSim.body(d),
    foot: UI.btn({ label: 'Cancel', variant: 'quiet', act: 'layer.close' }) + UI.btn({ label: 'Generate ERA', icon: 'zap', variant: 'primary', act: 'era.simCreate' }),
  })
  h.el.dataset.payer = d.st.payer
}
ACT['era.simPayer'] = (el) => {
  // Redraw the open dialog for the new payer rather than closing and reopening it.
  S.view('erasim', {}).payer = el.value
  const layer = el.closest('.layer')
  layer.querySelector('.dialog-body').innerHTML = EraSim.body(EraSim.data())
  layer.dataset.payer = el.value
  layer.querySelector('#erasim-payer').focus()
}
ACT['era.simCreate'] = (el) => {
  const layer = el.closest('.layer')
  const entries = Array.from(layer.querySelectorAll('[data-era-claim]')).map((sel) => {
    const c = S.find('claims', sel.dataset.eraClaim)
    return sel.value === 'paid' ? E.adjudicate(c, 'paid') : E.adjudicate(c, 'denied', sel.value, { 'CO-50': 'M127', 'CO-197': 'N54', 'CO-16': 'MA130', 'CO-204': 'N130' }[sel.value])
  })
  const era = E.createEra(layer.dataset.payer, entries, { unmatched: layer.querySelector('#erasim-unmatched').checked })
  UI.closeTop()
  UI.toast('success', 'ERA received', `${U.plural(era.claims.length, 'claim')} · ${U.money(E.eraTotal(era))}. Review and post it from the inbox.`)
  R.go('#/payments')
  setTimeout(() => ACT['era.open']({ dataset: { id: era.id } }), 250)
}

// ================================================================ registry used by the Guide
/** Each external event: what it stands in for, whether it can run now, and how. */
const Simulators = (() => {
  const signedIn = () => !!(S.user() && S.practice())
  const claimInRoute = () => {
    const { parts } = R.parse()
    return parts[0] === 'claims' && parts[1] === 'view' ? S.find('claims', parts[2]) : null
  }
  const submitted = () => DB.claims.filter((c) => S.inScopeClaim(c) && c.status === 'Submitted')
  const LIST = [
    { key: 'emr', icon: 'zap', title: 'EMR push', stands: 'The EMR sending a finalized clinical note', desc: 'Send a session from the EMR: a clean visit, a new patient, an unknown clinician or payer, a re-sent note, or a payload from an EMR-only location.', ready: () => signedIn(), run: () => ACT['sim.emr']() },
    {
      key: 'respond', icon: 'send', title: 'Waystar response', stands: 'The clearinghouse acknowledgement (277CA)', desc: 'Accept or reject a submitted claim.',
      ready: () => signedIn() && submitted().length > 0,
      why: 'Needs a submitted claim.',
      run: () => {
        const c = claimInRoute()
        if (c && c.status === 'Submitted') return ACT['cl.respond']({ dataset: { id: c.id } })
        Simulators.pickClaim()
      },
    },
    { key: 'era', icon: 'wallet', title: 'ERA arrival', stands: 'A payer’s electronic remittance (835) via Waystar', desc: 'Choose a payer and how it adjudicated each submitted claim; the remittance lands in Payments → ERA inbox.', ready: () => signedIn(), run: () => ACT['era.simulate']() },
    { key: 'sla', icon: 'clock', title: 'Payer SLA check', stands: 'The SLA engine that normally runs on its own', desc: 'Escalate submitted claims that passed their payer’s SLA without payment into A/R follow-up.', ready: () => signedIn(), run: () => ACT['ar.sla']() },
    { key: 'job', icon: 'play', title: 'Scheduled submission', stands: 'The submission job that runs at the configured interval', desc: 'Submit every released charge now, as the scheduled job would.', ready: () => signedIn(), run: () => ACT['ch.runScheduled']() },
  ]
  const pickClaim = () => {
    const list = submitted().slice(0, 12)
    UI.modal({
      title: 'Simulate a Waystar response',
      desc: 'Choose the submitted claim the clearinghouse answers.',
      size: 'md',
      cls: 'proto-layer',
      body: `<div class="choice-list">${list.map((c) => { const r = Cl.row(c); return `<button type="button" class="choice" style="text-align:left;width:100%" data-act="pg.respondTo" data-id="${c.id}"><span><span class="c-title">${c.number} · ${U.esc(r.name)}</span><span class="c-desc" style="display:block">${U.esc(r.payer)} · ${U.money(c.total)} · sent ${U.date(c.sentDate)}</span></span></button>` }).join('')}</div>`,
      foot: UI.btn({ label: 'Cancel', variant: 'quiet', act: 'layer.close' }),
    })
  }
  ACT['pg.respondTo'] = (el) => {
    UI.closeTop()
    ACT['cl.respond']({ dataset: { id: el.dataset.id } })
  }
  const run = (key) => {
    const s = LIST.find((x) => x.key === key)
    if (!s) return
    if (!s.ready()) {
      UI.toast('info', `${s.title} is not available yet`, s.why || 'Sign in and choose a practice first.')
      return
    }
    UI.closeMenu()
    s.run()
  }
  return { LIST, run, pickClaim }
})()
