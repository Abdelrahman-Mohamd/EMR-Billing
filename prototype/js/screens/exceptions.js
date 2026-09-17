/* Exceptions — Billing Exceptions at five entity levels (§4.4) and the
   Incomplete Entries / Profiles bucket. Every "Resolve" edits the real
   source record, then re-runs intake so the visit moves on by itself. */

const LEVELS = ['Patient', 'Case', 'Session', 'Charge', 'Payment']

Screens.exceptions = {
  render(parts, q) {
    const tab = ['incomplete', 'resolved'].includes(parts[0]) ? parts[0] : 'open'
    const v = S.view(`exc-${tab}`, { sort: 'detected', dir: 'desc', page: 1, levels: [] })
    // A deep link filters; plain navigation afterwards shows every level again.
    if (q.level && v.appliedQ !== q.level) {
      v.levels = [q.level]
      v.appliedQ = q.level
    } else if (!q.level && v.appliedQ) {
      v.levels = []
      v.appliedQ = null
    }
    const scope = DB.exceptions.filter(inScopeException)
    const open = scope.filter((x) => x.status === 'Open')
    const drafts = Exc.drafts()
    const tabs = [
      { key: 'open', label: 'Billing exceptions', count: open.length, alert: true },
      { key: 'incomplete', label: 'Incomplete profiles', count: drafts.length, alert: true },
      { key: 'resolved', label: 'Resolved', count: scope.filter((x) => x.status === 'Resolved').length },
    ]
    let body
    if (tab === 'incomplete') body = Exc.incompleteTab(drafts)
    else {
      const list = tab === 'open' ? open : scope.filter((x) => x.status === 'Resolved')
      const counts = Object.fromEntries(LEVELS.map((l) => [l, list.filter((x) => x.level === l).length]))
      const rows = list.filter((x) => !v.levels.length || v.levels.includes(x.level)).map(Exc.row)
      body = `<div class="control-line flush">${UI.pills(LEVELS.map((l) => ({ key: l, label: l, count: counts[l] })), v.levels, 'exc.level', { view: `exc-${tab}` })}${v.levels.length ? UI.btn({ label: 'Show all levels', variant: 'quiet', act: 'exc.levelClear', data: { view: `exc-${tab}` } }) : ''}</div>
        ${UI.table({
          cols: [
            { key: 'level', label: 'Level', sort: true, render: (r) => UI.tag(r.x.level, r.x.level === 'Payment' ? 'sand' : 'brand') },
            { key: 'trigger', label: 'Exception trigger', sort: true, render: (r) => `<span class="ink fw-500">${U.esc(r.x.trigger)}</span><span class="sub">${U.esc(r.x.detail)}</span>` },
            { key: 'record', label: 'Record', sort: true, render: (r) => r.recordHtml },
            { key: 'detected', label: 'Detected', sort: true, render: (r) => U.stampLabel(r.x.detectedAt, DB.today) },
            ...(tab === 'open'
              ? [
                  { key: 'owner', label: 'Owner', render: (r) => UI.ownerCell(r.x.wi) },
                  { key: 'due', label: 'Due', sort: (r) => r.x.wi.due, render: (r) => UI.dueCell(r.x.wi) },
                  { key: 'act', label: '', cls: 'r', render: (r) => (Exc.canFix(r.x) ? UI.btn({ label: 'Resolve', size: 'sm', act: 'exc.fix', data: { id: r.id }, demo: 'exc-fix' }) : '') },
                ]
              : [{ key: 'resolved', label: 'Resolved', render: (r) => `${U.stampLabel(r.x.resolvedAt, DB.today)}<span class="sub">${U.esc(S.userName(r.x.resolvedBy))}</span>` }]),
          ],
          rows, view: v, viewKey: `exc-${tab}`, noun: 'exception', rowAct: tab === 'open' ? 'exc.fix' : null, mark: (r) => (tab === 'open' ? (r.x.level === 'Charge' || r.x.level === 'Payment' ? 'critical' : 'warning') : null),
          empty: UI.empty({ icon: 'circleCheck', title: tab === 'open' ? 'No open billing exceptions' : 'Nothing resolved yet', text: tab === 'open' ? 'Payloads with missing fields, dummy data or unpriced codes are intercepted here before claim processing.' : '' }),
        })}`
    }
    return `<div class="screen"><div class="page-x screen-head"><div><h1 class="screen-title">Exceptions</h1><p class="screen-sub">Data problems caught before a claim is built</p></div>
      <div class="screen-actions"></div></div>
      <div class="page-x screen-body">${UI.tabs(tabs, tab, 'exc.tab')}<div class="mt-16">${body}</div></div></div>`
  },
}

