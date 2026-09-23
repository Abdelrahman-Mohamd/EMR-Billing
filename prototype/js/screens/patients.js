/* Patients — roster, and the chart in the EMR-V.2 two-tier grammar:
   PATIENT group · scoping boundary · case switcher · CASE group. */

const Pt = {
  cases: (pid) => DB.cases.filter((c) => c.patientId === pid),
  lines: (pid) => DB.chargeLines.filter((l) => {
    const v = S.find('visits', l.visitId)
    return v && !l.void && !l.dropped && l.billed && S.caseOf(v).patientId === pid
  }),
  balance: (pid) => U.sum(Pt.lines(pid), (l) => l.balIns + l.balPat),
  primaryPayer: (pid) => {
    const c = Pt.cases(pid).find((x) => x.isActive) || Pt.cases(pid)[0]
    const ins = c ? E.primaryIns(c.id) : null
    return ins ? ins.name : ''
  },
  flag: (pid) => {
    const vs = DB.visits.filter((v) => S.caseOf(v).patientId === pid)
    if (vs.some((v) => ['Exception', 'Incomplete'].includes(v.status))) return { tone: 'critical', text: 'Billing exception' }
    if (vs.some((v) => v.status === 'Pended')) return { tone: 'warning', text: 'Pended visit' }
    return null
  },
  mask: (ssn) => (ssn ? `***-**-${ssn.slice(-4)}` : ''),
}

// ================================================================= roster
Screens.patients = {
  render(parts, q) {
    if (parts[0]) return Chart.render(parts, q)
    const v = S.view('patients', { q: '', sort: 'name', dir: 'asc', page: 1, f: { location: '', payer: '', status: 'Active', balance: false } })
    let rows = DB.patients.filter(S.inScopePatient).map((p) => ({
      id: p.id, p, name: S.pname(p), dob: p.dob, billingId: p.billingId, emrId: p.emrId, cases: Pt.cases(p.id).length,
      payer: Pt.primaryPayer(p.id), balance: Pt.balance(p.id), flag: Pt.flag(p.id), status: p.isActive ? 'Active' : 'Inactive',
      // PRD V2: location lives on the visit (CH-04)
      locs: U.uniq(DB.visits.filter((v) => Pt.cases(p.id).some((c) => c.id === v.caseId)).map((v) => v.locationId)),
    }))
    const query = v.q.toLowerCase()
    if (query) rows = rows.filter((r) => `${r.p.firstName} ${r.p.lastName} ${r.p.lastName}, ${r.p.firstName}`.toLowerCase().includes(query) || String(r.billingId).includes(query) || String(r.emrId).includes(query))
    const f = v.f
    if (f.location) rows = rows.filter((r) => r.locs.includes(f.location))
    if (f.payer) rows = rows.filter((r) => r.payer === f.payer)
    if (f.status !== 'All') rows = rows.filter((r) => r.status === f.status)
    if (f.balance) rows = rows.filter((r) => r.balance > 0)
    const nFilters = (f.location ? 1 : 0) + (f.payer ? 1 : 0) + (f.status !== 'Active' ? 1 : 0) + (f.balance ? 1 : 0)
    const cols = [
      { key: 'name', label: 'Patient', sort: true, render: (r) => `<a href="#/patients/${r.id}" class="ink fw-500 t-meta">${U.esc(r.p.lastName)}, <span style="font-weight:400;color:var(--n600)">${U.esc(r.p.firstName)}</span></a><span class="sub">Billing ID ${r.billingId}${r.flag ? ` · <span class="status ${r.flag.tone}" style="font-size:13px">${r.flag.text}</span>` : ''}</span>` },
      { key: 'dob', label: 'Born', sort: true, render: (r) => U.date(r.dob) },
      { key: 'emrId', label: 'EMR ID', sort: true, render: (r) => r.emrId },
      { key: 'cases', label: 'Cases', sort: true, cls: 'c', render: (r) => r.cases },
      { key: 'payer', label: 'Primary insurance', sort: true, render: (r) => U.esc(r.payer) || '<span class="muted">—</span>' },
      { key: 'balance', label: 'Open balance', sort: true, cls: 'r', render: (r) => `<span class="num ${r.balance ? 'ink' : 'muted'}">${U.money(r.balance)}</span>` },
      { key: 'status', label: 'Status', sort: true, render: (r) => UI.status(r.status === 'Active' ? 'success' : 'inert', r.status) },
    ]
    const table = UI.table({
      cols, rows, view: v, viewKey: 'patients', rowAct: 'pt.open', mark: (r) => (r.flag ? r.flag.tone : null), noun: 'patient',
      empty: query || nFilters ? UI.empty({ icon: 'search', title: 'No patients match', text: 'Try a different name or clear the filters.', action: UI.btn({ label: 'Clear search and filters', act: 'pt.clearAll' }) }) : UI.empty({ icon: 'users', title: 'No patients yet', text: 'Patients arrive from the EMR with their first finalized note, or can be added here.' }),
    })
    return `<div class="screen"><div class="page-x screen-head"><div><h1 class="screen-title">Patients</h1><p class="screen-sub">${U.esc(S.practice().name)} · ${U.esc(S.locationScopeLabel())}${S.level('PATIENT') === 'view' ? ' · ' + UI.chip('inert', 'View only') : ''}</p></div></div>
      <div class="page-x"><div class="control-line">${UI.qsearch('pt-q', v.q, 'Search by name, Billing ID or EMR ID…', 'pt.search')}${UI.filtersBtn(nFilters, 'pt.filters', 'pt.clearFilters')}<div class="ml-auto row-wrap">${S.can('PATIENT', 'c') ? UI.btn({ label: 'New patient', icon: 'userPlus', variant: 'primary', act: 'pt.new' }) : ''}</div></div>${table}</div></div>`
  },
}
ACT['pt.search'] = U.debounce((el) => {
  S.view('patients', {}).q = el.value
  S.view('patients', {}).page = 1
  R.refresh()
}, 220)
ACT['pt.open'] = (el) => R.go(`#/patients/${el.dataset.id}`)
ACT['pt.clearFilters'] = () => {
  S.view('patients', {}).f = { location: '', payer: '', status: 'Active', balance: false }
  R.refresh()
}
ACT['pt.clearAll'] = () => {
  const v = S.view('patients', {})
  v.q = ''
  v.f = { location: '', payer: '', status: 'Active', balance: false }
  R.refresh()
}
ACT['pt.filters'] = () => {
  const v = S.view('patients', {})
  const payers = U.uniq(DB.insurances.filter((i) => i.practiceId === S.session.practiceId && !i.draft).map((i) => i.name))
  const h = UI.drawer({
    title: 'Filter patients',
    desc: 'Filters apply when you press Search.',
    body: UI.form(
      [
        { name: 'location', label: 'Location', type: 'select', options: S.locationsOfPractice().filter((l) => S.locAllowed(l.id)).map((l) => ({ value: l.id, label: l.name })), placeholder: 'All locations' },
        { name: 'payer', label: 'Primary insurance', type: 'select', options: payers, placeholder: 'Any insurance' },
        { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive', 'All'], placeholder: false },
        { name: 'balance', label: 'Only patients with an open balance', type: 'checkbox' },
      ],
      v.f,
    ),
    foot: UI.btn({ label: 'Reset', variant: 'quiet', act: 'pt.filtersReset' }) + UI.btn({ label: 'Search', variant: 'primary', icon: 'search', act: 'pt.filtersApply' }),
  })
  void h
}
ACT['pt.filtersReset'] = (el) => {
  const f = UI.formOf(el.closest('.drawer'))
  f.querySelector('[name="location"]').value = ''
  f.querySelector('[name="payer"]').value = ''
  f.querySelector('[name="status"]').value = 'Active'
  f.querySelector('[name="balance"]').checked = false
}
ACT['pt.filtersApply'] = (el) => {
  const vals = UI.readValues(UI.formOf(el.closest('.drawer')))
  const v = S.view('patients', {})
  v.f = vals
  v.page = 1
  UI.closeTop()
  R.refresh()
}

// ---- patient form (new + edit)
const patientSpecs = (isNew) => [
  { type: 'section', label: 'Patient' },
  { name: 'firstName', label: 'First name', required: true, span: 4, placeholder: 'First name', maxLength: 40 },
  { name: 'middleName', label: 'Middle name', span: 4, placeholder: 'Optional', maxLength: 30 },
  { name: 'lastName', label: 'Last name', required: true, span: 4, placeholder: 'Last name', maxLength: 40 },
  { name: 'dob', label: 'Date of birth', type: 'date', required: true, span: 4, help: 'Required for billing.', validate: (val) => (val > DB.today ? 'Please enter a valid date.' : '') },
  { name: 'gender', label: 'Gender', type: 'select', options: ['Female', 'Male', 'Other'], required: true, span: 4, help: 'Required for billing.' },
  { name: 'ssn', label: 'SSN', span: 4, placeholder: '000-00-0000', maxLength: 11, help: 'Optional. Stored encrypted; masked for everyone but System Admin.', validate: (val) => (/^\d{3}-\d{2}-\d{4}$/.test(val) ? '' : 'Please enter a valid SSN.') },
  { type: 'section', label: 'Contact' },
  { name: 'phoneCell', label: 'Cell phone', type: 'tel', span: 4, placeholder: '718-555-0100' },
  { name: 'phoneHome', label: 'Home phone', type: 'tel', span: 4, placeholder: '718-555-0100' },
  { name: 'email', label: 'Email', type: 'email', span: 4, placeholder: 'name@example.com' },
  { type: 'section', label: 'Address' },
  { name: 'line1', label: 'Street address', required: true, span: 8, placeholder: 'Street and number', help: 'Required for billing (Box 5).' },
  { name: 'line2', label: 'Apt, suite', span: 4, placeholder: 'Optional' },
  { name: 'city', label: 'City', required: true, span: 6, placeholder: 'City' },
  { name: 'state', label: 'State', type: 'state', required: true, span: 3, placeholder: 'NY' },
  { name: 'zip', label: 'ZIP', type: 'zip', required: true, span: 3, placeholder: '11209' },
  { type: 'section', label: 'Guarantor (responsible party)' },
  { name: 'guarantorType', label: 'Who receives statements', type: 'select', options: [{ value: 'self', label: 'The patient' }, { value: 'other', label: 'Another person' }], placeholder: false, span: 4 },
  { name: 'gName', label: 'Guarantor name', span: 4, placeholder: 'Full name', requiredIf: (vals) => vals.guarantorType === 'other' },
  { name: 'gRel', label: 'Relationship', type: 'select', options: ['Spouse', 'Parent', 'Child', 'Other'], span: 4, requiredIf: (vals) => vals.guarantorType === 'other' },
  { name: 'gLine1', label: 'Guarantor address', span: 6, placeholder: 'Street address', requiredIf: (vals) => vals.guarantorType === 'other' },
  { name: 'gCity', label: 'City', span: 3, requiredIf: (vals) => vals.guarantorType === 'other' },
  { name: 'gState', label: 'State', type: 'state', span: 1, requiredIf: (vals) => vals.guarantorType === 'other' },
  { name: 'gZip', label: 'ZIP', type: 'zip', span: 2, requiredIf: (vals) => vals.guarantorType === 'other' },
  { type: 'section', label: 'Notes' },
  { name: 'notes', label: 'Internal notes', type: 'textarea', span: 12, placeholder: 'Visible to staff only', rows: 2 },
  ...(isNew
    ? [
        { type: 'section', label: 'First case' },
        { type: 'note', label: 'A “Default” case is created with the patient. Add the referring physician, diagnoses and coverage to it before billing.' },
      ]
    : []),
]
const patientValues = (p) => ({
  firstName: p.firstName, middleName: p.middleName, lastName: p.lastName, dob: p.dob, gender: p.gender,
  ssn: S.canDecrypt() ? p.ssn : '', phoneCell: p.phoneCell, phoneHome: p.phoneHome, email: p.email,
  line1: p.address.line1, line2: p.address.line2, city: p.address.city, state: p.address.state, zip: p.address.zip,
  guarantorType: p.guarantor ? 'other' : 'self', gName: p.guarantor?.name, gRel: p.guarantor?.relationship,
  gLine1: p.guarantor?.address?.line1, gCity: p.guarantor?.address?.city, gState: p.guarantor?.address?.state, gZip: p.guarantor?.address?.zip,
  notes: p.notes,
})
const applyPatient = (p, vals) => {
  Object.assign(p, {
    firstName: vals.firstName, middleName: vals.middleName, lastName: vals.lastName, dob: vals.dob, gender: vals.gender,
    phoneCell: vals.phoneCell, phoneHome: vals.phoneHome, email: vals.email,
    address: { line1: vals.line1, line2: vals.line2, city: vals.city, state: vals.state, zip: vals.zip },
    guarantor: vals.guarantorType === 'other' ? { name: vals.gName, relationship: vals.gRel, address: { line1: vals.gLine1, city: vals.gCity, state: vals.gState, zip: vals.gZip } } : null,
    notes: vals.notes,
  })
  if (vals.ssn) p.ssn = vals.ssn
}
ACT['pt.new'] = () => {
  UI.modal({
    title: 'New patient',
    desc: 'Patients usually arrive from the EMR with their first finalized note. Add one by hand when a charge is entered manually.',
    size: 'lg',
    body: UI.form(patientSpecs(true), { guarantorType: 'self', gender: '', state: 'NY' }),
    foot: UI.btn({ label: 'Cancel', variant: 'quiet', act: 'layer.close' }) + UI.btn({ label: 'Create patient', variant: 'primary', act: 'pt.create' }),
  })
}
ACT['pt.create'] = (el) => {
  const vals = UI.submitForm(UI.formOf(el.closest('.layer')))
  if (!vals) return
  const p = { id: U.id('p'), practiceId: S.session.practiceId, billingId: 10412 + DB.patients.length + 40, emrId: null, ssn: '', isActive: true }
  applyPatient(p, vals)
  DB.patients.unshift(p)
  const c = { id: U.id('c'), patientId: p.id, name: 'Default', referrerId: null, injuryType: '', injuryDate: null, startOfCare: DB.today, dischargeDate: null, accidentState: '', employmentStatus: '', isActive: true, dx: [] }
  DB.cases.push(c)
  S.log('Patient created', { module: 'PATIENT', entityType: 'patient', entityId: p.id, detail: `${S.pfull(p)} · Default case created` })
  UI.closeTop()
  UI.toast('success', 'Patient created', 'A “Default” case was added. Add insurance coverage and diagnoses before the first charge.')
  R.go(`#/patients/${p.id}/coverage?case=${c.id}`)
}

// ================================================================= chart
const Chart = {
  render(parts, q) {
    const p = S.find('patients', parts[0])
    if (!p || !S.inScopePatient(p)) return `<div class="screen"><div class="page-x screen-head"><h1 class="screen-title">Patient not found</h1></div><div class="page-x">${UI.empty({ icon: 'users', title: 'This patient is not in the current practice', text: 'Switch company or go back to the roster.', action: UI.btn({ label: 'Back to patients', act: 'go', data: { hash: '#/patients' } }) })}</div></div>`
    const tab = parts[1] || 'profile'
    const cases = Pt.cases(p.id)
    const st = S.view(`chart-${p.id}`, { caseId: (cases.find((c) => c.isActive) || cases[0] || {}).id })
    if (q.case && cases.some((c) => c.id === q.case)) st.caseId = q.case
    const c = S.find('cases', st.caseId) || cases[0]
    const primary = c ? E.primaryIns(c.id) : null
    const phone = p.phoneCell || p.phoneHome
    const canEdit = S.can('PATIENT', 'u')
    const covs = c ? E.coverages(c.id) : []
    const auths = DB.authorizations.filter((a) => covs.some((cv) => cv.id === a.coverageId))
    const visits = c ? DB.visits.filter((v) => v.caseId === c.id && v.status !== 'Inactive') : []
    const link = (key, label, icon, n) => `<a class="subnav-link ${tab === key ? 'active' : ''}" href="#/patients/${p.id}/${key}${c ? `?case=${c.id}` : ''}">${I(icon)}<span>${label}</span>${n !== undefined ? `<span class="n">${n}</span>` : ''}</a>`
    const side = `<aside class="subnav"><span class="eyebrow">Patient</span>${link('profile', 'Profile', 'user')}${link('ledger', 'Ledger', 'receipt')}
      <div class="subnav-rule"></div>
      ${c ? `<button type="button" class="case-switch" data-act="chart.caseMenu" data-id="${p.id}"><span class="row"><span class="eyebrow" style="margin:0;padding:0">Case</span><span class="ml-auto muted">${I('chevronDown', 'icon-14')}</span></span><span class="cs-name">${U.esc(c.name)}</span><span class="cs-sub">${cases.length > 1 ? `${cases.length} cases · ` : ''}${c.startOfCare ? 'Since ' + U.date(c.startOfCare) : 'No start of care'}${c.isActive ? '' : ' · Closed'}</span></button>` : ''}
      <span class="eyebrow">Case</span>${c ? link('case', 'Case details', 'file') + link('diagnoses', 'Diagnoses', 'hash', c.dx.length) + link('coverage', 'Insurance', 'landmark', covs.length) + link('authorizations', 'Authorizations', 'fileCheck', auths.length) + link('visits', 'Visits & claims', 'send', visits.length) : ''}</aside>`
    const body = {
      profile: () => Chart.profile(p),
      ledger: () => Chart.ledger(p),
      case: () => Chart.caseTab(p, c),
      diagnoses: () => Chart.dxTab(p, c),
      coverage: () => Chart.covTab(p, c, covs),
      authorizations: () => Chart.authTab(p, c, covs, auths),
      visits: () => Chart.visitsTab(p, c, visits),
    }[tab]
    const flag = Pt.flag(p.id)
    return `<div class="screen-split">${side}<div class="subnav-content">
      <div class="chart-head"><div class="grow"><a class="back-link" href="#/patients">${I('arrowLeft', 'icon-14')} Patients</a><h1 class="chart-name">${U.esc(p.lastName)}<span class="first">${U.esc(p.firstName)}</span>${UI.chip(p.isActive ? 'success' : 'inert', p.isActive ? 'Active' : 'Inactive')}${flag ? UI.chip(flag.tone, flag.text) : ''}</h1>
        <div class="chart-meta"><span>Billing ID ${p.billingId}</span><span class="sep">·</span><span>EMR ${p.emrId || '—'}</span><span class="sep">·</span><span>${U.date(p.dob)} · ${U.age(p.dob, DB.today)}y</span><span class="sep">·</span><span>${U.esc(phone || 'No phone')}</span><span class="sep">·</span><span>${U.esc(primary ? primary.name : 'No insurance')}</span></div></div>
        <div class="row-wrap">${S.can('CHARGES', 'c') && c ? UI.btn({ label: 'New charge', icon: 'plus', variant: 'primary', act: 'go', data: { hash: `#/charges/new?patient=${p.id}&case=${c.id}` } }) : ''}${UI.btn({ label: 'More', icon: 'more', act: 'chart.more', data: { id: p.id } })}</div></div>
      <div class="chart-body">${body ? body() : UI.empty({ title: 'Unknown tab' })}</div></div></div>`
  },

  profile(p) {
    const ex = DB.exceptions.filter((x) => x.status === 'Open' && x.level === 'Patient' && x.fix && x.fix.patientId === p.id)
    const ssnVal = p.ssn ? (S.canDecrypt() ? (S.view('ssn', { show: false }).show ? p.ssn : Pt.mask(p.ssn)) : Pt.mask(p.ssn)) : ''
    const ssnCtl = p.ssn && S.canDecrypt() ? ` <button type="button" class="link-btn t-micro" data-act="chart.ssn">${S.view('ssn', { show: false }).show ? 'Hide' : 'Reveal'}</button>` : p.ssn ? ' <span class="muted t-micro">(masked for your role)</span>' : ''
    return `${ex.length ? `<div class="mt-16">${UI.notice('critical', `${U.plural(ex.length, 'billing exception')} on this patient.`, ex.map((x) => U.esc(x.trigger + ' — ' + x.detail)).join(' ') + ` <a href="#/exceptions">Open Exceptions</a>`, 'alert')}</div>` : ''}
      <div class="section">${UI.sectionHead('Demographics', 'Required for billing: date of birth, gender, address', S.can('PATIENT', 'u') ? UI.btn({ label: 'Edit patient', icon: 'pencil', size: 'sm', act: 'chart.editPatient', data: { id: p.id } }) : '')}
      ${UI.kv([['Name', `${p.firstName} ${p.middleName ? p.middleName + ' ' : ''}${p.lastName}`], ['Date of birth', `${U.date(p.dob)} (${U.age(p.dob, DB.today)} years)`], ['Gender', p.gender], ['SSN', ssnVal + ssnCtl, true], ['Billing ID', String(p.billingId)], ['EMR ID (sync key)', p.emrId ? String(p.emrId) : '']])}</div>
      <div class="section">${UI.sectionHead('Contact & address')}${UI.kv([['Cell phone', p.phoneCell], ['Home phone', p.phoneHome], ['Email', p.email], ['Address', `${p.address.line1}${p.address.line2 ? ', ' + p.address.line2 : ''}<br>${U.esc(p.address.city)}, ${U.esc(p.address.state)} ${U.esc(p.address.zip)}`, true]])}</div>
      <div class="section">${UI.sectionHead('Guarantor')}${UI.kv([['Guarantor', p.guarantor ? `${p.guarantor.name} (${p.guarantor.relationship})${p.guarantor.address && p.guarantor.address.line1 ? `<span class="sub">${U.esc(p.guarantor.address.line1)}, ${U.esc(p.guarantor.address.city)}, ${U.esc(p.guarantor.address.state)} ${U.esc(p.guarantor.address.zip)}</span>` : ''}` : 'The patient'], ['Internal notes', p.notes]])}</div>
      <div class="section">${UI.sectionHead('History')}${UI.historyView('patient', p.id)}</div>`
  },

  ledger(p) {
    const lines = Pt.lines(p.id)
    const pays = (l, kind) => U.sum(DB.payments.filter((x) => x.chargeLineId === l.id && x.kind === kind && !x.reversed), (x) => x.amount)
    const rows = lines.map((l) => {
      const v = S.find('visits', l.visitId)
      return { id: l.id, l, v, dos: v.dos, code: E.pc(l.procedureCodeId).code, charge: l.amount, ins: pays(l, 'Insurance payment'), adj: pays(l, 'Adjustment'), pat: pays(l, 'Patient payment'), balIns: l.balIns, balPat: l.balPat }
    })
    const v = S.view(`ledger-${p.id}`, { sort: 'dos', dir: 'desc', page: 1 })
    const unapplied = U.sum(DB.payments.filter((x) => x.patientId === p.id && x.unapplied), (x) => x.amount)
    const tot = (k) => U.money(U.sum(rows, (r) => r[k]))
    return `<div class="section">${UI.sectionHead('Ledger', 'Every billed charge line across all cases', S.can('PAYMENTS', 'c') ? UI.btn({ label: 'Post patient payment', icon: 'wallet', size: 'sm', variant: 'primary', act: 'chart.patPay', data: { id: p.id } }) : '')}
      <div class="balance mt-12 mb-16"><div><div class="eyebrow">Charges</div><div class="bv">${tot('charge')}</div></div><div><div class="eyebrow">Insurance balance</div><div class="bv">${tot('balIns')}</div></div><div><div class="eyebrow">Patient balance</div><div class="bv ${U.sum(rows, (r) => r.balPat) ? 'off' : ''}">${tot('balPat')}</div></div><div><div class="eyebrow">Unapplied credit</div><div class="bv">${U.money(unapplied)}</div></div></div>
      ${UI.table({
        cols: [
          { key: 'dos', label: 'DOS', sort: true, render: (r) => U.date(r.dos) },
          { key: 'code', label: 'Code', sort: true, render: (r) => `<span class="code">${r.code}</span> <span class="muted">×${r.l.units}</span>` },
          { key: 'charge', label: 'Charge', sort: true, cls: 'r', render: (r) => U.money(r.charge) },
          { key: 'ins', label: 'Ins. paid', cls: 'r', render: (r) => U.money(r.ins) },
          { key: 'adj', label: 'Adjustments', cls: 'r', render: (r) => U.money(r.adj) },
          { key: 'pat', label: 'Patient paid', cls: 'r', render: (r) => U.money(r.pat) },
          { key: 'balIns', label: 'Ins. balance', sort: true, cls: 'r', render: (r) => `<span class="${r.balIns ? 'ink' : 'muted'}">${U.money(r.balIns)}</span>` },
          { key: 'balPat', label: 'Pt. balance', sort: true, cls: 'r', render: (r) => `<span class="${r.balPat ? 'ink fw-500' : 'muted'}">${U.money(r.balPat)}</span>` },
        ],
        rows, view: v, viewKey: `ledger-${p.id}`, pageSize: 15, noun: 'charge line',
        empty: UI.empty({ icon: 'receipt', title: 'No billed charges yet', text: 'Charge lines appear here once a claim has been submitted.' }),
      })}</div>`
  },

  caseTab(p, c) {
    if (!c) return UI.empty({ title: 'No case', text: 'Create a case first.' })
    const ins = E.primaryIns(c.id)
    const ref = S.find('referrers', c.referrerId)
    const seen = U.uniq(DB.visits.filter((v) => v.caseId === c.id && v.status !== 'Inactive').map((v) => S.find('locations', v.locationId)?.name).filter(Boolean))
    const ex = DB.exceptions.filter((x) => x.status === 'Open' && x.level === 'Case' && x.fix && (x.fix.caseId === c.id || S.find('visits', x.visitId)?.caseId === c.id))
    const need = (val) => (val ? '' : ' <span class="chip tone-critical nodot">Required for billing</span>')
    return `${ex.length ? `<div class="mt-16">${UI.notice('critical', 'Case-level billing exception.', ex.map((x) => U.esc(x.detail)).join(' '), 'alert')}</div>` : ''}
      <div class="section">${UI.sectionHead('Case details', 'Every visit inherits the referring physician, diagnoses, injury type and onset date', S.can('PATIENT', 'u') ? UI.btn({ label: 'Edit case', icon: 'pencil', size: 'sm', act: 'chart.editCase', data: { id: c.id } }) : '')}
      ${UI.kv([
        ['Case name', c.name], ['Status', c.isActive ? 'Open' : 'Closed'],
        ['Referring physician', (ref ? `${U.esc(ref.name)} · ${ref.type === 'DQ' ? 'Supervising (DQ)' : 'Referring (DN)'} · NPI ${U.esc(ref.npi)}` : '') + need(ref), true],
        ['Injury type (related cause)', c.injuryType || 'Not related to an injury'],
        ['Injury / onset date', (c.injuryDate ? U.date(c.injuryDate) : '') + (!c.injuryDate && (['Employment Related', 'Auto'].includes(c.injuryType) || (ins && E.eff(ins, 'injuryDateRequired'))) ? need(false) : ''), true],
        ['Visit locations', seen.length ? U.esc(seen.join(', ')) + ' <span class="muted t-micro">· set on each visit</span>' : '<span class="muted">Set on each visit</span>', true],
        ['Accident state', c.accidentState], ['Employment status', c.employmentStatus],
        ['Start of care', c.startOfCare ? U.date(c.startOfCare) : ''], ['Discharge date', c.dischargeDate ? U.date(c.dischargeDate) : ''],
      ])}</div>
      <div class="section">${UI.sectionHead('Other cases for this patient', '', S.can('PATIENT', 'c') ? UI.btn({ label: 'New case', icon: 'plus', size: 'sm', act: 'chart.newCase', data: { id: p.id } }) : '')}
      <ul class="dx-list">${Pt.cases(p.id).map((x) => `<li><span class="dx-ptr" style="background:${x.id === c.id ? 'var(--brand)' : 'var(--brand-wash)'};color:${x.id === c.id ? '#fff' : 'var(--brand-deep)'}">${I('file', 'icon-14')}</span><div class="grow"><div class="ink fw-500">${U.esc(x.name)}</div><div class="t-micro muted">${x.startOfCare ? 'Since ' + U.date(x.startOfCare) : ''} · ${U.esc(E.primaryIns(x.id)?.name || 'No insurance')} · ${x.isActive ? 'Open' : 'Closed'}</div></div>${x.id === c.id ? UI.tag('Selected', 'brand') : UI.btn({ label: 'Switch', size: 'sm', act: 'go', data: { hash: `#/patients/${p.id}/case?case=${x.id}` } })}</li>`).join('')}</ul></div>`
  },

  dxTab(p, c) {
    if (!c) return ''
    const can = S.can('PATIENT', 'u')
    return `<div class="section">${UI.sectionHead('Diagnoses (ICD-10)', `${c.dx.length} of 12 · the position is the diagnosis pointer on the claim (Box 21 / 24E)`, can ? UI.btn({ label: 'Add diagnosis', icon: 'plus', size: 'sm', variant: 'primary', act: 'dx.add', data: { id: c.id } }) : '')}
      ${c.dx.length ? `<ul class="dx-list">${c.dx.map((d, i) => `<li><span class="dx-ptr">${i + 1}</span><div class="grow"><span class="code">${U.esc(d.code)}</span> <span class="muted-2">${U.esc(d.desc)}</span>${i === 0 ? ' ' + UI.tag('Primary', 'brand') : ''}</div>${can ? `<div class="row-actions">${UI.iconBtn({ icon: 'arrowUp', label: 'Move up', act: 'dx.move', data: { id: c.id, i, d: -1 }, disabled: i === 0 })}${UI.iconBtn({ icon: 'arrowDown', label: 'Move down', act: 'dx.move', data: { id: c.id, i, d: 1 }, disabled: i === c.dx.length - 1 })}${UI.iconBtn({ icon: 'trash', label: 'Remove', act: 'dx.remove', data: { id: c.id, i }, danger: true })}</div>` : ''}</li>`).join('')}</ul>` : UI.empty({ icon: 'hash', title: 'No diagnoses on this case', text: 'At least one ICD-10 code is needed before a claim can point to it.' })}
      <div class="mt-16">${UI.notice('info', 'Visits keep a snapshot.', 'Each visit copies these codes when it arrives, so later edits here never change a claim that was already billed.')}</div></div>`
  },

  covTab(p, c, covs) {
    if (!c) return ''
    const can = S.can('PATIENT', 'u')
    const RANK = { 1: 'Primary', 2: 'Secondary', 3: 'Tertiary' }
    const cards = covs
      .map((cv) => {
        const ins = E.insOf(cv)
        const sub = cv.subscriber
        return `<div class="cov-card"><div class="row"><span class="rank">${RANK[cv.rank]}</span>${ins.draft ? UI.chip('critical', 'Draft insurance profile') : ''}<span class="ml-auto row-wrap">${can ? UI.btn({ label: 'Edit', icon: 'pencil', size: 'sm', act: 'cov.edit', data: { id: cv.id } }) + UI.iconBtn({ icon: 'trash', label: 'Remove coverage', act: 'cov.remove', data: { id: cv.id }, danger: true }) : ''}</span></div>
          <div class="t-row fw-500 ink mt-4">${U.esc(S.insLabel(ins))}</div><div class="t-micro muted">${U.esc((E.classOf(ins) || {}).name || '—')} · ${U.esc(ins.type || '—')} · Payer ID ${U.esc(ins.payerId || '—')}${E.eff(ins, 'authRequired') ? ' · Authorization required' : ''}${ins.insuranceHold ? ' · Insurance hold (manual release)' : ''}</div>
          ${UI.kv([['Member ID', cv.memberId], ['Group number', cv.groupNumber || '<span class="chip tone-critical nodot">Missing — required for billing</span>', !cv.groupNumber], ['Claim number', cv.claimNumber], ['Subscriber', sub ? `${sub.name || '(name missing)'} · ${sub.relationship || ''}${sub.dob ? ' · ' + U.date(sub.dob) : ''}` : 'The patient (self)'], cv.employer ? ['Employer (WC)', `${cv.employer.name} — ${cv.employer.address}`] : null])}</div>`
      })
      .join('')
    return `<div class="section">${UI.sectionHead('Coverage', 'Claims are addressed to a coverage rank, in payment order', can && covs.length < 3 ? UI.btn({ label: 'Add coverage', icon: 'plus', size: 'sm', variant: 'primary', act: 'cov.add', data: { id: c.id } }) : '')}<div class="mt-12">${cards || UI.empty({ icon: 'landmark', title: 'No insurance on this case', text: 'Visits on a case without primary coverage are pended.' })}</div></div>`
  },

  authTab(p, c, covs, auths) {
    if (!c) return ''
    const v = S.view(`auth-${c.id}`, { sort: 'start', dir: 'desc', page: 1 })
    const needs = covs.some((cv) => E.eff(E.insOf(cv), 'authRequired'))
    const rows = auths.map((a) => ({ id: a.id, a, number: a.number, start: a.start, end: a.end, remaining: E.authRemaining(a), payer: E.insOf(S.find('coverages', a.coverageId)).name }))
    return `<div class="section">${UI.sectionHead('Authorizations', needs ? 'The primary insurance requires authorization — visits without one are pended' : 'Not required by the primary insurance', S.can('PATIENT', 'c') && covs.length ? UI.btn({ label: 'Add authorization', icon: 'plus', size: 'sm', variant: 'primary', act: 'auth.add', data: { id: c.id }, demo: 'auth-add' }) : '')}
      ${UI.table({
        cols: [
          { key: 'number', label: 'Authorization #', sort: true, render: (r) => `<span class="code">${U.esc(r.number)}</span>` },
          { key: 'payer', label: 'Issued by', render: (r) => U.esc(r.payer) },
          { key: 'start', label: 'Active dates', sort: true, render: (r) => `${U.date(r.a.start)} – ${U.date(r.a.end)}` },
          { key: 'qty', label: 'Approved', cls: 'r', render: (r) => `${r.a.qty} ${r.a.unit.toLowerCase()}` },
          { key: 'used', label: 'Used', cls: 'r', render: (r) => r.a.used },
          { key: 'remaining', label: 'Remaining', sort: true, cls: 'r', render: (r) => `<span class="${r.remaining ? 'ink fw-500' : 'status critical'}">${r.remaining}</span>` },
          { key: 'status', label: 'Status', render: (r) => { const s = E.authStatus(r.a); return UI.chip(s.tone, s.label) } },
          { key: 'act', label: '', cls: 'r', render: (r) => S.can('PATIENT', 'd') ? UI.iconBtn({ icon: 'trash', label: 'Delete authorization', act: 'auth.remove', data: { id: r.id }, danger: true }) : '' },
        ],
        rows, view: v, viewKey: `auth-${c.id}`, noun: 'authorization',
        empty: UI.empty({ icon: 'fileCheck', title: 'No authorizations recorded', text: needs ? 'Add the payer’s approval to release pended visits and held claims.' : 'This payer does not require one.' }),
      })}</div>`
  },

  visitsTab(p, c, visits) {
    const v = S.view(`visits-${c.id}`, { sort: 'dos', dir: 'desc', page: 1 })
    const rows = visits.map((x) => ({ id: x.id, x, dos: x.dos, prov: S.provName(S.find('providers', x.treatingProviderId), false), amount: E.visitTotal(x) }))
    return `<div class="section">${UI.sectionHead('Visits & claims', 'One visit per date of service; one claim per coverage rank')}
      ${UI.table({
        cols: [
          { key: 'dos', label: 'DOS', sort: true, render: (r) => `<span class="ink fw-500">${U.date(r.dos)}</span>` },
          { key: 'prov', label: 'Rendering provider', sort: true, render: (r) => U.esc(r.prov) },
          { key: 'codes', label: 'Codes', render: (r) => U.esc(UI.codesText(E.linesOfVisit(r.id))) },
          { key: 'amount', label: 'Amount', sort: true, cls: 'r', render: (r) => U.money(r.amount) },
          { key: 'status', label: 'Visit', render: (r) => UI.visitChip(r.x) },
          { key: 'claims', label: 'Claims', render: (r) => E.claimsOfVisit(r.id).map((cl) => `<a href="#/claims/view/${cl.id}" class="t-micro">${cl.number}</a> ${UI.claimChip(cl)}`).join('<br>') || '<span class="muted">—</span>' },
        ],
        rows, view: v, viewKey: `visits-${c.id}`, rowAct: 'visit.open', noun: 'visit',
        empty: UI.empty({ icon: 'send', title: 'No visits on this case yet' }),
      })}</div>`
  },
}

ACT['chart.ssn'] = () => {
  const v = S.view('ssn', { show: false })
  v.show = !v.show
  if (v.show) S.log('SSN revealed', { module: 'PATIENT', detail: 'Decrypted for System Admin' })
  R.refresh()
}
ACT['visit.open'] = (el) => R.go(`#/charges/visit/${el.dataset.id}`)
ACT['chart.caseMenu'] = (el) => {
  const pid = el.dataset.id
  const items = Pt.cases(pid).map((c) => ({ label: c.name, sub: `${E.primaryIns(c.id)?.name || 'No insurance'} · ${c.isActive ? 'Open' : 'Closed'}`, act: 'chart.pickCase', data: { pid, id: c.id }, selected: S.view(`chart-${pid}`, {}).caseId === c.id }))
  if (S.can('PATIENT', 'c')) items.push('sep', { label: 'New case', icon: 'plus', act: 'chart.newCase', data: { id: pid } })
  UI.menu(el, items)
}
ACT['chart.pickCase'] = (el) => {
  UI.closeMenu()
  S.view(`chart-${el.dataset.pid}`, {}).caseId = el.dataset.id
  const { parts } = R.parse()
  R.go(`#/patients/${el.dataset.pid}/${parts[2] || 'case'}?case=${el.dataset.id}`)
}
ACT['chart.more'] = (el) => {
  const p = S.find('patients', el.dataset.id)
  const hasVisits = DB.visits.some((v) => S.caseOf(v).patientId === p.id)
  UI.menu(el, [
    ...(S.can('PATIENT', 'u') ? [{ label: p.isActive ? 'Deactivate patient' : 'Reactivate patient', icon: p.isActive ? 'ban' : 'refresh', act: 'chart.toggleActive', data: { id: p.id } }] : []),
    ...(S.can('PATIENT', 'd') ? [{ label: 'Delete patient', icon: 'trash', act: 'chart.delete', data: { id: p.id }, danger: true, disabled: hasVisits, sub: hasVisits ? 'Has visits — deactivate instead' : '' }] : []),
  ], { align: 'end' })
}
ACT['chart.toggleActive'] = async (el) => {
  UI.closeMenu()
  const p = S.find('patients', el.dataset.id)
  const ok = await UI.confirm({ title: p.isActive ? 'Deactivate this patient?' : 'Reactivate this patient?', message: p.isActive ? 'The patient is hidden from the active roster. Existing claims and balances are kept.' : 'The patient returns to the active roster.', confirmLabel: p.isActive ? 'Deactivate' : 'Reactivate', tone: p.isActive ? 'critical' : 'primary' })
  if (!ok) return
  p.isActive = !p.isActive
  S.log(p.isActive ? 'Patient reactivated' : 'Patient deactivated', { module: 'PATIENT', entityType: 'patient', entityId: p.id })
  UI.toast('success', p.isActive ? 'Patient reactivated' : 'Patient deactivated')
  R.refresh()
}
ACT['chart.delete'] = async (el) => {
  UI.closeMenu()
  const p = S.find('patients', el.dataset.id)
  const ok = await UI.confirm({ title: `Delete ${S.pfull(p)}?`, message: 'The patient and their cases are removed. This cannot be undone.', confirmLabel: 'Delete patient', tone: 'critical' })
  if (!ok) return
  const caseIds = Pt.cases(p.id).map((c) => c.id)
  DB.coverages = DB.coverages.filter((cv) => !caseIds.includes(cv.caseId))
  DB.cases = DB.cases.filter((c) => c.patientId !== p.id)
  DB.patients = DB.patients.filter((x) => x.id !== p.id)
  S.log('Patient deleted', { module: 'PATIENT', entityType: 'patient', entityId: p.id, detail: S.pfull(p) })
  UI.toast('success', 'Patient deleted')
  R.go('#/patients')
}
ACT['chart.editPatient'] = (el) => {
  const p = S.find('patients', el.dataset.id)
  const h = UI.modal({ title: `Edit ${S.pfull(p)}`, size: 'lg', body: UI.form(patientSpecs(false), patientValues(p)), foot: UI.btn({ label: 'Cancel', variant: 'quiet', act: 'layer.close' }) + UI.btn({ label: 'Save patient', variant: 'primary', act: 'chart.savePatient' }) })
  h.el.dataset.id = p.id
  if (!S.canDecrypt() && p.ssn) {
    const f = h.el.querySelector('[name="ssn"]')
    f.placeholder = `${Pt.mask(p.ssn)} — enter a new value to replace`
  }
}
ACT['chart.savePatient'] = (el) => {
  const layer = el.closest('.layer')
  const vals = UI.submitForm(UI.formOf(layer))
  if (!vals) return
  const p = S.find('patients', layer.dataset.id)
  applyPatient(p, vals)
  S.log('Patient updated', { module: 'PATIENT', entityType: 'patient', entityId: p.id })
  UI.closeTop()
  const out = E.cascade()
  const sum = E.cascadeSummary(out)
  UI.toast('success', 'Patient saved', sum ? `Re-evaluated: ${sum}.` : '')
  R.refresh()
}

// ---- case form
const caseSpecs = (c) => {
  const ins = c ? E.primaryIns(c.id) : null
  return [
    { name: 'name', label: 'Case name', required: true, span: 6, placeholder: 'e.g. R shoulder 2026' },
    ...(DB.referrers.some((r) => r.practiceId === S.session.practiceId) ? [] : [{ type: 'note', html: `<strong>No referring physicians yet.</strong> A case needs one for billing — the name and NPI print in Box 17. ${UI.btn({ label: 'Add a referring physician', size: 'sm', icon: 'arrowRight', act: 'go', data: { hash: '#/admin/referrers' } })}` }]),
    { name: 'referrerId', label: 'Referring physician', type: 'select', required: true, span: 12, help: 'Name and NPI go on the claim (Box 17). Required for billing.', options: DB.referrers.filter((r) => r.practiceId === S.session.practiceId).map((r) => ({ value: r.id, label: `${r.name} · NPI ${r.npi}${E.npiValid(r.npi) ? '' : ' (invalid)'}` })) },
    { type: 'section', label: 'Injury & dates' },
    { name: 'injuryType', label: 'Related cause', type: 'select', options: ['Employment Related', 'Auto'], placeholder: 'Not related to an injury', span: 4, help: 'Drives Box 10a–c. Leave it empty and all three answer NO; the injury date and accident state follow from it.' },
    { name: 'injuryDate', label: 'Injury / onset date', type: 'date', span: 4, requiredIf: (v) => ['Employment Related', 'Auto'].includes(v.injuryType) || (ins && E.eff(ins, 'injuryDateRequired')), help: ins && E.eff(ins, 'injuryDateRequired') ? `${ins.name} requires it (Box 14).` : 'Box 14.' },
    { name: 'accidentState', label: 'Accident state', type: 'state', span: 4, placeholder: 'NY', requiredIf: (v) => v.injuryType === 'Auto', help: 'Box 10b when auto related.' },
    { name: 'employmentStatus', label: 'Employment status', span: 6, placeholder: 'e.g. Employed full time', requiredIf: () => ins && ins.type === 'Workers Comp', help: 'Required by the Case exception rule; not in the data model yet.' },
    { name: 'startOfCare', label: 'Start of care', type: 'date', span: 3 },
    { name: 'dischargeDate', label: 'Discharge date', type: 'date', span: 3, validate: (val, v) => (v.startOfCare && val < v.startOfCare ? 'Please enter a valid date.' : '') },
    { name: 'isActive', label: 'Case is open', type: 'checkbox', span: 12 },
  ]
}
/** Injury date and accident state are answers to Related Cause, so they wait for it.
 *  The injury date stays open when the payer asks for it whatever the cause (Box 14). */
const syncInjury = (ins) => (vals, formEl) => {
  const cause = !!vals.injuryType
  const open = { injuryDate: cause || !!(ins && E.eff(ins, 'injuryDateRequired')), accidentState: cause }
  Object.keys(open).forEach((n) => {
    const field = formEl.querySelector(`[data-field="${n}"]`)
    if (!field) return
    field.classList.toggle('is-disabled', !open[n])
    field.querySelectorAll('input, select').forEach((x) => {
      x.disabled = !open[n]
      if (!open[n]) x.value = ''
    })
  })
}
ACT['chart.editCase'] = (el) => {
  const c = S.find('cases', el.dataset.id)
  const h = UI.modal({ title: 'Edit case', desc: 'Visits inherit these values. Saving re-checks pended visits and held claims.', size: 'lg', body: UI.form(caseSpecs(c), { ...c, isActive: c.isActive }, { onChange: syncInjury(E.primaryIns(c.id)) }), foot: UI.btn({ label: 'Cancel', variant: 'quiet', act: 'layer.close' }) + UI.btn({ label: 'Save case', variant: 'primary', act: 'chart.saveCase' }) })
  h.el.dataset.id = c.id
}
ACT['chart.newCase'] = (el) => {
  UI.closeMenu()
  const h = UI.modal({ title: 'New case', desc: 'A case is one episode of care. Diagnoses and coverage are added to it next.', size: 'lg', body: UI.form(caseSpecs(null), { injuryType: '', isActive: true, startOfCare: DB.today }, { onChange: syncInjury(null) }), foot: UI.btn({ label: 'Cancel', variant: 'quiet', act: 'layer.close' }) + UI.btn({ label: 'Create case', variant: 'primary', act: 'chart.saveCase' }) })
  h.el.dataset.pid = el.dataset.id
}
ACT['chart.saveCase'] = (el) => {
  const layer = el.closest('.layer')
  const vals = UI.submitForm(UI.formOf(layer))
  if (!vals) return
  let c
  if (layer.dataset.id) {
    c = S.find('cases', layer.dataset.id)
    Object.assign(c, { ...vals, injuryDate: vals.injuryDate || null, startOfCare: vals.startOfCare || null, dischargeDate: vals.dischargeDate || null })
    S.log('Case updated', { module: 'PATIENT', entityType: 'case', entityId: c.id, detail: c.name })
  } else {
    c = { id: U.id('c'), patientId: layer.dataset.pid, dx: [], ...vals, injuryDate: vals.injuryDate || null, startOfCare: vals.startOfCare || null, dischargeDate: vals.dischargeDate || null }
    DB.cases.push(c)
    S.log('Case created', { module: 'PATIENT', entityType: 'case', entityId: c.id, detail: c.name })
    S.view(`chart-${c.patientId}`, {}).caseId = c.id
  }
  UI.closeTop()
  const sum = E.cascadeSummary(E.cascade())
  UI.toast('success', layer.dataset.id ? 'Case saved' : 'Case created', sum ? `Re-evaluated: ${sum}.` : '')
  R.go(`#/patients/${c.patientId}/case?case=${c.id}`)
}

// ---- diagnoses
ACT['dx.add'] = (el) => {
  const c = S.find('cases', el.dataset.id)
  if (c.dx.length >= 12) {
    UI.toast('warning', 'A case holds up to 12 diagnoses', 'Remove one before adding another.')
    return
  }
  const h = UI.modal({
    title: 'Add diagnosis',
    desc: `Pointer ${c.dx.length + 1} of 12.`,
    size: 'md',
    body: UI.form([{ name: 'code', label: 'ICD-10 code', type: 'select', required: true, options: DB.icd10.filter((d) => !c.dx.some((x) => x.code === d.code)).map((d) => ({ value: d.code, label: `${d.code} — ${d.desc}` })) }]),
    foot: UI.btn({ label: 'Cancel', variant: 'quiet', act: 'layer.close' }) + UI.btn({ label: 'Add diagnosis', variant: 'primary', act: 'dx.save' }),
  })
  h.el.dataset.id = c.id
}
ACT['dx.save'] = (el) => {
  const layer = el.closest('.layer')
  const vals = UI.submitForm(UI.formOf(layer))
  if (!vals) return
  const c = S.find('cases', layer.dataset.id)
  c.dx.push({ code: vals.code, desc: E.dxLabel(vals.code) })
  S.log('Diagnosis added', { module: 'PATIENT', entityType: 'case', entityId: c.id, detail: vals.code })
  UI.closeTop()
  UI.toast('success', `${vals.code} added as pointer ${c.dx.length}`)
  R.refresh()
}
ACT['dx.move'] = (el) => {
  const c = S.find('cases', el.dataset.id)
  const i = Number(el.dataset.i)
  const j = i + Number(el.dataset.d)
  ;[c.dx[i], c.dx[j]] = [c.dx[j], c.dx[i]]
  S.log('Diagnosis order changed', { module: 'PATIENT', entityType: 'case', entityId: c.id, detail: c.dx.map((d) => d.code).join(', ') })
  R.refresh()
}
ACT['dx.remove'] = async (el) => {
  const c = S.find('cases', el.dataset.id)
  const d = c.dx[Number(el.dataset.i)]
  const ok = await UI.confirm({ title: `Remove ${d.code}?`, message: 'Pointers after it move up by one. Visits already received keep their snapshot.', confirmLabel: 'Remove diagnosis', tone: 'critical' })
  if (!ok) return
  c.dx.splice(Number(el.dataset.i), 1)
  S.log('Diagnosis removed', { module: 'PATIENT', entityType: 'case', entityId: c.id, detail: d.code })
  R.refresh()
}

// ---- coverage
const coverageSpecs = (c, cv) => {
  const taken = E.coverages(c.id).filter((x) => !cv || x.id !== cv.id).map((x) => x.rank)
  const insList = DB.insurances.filter((i) => i.practiceId === S.session.practiceId && i.isActive && !i.draft)
  const typeOf = (id) => (DB.insurances.find((i) => i.id === id) || {}).type
  return [
    { name: 'insuranceId', label: 'Insurance', type: 'select', required: true, span: 8, options: insList.map((i) => ({ value: i.id, label: S.insLabel(i) })) },
    { name: 'rank', label: 'Rank', type: 'select', required: true, span: 4, placeholder: false, options: [1, 2, 3].filter((r) => !taken.includes(r)).map((r) => ({ value: String(r), label: { 1: 'Primary', 2: 'Secondary', 3: 'Tertiary' }[r] })) },
    { name: 'memberId', label: 'Member ID', required: true, span: 4, placeholder: 'As on the card' },
    { name: 'groupNumber', label: 'Group number', required: true, span: 4, placeholder: 'NONE if the plan has none', help: 'Required for billing.' },
    { name: 'claimNumber', label: 'Claim number', span: 4, placeholder: 'WC / auto claim #', requiredIf: (v) => ['PIP', 'Workers Comp'].includes(typeOf(v.insuranceId)), help: 'Box 11b for PIP and Workers’ Comp.' },
    { type: 'section', label: 'Subscriber' },
    { name: 'subRel', label: 'Patient’s relationship to subscriber', type: 'select', placeholder: false, span: 4, options: ['Self', 'Spouse', 'Child', 'Other'] },
    { name: 'subName', label: 'Subscriber name', span: 4, placeholder: 'Full name', requiredIf: (v) => v.subRel !== 'Self' },
    { name: 'subDob', label: 'Subscriber DOB', type: 'date', span: 4, requiredIf: (v) => v.subRel !== 'Self' },
    { type: 'section', label: 'Employer (Workers’ Comp only)' },
    { name: 'empName', label: 'Employer name', span: 6, placeholder: 'Optional', requiredIf: (v) => typeOf(v.insuranceId) === 'Workers Comp' },
    { name: 'empAddr', label: 'Employer address', span: 6, placeholder: 'Optional' },
  ]
}
ACT['cov.add'] = (el) => {
  const c = S.find('cases', el.dataset.id)
  const hasClass = DB.insuranceClasses.some((x) => x.practiceId === S.session.practiceId && x.isActive)
  if (!DB.insurances.some((i) => i.practiceId === S.session.practiceId && i.isActive && !i.draft)) {
    Dep.modal({
      title: 'Cannot add coverage yet',
      text: 'Coverage links this case to one of the practice’s insurances, with the member ID and group number for that policy. Claims are addressed to a coverage, never to an insurance directly. The practice has no insurances yet.',
      needs: [
        { ok: hasClass, label: 'An insurance class', why: 'Every insurance belongs to exactly one class.', action: { label: 'Create an insurance class', hash: '#/admin/classes' } },
        { ok: false, label: 'An insurance', why: 'The payer as the practice bills it.', action: hasClass ? { label: 'Add an insurance', hash: '#/admin/insurances' } : null },
      ],
    })
    return
  }
  const h = UI.modal({ title: 'Add coverage', desc: 'Primary, secondary and tertiary, in payment order.', size: 'lg', body: UI.form(coverageSpecs(c, null), { subRel: 'Self', rank: String([1, 2, 3].find((r) => !E.coverage(c.id, r))) }), foot: UI.btn({ label: 'Cancel', variant: 'quiet', act: 'layer.close' }) + UI.btn({ label: 'Add coverage', variant: 'primary', act: 'cov.save' }) })
  h.el.dataset.case = c.id
}
ACT['cov.edit'] = (el) => {
  const cv = S.find('coverages', el.dataset.id)
  const c = S.find('cases', cv.caseId)
  const h = UI.modal({ title: 'Edit coverage', size: 'lg', body: UI.form(coverageSpecs(c, cv), { ...cv, rank: String(cv.rank), subRel: cv.subscriber ? cv.subscriber.relationship || 'Other' : 'Self', subName: cv.subscriber?.name, subDob: cv.subscriber?.dob, empName: cv.employer?.name, empAddr: cv.employer?.address }), foot: UI.btn({ label: 'Cancel', variant: 'quiet', act: 'layer.close' }) + UI.btn({ label: 'Save coverage', variant: 'primary', act: 'cov.save' }) })
  h.el.dataset.case = c.id
  h.el.dataset.id = cv.id
}
ACT['cov.save'] = (el) => {
  const layer = el.closest('.layer')
  const vals = UI.submitForm(UI.formOf(layer))
  if (!vals) return
  const data = {
    insuranceId: vals.insuranceId, rank: Number(vals.rank), memberId: vals.memberId, groupNumber: vals.groupNumber, claimNumber: vals.claimNumber,
    subscriber: vals.subRel === 'Self' ? null : { name: vals.subName, dob: vals.subDob, relationship: vals.subRel },
    employer: vals.empName ? { name: vals.empName, address: vals.empAddr } : null,
  }
  let cv
  if (layer.dataset.id) {
    cv = S.find('coverages', layer.dataset.id)
    Object.assign(cv, data)
  } else {
    cv = { id: U.id('cv'), caseId: layer.dataset.case, ...data }
    DB.coverages.push(cv)
  }
  S.log(layer.dataset.id ? 'Coverage updated' : 'Coverage added', { module: 'PATIENT', entityType: 'case', entityId: cv.caseId, detail: `${S.find('insurances', cv.insuranceId).name} · rank ${cv.rank}` })
  UI.closeTop()
  DB.visits.filter((v) => v.caseId === cv.caseId && ['Review', 'Pended', 'Exception', 'Incomplete'].includes(v.status)).forEach((v) => E.repriceVisit(v))
  const sum = E.cascadeSummary(E.cascade())
  UI.toast('success', 'Coverage saved', sum ? `Re-evaluated: ${sum}.` : 'No waiting visits or held claims were affected.')
  R.refresh()
}
ACT['cov.remove'] = async (el) => {
  const cv = S.find('coverages', el.dataset.id)
  if (DB.claims.some((c) => c.coverageId === cv.id)) {
    UI.toast('warning', 'This coverage has claims', 'Coverage that has been billed cannot be removed. Add a new coverage instead.')
    return
  }
  const ok = await UI.confirm({ title: 'Remove this coverage?', message: `${S.find('insurances', cv.insuranceId).name} will no longer be billed for this case.`, confirmLabel: 'Remove coverage', tone: 'critical' })
  if (!ok) return
  DB.coverages = DB.coverages.filter((x) => x.id !== cv.id)
  S.log('Coverage removed', { module: 'PATIENT', entityType: 'case', entityId: cv.caseId })
  R.refresh()
}

// ---- authorizations
ACT['auth.add'] = (el) => {
  const c = S.find('cases', el.dataset.id)
  if (!E.coverages(c.id).length) {
    const p = S.patientOf(c)
    Dep.modal({
      title: 'Cannot add an authorization yet',
      text: 'An authorization is a payer’s pre-approval, issued on one of the case’s coverages. This case has no coverage yet.',
      needs: [{ ok: false, label: 'Coverage on this case', why: 'The insurance policy that issues the authorization.', action: { label: 'Add coverage', hash: `#/patients/${p.id}/coverage?case=${c.id}` } }],
    })
    return
  }
  const h = UI.modal({
    title: 'Add authorization',
    desc: 'A payer’s pre-approval for a number of visits or units within a date range. Saving re-checks pended visits and Authorization holds.',
    size: 'md',
    body: UI.form(
      [
        { name: 'coverageId', label: 'Issued by', type: 'select', required: true, placeholder: false, options: E.coverages(c.id).map((cv) => ({ value: cv.id, label: `${E.insOf(cv).name} (${{ 1: 'primary', 2: 'secondary', 3: 'tertiary' }[cv.rank]})` })) },
        { name: 'number', label: 'Authorization number', required: true, span: 12, placeholder: 'e.g. 0VJL671TT' },
        { name: 'start', label: 'Start date', type: 'date', required: true, span: 6 },
        { name: 'end', label: 'End date', type: 'date', required: true, span: 6, validate: (v, all) => (all.start && v < all.start ? 'Please enter a valid date.' : '') },
        { name: 'qty', label: 'Approved', type: 'number', required: true, span: 6, min: 1, max: 999, placeholder: '12' },
        { name: 'unit', label: 'Unit', type: 'select', required: true, span: 6, placeholder: false, options: ['Visits', 'Units'] },
      ],
      { unit: 'Visits' },
    ),
    foot: UI.btn({ label: 'Cancel', variant: 'quiet', act: 'layer.close' }) + UI.btn({ label: 'Save authorization', variant: 'primary', act: 'auth.save' }),
  })
  h.el.dataset.case = c.id
}
ACT['auth.save'] = (el) => {
  const layer = el.closest('.layer')
  const vals = UI.submitForm(UI.formOf(layer))
  if (!vals) return
  const a = { id: U.id('a'), coverageId: vals.coverageId, number: vals.number, start: vals.start, end: vals.end, qty: Number(vals.qty), unit: vals.unit, used: 0 }
  DB.authorizations.push(a)
  S.log('Authorization added', { module: 'PATIENT', entityType: 'case', entityId: layer.dataset.case, detail: `${a.number} · ${U.date(a.start)}–${U.date(a.end)} · ${a.qty} ${a.unit.toLowerCase()}` })
  UI.closeTop()
  const out = E.cascade()
  const sum = E.cascadeSummary(out)
  UI.toast('success', `Authorization ${a.number} saved`, sum ? `What happened next: ${sum}.` : 'No waiting visits or held claims needed it.', 7000)
  R.refresh()
}
ACT['auth.remove'] = async (el) => {
  const a = S.find('authorizations', el.dataset.id)
  if (a.used > 0) {
    UI.toast('warning', 'This authorization has been used', 'Visits already consumed it, so it cannot be deleted.')
    return
  }
  const ok = await UI.confirm({ title: `Delete authorization ${a.number}?`, message: 'It will no longer be available to visits.', confirmLabel: 'Delete authorization', tone: 'critical' })
  if (!ok) return
  DB.authorizations = DB.authorizations.filter((x) => x.id !== a.id)
  S.log('Authorization deleted', { module: 'PATIENT', detail: a.number })
  R.refresh()
}

// ---- patient payment (copay / statement payment)
ACT['chart.patPay'] = (el) => {
  const p = S.find('patients', el.dataset.id)
  const bal = U.sum(Pt.lines(p.id), (l) => l.balPat)
  const h = UI.modal({
    title: 'Post patient payment',
    desc: `${S.pfull(p)} owes ${U.money(bal)}. The payment is applied to the oldest patient balance first; anything left becomes a credit.`,
    size: 'md',
    body: UI.form([
      { name: 'amount', label: 'Amount', type: 'money', required: true, span: 6, placeholder: '0.00', min: 0.01 },
      { name: 'method', label: 'Method', type: 'select', required: true, span: 6, placeholder: false, options: ['Card', 'Cash', 'Check'] },
      { name: 'ref', label: 'Reference', span: 12, placeholder: 'Check number or card last four (optional)' },
    ]),
    foot: UI.btn({ label: 'Cancel', variant: 'quiet', act: 'layer.close' }) + UI.btn({ label: 'Post payment', variant: 'primary', act: 'chart.patPaySave' }),
  })
  h.el.dataset.id = p.id
}
ACT['chart.patPaySave'] = (el) => {
  const layer = el.closest('.layer')
  const vals = UI.submitForm(UI.formOf(layer))
  if (!vals) return
  if (Number(vals.amount) <= 0) {
    UI.setFieldError(UI.formOf(layer), 'amount', 'Please enter a valid amount.')
    return
  }
  const r = E.postPatientPayment(layer.dataset.id, Number(vals.amount), vals.method, vals.ref)
  UI.closeTop()
  UI.toast('success', `${U.money(vals.amount)} posted`, `Applied to ${U.plural(r.applied.length, 'charge line')}${r.unapplied ? ` · ${U.money(r.unapplied)} held as credit` : ''}.`)
  R.refresh()
}

// ---- explicit "not in this prototype / not yet specified" responses