const Exc = {
  drafts() {
    const out = []
    DB.providers.filter((p) => p.practiceId === S.session.practiceId && p.draft).forEach((p) => out.push({ id: p.id, kind: 'Provider', name: S.provName(p) || '(unnamed)', from: p.draftFrom, visits: DB.visits.filter((v) => v.status === 'Incomplete' && v.treatingProviderId === p.id && S.inScopeVisit(v)) }))
    DB.insurances.filter((i) => i.practiceId === S.session.practiceId && i.draft).forEach((i) => out.push({ id: i.id, kind: 'Insurance', name: i.name, from: i.draftFrom, visits: DB.visits.filter((v) => v.status === 'Incomplete' && S.inScopeVisit(v) && E.primaryIns(v.caseId)?.id === i.id) }))
    return out
  },
  row(x) {
    let recordHtml = ''
    let record = ''
    if (x.visitId) {
      const v = S.find('visits', x.visitId)
      const p = S.patientOfVisit(v)
      record = S.pname(p)
      recordHtml = `<a href="#/charges/visit/${v.id}" class="fw-500">${U.esc(S.pname(p))}</a><span class="sub">DOS ${U.date(v.dos)} · record ${U.esc(v.recordId)}</span>`
    } else if (x.eraId) {
      const era = S.find('eras', x.eraId)
      record = era.control
      recordHtml = `<span class="ink fw-500">ERA ${U.esc(era.control)}</span><span class="sub">${U.esc(S.find('insurances', era.insuranceId).name)}</span>`
    }
    return { id: x.id, x, level: x.level, trigger: x.trigger, record, recordHtml, detected: x.detectedAt }
  },
  canFix: (x) => (x.level === 'Payment' ? S.can('PAYMENTS', 'u') : S.can('CHARGES', 'u')),
  incompleteTab(drafts) {
    if (!drafts.length) return UI.empty({ icon: 'circleCheck', title: 'No incomplete profiles', text: 'When an EMR session references a provider or insurance that does not exist yet, a draft profile is created and the session waits here.' })
    return `${UI.notice('info', 'Draft profiles from the EMR.', 'Sessions that name an unknown provider or insurance wait here until the profile is completed. Completing it releases them.')}
      <div class="stack gap-16 mt-16">${drafts
        .map((d) => `<div class="card"><div class="card-head"><span class="scope-ico" style="background:var(--critical-bg);color:var(--critical)">${I(d.kind === 'Provider' ? 'stethoscope' : 'landmark', 'icon-18')}</span><div class="grow"><div class="card-title">${U.esc(d.name)} ${UI.chip('critical', `Draft ${d.kind.toLowerCase()}`)}</div><div class="t-micro muted">${U.esc(d.from || 'Created from an EMR payload')}</div></div>${(d.kind === 'Provider' ? S.can('ADMIN', 'u') : S.can('ADMIN', 'u')) ? UI.btn({ label: 'Complete profile', variant: 'primary', size: 'sm', act: d.kind === 'Provider' ? 'exc.completeProvider' : 'exc.completeIns', data: { id: d.id } }) : `<span class="t-micro muted">Admin access needed</span>`}</div>
          <div class="card-body">${d.visits.length ? `<div class="eyebrow mb-8">${U.plural(d.visits.length, 'quarantined session')}</div>${d.visits.map((v) => { const p = S.patientOfVisit(v); return `<div class="row" style="padding:8px 0;border-bottom:1px solid var(--rule-row)"><a href="#/charges/visit/${v.id}" class="fw-500">${U.esc(S.pname(p))}</a><span class="muted t-micro">DOS ${U.date(v.dos)} · ${U.esc(UI.codesText(E.linesOfVisit(v.id)))}</span><span class="ml-auto num ink">${U.money(E.visitTotal(v))}</span></div>` }).join('')}` : '<span class="muted t-micro">No sessions waiting on this profile.</span>'}</div></div>`)
        .join('')}</div>`
  },
}
ACT['exc.tab'] = (el) => R.go(`#/exceptions${el.dataset.key === 'open' ? '' : '/' + el.dataset.key}`)
ACT['exc.level'] = (el) => {
  const v = S.view(el.dataset.view, {})
  v.levels = v.levels.includes(el.dataset.key) ? v.levels.filter((x) => x !== el.dataset.key) : [...v.levels, el.dataset.key]
  v.page = 1
  R.refresh()
}
ACT['exc.levelClear'] = (el) => {
  S.view(el.dataset.view, {}).levels = []
  R.refresh()
}

// ---------------------------------------------------------------- resolve flows
const afterFix = (x, label) => {
  const out = E.cascade()
  if (x.level !== 'Payment') {
    const still = DB.exceptions.filter((e) => e.visitId === x.visitId && e.status === 'Open')
    const v = x.visitId ? S.find('visits', x.visitId) : null
    S.emit('exception.resolved', x)
    if (still.length) UI.toast('warning', `${label} — but the visit still has ${U.plural(still.length, 'exception')}`, U.esc(still.map((e) => e.trigger).join(' · ')), 7000)
    else UI.toast('success', `${label} — exception resolved`, v ? `The visit moved to ${UI.VISIT_LABEL[v.status]}.${E.cascadeSummary(out) ? ' ' + E.cascadeSummary(out) + '.' : ''}` : '', 7000)
  }
  R.refresh()
}
ACT['exc.fix'] = (el) => {
  const x = S.find('exceptions', el.dataset.id)
  if (!x || x.status !== 'Open') return
  if (!Exc.canFix(x)) {
    UI.toast('info', 'View only', 'Your role can inspect exceptions but not resolve them.')
    return
  }
  const fx = x.fix || {}
  const open = (title, desc, specs, values, act, extra = '') => {
    const h = UI.modal({ title, desc, size: 'md', body: `${UI.notice('critical', `${x.level} · ${x.trigger}.`, U.esc(x.detail), 'alert')}<div class="mt-16">${UI.form(specs, values)}</div>${extra}`, foot: UI.btn({ label: 'Cancel', variant: 'quiet', act: 'layer.close' }) + UI.btn({ label: 'Save and re-check', variant: 'primary', act }) })
    h.el.dataset.id = x.id
    return h
  }
  const notDummy = (val) => (E.DUMMY_PHONES.includes(val) ? 'Please enter a valid phone number.' : '')
  if (fx.type === 'patient-phone') {
    const p = S.find('patients', fx.patientId)
    open(`Fix phone — ${S.pfull(p)}`, 'Placeholder numbers such as 000-000-0000 are flagged.', [
      { name: 'phoneCell', label: 'Cell phone', type: 'tel', span: 6, validate: notDummy, requiredIf: (v) => !v.phoneHome },
      { name: 'phoneHome', label: 'Home phone', type: 'tel', span: 6, validate: notDummy },
    ], { phoneCell: E.DUMMY_PHONES.includes(p.phoneCell) ? '' : p.phoneCell, phoneHome: E.DUMMY_PHONES.includes(p.phoneHome) ? '' : p.phoneHome }, 'exc.savePatient')
  } else if (fx.type === 'patient-address') {
    const p = S.find('patients', fx.patientId)
    open(`Fix address — ${S.pfull(p)}`, `ZIP codes are cross-referenced against the state. ${U.esc(p.address.zip)} belongs to ${E.zipState(p.address.zip) || 'an unknown state'}.`, [
      { name: 'line1', label: 'Street address', required: true, span: 12 },
      { name: 'city', label: 'City', required: true, span: 6 },
      { name: 'state', label: 'State', type: 'state', required: true, span: 3 },
      { name: 'zip', label: 'ZIP', type: 'zip', required: true, span: 3, validate: (val, v) => (E.zipState(val) && E.zipState(val) !== v.state ? 'Please enter a valid ZIP code.' : '') },
    ], p.address, 'exc.savePatient')
  } else if (fx.type === 'patient-length') {
    const p = S.find('patients', fx.patientId)
    const h = open(`Fix field length — ${S.pfull(p)}`, `Some values are longer than a claim allows. Edit them, or use the shortened version and review it before saving.`, [
      { name: 'firstName', label: 'First name', required: true, span: 6 },
      { name: 'lastName', label: 'Last name', required: true, span: 6 },
      { name: 'middleName', label: 'Middle name', span: 6 },
      { name: 'line1', label: 'Street address', required: true, span: 12, validate: (val) => (val.length > E.LIMITS.addressLine ? `Please shorten the address.` : '') },
    ], { firstName: p.firstName, lastName: p.lastName, middleName: p.middleName, line1: p.address.line1 }, 'exc.savePatient', `<div class="mt-12">${UI.btn({ label: `Fill in a truncated version (name ${E.LIMITS.name}, address ${E.LIMITS.addressLine} characters)`, size: 'sm', act: 'exc.truncate' })}</div>`)
    void h
  } else if (fx.type === 'case') {
    const c = S.find('cases', fx.caseId)
    open(`Complete case fields — ${c.name}`, 'Claims are held when injury date, employment status or subscriber details are missing.', [
      { name: 'injuryDate', label: 'Injury / onset date', type: 'date', span: 6, requiredIf: () => /Injury/.test(x.detail) },
      { name: 'employmentStatus', label: 'Employment status', span: 6, placeholder: 'e.g. Employed full time', requiredIf: () => /Employment/.test(x.detail) },
      { name: 'referrerId', label: 'Referring physician', type: 'select', span: 12, requiredIf: () => /referring/.test(x.detail), options: DB.referrers.filter((r) => r.practiceId === S.session.practiceId && E.npiValid(r.npi)).map((r) => ({ value: r.id, label: `${r.name} · NPI ${r.npi}` })) },
    ], c, 'exc.saveCase')
  } else if (fx.type === 'coverage') {
    const cv = S.find('coverages', fx.coverageId)
    open('Complete subscriber details', 'Primary insurance subscriber details are required when the patient is not the subscriber.', [
      { name: 'name', label: 'Subscriber name', required: true, span: 6 },
      { name: 'dob', label: 'Subscriber DOB', type: 'date', required: true, span: 6 },
    ], cv.subscriber || {}, 'exc.saveCoverage')
  } else if (fx.type === 'referrer') {
    const r = S.find('referrers', fx.referrerId)
    open(`Fix referring physician — ${r.name}`, 'Placeholder NPIs such as 9999999999 and 1234567890 are flagged. Correct the NPI on the directory profile, or point the case to another physician.', [
      { name: 'mode', label: 'How to fix it', type: 'radio', required: true, options: [{ value: 'npi', label: `Correct ${r.name}’s NPI`, desc: 'Updates the referring physician directory for every case.' }, { value: 'swap', label: 'Use a different referring physician on this case' }] },
      { name: 'npi', label: 'Correct NPI', type: 'npi', span: 6, requiredIf: (v) => v.mode === 'npi', validate: (val) => (E.DUMMY_NPIS.includes(val) ? 'Please enter a valid NPI.' : '') },
      { name: 'referrerId', label: 'Referring physician', type: 'select', span: 6, requiredIf: (v) => v.mode === 'swap', options: DB.referrers.filter((rr) => rr.practiceId === S.session.practiceId && E.npiValid(rr.npi)).map((rr) => ({ value: rr.id, label: rr.name })) },
    ], { mode: 'npi' }, 'exc.saveReferrer')
  } else if (fx.type === 'provider-npi') {
    const p = S.find('providers', fx.providerId)
    open(`Add rendering NPI — ${S.provName(p)}`, 'The rendering provider’s individual NPI is required before claim assembly.', [
      { name: 'npi', label: 'Individual NPI', type: 'npi', required: true, span: 6, validate: (val) => (E.DUMMY_NPIS.includes(val) ? 'Please enter a valid NPI.' : '') },
    ], {}, 'exc.saveProvider')
  } else if (fx.type === 'fee') {
    const code = E.pc(fx.procedureCodeId)
    const ins = fx.insuranceId ? S.find('insurances', fx.insuranceId) : null
    open(`Price ${code.code} — ${code.description}`, 'This code is missing from both the payer-specific and the default fee schedule, so it was charged at $0.00. Set a default fee, add a payer rate, or both.', [
      { name: 'defaultFee', label: 'Default fee per unit', type: 'money', span: 6, placeholder: '0.00', requiredIf: (v) => !v.billed, help: 'Used when no payer row matches.' },
      ...(ins ? [{ type: 'section', label: `${ins.name} fee schedule` }, { name: 'billed', label: 'Billed per unit', type: 'money', span: 6, placeholder: '0.00' }] : []),
    ], {}, 'exc.saveFee')
  } else if (fx.type === 'era-claim') {
    const era = S.find('eras', x.eraId)
    const ec = era.claims[x.eraIdx]
    const cands = DB.claims.filter((c) => S.inScopeClaim(c) && c.status === 'Submitted' && E.insOf(S.find('coverages', c.coverageId)).id === era.insuranceId)
    const h = UI.modal({
      title: 'Map remittance to a claim',
      desc: `ERA ${U.esc(era.control)} paid ${U.money(U.sum(ec.lines, (l) => l.paid))} against claim control number ${U.esc(ec.claimNumber)}, which does not exist. Pick the claim it belongs to.`,
      size: 'md',
      body: `${UI.notice('critical', 'Payment · Unmapped payer remittance data.', U.esc(x.detail), 'alert')}<div class="mt-16">${cands.length ? UI.form([{ name: 'claimId', label: 'Claim', type: 'select', required: true, options: cands.map((c) => ({ value: c.id, label: `${c.number} · ${S.pfull(S.patientOfVisit(S.visitOf(c)))} · DOS ${U.date(S.visitOf(c).dos)} · ${U.money(c.total)}` })) }]) : UI.empty({ icon: 'search', title: 'No submitted claims for this payer', text: 'There is nothing to map this remittance to. Leave it open and ask the payer for a corrected ERA.' })}</div>`,
      foot: UI.btn({ label: 'Cancel', variant: 'quiet', act: 'layer.close' }) + (cands.length ? UI.btn({ label: 'Map and post', variant: 'primary', act: 'exc.saveEraClaim' }) : ''),
    })
    h.el.dataset.id = x.id
  } else if (fx.type === 'carc') {
    const code = (x.detail.match(/^([A-Z]{2}-\d+)/) || [])[1] || ''
    open(`Map adjustment code ${code}`, 'Automated posting is blocked for adjustment reason codes that have no mapping. Add it to the code list, then the remittance posts.', [
      { name: 'code', label: 'Code', required: true, span: 4, disabled: true },
      { name: 'desc', label: 'Description', required: true, span: 8, placeholder: 'e.g. Sequestration — reduction in federal payment' },
    ], { code, desc: code === 'CO-253' ? 'Sequestration — reduction in federal payment' : '' }, 'exc.saveCarc')
  } else {
    UI.toast('info', 'No fix form for this exception')
  }
}
const excOf = (el) => S.find('exceptions', el.closest('.layer').dataset.id)
ACT['exc.truncate'] = (el) => {
  const f = UI.formOf(el.closest('.layer'))
  const first = f.querySelector('[name="firstName"]')
  const last = f.querySelector('[name="lastName"]')
  const mid = f.querySelector('[name="middleName"]')
  first.value = first.value.split(' ')[0]
  mid.value = ''
  if (`${first.value} ${last.value}`.length > E.LIMITS.name) last.value = last.value.slice(0, E.LIMITS.name - first.value.length - 1)
  const line1 = f.querySelector('[name="line1"]')
  line1.value = line1.value.slice(0, E.LIMITS.addressLine)
  UI.toast('info', 'Truncated values filled in', 'Review them, then save.')
}
ACT['exc.savePatient'] = (el) => {
  const vals = UI.submitForm(UI.formOf(el.closest('.layer')))
  if (!vals) return
  const x = excOf(el)
  const p = S.find('patients', x.fix.patientId)
  ;['phoneCell', 'phoneHome', 'firstName', 'lastName', 'middleName'].forEach((k) => {
    if (k in vals) p[k] = vals[k]
  })
  ;['line1', 'city', 'state', 'zip'].forEach((k) => {
    if (k in vals) p.address[k] = vals[k]
  })
  S.log('Patient corrected from Billing Exceptions', { module: 'PATIENT', entityType: 'patient', entityId: p.id, detail: x.trigger })
  UI.closeTop()
  afterFix(x, 'Patient updated')
}
ACT['exc.saveCase'] = (el) => {
  const vals = UI.submitForm(UI.formOf(el.closest('.layer')))
  if (!vals) return
  const x = excOf(el)
  const c = S.find('cases', x.fix.caseId)
  if (vals.injuryDate) c.injuryDate = vals.injuryDate
  if (vals.employmentStatus) c.employmentStatus = vals.employmentStatus
  if (vals.referrerId) c.referrerId = vals.referrerId
  S.log('Case completed from Billing Exceptions', { module: 'PATIENT', entityType: 'case', entityId: c.id, detail: x.detail })
  UI.closeTop()
  afterFix(x, 'Case updated')
}
ACT['exc.saveCoverage'] = (el) => {
  const vals = UI.submitForm(UI.formOf(el.closest('.layer')))
  if (!vals) return
  const x = excOf(el)
  const cv = S.find('coverages', x.fix.coverageId)
  cv.subscriber = { ...(cv.subscriber || {}), ...vals }
  UI.closeTop()
  afterFix(x, 'Subscriber completed')
}
ACT['exc.saveReferrer'] = (el) => {
  const vals = UI.submitForm(UI.formOf(el.closest('.layer')))
  if (!vals) return
  const x = excOf(el)
  if (vals.mode === 'npi') {
    const r = S.find('referrers', x.fix.referrerId)
    r.npi = vals.npi
    S.log('Referring physician NPI corrected', { module: 'ADMIN', entityType: 'referrer', entityId: r.id, detail: `${r.name} → ${vals.npi}` })
  } else {
    const c = S.find('cases', x.fix.caseId)
    c.referrerId = vals.referrerId
    S.log('Referring physician changed on case', { module: 'PATIENT', entityType: 'case', entityId: c.id })
  }
  UI.closeTop()
  afterFix(x, 'Referring physician fixed')
}
ACT['exc.saveProvider'] = (el) => {
  const vals = UI.submitForm(UI.formOf(el.closest('.layer')))
  if (!vals) return
  const x = excOf(el)
  const p = S.find('providers', x.fix.providerId)
  p.npi = vals.npi
  S.log('Provider NPI added', { module: 'ADMIN', entityType: 'provider', entityId: p.id, detail: vals.npi })
  UI.closeTop()
  afterFix(x, 'Provider NPI saved')
}
ACT['exc.saveFee'] = (el) => {
  const vals = UI.submitForm(UI.formOf(el.closest('.layer')))
  if (!vals) return
  const x = excOf(el)
  const code = E.pc(x.fix.procedureCodeId)
  if (vals.defaultFee) code.defaultFee = Number(vals.defaultFee)
  if (vals.billed && x.fix.insuranceId) DB.feeSchedules.push({ id: U.id('fs'), insuranceId: x.fix.insuranceId, procedureCodeId: code.id, billed: Number(vals.billed), from: '2026-01-01', to: '2026-12-31' })
  DB.visits.filter((v) => ['Exception', 'Review', 'Pended', 'Delayed', 'Released'].includes(v.status)).forEach((v) => E.repriceVisit(v))
  S.log('Fee added for new CPT code', { module: 'ADMIN', entityType: 'procedureCode', entityId: code.id, detail: `${code.code}${vals.defaultFee ? ' default ' + U.money(vals.defaultFee) : ''}${vals.billed ? ' · payer ' + U.money(vals.billed) : ''}` })
  UI.closeTop()
  afterFix(x, `${code.code} priced`)
}
ACT['exc.saveEraClaim'] = (el) => {
  const vals = UI.submitForm(UI.formOf(el.closest('.layer')))
  if (!vals) return
  const x = excOf(el)
  const era = S.find('eras', x.eraId)
  const claim = S.find('claims', vals.claimId)
  const fresh = E.adjudicate(claim, 'paid')
  era.claims[x.eraIdx] = { ...fresh, status: 'pending' }
  const r = E.postEraClaim(era, x.eraIdx)
  x.status = 'Resolved'
  x.resolvedAt = S.now()
  x.resolvedBy = S.session.userId
  S.log('Remittance mapped to claim and posted', { module: 'PAYMENTS', entityType: 'exception', entityId: x.id, detail: `${claim.number} · ${U.money(r.paid)}` })
  UI.closeTop()
  UI.toast('success', 'Remittance posted', `${U.money(r.paid)} applied to ${claim.number}.${r.secondary ? ' A secondary claim was created.' : ''}`)
  S.emit('exception.resolved', x)
  R.refresh()
}
ACT['exc.saveCarc'] = (el) => {
  const vals = UI.submitForm(UI.formOf(el.closest('.layer')))
  if (!vals) return
  const x = excOf(el)
  const code = UI.formOf(el.closest('.layer')).querySelector('[name="code"]').value
  DB.carc.push({ code, desc: vals.desc })
  const era = S.find('eras', x.eraId)
  const r = E.postEraClaim(era, x.eraIdx)
  x.status = 'Resolved'
  x.resolvedAt = S.now()
  x.resolvedBy = S.session.userId
  S.log('Adjustment code mapped and remittance posted', { module: 'PAYMENTS', entityType: 'exception', entityId: x.id, detail: `${code} — ${vals.desc}` })
  UI.closeTop()
  UI.toast('success', `${code} mapped — remittance posted`, `${U.money(r.paid)} applied.${r.secondary ? ' A secondary claim was created.' : ''}`)
  S.emit('exception.resolved', x)
  R.refresh()
}

// ---------------------------------------------------------------- incomplete profiles
ACT['exc.completeProvider'] = (el) => {
  const p = S.find('providers', el.dataset.id)
  const h = UI.modal({
    title: 'Complete provider profile',
    desc: `${U.esc(p.draftFrom || '')}. Clinicians have no login — this is the provider entity that goes on claims.`,
    size: 'lg',
    body: UI.form(
      [
        { name: 'firstName', label: 'First name', required: true, span: 6 },
        { name: 'lastName', label: 'Last name', required: true, span: 6 },
        { name: 'credential', label: 'Credential', required: true, span: 4, placeholder: 'PT, DPT' },
        { name: 'specialty', label: 'Specialty', type: 'select', required: true, span: 8, options: ['PHYSICAL THERAPIST', 'OCCUPATIONAL THERAPIST', 'SPEECH-LANGUAGE PATHOLOGIST'] },
        { name: 'npi', label: 'Individual NPI', type: 'npi', required: true, span: 4, validate: (val) => (E.DUMMY_NPIS.includes(val) ? 'Please enter a valid NPI.' : '') },
        { name: 'taxonomy', label: 'Taxonomy code', required: true, span: 4, placeholder: '225100000X' },
        { name: 'stateLicense', label: 'State license', span: 4, placeholder: 'NY 000000' },
        { name: 'enrollAll', label: 'Mark as actively enrolled with every payer of this practice', type: 'checkbox', span: 12, desc: 'Credentialing is checked per payer at scrubbing. Leave unticked to set enrollments later in Admin → Providers.' },
      ],
      { ...p, specialty: 'PHYSICAL THERAPIST', taxonomy: '225100000X' },
    ),
    foot: UI.btn({ label: 'Cancel', variant: 'quiet', act: 'layer.close' }) + UI.btn({ label: 'Complete profile', variant: 'primary', act: 'exc.saveDraftProvider' }),
  })
  h.el.dataset.id = p.id
}
ACT['exc.saveDraftProvider'] = (el) => {
  const layer = el.closest('.layer')
  const vals = UI.submitForm(UI.formOf(layer))
  if (!vals) return
  const p = S.find('providers', layer.dataset.id)
  Object.assign(p, { firstName: vals.firstName, lastName: vals.lastName, credential: vals.credential, specialty: vals.specialty, npi: vals.npi, taxonomy: vals.taxonomy, stateLicense: vals.stateLicense, draft: false, code: String(330 + DB.providers.length) })
  if (vals.enrollAll) p.enrollments = DB.insurances.filter((i) => i.practiceId === p.practiceId && !i.draft).map((i) => ({ insuranceId: i.id, status: 'Active', effective: DB.today }))
  S.log('Draft provider profile completed', { module: 'ADMIN', entityType: 'provider', entityId: p.id, detail: S.provName(p) })
  UI.closeTop()
  const out = E.cascade()
  UI.toast('success', 'Provider profile completed', E.cascadeSummary(out) ? `Quarantined sessions released: ${E.cascadeSummary(out)}.` : '')
  S.emit('exception.resolved', p)
  R.refresh()
}
ACT['exc.completeIns'] = (el) => {
  const ins = S.find('insurances', el.dataset.id)
  const h = UI.modal({
    title: 'Complete insurance profile',
    desc: `${U.esc(ins.draftFrom || '')}. Billing rules on the payer change how claims are built.`,
    size: 'lg',
    body: UI.form(
      [
        { name: 'name', label: 'Payer name', required: true, span: 8 },
        { name: 'code', label: 'Code', type: 'number', required: true, span: 4, placeholder: '1060', validate: (val) => (DB.insurances.some((i) => i.id !== ins.id && i.practiceId === ins.practiceId && String(i.code) === String(val)) ? 'This code is already used.' : '') },
        { name: 'classId', label: 'Insurance class', type: 'select', required: true, span: 4, options: DB.insuranceClasses.filter((c) => c.practiceId === ins.practiceId && c.isActive).map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` })), help: 'Billing rules are inherited from the class; override them later in Admin → Insurances.' },
        { name: 'type', label: 'Insurance type (filing indicator)', type: 'select', required: true, span: 4, options: ['Commercial', 'Medicare', 'Workers Comp', 'PIP'] },
        { name: 'payerId', label: 'Clearinghouse payer ID', required: true, span: 4, placeholder: 'e.g. OSCAR' },
        { name: 'line1', label: 'Claims address', required: true, span: 12 },
        { name: 'city', label: 'City', required: true, span: 6 },
        { name: 'state', label: 'State', type: 'state', required: true, span: 3 },
        { name: 'zip', label: 'ZIP', type: 'zip', required: true, span: 3 },
      ],
      { name: ins.name, classId: (DB.insuranceClasses.find((c) => c.practiceId === ins.practiceId && c.code === 'COM') || {}).id, type: 'Commercial', payerId: 'OSCAR', code: 1060 },
    ),
    foot: UI.btn({ label: 'Cancel', variant: 'quiet', act: 'layer.close' }) + UI.btn({ label: 'Complete profile', variant: 'primary', act: 'exc.saveDraftIns' }),
  })
  h.el.dataset.id = ins.id
}
ACT['exc.saveDraftIns'] = (el) => {
  const layer = el.closest('.layer')
  const vals = UI.submitForm(UI.formOf(layer))
  if (!vals) return
  const ins = S.find('insurances', layer.dataset.id)
  Object.assign(ins, { name: vals.name, code: Number(vals.code), classId: vals.classId, type: vals.type, payerId: vals.payerId, address: { line1: vals.line1, city: vals.city, state: vals.state, zip: vals.zip }, draft: false })
  DB.providers.filter((p) => p.practiceId === ins.practiceId && !p.draft).forEach((p) => {
    if (!p.enrollments.some((e) => e.insuranceId === ins.id)) p.enrollments.push({ insuranceId: ins.id, status: 'Active', effective: DB.today })
  })
  DB.visits.filter((v) => v.status === 'Incomplete').forEach((v) => E.repriceVisit(v))
  S.log('Draft insurance profile completed', { module: 'ADMIN', entityType: 'insurance', entityId: ins.id, detail: ins.name })
  UI.closeTop()
  const out = E.cascade()
  UI.toast('success', 'Insurance profile completed', E.cascadeSummary(out) ? `Quarantined sessions released: ${E.cascadeSummary(out)}.` : '')
  S.emit('exception.resolved', ins)
  R.refresh()
}
