/* Admin — account setup (§1), access control (§1.3–1.4, §10.2, §10.6),
   EMR integration, setup data, coding rules,
   submission automation and the audit log. */

const ADMIN_SECTIONS = [
  { group: 'Organization', items: [
    { key: 'organizations', label: 'Organizations', icon: 'layers', perm: 'ADMIN', global: true },
    { key: 'practices', label: 'Practices & locations', icon: 'building', perm: 'ADMIN' },
    { key: 'users', label: 'Users', icon: 'users', perm: 'ADMIN' },
    { key: 'roles', label: 'Roles & permissions', icon: 'lock', perm: 'ADMIN' },
    { key: 'integration', label: 'EMR integration', icon: 'plug', perm: 'INTEGRATION' },
  ] },
  { group: 'Setup', items: [
    { key: 'providers', label: 'Providers', icon: 'stethoscope', perm: 'ADMIN' },
    { key: 'classes', label: 'Insurance classes', icon: 'layers', perm: 'ADMIN' },
    { key: 'insurances', label: 'Insurances', icon: 'landmark', perm: 'ADMIN' },
    { key: 'buckets', label: 'Release buckets', icon: 'inbox', perm: 'ADMIN' },
    { key: 'codes', label: 'Procedure codes', icon: 'hash', perm: 'ADMIN' },
    { key: 'fees', label: 'Fee schedules', icon: 'dollar', perm: 'ADMIN' },
    { key: 'referrers', label: 'Referring physicians', icon: 'user', perm: 'ADMIN' },
    { key: 'portals', label: 'Payer portals', icon: 'link', perm: 'ADMIN' },
  ] },
  { group: 'Billing rules', items: [
    { key: 'rules', label: 'Coding rules', icon: 'branch', perm: 'ADMIN' },
    { key: 'automation', label: 'Submission & automation', icon: 'clock', perm: 'ADMIN' },
  ] },
  { group: 'Audit', items: [{ key: 'audit', label: 'Audit log', icon: 'history', perm: 'ADMIN' }] },
]
const adminItems = () => ADMIN_SECTIONS.flatMap((g) => g.items).filter((i) => S.can(i.perm, 'r') && (!i.global || S.isGlobal()))

Screens.admin = {
  render(parts, q) {
    const items = adminItems()
    const key = items.some((i) => i.key === parts[0]) ? parts[0] : items[0]?.key
    const item = items.find((i) => i.key === key)
    const side = `<aside class="subnav">${ADMIN_SECTIONS.map((g) => {
      const vis = g.items.filter((i) => S.can(i.perm, 'r'))
      return vis.length ? `<span class="eyebrow">${g.group}</span>${vis.map((i) => `<a class="subnav-link ${i.key === key ? 'active' : ''}" href="#/admin/${i.key}">${I(i.icon)}<span>${i.label}</span></a>`).join('')}` : ''
    }).join('')}</aside>`
    // Fresh System before the first practice: only practice-independent sections can open
    const needsPractice = !S.practice() && !['practices', 'users', 'roles', 'codes', 'audit'].includes(key)
    const body = needsPractice
      ? UI.empty({ icon: 'building', title: 'No practice yet', text: `${U.esc(item ? item.label : 'This list')} belongs to a practice. Create the practice and its primary location first.`, action: S.isGlobal() ? UI.btn({ label: 'Create the practice', icon: 'plus', variant: 'primary', act: 'go', data: { hash: '#/admin/practices' } }) : '' })
      : Adm[key] ? Adm[key](q) : ''
    const viewOnly = item && !S.can(item.perm, 'u') && !S.can(item.perm, 'c')
    return `<div class="screen-split">${side}<div class="subnav-content"><div class="page-x screen-head"><div><h1 class="screen-title">${U.esc(item ? item.label : 'Admin')}</h1><p class="screen-sub">${U.esc(Adm.sub[key] || '')}${viewOnly ? ' · ' + UI.chip('inert', 'View only') : ''}</p></div><div class="screen-actions">${!needsPractice && Adm.actions[key] ? Adm.actions[key]() : ''}</div></div><div class="page-x screen-body">${body}</div></div></div>`
  },
  after(parts, q) {
    if (parts[0] === 'providers' && q.open && S.view('prov-open', {}).done !== q.open) {
      S.view('prov-open', {}).done = q.open
      ACT['prov.edit']({ dataset: { id: q.open } })
    }
  },
}
const canA = (op) => S.can('ADMIN', op)

const Adm = {
  sub: {
    organizations: 'An owner that groups practices, so reports can run across all of them. Optional — a practice can stand on its own.',
    practices: 'Practices and their locations. A practice appears as “Company” in the sidebar switcher.',
    users: 'Users, service accounts and their practice / location grants.',
    roles: 'Permissions per role and module. A user with several roles gets the union.',
    integration: 'Integration is set up per location. Only integrated locations send sessions into billing.',
    providers: 'Billing and rendering clinicians. Clinicians do not log in.',
    classes: 'Groups of insurances that share billing rules. The class holds the default of every rule; each insurance inherits it unless it overrides it.',
    insurances: 'Payers as the practice bills them: class, rule overrides, insurance hold and portal credentials.',
    buckets: 'Named manual-release queues. Insurances with the insurance hold checked are assigned to one; their claims stop here after scrubbing until a user releases them.',
    codes: 'CPT / HCPCS codes with category and active flag, shared by every practice.',
    fees: 'The billed price per unit for one code and one insurance; otherwise the code’s default fee.',
    referrers: 'Referring (DN) and supervising (DQ) physicians. The type sets the Box 17 qualifier.',
    portals: 'Where each payer’s claims and remittances are checked online. Credentials are stored on the insurance and masked for every role except System Admin.',
    rules: 'Replace and Drop rules run during scrubbing; payer-specific rules override default rules.',
    automation: 'Scheduled submission interval, the AI coding add-on and the SLA source.',
    audit: 'Every action taken in the system: who, what, when and on which record.',
  },
  actions: {
    organizations: () => (S.isGlobal() ? UI.btn({ label: 'New organization', icon: 'plus', variant: 'primary', act: 'org.edit' }) : ''),
    practices: () => (S.isGlobal() ? UI.btn({ label: 'New practice', icon: 'plus', variant: 'primary', act: 'prac.new' }) : `<span class="t-micro muted">${I('lock', 'icon-14')} Only System Admin creates practices</span>`),
    users: () => (canA('c') ? UI.btn({ label: 'New user', icon: 'userPlus', variant: 'primary', act: 'user.edit' }) : ''),
    roles: () => (canA('c') ? UI.btn({ label: 'New role', icon: 'plus', variant: 'primary', act: 'role.new' }) : ''),
    providers: () => (canA('c') ? UI.btn({ label: 'New provider', icon: 'plus', variant: 'primary', act: 'prov.edit' }) : ''),
    classes: () => (canA('c') ? UI.btn({ label: 'New class', icon: 'plus', variant: 'primary', act: 'cls.edit' }) : ''),
    insurances: () => (canA('c') ? UI.btn({ label: 'New insurance', icon: 'plus', variant: 'primary', act: 'ins.edit' }) : ''),
    buckets: () => (canA('c') ? UI.btn({ label: 'New release bucket', icon: 'plus', variant: 'primary', act: 'bkt.edit' }) : ''),
    codes: () => (canA('c') && S.isGlobal() ? UI.btn({ label: 'New code', icon: 'plus', variant: 'primary', act: 'code.edit' }) : ''),
    fees: () => (canA('c') && DB.insurances.some((i) => i.practiceId === S.session.practiceId && !i.draft) && DB.procedureCodes.length ? UI.btn({ label: 'Add fee row', icon: 'plus', variant: 'primary', act: 'fee.edit' }) : ''),
    referrers: () => (canA('c') ? UI.btn({ label: 'New physician', icon: 'plus', variant: 'primary', act: 'ref.edit' }) : ''),
    rules: () => (canA('c') ? UI.btn({ label: 'New rule', icon: 'plus', variant: 'primary', act: 'rule.edit' }) : ''),
  },
}

// ---------------------------------------------------------------- organizations
Adm.organizations = () => {
  const orgs = DB.companies
  const practicesOf = (o) => DB.practices.filter((p) => p.companyId === o.id)
  return UI.table({
    cols: [
      { key: 'name', label: 'Organization', sort: true, render: (o) => `<span class="ink fw-500">${U.esc(o.name)}</span>` },
      { key: 'practices', label: 'Practices', render: (o) => (practicesOf(o).length ? practicesOf(o).map((p) => U.esc(p.name)).join(', ') : '<span class="muted">None yet</span>') },
      { key: 'n', label: 'Count', cls: 'r', render: (o) => practicesOf(o).length },
      { key: 'st', label: 'Status', render: (o) => UI.status(o.isActive ? 'success' : 'inert', o.isActive ? 'Active' : 'Inactive') },
      { key: 'act', label: '', cls: 'r', render: (o) => `<div class="row-actions">${canA('u') ? UI.iconBtn({ icon: 'pencil', label: 'Edit organization', act: 'org.edit', data: { id: o.id } }) : ''}</div>` },
    ],
    rows: orgs, view: S.view('adm-org', { sort: 'name', dir: 'asc', page: 1 }), viewKey: 'adm-org', rowAct: canA('u') ? 'org.edit' : null, noun: 'organization',
    empty: UI.empty({ icon: 'layers', title: 'No organizations', text: 'An organization groups the practices of one owner so reports can run across them. It holds no billing data, and a practice can be billed without one.', action: S.isGlobal() ? UI.btn({ label: 'New organization', icon: 'plus', variant: 'primary', act: 'org.edit' }) : '' }),
  })
}
ACT['org.edit'] = (el) => {
  const o = el.dataset.id ? S.find('companies', el.dataset.id) : null
  const editable = canA(o ? 'u' : 'c') && S.isGlobal()
  const mine = o ? DB.practices.filter((p) => p.companyId === o.id).map((p) => p.id) : []
  const h = UI.modal({
    title: o ? o.name : 'New organization',
    desc: 'Groups the practices of one owner for cross-practice reporting.',
    size: 'md',
    body: UI.form([
      { name: 'name', label: 'Organization name', required: true, span: 12, disabled: !editable, placeholder: 'e.g. Harborline Rehab Group' },
      { type: 'section', label: 'Practices in this organization' },
      { type: 'html', span: 12, html: UI.multipick({
        attr: 'data-org-prac',
        disabled: !editable,
        placeholder: 'Search or pick practices',
        search: 'Search practices by name',
        empty: 'No practices exist yet. Create the organization first and add practices to it later.',
        chosen: mine,
        options: DB.practices.map((p) => ({
          value: p.id,
          label: p.name,
          sub: `${p.legalName}${p.companyId && p.companyId !== (o || {}).id ? ` · currently in ${(S.find('companies', p.companyId) || {}).name || 'another organization'}` : ''}`,
        })),
      }) },
      { name: 'isActive', label: 'Active', type: 'checkbox', span: 12, disabled: !editable },
    ], o || { isActive: true }),
    foot: UI.btn({ label: editable ? 'Cancel' : 'Close', variant: 'quiet', act: 'layer.close' }) + (editable ? UI.btn({ label: o ? 'Save organization' : 'Create organization', variant: 'primary', act: 'org.save' }) : ''),
  })
  if (o) h.el.dataset.id = o.id
}
ACT['org.save'] = (el) => {
  const layer = el.closest('.layer')
  const vals = UI.submitForm(UI.formOf(layer))
  if (!vals) return
  let o = layer.dataset.id ? S.find('companies', layer.dataset.id) : null
  if (o) Object.assign(o, { name: vals.name, isActive: vals.isActive })
  else {
    o = { id: U.id('co'), name: vals.name, isActive: vals.isActive }
    DB.companies.push(o)
  }
  // A practice belongs to at most one organization
  layer.querySelectorAll('[data-org-prac]').forEach((cb) => {
    const p = S.find('practices', cb.dataset.orgPrac)
    if (!p) return
    if (cb.checked) p.companyId = o.id
    else if (p.companyId === o.id) p.companyId = null
  })
  S.log(layer.dataset.id ? 'Organization updated' : 'Organization created', { module: 'ADMIN', entityType: 'company', entityId: o.id, detail: `${o.name} · ${U.plural(DB.practices.filter((p) => p.companyId === o.id).length, 'practice')}` })
  UI.closeTop()
  UI.toast('success', layer.dataset.id ? 'Organization saved' : `${o.name} created`)
  R.refresh()
}

// ---------------------------------------------------------------- practices & locations
Adm.practices = () => {
  const list = S.isGlobal() ? DB.practices : S.practices()
  const st = S.view('adm-prac', { sel: S.session.practiceId })
  const sel = S.find('practices', st.sel) || list[0]
  // Day 1 (Fresh System): no practice exists yet
  if (!sel) {
    return `<div class="card">${UI.empty({
        icon: 'building',
        title: 'No practices yet',
        text: 'A practice is the billing entity: its legal name, Tax ID, taxonomy and group NPI print on every claim, and every patient, provider, insurance and charge belongs to exactly one practice. Creating it also creates the primary location, which is mandatory.',
        action: S.isGlobal() ? UI.btn({ label: 'Create the practice', icon: 'plus', variant: 'primary', act: 'prac.new' }) : `<span class="t-micro muted">${I('lock', 'icon-14')} Only a System Admin creates practices.</span>`,
      })}</div>`
  }
  const locs = DB.locations.filter((l) => l.practiceId === sel.id)
  // The organization groups one owner's practices; shown only when this practice is in one
  const co = S.companyOf(sel)
  const org = co ? `<div class="card card-pad mb-16" data-section="organization"><div class="row"><span class="scope-ico" style="background:var(--brand-wash);color:var(--brand-deep)">${I('layers', 'icon-18')}</span><div class="grow"><div class="eyebrow">Organization</div><div class="t-row ink fw-500">${U.esc(co.name)}</div><div class="t-micro muted">Owns ${U.plural(DB.practices.filter((p) => p.companyId === co.id).length, 'practice')}. Used for reports across the owner’s practices; holds no billing data.</div></div>${S.isGlobal() ? UI.btn({ label: 'Manage', size: 'sm', act: 'go', data: { hash: '#/admin/organizations' } }) : ''}</div></div>` : ''
  return `${org}
    ${UI.table({
      cols: [
        { key: 'code', label: 'Code', render: (r) => `<span class="code">${r.code}</span>` },
        { key: 'name', label: 'Practice', render: (r) => `<span class="ink fw-500">${U.esc(r.name)}</span><span class="sub">${U.esc(r.legalName)}${r.dba ? ` · DBA ${U.esc(r.dba)}` : ''}</span>` },
        { key: 'npi', label: 'Group NPI', render: (r) => r.npi },
        { key: 'tax', label: 'Tax ID', render: (r) => `${r.taxId} <span class="muted">${r.taxIdType}</span>` },
        { key: 'tx', label: 'Taxonomy', render: (r) => r.taxonomy },
        { key: 'locs', label: 'Locations', cls: 'r', render: (r) => DB.locations.filter((l) => l.practiceId === r.id && l.isActive).length },
        { key: 'st', label: '', render: (r) => (r.id === sel.id ? UI.tag('Selected', 'brand') : '') },
      ],
      rows: list, view: S.view('adm-prac-t', { page: 1 }), viewKey: 'adm-prac-t', rowAct: 'prac.select', noun: 'practice', noPaging: true,
    })}
    <div class="section">${UI.sectionHead(`${sel.name}`, 'Billing constants printed on every claim (Boxes 25, 32a, 33)', canA('u') ? UI.btn({ label: 'Edit practice', icon: 'pencil', size: 'sm', act: 'prac.edit', data: { id: sel.id } }) : '')}
      ${UI.kv([['Legal name', sel.legalName], ['DBA', sel.dba], ['Billing address', `${sel.address.line1}${sel.address.line2 ? ', ' + sel.address.line2 : ''}, ${sel.address.city}, ${sel.address.state} ${sel.address.zip}`], ['Tax ID', `${sel.taxId} (${sel.taxIdType})`], ['Taxonomy code', sel.taxonomy], ['Group NPI', sel.npi]])}</div>
    <div class="section">${UI.sectionHead('Locations', 'At least one primary location is mandatory', canA('c') ? UI.btn({ label: 'Add location', icon: 'plus', size: 'sm', act: 'loc.edit', data: { practice: sel.id } }) : '')}
      ${UI.table({
        cols: [
          { key: 'code', label: 'Code', render: (l) => `<span class="code">${l.code}</span>` },
          { key: 'name', label: 'Facility', render: (l) => `<span class="ink fw-500">${U.esc(l.name)}</span>${l.isPrimary ? ' ' + UI.tag('Primary', 'brand') : ''}<span class="sub">${U.esc(l.address.line1)}, ${U.esc(l.address.city)} ${U.esc(l.address.zip)}</span>` },
          { key: 'npi', label: 'NPI', render: (l) => l.npi },
          { key: 'pos', label: 'Default POS', render: (l) => l.pos },
          { key: 'emr', label: 'EMR integration', render: (l) => `${UI.chip(l.emr.link === 'Linked' ? 'success' : l.emr.link === 'Requested' ? 'warning' : 'inert', l.emr.link)} ${UI.chip(l.emr.election === 'Integrated' ? 'brand' : 'inert', l.emr.election)}` },
          { key: 'st', label: 'Status', render: (l) => UI.status(l.isActive ? 'success' : 'inert', l.isActive ? 'Active' : 'Inactive') },
          { key: 'act', label: '', cls: 'r', render: (l) => (canA('u') ? `<div class="row-actions">${UI.iconBtn({ icon: 'pencil', label: 'Edit location', act: 'loc.edit', data: { id: l.id } })}${UI.iconBtn({ icon: l.isActive ? 'ban' : 'refresh', label: l.isActive ? 'Deactivate' : 'Reactivate', act: 'loc.toggle', data: { id: l.id }, danger: l.isActive })}</div>` : '') },
        ],
        rows: locs, view: S.view('adm-locs', { page: 1 }), viewKey: 'adm-locs', noun: 'location', noPaging: true,
      })}</div>`
}
ACT['prac.select'] = (el) => {
  S.view('adm-prac', {}).sel = el.dataset.id
  R.refresh()
}
const practiceSpecs = (withLocation, editingId = null) => [
  { type: 'section', label: 'Practice (billing entity)' },
  { name: 'legalName', label: 'Practice legal name', required: true, span: 8, placeholder: 'As registered for tax and billing' },
  { name: 'code', label: 'Code', required: true, span: 4, placeholder: 'PV4', validate: (v) => (DB.practices.some((p) => p.code === v && p.id !== editingId) ? 'This code is already used.' : '') },
  { name: 'name', label: 'Display name', required: true, span: 6, placeholder: 'Shown in the Company switcher' },
  { name: 'dba', label: 'DBA', span: 6, placeholder: 'Optional' },
  { name: 'line1', label: 'Billing address', required: true, span: 8 },
  { name: 'line2', label: 'Suite', span: 4 },
  { name: 'city', label: 'City', required: true, span: 6 },
  { name: 'state', label: 'State', type: 'state', required: true, span: 3 },
  { name: 'zip', label: 'ZIP', type: 'zip', required: true, span: 3 },
  { name: 'taxIdType', label: 'Tax ID type', type: 'select', required: true, span: 4, placeholder: false, options: ['EIN', 'SSN'] },
  { name: 'taxId', label: 'Tax ID', required: true, span: 4, placeholder: '00-0000000', validate: (v, all) => (all.taxIdType === 'SSN' ? (/^\d{3}-\d{2}-\d{4}$/.test(v) ? '' : 'Please enter a valid SSN.') : /^\d{2}-\d{7}$/.test(v) ? '' : 'Please enter a valid EIN.') },
  { name: 'taxonomy', label: 'Taxonomy code', required: true, span: 4, placeholder: '225100000X', validate: (v) => (/^[0-9A-Z]{9}X$/i.test(v) ? '' : 'Please enter a valid taxonomy code.') },
  { name: 'npi', label: 'Group NPI', type: 'npi', required: true, span: 4 },
  ...(DB.companies.length ? [{ name: 'companyId', label: 'Organization', type: 'select', span: 6, options: DB.companies.filter((c) => c.isActive).map((c) => ({ value: c.id, label: c.name })), help: 'Optional — groups practices of one owner for reporting.' }] : []),
  ...(withLocation
    ? [
        { type: 'section', label: 'Primary facility (mandatory)' },
        { type: 'note', label: 'At least one primary location is required when a practice is created. More can be added afterwards.' },
        { name: 'locName', label: 'Facility name', required: true, span: 6, placeholder: 'e.g. Bay Ridge' },
        { name: 'locCode', label: 'Location code', required: true, span: 3, placeholder: 'BR003' },
        { name: 'locNpi', label: 'Facility or group NPI', type: 'npi', required: true, span: 3 },
        { name: 'locLine1', label: 'Rendering address', required: true, span: 6 },
        { name: 'locCity', label: 'City', required: true, span: 3 },
        { name: 'locZip', label: 'ZIP', type: 'zip', required: true, span: 3 },
      ]
    : []),
]
ACT['prac.new'] = () => {
  UI.modal({ title: 'New practice', desc: 'Practice-level metadata required whenever an account is initialized.', size: 'lg', body: UI.form(practiceSpecs(true), { taxIdType: 'EIN', state: 'NY', taxonomy: '225100000X' }), foot: UI.btn({ label: 'Cancel', variant: 'quiet', act: 'layer.close' }) + UI.btn({ label: 'Create practice', variant: 'primary', act: 'prac.save' }) })
}
ACT['prac.edit'] = (el) => {
  const p = S.find('practices', el.dataset.id)
  const h = UI.modal({ title: `Edit ${p.name}`, size: 'lg', body: UI.form(practiceSpecs(false, p.id), { ...p, ...p.address }), foot: UI.btn({ label: 'Cancel', variant: 'quiet', act: 'layer.close' }) + UI.btn({ label: 'Save practice', variant: 'primary', act: 'prac.save' }) })
  h.el.dataset.id = p.id
}
ACT['prac.save'] = (el) => {
  const layer = el.closest('.layer')
  const vals = UI.submitForm(UI.formOf(layer))
  if (!vals) return
  const data = { legalName: vals.legalName, code: vals.code, name: vals.name, dba: vals.dba, address: { line1: vals.line1, line2: vals.line2, city: vals.city, state: vals.state, zip: vals.zip }, taxIdType: vals.taxIdType, taxId: vals.taxId, taxonomy: vals.taxonomy.toUpperCase(), npi: vals.npi }
  if (layer.dataset.id) {
    Object.assign(S.find('practices', layer.dataset.id), data)
    S.log('Practice updated', { module: 'ADMIN', detail: data.name })
    UI.toast('success', 'Practice saved')
  } else {
    const p = { id: U.id('pr'), companyId: vals.companyId || null, phone: '', isActive: true, ...data }
    DB.practices.push(p)
    DB.locations.push({ id: U.id('L'), practiceId: p.id, code: vals.locCode, name: vals.locName, npi: vals.locNpi, address: { line1: vals.locLine1, city: vals.locCity, state: vals.state, zip: vals.locZip }, pos: '11', isPrimary: true, isActive: true, emr: { uniqueLocationId: '', link: 'Not linked', election: 'EMR only' } })
    DB.periods.push({ id: DB.today.slice(0, 7), status: 'Open', closedBy: null, closedOn: null, practiceId: p.id })
    S.log('Practice created with primary location', { module: 'ADMIN', detail: `${p.name} · ${vals.locName}` })
    // The first practice on a fresh installation becomes the working practice
    if (!S.practice()) S.session.practiceId = p.id
    // Prototype assumption A-P49: a new practice starts with the current month as its open accounting period
    DB.periods.push({ id: DB.today.slice(0, 7), status: 'Open', closedBy: null, closedOn: null, practiceId: p.id })
    UI.toast('success', `${p.name} created`, 'Its primary location is not linked to the EMR yet — request integration from EMR integration.')
  }
  UI.closeTop()
  R.refresh()
}
ACT['loc.edit'] = (el) => {
  const l = el.dataset.id ? S.find('locations', el.dataset.id) : null
  const h = UI.modal({
    title: l ? `Edit ${l.name}` : 'Add location',
    size: 'md',
    body: UI.form([
      { name: 'name', label: 'Facility name', required: true, span: 8 },
      { name: 'code', label: 'Code', required: true, span: 4, validate: (v) => (DB.locations.some((x) => x.code === v && x.practiceId === (l ? l.practiceId : el.dataset.practice) && (!l || x.id !== l.id)) ? 'This code is already used in this practice.' : '') },
      { name: 'line1', label: 'Rendering address', required: true, span: 12 },
      { name: 'city', label: 'City', required: true, span: 6 },
      { name: 'state', label: 'State', type: 'state', required: true, span: 3 },
      { name: 'zip', label: 'ZIP', type: 'zip', required: true, span: 3 },
      { name: 'npi', label: 'Facility or group NPI', type: 'npi', required: true, span: 6 },
      { name: 'pos', label: 'Default place of service', type: 'select', required: true, span: 6, placeholder: false, options: POS_OPTIONS },
      { name: 'isPrimary', label: 'Primary location', type: 'checkbox', span: 12 },
    ], l ? { ...l, ...l.address } : { pos: '11', state: 'NY' }),
    foot: UI.btn({ label: 'Cancel', variant: 'quiet', act: 'layer.close' }) + UI.btn({ label: l ? 'Save location' : 'Add location', variant: 'primary', act: 'loc.save' }),
  })
  if (l) h.el.dataset.id = l.id
  h.el.dataset.practice = l ? l.practiceId : el.dataset.practice
}
ACT['loc.save'] = (el) => {
  const layer = el.closest('.layer')
  const vals = UI.submitForm(UI.formOf(layer))
  if (!vals) return
  const pid = layer.dataset.practice
  const data = { name: vals.name, code: vals.code, npi: vals.npi, pos: vals.pos, address: { line1: vals.line1, city: vals.city, state: vals.state, zip: vals.zip } }
  let l
  if (layer.dataset.id) {
    l = S.find('locations', layer.dataset.id)
    Object.assign(l, data)
  } else {
    l = { id: U.id('L'), practiceId: pid, isActive: true, isPrimary: false, emr: { uniqueLocationId: '', link: 'Not linked', election: 'EMR only' }, ...data }
    DB.locations.push(l)
  }
  if (vals.isPrimary) DB.locations.filter((x) => x.practiceId === pid).forEach((x) => (x.isPrimary = x.id === l.id))
  S.log(layer.dataset.id ? 'Location updated' : 'Location added', { module: 'ADMIN', detail: l.name })
  UI.closeTop()
  UI.toast('success', 'Location saved')
  R.refresh()
}
ACT['loc.toggle'] = async (el) => {
  const l = S.find('locations', el.dataset.id)
  if (l.isActive && (l.isPrimary || DB.locations.filter((x) => x.practiceId === l.practiceId && x.isActive).length === 1)) {
    UI.toast('warning', 'This location cannot be deactivated', 'A practice needs an active primary location. Make another location primary first.')
    return
  }
  const ok = await UI.confirm({ title: `${l.isActive ? 'Deactivate' : 'Reactivate'} ${l.name}?`, message: l.isActive ? 'It can no longer be chosen for new cases or visits.' : 'It becomes available again.', confirmLabel: l.isActive ? 'Deactivate' : 'Reactivate', tone: l.isActive ? 'critical' : 'primary' })
  if (!ok) return
  l.isActive = !l.isActive
  S.log(l.isActive ? 'Location reactivated' : 'Location deactivated', { module: 'ADMIN', detail: l.name })
  R.refresh()
}

// ---------------------------------------------------------------- users
Adm.users = () => {
  const users = DB.users.filter((u) => S.isGlobal() || u.roleIds.some((r) => S.find('roles', r).isGlobal) || u.grants.some((g) => S.practices().some((p) => p.id === g.practiceId)))
  return `${UI.notice('info', 'Clinicians do not hold user accounts.', 'They exist as provider profiles in Setup → Providers. Service accounts, such as the EMR import, are users that cannot sign in interactively.')}<div class="mt-16"></div>${UI.table({
    cols: [
      { key: 'displayName', label: 'User', sort: true, render: (u) => `<span class="ink fw-500">${U.esc(u.displayName)}</span><span class="sub">${U.esc(u.username)}${u.email ? ' · ' + U.esc(u.email) : ''}</span>` },
      { key: 'roles', label: 'Roles', render: (u) => u.roleIds.map((r) => { const role = S.find('roles', r); return UI.tag(role.name, role.isGlobal ? 'brand' : '') }).join(' ') },
      { key: 'scope', label: 'Practices · locations', render: (u) => (u.roleIds.some((r) => S.find('roles', r).isGlobal) ? '<span class="muted-2">Every practice (global role)</span>' : u.grants.map((g) => `${U.esc(S.find('practices', g.practiceId).name)}<span class="sub">${g.locationIds.length ? g.locationIds.map((id) => S.find('locations', id).name).join(', ') + ' only' : 'All locations'}</span>`).join('')) },
      { key: 'type', label: 'Type', render: (u) => (u.isServiceAccount ? UI.tag('Service account') : 'User') },
      { key: 'st', label: 'Status', render: (u) => UI.status(u.isActive ? 'success' : 'inert', u.isActive ? 'Active' : 'Inactive') },
      { key: 'act', label: '', cls: 'r', render: (u) => (canA('u') && u.id !== S.session.userId ? `<div class="row-actions">${UI.iconBtn({ icon: 'pencil', label: 'Edit user', act: 'user.edit', data: { id: u.id } })}${UI.iconBtn({ icon: u.isActive ? 'ban' : 'refresh', label: u.isActive ? 'Deactivate' : 'Reactivate', act: 'user.toggle', data: { id: u.id }, danger: u.isActive })}</div>` : u.id === S.session.userId ? '<span class="t-micro muted">You</span>' : '') },
    ],
    rows: users, view: S.view('adm-users', { sort: 'displayName', dir: 'asc', page: 1 }), viewKey: 'adm-users', noun: 'user',
  })}`
}
ACT['user.edit'] = (el) => {
  const u = el.dataset.id ? S.find('users', el.dataset.id) : null
  const grantable = S.isGlobal() ? DB.practices : S.practices()
  const rolesHtml = `<div class="field-label">Roles<span class="req">*</span></div><div class="check-list mt-8">${DB.roles.map((r) => {
    const locked = r.isGlobal && !S.hasRole('SYSTEM_ADMIN')
    return `<label class="check-row"><input type="checkbox" data-role="${r.id}" ${u && u.roleIds.includes(r.id) ? 'checked' : ''} ${locked ? 'disabled' : ''}><span>${U.esc(r.name)} ${r.custom ? UI.tag('Custom') : ''}<span class="desc">${locked ? 'Only a System Admin can grant this role.' : U.esc(r.description || '')}</span></span></label>`
  }).join('')}</div><div class="field-error" data-err="roles" hidden></div>`
  const grantsHtml = `<div class="field-label mt-16">Practice and location access</div><div class="t-micro muted-2 mt-4">No locations ticked means every location of the practice.</div>${grantable.length ? '' : `<div class="mt-8">${UI.notice('warning', 'No practice to grant yet.', 'Access is granted practice by practice. Only global roles such as System Admin can work before a practice exists.')}</div>`}${grantable.map((p) => {
    const g = u ? u.grants.find((x) => x.practiceId === p.id) : p.id === S.session.practiceId ? { locationIds: [] } : null
    return `<div class="card card-pad mt-8"><label class="check-row"><input type="checkbox" data-grant="${p.id}" ${g ? 'checked' : ''}><span class="fw-500">${U.esc(p.name)}</span></label><div class="check-grid mt-8" style="padding-left:27px">${DB.locations.filter((l) => l.practiceId === p.id).map((l) => `<label class="check-row"><input type="checkbox" data-loc="${p.id}:${l.id}" ${g && g.locationIds.includes(l.id) ? 'checked' : ''}><span>${U.esc(l.name)}</span></label>`).join('')}</div></div>`
  }).join('')}<div class="field-error" data-err="grants" hidden></div>`
  const h = UI.modal({
    title: u ? `Edit ${u.displayName}` : 'New user',
    size: 'lg',
    body: UI.form([
      { name: 'displayName', label: 'Display name', required: true, span: 6 },
      { name: 'username', label: 'Username', required: true, span: 6, validate: (v) => (DB.users.some((x) => x.username.toLowerCase() === v.toLowerCase() && (!u || x.id !== u.id)) ? 'This username is taken.' : '') },
      { name: 'email', label: 'Email', type: 'email', span: 6, requiredIf: (v) => !v.isServiceAccount },
      { name: 'defaultPracticeId', label: 'Default practice at sign-in', type: 'select', required: true, span: 6, placeholder: false, options: grantable.map((p) => ({ value: p.id, label: p.name })) },
      { name: 'isServiceAccount', label: 'Service account — cannot sign in interactively', type: 'checkbox', span: 12 },
    ], u || { defaultPracticeId: S.session.practiceId }) + `<div class="mt-16">${rolesHtml}${grantsHtml}</div>`,
    foot: UI.btn({ label: 'Cancel', variant: 'quiet', act: 'layer.close' }) + UI.btn({ label: u ? 'Save user' : 'Create user', variant: 'primary', act: 'user.save' }),
  })
  if (u) h.el.dataset.id = u.id
}
ACT['user.save'] = (el) => {
  const layer = el.closest('.layer')
  const vals = UI.submitForm(UI.formOf(layer))
  const roleIds = U.qsa('[data-role]', layer).filter((x) => x.checked).map((x) => x.dataset.role)
  const grants = U.qsa('[data-grant]', layer).filter((x) => x.checked).map((x) => ({ practiceId: x.dataset.grant, locationIds: U.qsa(`[data-loc^="${x.dataset.grant}:"]`, layer).filter((c) => c.checked).map((c) => c.dataset.loc.split(':')[1]) }))
  const errRoles = layer.querySelector('[data-err="roles"]')
  const errGrants = layer.querySelector('[data-err="grants"]')
  errRoles.hidden = !!roleIds.length
  errRoles.textContent = 'This field is required.'
  const global = roleIds.some((r) => S.find('roles', r).isGlobal)
  errGrants.hidden = global || !!grants.length
  errGrants.textContent = 'Grant at least one practice.'
  if (!vals || !roleIds.length || (!global && !grants.length)) return
  const data = { displayName: vals.displayName, username: vals.username, email: vals.email, isServiceAccount: vals.isServiceAccount, defaultPracticeId: vals.defaultPracticeId, roleIds, grants: global ? [] : grants }
  if (layer.dataset.id) Object.assign(S.find('users', layer.dataset.id), data)
  else DB.users.push({ id: U.id('u'), isActive: true, ...data })
  S.log(layer.dataset.id ? 'User updated' : 'User created', { module: 'ADMIN', detail: `${data.displayName} · ${roleIds.map((r) => S.find('roles', r).name).join(' + ')}` })
  UI.closeTop()
  UI.toast('success', layer.dataset.id ? 'User saved' : 'User created', `An invitation was sent to ${U.esc(vals.email || 'the user')}.`)
  R.refresh()
}
ACT['user.toggle'] = async (el) => {
  const u = S.find('users', el.dataset.id)
  const ok = await UI.confirm({ title: `${u.isActive ? 'Deactivate' : 'Reactivate'} ${u.displayName}?`, message: u.isActive ? 'They can no longer sign in. Their history is kept.' : 'They can sign in again.', confirmLabel: u.isActive ? 'Deactivate user' : 'Reactivate user', tone: u.isActive ? 'critical' : 'primary' })
  if (!ok) return
  u.isActive = !u.isActive
  S.log(u.isActive ? 'User reactivated' : 'User deactivated', { module: 'ADMIN', detail: u.displayName })
  R.refresh()
}

// ---------------------------------------------------------------- roles & permissions
Adm.roles = () => {
  const st = S.view('adm-roles', { sel: 'r2' })
  const role = S.find('roles', st.sel) || DB.roles[0]
  const locked = role.seeded || !canA('u')
  const list = DB.roles.map((r) => `<button type="button" class="subnav-link ${r.id === role.id ? 'active' : ''}" style="border-radius:var(--r-md);height:auto;padding:10px 12px;align-items:flex-start" data-act="role.sel" data-id="${r.id}"><span class="grow"><span class="fw-500" style="display:block">${U.esc(r.name)}</span><span class="t-micro muted" style="display:block">${r.seeded ? 'System role' : r.custom ? 'Custom' : 'Standard'} · ${U.plural(DB.users.filter((u) => u.roleIds.includes(r.id)).length, 'user')}</span></span></button>`).join('')
  const matrix = MODULES.map((m) => {
    const p = role.permissions[m.key]
    const lvl = S.levelOf(p)
    return `<tr><td class="ink fw-500">${m.label}</td><td>${UI.seg([{ value: 'edit', label: 'Edit' }, { value: 'view', label: 'View' }, { value: 'hidden', label: 'Hidden' }], lvl, 'role.level', { role: role.id, mod: m.key }, locked)}</td><td class="c"><input type="checkbox" aria-label="Delete ${m.label}" data-act="role.del" data-role="${role.id}" data-mod="${m.key}" ${p.d ? 'checked' : ''} ${locked || lvl !== 'edit' ? 'disabled' : ''}></td><td><span class="code">${['c', 'r', 'u', 'd'].filter((k) => p[k]).map((k) => k.toUpperCase()).join(' ') || '—'}</span></td></tr>`
  }).join('')
  return `<div class="grid-2 grid-1-2"><div class="stack gap-4">${list}</div><div>
    <div class="row-wrap mb-16"><div class="grow"><div class="t-row ink fw-500">${U.esc(role.name)}</div><div class="t-micro muted-2">${U.esc(role.description || '')}${role.isGlobal ? ' · Global: sees every practice' : ''}</div></div>${!role.seeded && S.can('ADMIN', 'd') ? UI.btn({ label: 'Delete role', variant: 'danger', size: 'sm', act: 'role.delete', data: { id: role.id } }) : ''}</div>
    ${UI.notice('info', 'Access levels.', 'Edit lets the role create, view and update records in the module — and delete them when Delete is ticked. View is read-only. Hidden removes the section.')}
    <div class="tbl-wrap scroll-x mt-16"><table class="tbl"><thead><tr><th>Module</th><th>Access</th><th class="c">Delete</th><th>Flags</th></tr></thead><tbody>${matrix}</tbody></table></div>
    ${role.seeded ? `<div class="t-micro muted mt-12">${I('lock', 'icon-14')} System roles cannot be changed. Create a custom role to adjust permissions.</div>` : ''}
    ${role.code === 'PRACTICE_ADMIN' ? `<div class="section">${UI.sectionHead('Limits beyond the flags')}<ul class="t-micro muted-2" style="line-height:1.8;margin:10px 0 0;padding-left:18px"><li>Billing: cannot delete a sent claim</li><li>Payments: reversals are posted, not deleted</li><li>Reports: granted practices only</li><li>Month End: cannot reopen a closed period</li><li>Admin: manages setup and users of granted practices; cannot create practices or grant System Admin</li></ul></div>` : ''}
  </div></div>`
}
ACT['role.sel'] = (el) => {
  S.view('adm-roles', {}).sel = el.dataset.id
  R.refresh()
}
ACT['role.level'] = (el) => {
  const role = S.find('roles', el.dataset.role)
  const p = role.permissions[el.dataset.mod]
  const lvl = el.dataset.value
  role.permissions[el.dataset.mod] = lvl === 'edit' ? { c: true, r: true, u: true, d: p.d } : lvl === 'view' ? { c: false, r: true, u: false, d: false } : { c: false, r: false, u: false, d: false }
  S.log('Role permission changed', { module: 'ADMIN', detail: `${role.name} · ${el.dataset.mod} → ${lvl}` })
  UI.toast('success', `${role.name}: ${MODULES.find((m) => m.key === el.dataset.mod).label} set to ${lvl[0].toUpperCase() + lvl.slice(1)}`, 'Applies immediately to every user holding this role.')
  R.refresh()
}
ACT['role.del'] = (el) => {
  const role = S.find('roles', el.dataset.role)
  role.permissions[el.dataset.mod].d = el.checked
  S.log('Role permission changed', { module: 'ADMIN', detail: `${role.name} · ${el.dataset.mod} delete ${el.checked ? 'on' : 'off'}` })
  R.refresh()
}
ACT['role.new'] = () => {
  UI.modal({
    title: 'New role',
    desc: 'Adding a role is a data change, not a schema change.',
    size: 'md',
    body: UI.form([
      { name: 'name', label: 'Role name', required: true, placeholder: 'e.g. Payment poster', validate: (v) => (DB.roles.some((r) => r.name.toLowerCase() === v.toLowerCase()) ? 'A role with this name exists.' : '') },
      { name: 'from', label: 'Start from', type: 'select', required: true, placeholder: false, options: DB.roles.filter((r) => !r.isGlobal).map((r) => ({ value: r.id, label: `Copy of ${r.name}` })) },
    ]),
    foot: UI.btn({ label: 'Cancel', variant: 'quiet', act: 'layer.close' }) + UI.btn({ label: 'Create role', variant: 'primary', act: 'role.create' }),
  })
}
ACT['role.create'] = (el) => {
  const vals = UI.submitForm(UI.formOf(el.closest('.layer')))
  if (!vals) return
  const src = S.find('roles', vals.from)
  const r = { id: U.id('r'), code: vals.name.toUpperCase().replace(/\W+/g, '_'), name: vals.name, isGlobal: false, custom: true, permissions: U.clone(src.permissions), description: `Custom role based on ${src.name}.` }
  DB.roles.push(r)
  S.view('adm-roles', {}).sel = r.id
  S.log('Role created', { module: 'ADMIN', detail: r.name })
  UI.closeTop()
  R.refresh()
}
ACT['role.delete'] = async (el) => {
  const r = S.find('roles', el.dataset.id)
  if (DB.users.some((u) => u.roleIds.includes(r.id))) {
    UI.toast('warning', 'This role is assigned to users', 'Remove it from every user first.')
    return
  }
  const ok = await UI.confirm({ title: `Delete ${r.name}?`, message: 'The role and its permissions are removed.', confirmLabel: 'Delete role', tone: 'critical' })
  if (!ok) return
  DB.roles = DB.roles.filter((x) => x.id !== r.id)
  S.view('adm-roles', {}).sel = 'r2'
  R.refresh()
}

// ---------------------------------------------------------------- EMR integration (§2)
Adm.integration = () => {
  const locs = S.locationsOfPractice()
  const last = (l) => DB.emrLog.find((e) => e.locationId === l.id)
  const canC = S.can('INTEGRATION', 'c')
  const canU = S.can('INTEGRATION', 'u')
  const canApprove = S.hasRole('SYSTEM_ADMIN') || S.hasRole('ORG_ADMIN')
  const lv = S.view('emrlog', { results: [], page: 1 })
  const RES = ['Accepted', 'Replaced', 'Updated queue', 'Blocked']
  const log = DB.emrLog.filter((e) => locs.some((l) => l.id === e.locationId) && (!lv.results.length || lv.results.includes(e.result)))
  const RES_TONE = { Accepted: 'success', Replaced: 'info', 'Updated queue': 'attention', Blocked: 'critical' }
  return `<div class="grid-3"><div class="card card-pad"><div class="eyebrow">1 · Request</div><div class="t-micro muted-2 mt-8">A Domain Admin raises a formal integration request for a location.</div></div><div class="card card-pad"><div class="eyebrow">2 · Link</div><div class="t-micro muted-2 mt-8">The location is mapped 1:1 to its EMR twin through a shared Unique Location ID.</div></div><div class="card card-pad"><div class="eyebrow">3 · Elect</div><div class="t-micro muted-2 mt-8">Integrated locations send sessions, charges, charts, cases and providers; EMR-only payloads are blocked.</div></div></div>
    <div class="section">${UI.sectionHead('Locations', S.practice().name)}${UI.table({
      cols: [
        { key: 'name', label: 'Location', render: (l) => `<span class="ink fw-500">${U.esc(l.name)}</span><span class="sub">${l.code}</span>` },
        { key: 'uid', label: 'Unique Location ID', render: (l) => (l.emr.uniqueLocationId ? `<span class="code">${l.emr.uniqueLocationId}</span>` : '<span class="muted">—</span>') },
        { key: 'link', label: 'Link', render: (l) => `${UI.chip(l.emr.link === 'Linked' ? 'success' : l.emr.link === 'Requested' ? 'warning' : 'inert', l.emr.link)}${l.emr.link === 'Requested' ? `<span class="sub">By ${U.esc(S.userName(l.emr.requestedBy))} · ${U.date(l.emr.requestedOn)}</span>` : l.emr.linkedOn ? `<span class="sub">Since ${U.date(l.emr.linkedOn)}</span>` : ''}` },
        { key: 'election', label: 'Billing election', render: (l) => UI.chip(l.emr.election === 'Integrated' ? 'brand' : 'inert', l.emr.election) },
        { key: 'last', label: 'Last payload', render: (l) => { const e = last(l); return e ? `${U.stampLabel(e.at, DB.today)}<span class="sub">${UI.chip(RES_TONE[e.result] || 'inert', e.result)}</span>` : '<span class="muted">—</span>' } },
        { key: 'act', label: '', cls: 'r', render: (l) => {
          if (l.emr.link === 'Not linked') return canC ? UI.btn({ label: 'Request integration', size: 'sm', act: 'emr.request', data: { id: l.id } }) : ''
          if (l.emr.link === 'Requested') return canApprove ? UI.btn({ label: 'Approve & link', size: 'sm', act: 'emr.approve', data: { id: l.id } }) : '<span class="t-micro muted">Awaiting approval</span>'
          return canU ? UI.btn({ label: l.emr.election === 'Integrated' ? 'Switch to EMR-only' : 'Switch to integrated', size: 'sm', act: 'emr.elect', data: { id: l.id } }) : ''
        } },
      ],
      rows: locs, view: S.view('emr-locs', { page: 1 }), viewKey: 'emr-locs', noun: 'location', noPaging: true,
    })}<div class="t-micro muted mt-8">A System Admin or Organization Admin approves integration requests.</div></div>
    <div class="section">${UI.sectionHead('Payload log', 'Every payload received from the EMR and what reconciliation did with it')}<div class="mt-12">${UI.pills(RES.map((r) => ({ key: r, label: r, count: DB.emrLog.filter((e) => e.result === r && locs.some((l) => l.id === e.locationId)).length })), lv.results, 'emr.logFilter')}</div>
      ${UI.table({
        cols: [
          { key: 'at', label: 'Received', render: (e) => U.stampLabel(e.at, DB.today) },
          { key: 'loc', label: 'Location', render: (e) => U.esc(S.find('locations', e.locationId).name) },
          { key: 'rec', label: 'Internal Record ID', render: (e) => `<span class="code">${U.esc(e.recordId)}</span>` },
          { key: 'patient', label: 'Patient', render: (e) => U.esc(e.patient) },
          { key: 'result', label: 'Result', render: (e) => UI.chip(RES_TONE[e.result] || 'inert', e.result) },
          { key: 'detail', label: 'Detail', render: (e) => `<span style="white-space:normal">${U.esc(e.detail)}</span>${e.visitId && S.find('visits', e.visitId) ? ` <a href="#/charges/visit/${e.visitId}">Open</a>` : ''}` },
        ],
        rows: log, view: lv, viewKey: 'emrlog', noun: 'payload', pageSize: 10,
        empty: UI.empty({ icon: 'plug', title: 'No payloads', text: 'Payloads appear here when a linked location sends a finalized note.' }),
      })}</div>`
}
ACT['emr.logFilter'] = (el) => {
  const v = S.view('emrlog', {})
  v.results = v.results.includes(el.dataset.key) ? v.results.filter((x) => x !== el.dataset.key) : [...v.results, el.dataset.key]
  v.page = 1
  R.refresh()
}
ACT['emr.request'] = (el) => {
  const l = S.find('locations', el.dataset.id)
  const h = UI.modal({
    title: `Request integration — ${l.name}`,
    desc: 'The shared Unique Location ID maps this location 1:1 to the same location in the EMR.',
    size: 'md',
    body: UI.form([
      { name: 'uid', label: 'Unique Location ID', required: true, placeholder: 'EMR-LOC-0000', validate: (v) => (DB.locations.some((x) => x.emr.uniqueLocationId === v && x.id !== l.id) ? 'This ID is already linked to another location.' : '') },
      { name: 'note', label: 'Note for the approver', type: 'textarea', rows: 2, placeholder: 'Optional' },
    ], { uid: `EMR-LOC-${4480 + DB.locations.length}` }),
    foot: UI.btn({ label: 'Cancel', variant: 'quiet', act: 'layer.close' }) + UI.btn({ label: 'Send request', variant: 'primary', act: 'emr.requestSave' }),
  })
  h.el.dataset.id = l.id
}
ACT['emr.requestSave'] = (el) => {
  const layer = el.closest('.layer')
  const vals = UI.submitForm(UI.formOf(layer))
  if (!vals) return
  const l = S.find('locations', layer.dataset.id)
  Object.assign(l.emr, { uniqueLocationId: vals.uid, link: 'Requested', requestedBy: S.session.userId, requestedOn: DB.today })
  S.log('EMR integration requested', { module: 'INTEGRATION', detail: `${l.name} · ${vals.uid}` })
  UI.closeTop()
  UI.toast('success', 'Integration requested', 'It waits for approval before the location is linked.')
  R.refresh()
}
ACT['emr.approve'] = async (el) => {
  const l = S.find('locations', el.dataset.id)
  const ok = await UI.confirm({ title: `Link ${l.name} to the EMR?`, message: `Unique Location ID ${l.emr.uniqueLocationId} is mapped 1:1. The location stays EMR-only until someone elects it for billing.`, confirmLabel: 'Approve & link' })
  if (!ok) return
  Object.assign(l.emr, { link: 'Linked', linkedOn: DB.today })
  S.log('EMR integration approved and linked', { module: 'INTEGRATION', detail: `${l.name} · ${l.emr.uniqueLocationId}` })
  UI.toast('success', `${l.name} linked`, 'Switch it to Integrated to send its sessions into billing.')
  R.refresh()
}
ACT['emr.elect'] = async (el) => {
  const l = S.find('locations', el.dataset.id)
  const toIntegrated = l.emr.election !== 'Integrated'
  const ok = await UI.confirm({
    title: toIntegrated ? `Bill ${l.name} through the platform?` : `Make ${l.name} EMR-only?`,
    message: toIntegrated ? 'From now on its sessions, charges, patient charts, cases and providers flow into billing.' : 'New payloads from this location are blocked from billing. Data already in billing is not changed.',
    confirmLabel: toIntegrated ? 'Switch to integrated' : 'Switch to EMR-only',
    tone: toIntegrated ? 'primary' : 'critical',
  })
  if (!ok) return
  l.emr.election = toIntegrated ? 'Integrated' : 'EMR only'
  S.log(`Billing election changed to ${l.emr.election}`, { module: 'INTEGRATION', detail: l.name })
  UI.toast('success', `${l.name} is now ${l.emr.election}`)
  R.refresh()
}

// ---------------------------------------------------------------- providers
Adm.providers = () => {
  const list = DB.providers.filter((p) => p.practiceId === S.session.practiceId)
  const payers = DB.insurances.filter((i) => i.practiceId === S.session.practiceId && !i.draft)
  return UI.table({
    cols: [
      { key: 'code', label: 'Provider ID', sort: true, render: (p) => `<span class="code">${U.esc(p.code)}</span>` },
      { key: 'name', label: 'Provider', sort: (p) => p.lastName, render: (p) => `<span class="ink fw-500">${U.esc(S.provName(p) || '(unnamed)')}</span><span class="sub">${U.esc(p.specialty || '—')}</span>` },
      { key: 'npi', label: 'NPI', render: (p) => (E.npiValid(p.npi) ? p.npi : `<span class="status critical">${p.npi || 'Missing'}</span>`) },
      { key: 'tax', label: 'Taxonomy · license', render: (p) => `${U.esc(p.taxonomy || '—')}<span class="sub">${U.esc(p.stateLicense || '—')}</span>` },
      { key: 'hold', label: 'Claim hold', render: (p) => (p.claimHoldUntil ? `<span class="status ${E.holdRunning(p) ? 'attention' : 'inert'}">${U.esc(E.holdWindow(p))}</span><span class="sub">${U.esc(p.claimHoldReason)} · ${U.esc(E.holdScope(p))}</span>` : '<span class="muted">None</span>') },
      { key: 'enr', label: 'Payer enrollment', render: (p) => { const a = p.enrollments.filter((e) => e.status === 'Active').length; const pen = p.enrollments.filter((e) => e.status === 'Pending').length; return `${a}/${payers.length} active${pen ? ` · <span class="status warning">${pen} pending</span>` : ''}` } },
      { key: 'st', label: 'Status', render: (p) => (p.draft ? UI.chip('critical', 'Draft from EMR') : UI.status(p.isActive ? 'success' : 'inert', p.isActive ? 'Active' : 'Inactive')) },
    ],
    empty: UI.empty({ icon: 'stethoscope', title: 'No providers yet', text: 'Providers are the clinicians who treat and bill — every visit names a billing and a rendering provider, printed with their NPI on the claim. They do not sign in. A provider can also arrive as a draft profile when an EMR session names someone unknown.', action: canA('c') ? UI.btn({ label: 'Add a provider', icon: 'plus', variant: 'primary', act: 'prov.edit' }) : '' }),
    rows: list, view: S.view('adm-prov', { sort: 'code', dir: 'asc', page: 1 }), viewKey: 'adm-prov', rowAct: 'prov.edit', noun: 'provider', mark: (p) => (p.draft ? 'critical' : E.holdRunning(p) ? 'attention' : null),
  })
}
ACT['prov.edit'] = (el) => {
  const p = el.dataset.id ? S.find('providers', el.dataset.id) : null
  const editable = canA(p ? 'u' : 'c')
  const payers = DB.insurances.filter((i) => i.practiceId === S.session.practiceId && !i.draft)
  const locs = DB.locations.filter((l) => l.practiceId === S.session.practiceId)
  const scopeList = (items, attr, chosen) =>
    items.length
      ? items.map((x) => `<label class="check-row"><input type="checkbox" ${attr}="${x.id}" ${chosen.includes(x.id) ? 'checked' : ''} ${editable ? '' : 'disabled'}><span>${U.esc(x.name)}</span></label>`).join('')
      : '<div class="t-micro muted">None yet.</div>'
  const enrHtml = `<div class="form-section-title" style="margin-top:20px">Payer enrollment (credentialing)</div><div class="t-micro muted-2 mt-4 mb-8">Claims are checked for active enrollment with the payer on the date of service.</div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Payer</th><th>Status</th><th>Effective</th></tr></thead><tbody>${payers.map((i) => { const e = p ? p.enrollments.find((x) => x.insuranceId === i.id) : null; return `<tr><td class="ink">${U.esc(i.name)}</td><td><select class="mini-select" data-enr="${i.id}" ${editable ? '' : 'disabled'} aria-label="Enrollment with ${U.esc(i.name)}">${['Active', 'Pending', 'Not enrolled'].map((s) => `<option ${((e && e.status) || 'Not enrolled') === s ? 'selected' : ''}>${s}</option>`).join('')}</select></td><td><input class="mini-input" style="width:140px" type="date" data-enr-date="${i.id}" value="${(e && e.effective) || ''}" ${editable ? '' : 'disabled'} aria-label="Effective date"></td></tr>` }).join('')}</tbody></table></div>${payers.length ? '' : `<div class="mt-8">${UI.notice('warning', 'No insurances yet.', 'Enrollment is recorded per payer. Add the practice’s insurances first; until the provider is enrolled with a payer, that payer’s claims stop in the Credentialing hold.')}</div>`}`
  const h = UI.modal({
    title: p ? S.provName(p) || 'Provider' : 'New provider',
    desc: p && p.draft ? U.esc(p.draftFrom || 'Draft profile from the EMR') : 'Clinicians carry an individual NPI, state license and taxonomy.',
    size: 'lg',
    body: UI.form([
      { name: 'firstName', label: 'First name', required: true, span: 4, disabled: !editable },
      { name: 'lastName', label: 'Last name', required: true, span: 4, disabled: !editable },
      { name: 'credential', label: 'Credential', span: 4, placeholder: 'PT, DPT', help: 'Optional.', disabled: !editable },
      { name: 'code', label: 'Provider ID', required: true, span: 3, disabled: !editable },
      { name: 'specialty', label: 'Specialty', type: 'select', required: true, span: 5, options: ['PHYSICAL THERAPIST', 'OCCUPATIONAL THERAPIST', 'SPEECH-LANGUAGE PATHOLOGIST'], disabled: !editable },
      { name: 'npi', label: 'Individual NPI', type: 'npi', required: true, span: 4, help: 'Required for billing.', disabled: !editable, validate: (v) => (E.DUMMY_NPIS.includes(v) ? 'Please enter a valid NPI.' : '') },
      { name: 'taxonomy', label: 'Taxonomy code', required: true, span: 6, disabled: !editable },
      { name: 'stateLicense', label: 'State license', span: 6, disabled: !editable },
      { type: 'section', label: 'Claim hold' },
      { type: 'note', label: 'While the hold is running, this provider’s visits inside the window wait in Delayed and unsent claims stop in the Provider hold — billing and submission both. When the end date passes, they go out normally.' },
      { name: 'claimHoldFrom', label: 'Hold from', type: 'date', span: 4, requiredIf: (v) => !!v.claimHoldUntil, disabled: !editable },
      { name: 'claimHoldUntil', label: 'Hold until', type: 'date', span: 4, disabled: !editable, help: 'Clear it to lift the hold.', validate: (val, v) => (val && v.claimHoldFrom && val < v.claimHoldFrom ? 'Please enter a valid date.' : '') },
      { name: 'claimHoldReason', label: 'Reason', span: 4, placeholder: 'e.g. Pending Provider Credentialing', requiredIf: (v) => !!v.claimHoldUntil, disabled: !editable },
      { type: 'html', span: 6, html: `<div class="eyebrow mb-8">Locations the hold covers</div>${scopeList(locs, 'data-hold-loc', (p && p.claimHoldLocations) || [])}<div class="t-micro muted-2 mt-4">Tick none to cover every location.</div>` },
      { type: 'html', span: 6, html: `<div class="eyebrow mb-8">Payers the hold covers</div>${scopeList(payers, 'data-hold-ins', (p && p.claimHoldInsurances) || [])}<div class="t-micro muted-2 mt-4">Tick none to cover every payer.</div>` },
      { name: 'isActive', label: 'Active', type: 'checkbox', span: 12, disabled: !editable },
    ], p || { isActive: true, specialty: 'PHYSICAL THERAPIST', taxonomy: '225100000X', code: String(330 + DB.providers.length) }) + enrHtml,
    foot: UI.btn({ label: editable ? 'Cancel' : 'Close', variant: 'quiet', act: 'layer.close' }) + (editable ? UI.btn({ label: 'Save provider', variant: 'primary', act: 'prov.save' }) : ''),
  })
  if (p) h.el.dataset.id = p.id
}
ACT['prov.save'] = (el) => {
  const layer = el.closest('.layer')
  const vals = UI.submitForm(UI.formOf(layer))
  if (!vals) return
  const enrollments = U.qsa('[data-enr]', layer).filter((s) => s.value !== 'Not enrolled').map((s) => ({ insuranceId: s.dataset.enr, status: s.value, effective: layer.querySelector(`[data-enr-date="${s.dataset.enr}"]`).value || null }))
  const picked = (attr) => U.qsa(`[${attr}]`, layer).filter((x) => x.checked).map((x) => x.getAttribute(attr))
  const held = !!vals.claimHoldUntil
  const data = { firstName: vals.firstName, lastName: vals.lastName, credential: vals.credential, code: vals.code, specialty: vals.specialty, npi: vals.npi, taxonomy: vals.taxonomy, stateLicense: vals.stateLicense, claimHoldFrom: held ? vals.claimHoldFrom || null : null, claimHoldUntil: vals.claimHoldUntil || null, claimHoldReason: held ? vals.claimHoldReason : '', claimHoldLocations: held ? picked('data-hold-loc') : [], claimHoldInsurances: held ? picked('data-hold-ins') : [], isActive: vals.isActive, enrollments, draft: false }
  let p
  if (layer.dataset.id) {
    p = S.find('providers', layer.dataset.id)
    Object.assign(p, data)
  } else {
    p = { id: U.id('P'), practiceId: S.session.practiceId, ...data }
    DB.providers.push(p)
  }
  S.log(layer.dataset.id ? 'Provider updated' : 'Provider created', { module: 'ADMIN', entityType: 'provider', entityId: p.id, detail: `${S.provName(p)}${p.claimHoldUntil ? ` · ${E.holdText(p)}` : ''}` })
  UI.closeTop()
  const sum = E.cascadeSummary(E.cascade())
  UI.toast('success', 'Provider saved', sum ? `What happened next: ${sum}.` : '', 7000)
  R.refresh()
}

// ---------------------------------------------------------------- insurance classes (PRD V2 §10.3, CH-02)
const YN = (v) => (v ? 'Yes' : 'No')
Adm.classes = () => {
  const list = DB.insuranceClasses.filter((c) => c.practiceId === S.session.practiceId)
  return `<div class="mb-16">${UI.notice('info', 'How inheritance works.', 'Every insurance belongs to exactly one class. A rule left blank on the insurance uses the class value; a value set on the insurance overrides the class for that insurance only Changes apply to claims the next time they are scrubbed.')}</div>${UI.table({
    cols: [
      { key: 'code', label: 'Code', sort: true, render: (c) => `<span class="code">${U.esc(c.code)}</span>` },
      { key: 'name', label: 'Class', sort: true, render: (c) => `<span class="ink fw-500">${U.esc(c.name)}</span>` },
      { key: 'rules', label: 'Rule defaults', render: (c) => [c.authRequired && UI.tag('Auth required'), c.injuryDateRequired && UI.tag('Injury date required'), c.specialtyModifiers && UI.tag('Specialty modifiers'), !c.acceptAssignment && UI.tag('No assignment', 'sand'), UI.tag(c.icdVersion)].filter(Boolean).join(' ') },
      { key: 'ins', label: 'Insurances', cls: 'r', render: (c) => DB.insurances.filter((i) => i.classId === c.id).length },
      { key: 'over', label: 'With overrides', cls: 'r', render: (c) => { const n = DB.insurances.filter((i) => i.classId === c.id && E.RULES.some((r) => !E.inherited(i, r.key))).length; return n ? `<span class="status attention">${n}</span>` : '<span class="muted">0</span>' } },
      { key: 'st', label: 'Status', render: (c) => UI.status(c.isActive ? 'success' : 'inert', c.isActive ? 'Active' : 'Inactive') },
    ],
    rows: list, view: S.view('adm-cls', { sort: 'code', dir: 'asc', page: 1 }), viewKey: 'adm-cls', rowAct: 'cls.edit', noun: 'class',
    empty: UI.empty({ icon: 'layers', title: 'No insurance classes', text: 'Create a class before adding insurances — every insurance needs one.' }),
  })}`
}
ACT['cls.edit'] = (el) => {
  const c = el.dataset.id ? S.find('insuranceClasses', el.dataset.id) : null
  const editable = canA(c ? 'u' : 'c')
  const members = c ? DB.insurances.filter((i) => i.classId === c.id) : []
  const h = UI.modal({
    title: c ? `${c.code} — ${c.name}` : 'New insurance class',
    desc: 'The default for every billing rule of the insurances in this class.',
    size: 'md',
    body: UI.form([
      { name: 'code', label: 'Code', required: true, span: 4, maxLength: 8, disabled: !editable, validate: (v) => (DB.insuranceClasses.some((x) => x.practiceId === S.session.practiceId && x.code.toUpperCase() === v.toUpperCase() && (!c || x.id !== c.id)) ? 'This code is already used.' : '') },
      { name: 'name', label: 'Name', required: true, span: 8, placeholder: 'Worker’s Comp', disabled: !editable },
      { type: 'section', label: 'Rule defaults' },
      { name: 'authRequired', label: 'Authorization required', type: 'checkbox', span: 6, disabled: !editable, desc: 'Visits without one are pended; claims without one are held.' },
      { name: 'injuryDateRequired', label: 'Injury date required', type: 'checkbox', span: 6, disabled: !editable, desc: 'Box 14 must be filled.' },
      { name: 'specialtyModifiers', label: 'Apply specialty modifiers', type: 'checkbox', span: 6, disabled: !editable, desc: 'Adds GP / GO / GN to therapy lines.' },
      { name: 'acceptAssignment', label: 'Accept assignment', type: 'checkbox', span: 6, disabled: !editable, desc: 'Box 27.' },
      { name: 'icdVersion', label: 'ICD version', type: 'select', span: 6, placeholder: false, options: ['ICD10', 'ICD9'], disabled: !editable },
      { name: 'isActive', label: 'Active', type: 'checkbox', span: 6, disabled: !editable },
    ], c || { isActive: true, icdVersion: 'ICD10', acceptAssignment: true, specialtyModifiers: true }) +
      (members.length ? `<div class="form-note mt-16">${U.plural(members.length, 'insurance')} in this class: ${members.map((i) => U.esc(i.name) + (E.RULES.some((r) => !E.inherited(i, r.key)) ? ' (overrides)' : '')).join(', ')}.</div>` : ''),
    foot: UI.btn({ label: editable ? 'Cancel' : 'Close', variant: 'quiet', act: 'layer.close' }) + (editable ? UI.btn({ label: 'Save class', variant: 'primary', act: 'cls.save' }) : ''),
  })
  if (c) h.el.dataset.id = c.id
}
ACT['cls.save'] = (el) => {
  const layer = el.closest('.layer')
  const vals = UI.submitForm(UI.formOf(layer))
  if (!vals) return
  const data = { code: vals.code.toUpperCase(), name: vals.name, authRequired: vals.authRequired, injuryDateRequired: vals.injuryDateRequired, specialtyModifiers: vals.specialtyModifiers, acceptAssignment: vals.acceptAssignment, icdVersion: vals.icdVersion, isActive: vals.isActive }
  let c
  if (layer.dataset.id) {
    c = S.find('insuranceClasses', layer.dataset.id)
    Object.assign(c, data)
  } else {
    c = { id: U.id('ic'), practiceId: S.session.practiceId, ...data }
    DB.insuranceClasses.push(c)
  }
  S.log(layer.dataset.id ? 'Insurance class updated' : 'Insurance class created', { module: 'ADMIN', entityType: 'insuranceClass', entityId: c.id, detail: `${c.code} ${c.name}` })
  UI.closeTop()
  const sum = E.cascadeSummary(E.cascade())
  UI.toast('success', 'Class saved', sum ? `Inheriting insurances picked it up. ${sum}.` : 'Insurances that inherit these rules use them at the next scrub.', 7000)
  R.refresh()
}

// ---------------------------------------------------------------- release buckets (PRD V2 §6.2, §10.3, CH-01/CH-03)
Adm.buckets = () => {
  const list = DB.releaseBuckets.filter((b) => b.practiceId === S.session.practiceId)
  return UI.table({
    cols: [
      { key: 'name', label: 'Bucket', sort: true, render: (b) => `<span class="ink fw-500">${U.esc(b.name)}</span><span class="sub" style="white-space:normal;max-width:360px">${U.esc(b.description || '—')}</span>` },
      { key: 'ins', label: 'Held insurances', render: (b) => { const l = DB.insurances.filter((i) => i.releaseBucketId === b.id && i.insuranceHold); return l.length ? l.map((i) => U.esc(i.name)).join('<br>') : '<span class="muted">None</span>' } },
      { key: 'waiting', label: 'Claims waiting', cls: 'r', render: (b) => { const n = E.waitingInBucket(b.id).length; return n ? `<a class="status attention" href="#/claims/buckets">${n}</a>` : '<span class="muted">0</span>' } },
      { key: 'st', label: 'Status', render: (b) => UI.status(b.isActive ? 'success' : 'inert', b.isActive ? 'Active' : 'Inactive') },
    ],
    rows: list, view: S.view('adm-bkt', { sort: 'name', dir: 'asc', page: 1 }), viewKey: 'adm-bkt', rowAct: 'bkt.edit', noun: 'bucket',
    empty: UI.empty({ icon: 'inbox', title: 'No release buckets', text: 'Create one, then check the insurance hold on the insurances that need manual release.' }),
  })
}
ACT['bkt.edit'] = (el) => {
  const b = el.dataset.id ? S.find('releaseBuckets', el.dataset.id) : null
  const editable = canA(b ? 'u' : 'c')
  const assigned = b ? DB.insurances.filter((i) => i.releaseBucketId === b.id && i.insuranceHold) : []
  const h = UI.modal({
    title: b ? b.name : 'New release bucket',
    desc: 'A named manual-release queue created by a Practice Admin.',
    size: 'md',
    body: UI.form([
      { name: 'name', label: 'Name', required: true, span: 12, placeholder: 'Manual Release – WC Payers', disabled: !editable, validate: (v) => (DB.releaseBuckets.some((x) => x.practiceId === S.session.practiceId && x.name.toLowerCase() === v.toLowerCase() && (!b || x.id !== b.id)) ? 'This name is already used.' : '') },
      { name: 'description', label: 'Description', type: 'textarea', span: 12, rows: 2, disabled: !editable },
      { name: 'isActive', label: 'Active', type: 'checkbox', span: 12, disabled: !editable, desc: 'Inactive buckets cannot be assigned to new insurances.' },
    ], b || { isActive: true }) +
      (b ? `<div class="form-note mt-16">${assigned.length ? `Assigned to ${assigned.map((i) => U.esc(i.name)).join(', ')}.` : 'No insurance is assigned to this bucket.'} ${E.waitingInBucket(b.id).length ? `${U.plural(E.waitingInBucket(b.id).length, 'claim')} waiting.` : ''} Deactivating the bucket keeps its insurances and waiting claims.</div>` : ''),
    foot: UI.btn({ label: editable ? 'Cancel' : 'Close', variant: 'quiet', act: 'layer.close' }) + (editable ? UI.btn({ label: 'Save bucket', variant: 'primary', act: 'bkt.save' }) : ''),
  })
  if (b) h.el.dataset.id = b.id
}
ACT['bkt.save'] = (el) => {
  const layer = el.closest('.layer')
  const vals = UI.submitForm(UI.formOf(layer))
  if (!vals) return
  let b
  if (layer.dataset.id) {
    b = S.find('releaseBuckets', layer.dataset.id)
    Object.assign(b, { name: vals.name, description: vals.description, isActive: vals.isActive })
  } else {
    b = { id: U.id('rb'), practiceId: S.session.practiceId, name: vals.name, description: vals.description, isActive: vals.isActive, createdBy: S.session.userId, createdOn: DB.today }
    DB.releaseBuckets.push(b)
  }
  S.log(layer.dataset.id ? 'Release bucket updated' : 'Release bucket created', { module: 'ADMIN', entityType: 'releaseBucket', entityId: b.id, detail: b.name })
  UI.closeTop()
  UI.toast('success', 'Release bucket saved', layer.dataset.id ? '' : 'Assign it to an insurance by checking that insurance’s hold.')
  R.refresh()
}

// ---------------------------------------------------------------- insurances
const TRI = (v) => (v === null || v === undefined ? 'inherit' : v === true ? 'yes' : v === false ? 'no' : v)
const UNTRI = (v) => (v === 'inherit' ? null : v === 'yes' ? true : v === 'no' ? false : v)
const effSummary = (vals, practiceId) => {
  const cls = S.find('insuranceClasses', vals.classId)
  if (!cls) return '<span class="muted">Choose a class to see the effective rules.</span>'
  return E.RULES.map((r) => {
    const own = UNTRI(vals[r.key])
    const val = own === null || own === undefined || own === '' ? cls[r.key] : own
    const src = own === null || own === undefined || own === '' ? `from ${U.esc(cls.name)}` : '<b>overridden</b>'
    return `<div class="row" style="padding:3px 0"><span class="grow">${r.label}</span><span class="ink fw-500">${typeof val === 'boolean' ? YN(val) : U.esc(val)}</span><span class="muted t-micro" style="width:130px;text-align:right">${src}</span></div>`
  }).join('') + (void practiceId || '')
}
Adm.insurances = () => {
  const list = DB.insurances.filter((i) => i.practiceId === S.session.practiceId)
  return UI.table({
    cols: [
      { key: 'code', label: 'Payer', sort: true, render: (i) => { const cls = E.classOf(i); return `<span class="ink fw-500">${U.esc(S.insLabel(i))}</span><span class="sub">${U.esc(cls ? cls.name : '— no class')} · ${U.esc(i.type || '—')}</span>` } },
      { key: 'payerId', label: 'Payer ID', render: (i) => U.esc(i.payerId || '—') },
      { key: 'rules', label: 'Effective billing rules', render: (i) => [E.eff(i, 'authRequired') && UI.tag('Auth required'), E.eff(i, 'injuryDateRequired') && UI.tag('Injury date required'), E.eff(i, 'specialtyModifiers') && UI.tag('Specialty modifiers'), i.format === 'CMS1500' && UI.tag('Paper CMS-1500')].filter(Boolean).join(' ') + (E.RULES.some((r) => !E.inherited(i, r.key)) ? ` <span class="t-micro muted">· overrides class</span>` : '') || '<span class="muted">—</span>' },
      { key: 'hold', label: 'Insurance hold', render: (i) => `${i.insuranceHold ? `${UI.tag('Manual release', 'sand')}<span class="sub">${U.esc((S.find('releaseBuckets', i.releaseBucketId) || {}).name || '(no bucket)')}</span>` : '<span class="muted">Automatic</span>'}${i.auditRequired ? `<span class="sub">${UI.tag('Audit required', 'sand')}</span>` : ''}` },
      { key: 'sla', label: 'SLA', sort: (i) => i.slaDays, render: (i) => `${i.slaDays} days` },
      { key: 'st', label: 'Status', render: (i) => (i.draft ? UI.chip('critical', 'Draft from EMR') : UI.status(i.isActive ? 'success' : 'inert', i.isActive ? 'Active' : 'Inactive')) },
    ],
    empty: UI.empty({ icon: 'landmark', title: 'No insurances yet', text: `An insurance is a payer as this practice bills it. Coverage on a patient’s case points to one, and claims are addressed to that coverage. ${DB.insuranceClasses.some((c) => c.practiceId === S.session.practiceId) ? 'Each one belongs to an insurance class and inherits its rules.' : 'Each one must belong to an insurance class, so create a class first.'}`, action: canA('c') ? UI.btn({ label: DB.insuranceClasses.some((c) => c.practiceId === S.session.practiceId) ? 'Add an insurance' : 'Create an insurance class', icon: 'plus', variant: 'primary', act: DB.insuranceClasses.some((c) => c.practiceId === S.session.practiceId) ? 'ins.edit' : 'go', data: { hash: '#/admin/classes' } }) : '' }),
    rows: list, view: S.view('adm-ins', { sort: 'code', dir: 'asc', page: 1 }), viewKey: 'adm-ins', rowAct: 'ins.edit', noun: 'insurance', mark: (i) => (i.draft ? 'critical' : null),
  })
}
ACT['ins.edit'] = (el) => {
  const ins = el.dataset.id ? S.find('insurances', el.dataset.id) : null
  if (!ins && !DB.insuranceClasses.some((c) => c.practiceId === S.session.practiceId && c.isActive)) {
    Dep.modal({
      title: 'Cannot add an insurance yet',
      text: 'Every insurance must belong to exactly one insurance class — the class holds the default billing rules the insurance inherits. This practice has no active insurance class yet.',
      needs: [{ ok: false, label: 'An insurance class', why: 'For example Commercial, Medicare, Workers’ Comp or Auto / No-Fault.', action: { label: 'Create an insurance class', hash: '#/admin/classes' } }],
    })
    return
  }
  const editable = canA(ins ? 'u' : 'c')
  const pid = S.session.practiceId
  const classes = DB.insuranceClasses.filter((c) => c.practiceId === pid && (c.isActive || (ins && ins.classId === c.id)))
  // "Inactive buckets cannot be assigned to new insurances" — an existing assignment stays selectable.
  const buckets = DB.releaseBuckets.filter((b) => b.practiceId === pid && (b.isActive || (ins && ins.releaseBucketId === b.id)))
  const triOpts = [{ value: 'inherit', label: 'Inherit from class' }, { value: 'yes', label: 'Yes — override' }, { value: 'no', label: 'No — override' }]
  const start = ins
    ? { ...ins, ...ins.address, ...Object.fromEntries(E.RULES.map((r) => [r.key, TRI(ins[r.key])])) }
    : { format: '837P', maxUnits: 6, slaDays: 30, insuranceHold: false, auditRequired: false, ...Object.fromEntries(E.RULES.map((r) => [r.key, 'inherit'])) }
  const h = UI.modal({
    title: ins ? S.insLabel(ins) : 'New insurance',
    desc: 'A payer as the practice bills it.',
    size: 'lg',
    body: UI.form([
      { type: 'section', label: 'Payer' },
      { name: 'code', label: 'Code', type: 'number', required: true, span: 3, disabled: !editable, validate: (v) => (DB.insurances.some((i) => i.practiceId === pid && String(i.code) === String(v) && (!ins || i.id !== ins.id)) ? 'This code is already used.' : '') },
      { name: 'name', label: 'Name', required: true, span: 9, disabled: !editable },
      { name: 'classId', label: 'Insurance class', type: 'select', required: true, span: 4, disabled: !editable, options: classes.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` })), help: 'Required. One class per insurance.' },
      { name: 'type', label: 'Insurance type (claim filing indicator)', type: 'select', required: true, span: 4, disabled: !editable, options: ['Commercial', 'Medicare', 'Workers Comp', 'PIP'] },
      { name: 'payerId', label: 'Clearinghouse payer ID', required: true, span: 4, disabled: !editable },
      { name: 'line1', label: 'Claims address', span: 12, disabled: !editable },
      { name: 'city', label: 'City', span: 6, disabled: !editable },
      { name: 'state', label: 'State', type: 'state', span: 3, disabled: !editable },
      { name: 'zip', label: 'ZIP', type: 'zip', span: 3, disabled: !editable },
      { name: 'phone', label: 'Phone', type: 'tel', span: 6, disabled: !editable },
      { name: 'fax', label: 'Fax', type: 'tel', span: 6, disabled: !editable },
      { type: 'section', label: 'Billing rules — inherit from the class or override' },
      { name: 'authRequired', label: 'Authorization required', type: 'select', placeholder: false, span: 4, options: triOpts, disabled: !editable },
      { name: 'injuryDateRequired', label: 'Injury date required', type: 'select', placeholder: false, span: 4, options: triOpts, disabled: !editable },
      { name: 'specialtyModifiers', label: 'Apply specialty modifiers', type: 'select', placeholder: false, span: 4, options: triOpts, disabled: !editable },
      { name: 'acceptAssignment', label: 'Accept assignment', type: 'select', placeholder: false, span: 4, options: triOpts, disabled: !editable },
      { name: 'icdVersion', label: 'ICD version', type: 'select', placeholder: false, span: 4, options: [{ value: 'inherit', label: 'Inherit from class' }, { value: 'ICD10', label: 'ICD10 — override' }, { value: 'ICD9', label: 'ICD9 — override' }], disabled: !editable },
      { type: 'html', span: 12, html: `<div class="card card-pad" style="background:var(--bg-sunk,#f6f7f9)"><div class="eyebrow mb-8">Effective values</div><div id="ins-eff">${effSummary(start, pid)}</div></div>` },
      { type: 'section', label: 'Manual release' },
      { name: 'insuranceHold', label: 'Insurance hold', type: 'checkbox', span: 12, disabled: !editable, desc: 'Claims for this payer stop in a release bucket after scrubbing and go out only when a user releases them.' },
      { name: 'releaseBucketId', label: 'Release bucket', type: 'select', span: 6, disabled: !editable, hidden: !start.insuranceHold, requiredIf: (v) => !!v.insuranceHold, options: buckets.map((b) => ({ value: b.id, label: b.name + (b.isActive ? '' : ' (inactive)') })), help: buckets.length ? 'Shown only when the insurance hold is checked; required then.' : 'No active bucket — create one in Admin → Release buckets.' },
      { type: 'section', label: 'Payer audit' },
      { name: 'auditRequired', label: 'Audit required', type: 'checkbox', span: 12, disabled: !editable, desc: 'Claims for this payer stop in the Audit hold after scrubbing. A reviewer records which documents were attached, and the claim goes out only then.' },
      { type: 'section', label: 'Submission & SLA' },
      { name: 'format', label: 'Claim format', type: 'select', span: 4, placeholder: false, options: [{ value: '837P', label: 'EDI 837P' }, { value: 'CMS1500', label: 'Paper CMS-1500 (print queue)' }], disabled: !editable },
      { name: 'maxUnits', label: 'Max units per line', type: 'number', span: 4, min: 1, max: 20, required: true, disabled: !editable },
      { name: 'slaDays', label: 'Payment SLA (days)', type: 'number', span: 4, min: 1, max: 365, required: true, disabled: !editable },
      ...(ins ? [{ type: 'note', html: `Portal access for this payer is kept in <strong>Admin → Payer portals</strong>. ${UI.btn({ label: 'Open payer portals', size: 'sm', icon: 'arrowRight', act: 'go', data: { hash: '#/admin/portals' } })}` }] : []),
    ], start, {
      onChange: (vals, formEl) => {
        const f = formEl.querySelector('[data-field="releaseBucketId"]')
        if (f) f.hidden = !vals.insuranceHold
        const eff = formEl.querySelector('#ins-eff')
        if (eff) eff.innerHTML = effSummary(vals, pid)
      },
    }),
    foot: UI.btn({ label: editable ? 'Cancel' : 'Close', variant: 'quiet', act: 'layer.close' }) + (editable ? UI.btn({ label: 'Save insurance', variant: 'primary', act: 'ins.save' }) : ''),
  })
  if (ins) h.el.dataset.id = ins.id
}
ACT['ins.save'] = (el) => {
  const layer = el.closest('.layer')
  const vals = UI.submitForm(UI.formOf(layer))
  if (!vals) return
  const bucket = vals.insuranceHold ? S.find('releaseBuckets', vals.releaseBucketId) : null
  const data = {
    code: Number(vals.code), name: vals.name, classId: vals.classId, type: vals.type, payerId: vals.payerId, address: { line1: vals.line1, city: vals.city, state: vals.state, zip: vals.zip }, phone: vals.phone, fax: vals.fax,
    ...Object.fromEntries(E.RULES.map((r) => [r.key, UNTRI(vals[r.key])])),
    insuranceHold: vals.insuranceHold, releaseBucketId: bucket && bucket.practiceId === S.session.practiceId ? bucket.id : null, auditRequired: vals.auditRequired,
    format: vals.format, maxUnits: Number(vals.maxUnits), slaDays: Number(vals.slaDays), draft: false,
  }
  let ins
  if (layer.dataset.id) {
    ins = S.find('insurances', layer.dataset.id)
    Object.assign(ins, data)
  } else {
    ins = { id: U.id('i'), practiceId: S.session.practiceId, isActive: true, portalUrl: '', portalUser: '', portalPassword: '', ...data }
    DB.insurances.push(ins)
  }
  S.log(layer.dataset.id ? 'Insurance updated' : 'Insurance created', { module: 'ADMIN', entityType: 'insurance', entityId: ins.id, detail: `${ins.name}${ins.insuranceHold ? ` · insurance hold → ${bucket.name}` : ''}` })
  UI.closeTop()
  const sum = E.cascadeSummary(E.cascade())
  UI.toast('success', 'Insurance saved', sum ? `What happened next: ${sum}.` : 'Rules apply to the next scrub.', 7000)
  R.refresh()
}

// ---------------------------------------------------------------- payer portals
Adm.portals = () => {
  const payers = DB.insurances.filter((i) => i.practiceId === S.session.practiceId && !i.draft)
  const dash = '<span class="muted">—</span>'
  return UI.table({
    cols: [
      { key: 'payer', label: 'Payer', sort: (i) => i.name, render: (i) => `<span class="ink fw-500">${U.esc(S.insLabel(i))}</span>` },
      { key: 'url', label: 'Portal', render: (i) => (i.portalUrl ? `<a href="${U.esc(i.portalUrl)}" target="_blank" rel="noopener">${U.esc(i.portalUrl)}</a>` : dash) },
      { key: 'user', label: 'User', render: (i) => U.esc(i.portalUser) || dash },
      { key: 'pw', label: 'Password', render: (i) => (i.portalPassword ? (S.canDecrypt() ? `<span class="code">${U.esc(i.portalPassword)}</span>` : '•••••••• <span class="t-micro muted">masked</span>') : dash) },
      { key: 'act', label: '', cls: 'r', render: (i) => `<div class="row-actions">${canA('u') ? UI.iconBtn({ icon: 'pencil', label: 'Edit portal access', act: 'portal.edit', data: { id: i.id } }) : ''}</div>` },
    ],
    rows: payers, view: S.view('adm-portal', { sort: 'payer', dir: 'asc', page: 1 }), viewKey: 'adm-portal', rowAct: canA('u') ? 'portal.edit' : null, noun: 'payer',
    empty: UI.empty({ icon: 'landmark', title: 'No insurances yet', text: 'Portal access is recorded per payer. Add the practice’s insurances first.', action: canA('c') ? UI.btn({ label: 'Add an insurance', icon: 'arrowRight', act: 'go', data: { hash: '#/admin/insurances' } }) : '' }),
  })
}
ACT['portal.edit'] = (el) => {
  const ins = S.find('insurances', el.dataset.id)
  const editable = canA('u')
  const h = UI.modal({
    title: `${S.insLabel(ins)} — payer portal`,
    desc: 'Where this payer’s claims and remittances are checked online.',
    size: 'md',
    body: UI.form([
      { name: 'portalUrl', label: 'Portal URL', span: 12, disabled: !editable, placeholder: 'https://' },
      { name: 'portalUser', label: 'Portal user', span: 6, disabled: !editable },
      { name: 'portalPassword', label: 'Portal password', span: 6, disabled: !editable, placeholder: ins.portalPassword && !S.canDecrypt() ? '•••••••• — masked for your role' : '', help: S.canDecrypt() ? 'Visible because you are a System Admin.' : 'Decrypted only for System Admin. Type to replace.' },
    ], { portalUrl: ins.portalUrl, portalUser: ins.portalUser, portalPassword: S.canDecrypt() ? ins.portalPassword : '' }),
    foot: UI.btn({ label: editable ? 'Cancel' : 'Close', variant: 'quiet', act: 'layer.close' }) + (editable ? UI.btn({ label: 'Save portal access', variant: 'primary', act: 'portal.save' }) : ''),
  })
  h.el.dataset.id = ins.id
}
ACT['portal.save'] = (el) => {
  const layer = el.closest('.layer')
  const vals = UI.submitForm(UI.formOf(layer))
  if (!vals) return
  const ins = S.find('insurances', layer.dataset.id)
  ins.portalUrl = vals.portalUrl
  ins.portalUser = vals.portalUser
  if (vals.portalPassword || S.canDecrypt()) ins.portalPassword = vals.portalPassword
  S.log('Payer portal access saved', { module: 'ADMIN', entityType: 'insurance', entityId: ins.id, detail: ins.name })
  UI.closeTop()
  UI.toast('success', 'Portal access saved')
  R.refresh()
}

// ---------------------------------------------------------------- procedure codes
Adm.codes = () => {
  const canEdit = canA('u') && S.isGlobal()
  return `${!S.isGlobal() ? `<div class="mb-16">${UI.notice('info', 'Shared across practices.', 'Procedure codes are shared by every practice and maintained by a System Admin.')}</div>` : ''}${UI.table({
    cols: [
      { key: 'code', label: 'Code', sort: true, render: (c) => `<span class="code">${c.code}</span>${c.isNew ? ' ' + UI.chip('warning', 'New from EMR') : ''}` },
      { key: 'description', label: 'Description', sort: true, render: (c) => U.esc(c.description) },
      { key: 'procedureType', label: 'Type', sort: true, render: (c) => U.esc(c.procedureType || '—') },
      { key: 'isTimed', label: 'Timed (8-minute rule)', render: (c) => (c.isTimed ? UI.tag('Timed') : '<span class="muted">Untimed</span>') },
      { key: 'defaultModifier', label: 'Default modifiers', render: (c) => U.esc([c.defaultModifier, c.defaultModifier2].filter(Boolean).join(' · ')) || '—' },
      { key: 'defaultFee', label: 'Default fee', sort: true, cls: 'r', render: (c) => (c.defaultFee ? U.money(c.defaultFee) : `<span class="status critical">$0.00</span>`) },
      { key: 'isActive', label: 'Status', render: (c) => UI.status(c.isActive ? 'success' : 'inert', c.isActive ? 'Active' : 'Inactive — not offered on new charge lines') },
      { key: 'act', label: '', cls: 'r', render: (c) => (canEdit ? UI.iconBtn({ icon: 'pencil', label: 'Edit code', act: 'code.edit', data: { id: c.id } }) : '') },
    ],
    empty: UI.empty({ icon: 'file', title: 'No procedure codes yet', text: 'Each charge line is one CPT / HCPCS code with a default fee. The list is shared by every practice.', action: canEdit ? UI.btn({ label: 'Add a procedure code', icon: 'plus', variant: 'primary', act: 'code.edit' }) : '' }),
    rows: DB.procedureCodes, view: S.view('adm-codes', { sort: 'code', dir: 'asc', page: 1 }), viewKey: 'adm-codes', noun: 'code', pageSize: 20, mark: (c) => (c.isActive ? null : 'inert'),
  })}`
}
ACT['code.edit'] = (el) => {
  const c = el.dataset.id ? S.find('procedureCodes', el.dataset.id) : null
  const h = UI.modal({
    title: c ? `${c.code} — ${c.description}` : 'New procedure code',
    size: 'md',
    body: UI.form([
      { name: 'code', label: 'CPT / HCPCS', required: true, span: 4, maxLength: 5, disabled: !!c, validate: (v) => (!/^[A-Z0-9]{5}$/i.test(v) ? 'Please enter a valid code.' : !c && DB.procedureCodes.some((x) => x.code === v.toUpperCase()) ? 'This code exists.' : '') },
      { name: 'description', label: 'Description', required: true, span: 8 },
      { name: 'defaultModifier', label: 'Default modifier 1', span: 3, maxLength: 2 },
      { name: 'defaultModifier2', label: 'Default modifier 2', span: 3, maxLength: 2, validate: (v, all) => (v && !all.defaultModifier ? 'Use modifier 1 first.' : v && v.toUpperCase() === (all.defaultModifier || '').toUpperCase() ? 'The two modifiers must differ.' : '') },
      { name: 'defaultFee', label: 'Default fee per unit', type: 'money', required: true, span: 3 },
      { name: 'procedureType', label: 'Procedure type', type: 'select', required: true, span: 3, options: ['Evaluation', 'Therapeutic', 'Modality', 'Supply / DME'] },
      { name: 'isTimed', label: 'Timed — units follow the 8-minute rule', type: 'checkbox', span: 12 },
      { name: 'isActive', label: 'Active', type: 'checkbox', span: 12, desc: 'Inactive codes cannot be added to new charge lines.' },
    ], c ? { ...c, defaultFee: c.defaultFee.toFixed(2) } : { defaultModifier: 'GP', procedureType: 'Therapeutic', isActive: true }),
    foot: UI.btn({ label: 'Cancel', variant: 'quiet', act: 'layer.close' }) + UI.btn({ label: 'Save code', variant: 'primary', act: 'code.save' }),
  })
  if (c) h.el.dataset.id = c.id
}
ACT['code.save'] = (el) => {
  const layer = el.closest('.layer')
  const vals = UI.submitForm(UI.formOf(layer))
  if (!vals) return
  if (layer.dataset.id) {
    const c = S.find('procedureCodes', layer.dataset.id)
    Object.assign(c, { description: vals.description, defaultModifier: vals.defaultModifier.toUpperCase(), defaultModifier2: (vals.defaultModifier2 || '').toUpperCase(), defaultFee: Number(vals.defaultFee), isTimed: vals.isTimed, procedureType: vals.procedureType, isActive: vals.isActive, isNew: false })
  } else DB.procedureCodes.push({ id: `pc${vals.code.toUpperCase()}`, code: vals.code.toUpperCase(), description: vals.description, defaultModifier: vals.defaultModifier.toUpperCase(), defaultFee: Number(vals.defaultFee), isTimed: vals.isTimed, procedureType: vals.procedureType, isActive: vals.isActive })
  DB.visits.filter((v) => ['Exception', 'Review', 'Pended', 'Delayed', 'Released'].includes(v.status)).forEach((v) => E.repriceVisit(v))
  S.log('Procedure code saved', { module: 'ADMIN', detail: vals.code || S.find('procedureCodes', layer.dataset.id).code })
  UI.closeTop()
  const sum = E.cascadeSummary(E.cascade())
  UI.toast('success', 'Code saved', sum ? `What happened next: ${sum}.` : '')
  R.refresh()
}

// ---------------------------------------------------------------- fee schedules
Adm.fees = () => {
  const payers = DB.insurances.filter((i) => i.practiceId === S.session.practiceId && !i.draft)
  if (!payers.length || !DB.procedureCodes.length) {
    return `<div class="card">${UI.empty({ icon: 'dollar', title: 'Nothing to price yet', text: 'A fee-schedule row is the billed price of one procedure code for one insurance. Without a row, a charge uses the code’s default fee.' })}</div>
      <div class="mt-16">${Dep.panel({
        title: 'A fee schedule needs',
        needs: [
          { ok: !!payers.length, label: 'At least one insurance', why: 'Every insurance needs an insurance class first.', action: { label: 'Add an insurance', hash: '#/admin/insurances' } },
          { ok: !!DB.procedureCodes.length, label: 'At least one procedure code', why: 'Shared CPT/HCPCS reference data.', action: { label: 'Add a procedure code', hash: '#/admin/codes' } },
        ],
      })}</div>`
  }
  const st = S.view('adm-fees', { ins: payers[0].id, lk: { ins: payers[0].id, code: 'pc97110', units: 2 } })
  const ins = S.find('insurances', st.ins) || payers[0]
  const rows = DB.feeSchedules.filter((r) => r.insuranceId === ins.id).map((r) => ({ ...r, pc: E.pc(r.procedureCodeId) }))
  const lk = st.lk
  const res = E.price(lk.code, Number(lk.units) || 1, lk.ins, DB.today)
  return `<div class="grid-2 grid-2-1"><div>
      <div class="row-wrap mb-16"><div class="field" style="min-width:280px"><label class="field-label" for="fee-ins">Insurance</label><div class="control"><select id="fee-ins" data-change="fee.ins">${payers.map((p) => `<option value="${p.id}" ${p.id === ins.id ? 'selected' : ''}>${U.esc(S.insLabel(p))}</option>`).join('')}</select><span class="chev">${I('chevronDown', 'icon-14')}</span></div></div></div>
      ${UI.table({
        cols: [
          { key: 'code', label: 'Code', sort: (r) => r.pc.code, render: (r) => `<span class="code">${r.pc.code}</span><span class="sub">${U.esc(r.pc.description)}</span>` },
          { key: 'billed', label: 'Billed / unit', sort: true, cls: 'r', render: (r) => `<span class="num ink">${U.money(r.billed)}</span>` },
          { key: 'default', label: 'Default fee', cls: 'r', render: (r) => `<span class="muted">${U.money(r.pc.defaultFee)}</span>` },
          { key: 'eff', label: 'Effective', render: (r) => `${U.date(r.from)} – ${U.date(r.to)}` },
          { key: 'act', label: '', cls: 'r', render: (r) => `<div class="row-actions">${canA('u') ? UI.iconBtn({ icon: 'pencil', label: 'Edit row', act: 'fee.edit', data: { id: r.id } }) : ''}${canA('d') ? UI.iconBtn({ icon: 'trash', label: 'Delete row', act: 'fee.delete', data: { id: r.id }, danger: true }) : ''}</div>` },
        ],
        rows, view: S.view('adm-fee-t', { sort: 'code', dir: 'asc', page: 1 }), viewKey: 'adm-fee-t', noun: 'fee row', pageSize: 15,
        empty: UI.empty({ icon: 'dollar', title: `No fee schedule for ${ins.name}`, text: 'Every code falls back to its default fee.' }),
      })}</div>
    <div class="card"><div class="card-head"><span class="card-title">Price lookup</span></div><div class="card-body">
      <div class="t-micro muted-2 mb-16">How a charge line is priced: the payer’s billed price when a row is effective, otherwise the code’s default fee. What a payer allows is known from its remittance.</div>
      <div class="form-grid"><div class="field"><span class="field-label">Insurance</span><div class="control"><select data-change="fee.lk" data-f="ins" aria-label="Insurance">${payers.map((p) => `<option value="${p.id}" ${p.id === lk.ins ? 'selected' : ''}>${U.esc(p.name)}</option>`).join('')}</select><span class="chev">${I('chevronDown', 'icon-14')}</span></div></div>
      <div class="field span-8"><span class="field-label">Code</span><div class="control"><select data-change="fee.lk" data-f="code" aria-label="Code">${DB.procedureCodes.map((c) => `<option value="${c.id}" ${c.id === lk.code ? 'selected' : ''}>${c.code} — ${U.esc(c.description)}</option>`).join('')}</select><span class="chev">${I('chevronDown', 'icon-14')}</span></div></div>
      <div class="field span-4"><span class="field-label">Units</span><div class="control"><input type="number" min="1" max="12" value="${lk.units}" data-change="fee.lk" data-f="units" aria-label="Units"></div></div></div>
      <div class="balance mt-16"><div><div class="eyebrow">Charge</div><div class="bv">${U.money(res.amount)}</div></div><div><div class="eyebrow">Source</div><div class="t-meta ink mt-8">${res.source === 'payer' ? `${U.esc(S.find('insurances', lk.ins).name)} schedule · ${U.money(res.rate)} × ${lk.units}` : `Default fee · ${U.money(res.rate)} × ${lk.units}`}</div></div></div>
    </div></div></div>`
}
ACT['fee.ins'] = (el) => {
  S.view('adm-fees', {}).ins = el.value
  S.view('adm-fee-t', {}).page = 1
  R.refresh()
}
ACT['fee.lk'] = (el) => {
  S.view('adm-fees', {}).lk[el.dataset.f] = el.value
  R.refresh()
}
ACT['fee.edit'] = (el) => {
  const st = S.view('adm-fees', {})
  const r = el.dataset.id ? S.find('feeSchedules', el.dataset.id) : null
  const insId = r ? r.insuranceId : st.ins
  const taken = DB.feeSchedules.filter((x) => x.insuranceId === insId && (!r || x.id !== r.id)).map((x) => x.procedureCodeId)
  const h = UI.modal({
    title: r ? 'Edit fee row' : 'Add fee row',
    desc: S.find('insurances', insId).name,
    size: 'md',
    body: UI.form([
      { name: 'procedureCodeId', label: 'Code', type: 'select', required: true, disabled: !!r, options: DB.procedureCodes.filter((c) => !taken.includes(c.id) || (r && c.id === r.procedureCodeId)).map((c) => ({ value: c.id, label: `${c.code} — ${c.description}` })) },
      { name: 'billed', label: 'Billed per unit', type: 'money', required: true, span: 6, help: 'Put on the claim.' },
      { name: 'from', label: 'Effective from', type: 'date', required: true, span: 6 },
      { name: 'to', label: 'Effective to', type: 'date', required: true, span: 6, validate: (v, all) => (v < all.from ? 'Please enter a valid date.' : '') },
    ], r ? { ...r, billed: r.billed.toFixed(2) } : { from: '2026-01-01', to: '2026-12-31' }),
    foot: UI.btn({ label: 'Cancel', variant: 'quiet', act: 'layer.close' }) + UI.btn({ label: 'Save fee row', variant: 'primary', act: 'fee.save' }),
  })
  h.el.dataset.ins = insId
  if (r) h.el.dataset.id = r.id
}
ACT['fee.save'] = (el) => {
  const layer = el.closest('.layer')
  const vals = UI.submitForm(UI.formOf(layer))
  if (!vals) return
  const data = { billed: Number(vals.billed), from: vals.from, to: vals.to }
  if (layer.dataset.id) Object.assign(S.find('feeSchedules', layer.dataset.id), data)
  else DB.feeSchedules.push({ id: U.id('fs'), insuranceId: layer.dataset.ins, procedureCodeId: vals.procedureCodeId, ...data })
  DB.visits.filter((v) => ['Exception', 'Review', 'Pended', 'Delayed', 'Released'].includes(v.status)).forEach((v) => E.repriceVisit(v))
  S.log('Fee schedule row saved', { module: 'ADMIN', detail: `${S.find('insurances', layer.dataset.ins).name} · ${U.money(data.billed)}` })
  UI.closeTop()
  const sum = E.cascadeSummary(E.cascade())
  UI.toast('success', 'Fee row saved', `Unbilled visits were repriced.${sum ? ' ' + sum + '.' : ''}`)
  R.refresh()
}
ACT['fee.delete'] = async (el) => {
  const r = S.find('feeSchedules', el.dataset.id)
  const ok = await UI.confirm({ title: `Delete the ${E.pc(r.procedureCodeId).code} row?`, message: 'The code falls back to its default fee for this payer.', confirmLabel: 'Delete row', tone: 'critical' })
  if (!ok) return
  DB.feeSchedules = DB.feeSchedules.filter((x) => x.id !== r.id)
  R.refresh()
}

// ---------------------------------------------------------------- referring physicians
Adm.referrers = () => UI.table({
  cols: [
    { key: 'name', label: 'Physician', sort: true, render: (r) => `<span class="ink fw-500">${U.esc(r.name)}</span><span class="sub">${U.esc(r.practiceName || '')}</span>` },
    { key: 'type', label: 'Type (Box 17)', render: (r) => UI.tag(r.type === 'DQ' ? 'DQ · Supervising' : 'DN · Referring', r.type === 'DQ' ? 'sand' : 'brand') },
    { key: 'npi', label: 'NPI', render: (r) => (E.npiValid(r.npi) ? r.npi : `<span class="status critical">${U.esc(r.npi || 'Missing')} — invalid</span>`) },
    { key: 'contact', label: 'Phone · fax', render: (r) => `${U.esc(r.phone || '—')}<span class="sub">${U.esc(r.fax || '')}</span>` },
    { key: 'cases', label: 'Cases', cls: 'r', render: (r) => DB.cases.filter((c) => c.referrerId === r.id).length },
  ],
  empty: UI.empty({ icon: 'user', title: 'No referring physicians yet', text: 'A patient’s case needs a referring physician before it can be billed; their name, NPI and qualifier print in Box 17 of the claim.', action: canA('c') ? UI.btn({ label: 'Add a physician', icon: 'plus', variant: 'primary', act: 'ref.edit' }) : '' }),
  rows: DB.referrers.filter((r) => r.practiceId === S.session.practiceId), view: S.view('adm-ref', { sort: 'name', dir: 'asc', page: 1 }), viewKey: 'adm-ref', rowAct: canA('u') ? 'ref.edit' : null, noun: 'physician', mark: (r) => (E.npiValid(r.npi) ? null : 'critical'),
})
ACT['ref.edit'] = (el) => {
  const r = el.dataset.id ? S.find('referrers', el.dataset.id) : null
  const h = UI.modal({
    title: r ? r.name : 'New referring physician',
    desc: 'Linked directory profile. Name, type and NPI are required for billing.',
    size: 'md',
    body: UI.form([
      { name: 'name', label: 'Name', required: true, span: 12, placeholder: 'First Last, MD' },
      { name: 'type', label: 'Type', type: 'select', required: true, span: 6, placeholder: false, options: [{ value: 'DN', label: 'Referring (DN)' }, { value: 'DQ', label: 'Supervising (DQ)' }], help: 'Sets the Box 17 qualifier.' },
      { name: 'npi', label: 'NPI', type: 'npi', required: true, span: 6, validate: (v) => (E.DUMMY_NPIS.includes(v) ? 'Please enter a valid NPI.' : '') },
      { name: 'practiceName', label: 'Practice name', span: 12 },
      { name: 'phone', label: 'Phone', type: 'tel', span: 6 },
      { name: 'fax', label: 'Fax', type: 'tel', span: 6 },
    ], r || { type: 'DN' }),
    foot: UI.btn({ label: 'Cancel', variant: 'quiet', act: 'layer.close' }) + UI.btn({ label: 'Save physician', variant: 'primary', act: 'ref.save' }),
  })
  if (r) h.el.dataset.id = r.id
}
ACT['ref.save'] = (el) => {
  const layer = el.closest('.layer')
  const vals = UI.submitForm(UI.formOf(layer))
  if (!vals) return
  if (layer.dataset.id) Object.assign(S.find('referrers', layer.dataset.id), vals)
  else DB.referrers.push({ id: U.id('R'), practiceId: S.session.practiceId, ...vals })
  S.log('Referring physician saved', { module: 'ADMIN', detail: vals.name })
  UI.closeTop()
  const sum = E.cascadeSummary(E.cascade())
  UI.toast('success', 'Physician saved', sum ? `What happened next: ${sum}.` : '')
  R.refresh()
}

// ---------------------------------------------------------------- coding rules (§6.1)
Adm.rules = () => {
  const payers = DB.insurances.filter((i) => i.practiceId === S.session.practiceId && !i.draft)
  const rules = DB.codingRules.filter((r) => r.scope === 'default' || payers.some((p) => p.id === r.scope))
  const t = S.view('rule-test', { ins: 'i1', codes: '97110, 97014, 97010' })
  const results = t.codes.split(/[,\s]+/).filter(Boolean).map((code) => {
    const r = E.ruleFor(code.toUpperCase(), t.ins)
    return { code: code.toUpperCase(), r }
  })
  return `<div class="grid-2 grid-2-1"><div>${UI.table({
    empty: UI.empty({ icon: 'refresh', title: 'No coding rules yet', text: 'Coding rules are optional. A Replace rule swaps one CPT / HCPCS code for another and a Drop rule removes a code during scrubbing; a payer-specific rule overrides a default rule.' + (DB.procedureCodes.length ? '' : ' Rules act on procedure codes, so add those first.') }),
    cols: [
      { key: 'type', label: 'Rule', render: (r) => UI.tag(r.type, r.type === 'Replace' ? 'brand' : 'sand') },
      { key: 'fromCode', label: 'Code', render: (r) => `<span class="code">${r.fromCode}</span>${r.type === 'Replace' ? ` → <span class="code">${r.toCode}</span>` : ' → dropped'}` },
      { key: 'scope', label: 'Applies to', render: (r) => (r.scope === 'default' ? 'Default (all payers)' : r.scope.startsWith('class:') ? `${U.esc((S.find('insuranceClasses', r.scope.slice(6)) || {}).name || 'Class')} class` : `${U.esc((S.find('insurances', r.scope) || {}).name || 'Payer')} only`) },
      { key: 'note', label: 'Why', render: (r) => `<span style="white-space:normal">${U.esc(r.note || '')}</span>` },
      { key: 'active', label: 'Active', render: (r) => (canA('u') ? `<input type="checkbox" aria-label="Active" data-act="rule.toggle" data-id="${r.id}" ${r.active ? 'checked' : ''}>` : r.active ? 'Yes' : 'No') },
      { key: 'act', label: '', cls: 'r', render: (r) => `<div class="row-actions">${canA('u') ? UI.iconBtn({ icon: 'pencil', label: 'Edit rule', act: 'rule.edit', data: { id: r.id } }) : ''}${canA('d') ? UI.iconBtn({ icon: 'trash', label: 'Delete rule', act: 'rule.delete', data: { id: r.id }, danger: true }) : ''}</div>` },
    ],
    rows: rules, view: S.view('adm-rules', { page: 1 }), viewKey: 'adm-rules', noun: 'rule', noPaging: true,
  })}<div class="t-micro muted-2 mt-12">Rules run on fresh submissions, resubmissions and corrected claims, and change the billing record itself.</div></div>
    <div class="card"><div class="card-head"><span class="card-title">Test the rules</span></div><div class="card-body">
      <div class="form-grid"><div class="field"><span class="field-label">Payer</span><div class="control"><select data-change="rule.test" data-f="ins" aria-label="Payer">${payers.map((p) => `<option value="${p.id}" ${p.id === t.ins ? 'selected' : ''}>${U.esc(p.name)}</option>`).join('')}</select><span class="chev">${I('chevronDown', 'icon-14')}</span></div></div>
      <div class="field"><span class="field-label">Codes on the claim</span><div class="control"><input value="${U.esc(t.codes)}" data-change="rule.test" data-f="codes" aria-label="Codes"></div></div></div>
      <ul class="checks mt-12">${results.map((x) => `<li><span class="ck ${x.r ? 'fail' : 'pass'}" style="${x.r ? 'background:var(--sand-wash);color:var(--sand-deep)' : ''}">${I(x.r ? 'refresh' : 'check')}</span><div class="grow"><div class="c-name">${x.code}</div><div class="c-detail">${x.r ? `${x.r.type === 'Replace' ? `Replaced by ${x.r.toCode}` : 'Dropped'} — ${x.r.scope === 'default' ? 'default rule' : 'payer-specific rule (overrides default)'}` : 'Unchanged'}</div></div></li>`).join('')}</ul>
    </div></div></div>`
}
ACT['rule.test'] = (el) => {
  S.view('rule-test', {})[el.dataset.f] = el.value
  R.refresh()
}
ACT['rule.toggle'] = (el) => {
  const r = S.find('codingRules', el.dataset.id)
  r.active = el.checked
  S.log(`Coding rule ${r.active ? 'activated' : 'paused'}`, { module: 'ADMIN', detail: `${r.type} ${r.fromCode}` })
  R.refresh()
}
ACT['rule.edit'] = (el) => {
  const r = el.dataset.id ? S.find('codingRules', el.dataset.id) : null
  if (!r && !DB.procedureCodes.length) {
    Dep.modal({
      title: 'Cannot add a coding rule yet',
      text: 'Replace and Drop rules act on CPT / HCPCS codes during scrubbing. There are no procedure codes yet.',
      needs: [{ ok: false, label: 'Procedure codes', why: 'Shared by every practice, maintained by a System Admin.', action: { label: 'Add a procedure code', hash: '#/admin/codes' } }],
    })
    return
  }
  const payers = DB.insurances.filter((i) => i.practiceId === S.session.practiceId && !i.draft)
  const h = UI.modal({
    title: r ? 'Edit coding rule' : 'New coding rule',
    size: 'md',
    body: UI.form([
      { name: 'type', label: 'Rule type', type: 'radio', required: true, options: [{ value: 'Replace', label: 'Replace', desc: 'Convert a code to an alternative code.' }, { value: 'Drop', label: 'Drop', desc: 'Remove the code from the claim.' }] },
      { name: 'fromCode', label: 'Code', type: 'select', required: true, span: 6, options: DB.procedureCodes.map((c) => ({ value: c.code, label: `${c.code} — ${c.description}` })) },
      { name: 'toCode', label: 'Replace with', type: 'select', span: 6, requiredIf: (v) => v.type === 'Replace', options: DB.procedureCodes.map((c) => ({ value: c.code, label: `${c.code} — ${c.description}` })), validate: (v, all) => (v && v === all.fromCode ? 'Please choose a different code.' : '') },
      { name: 'scope', label: 'Applies to', type: 'select', required: true, placeholder: false, help: 'A payer rule wins over its class rule, and a class rule wins over the default.', options: [{ value: 'default', label: 'Default — all payers' }, ...DB.insuranceClasses.filter((c) => c.practiceId === S.session.practiceId && c.isActive).map((c) => ({ value: `class:${c.id}`, label: `Class — ${c.name}` })), ...payers.map((p) => ({ value: p.id, label: `${p.name} only (overrides default)` }))] },
      { name: 'note', label: 'Why', placeholder: 'Optional reason' },
    ], r || { type: 'Replace', scope: 'default' }),
    foot: UI.btn({ label: 'Cancel', variant: 'quiet', act: 'layer.close' }) + UI.btn({ label: 'Save rule', variant: 'primary', act: 'rule.save' }),
  })
  if (r) h.el.dataset.id = r.id
}
ACT['rule.save'] = (el) => {
  const layer = el.closest('.layer')
  const vals = UI.submitForm(UI.formOf(layer))
  if (!vals) return
  const data = { type: vals.type, fromCode: vals.fromCode, toCode: vals.type === 'Replace' ? vals.toCode : '', scope: vals.scope, note: vals.note }
  if (layer.dataset.id) Object.assign(S.find('codingRules', layer.dataset.id), data)
  else DB.codingRules.push({ id: U.id('cr'), active: true, ...data })
  S.log('Coding rule saved', { module: 'ADMIN', detail: `${data.type} ${data.fromCode}${data.toCode ? ' → ' + data.toCode : ''}` })
  UI.closeTop()
  UI.toast('success', 'Rule saved', 'It runs on the next scrub.')
  R.refresh()
}
ACT['rule.delete'] = async (el) => {
  const r = S.find('codingRules', el.dataset.id)
  const ok = await UI.confirm({ title: 'Delete this rule?', message: `${r.type} ${r.fromCode} will no longer run during scrubbing.`, confirmLabel: 'Delete rule', tone: 'critical' })
  if (!ok) return
  DB.codingRules = DB.codingRules.filter((x) => x.id !== r.id)
  R.refresh()
}

// ---------------------------------------------------------------- automation
Adm.automation = () => {
  const s = DB.settings
  const editable = canA('u')
  return `<div style="max-width:720px">${UI.form([
    { type: 'section', label: 'Scheduled submission' },
    { name: 'schedule', label: 'Submit released charges automatically', type: 'select', placeholder: false, disabled: !editable, options: [{ value: 'off', label: 'Off — submit manually' }, ...s.scheduleOptions.map((o) => ({ value: o.id, label: o.label }))], help: `Last run ${s.lastScheduledRun ? U.stampLabel(s.lastScheduledRun, DB.today) : 'never'}.` },
    { type: 'note', html: `The list is yours to fill: add the times this practice submits on, or remove the ones it never uses. ${editable ? UI.btn({ label: 'Manage the list', size: 'sm', icon: 'clock', act: 'sched.manage' }) : ''}` },
    { type: 'section', label: 'AI coding quality' },
    { name: 'aiCoding', label: 'AI add-on: check diagnosis-to-CPT consistency during scrubbing', type: 'checkbox', disabled: !editable, desc: 'Failures go to the Coding Issue hold.' },
    { type: 'section', label: 'Payer SLA engine' },
    { name: 'slaSource', label: 'Where SLAs come from', type: 'radio', disabled: !editable, options: [{ value: 'manual', label: 'Configured manually per insurance', desc: 'Set in Setup → Insurances.' }, { value: 'ai', label: 'Predicted by AI agents', desc: 'Not available.', disabled: true }] },
  ], s)}${editable ? `<div class="row-wrap mt-24">${UI.btn({ label: 'Save settings', variant: 'primary', act: 'auto.save' })}</div>` : ''}</div>`
}
ACT['auto.save'] = (el) => {
  const vals = UI.readValues(UI.formOf(el.closest('.subnav-content')))
  Object.assign(DB.settings, { schedule: vals.schedule, aiCoding: vals.aiCoding, slaSource: vals.slaSource || 'manual' })
  S.log('Automation settings saved', { module: 'ADMIN', detail: `Schedule ${vals.schedule} · AI coding ${vals.aiCoding ? 'on' : 'off'}` })
  UI.toast('success', 'Settings saved', `${vals.aiCoding ? 'The AI coding check runs' : 'The AI coding check is skipped'} on the next scrub.`)
  R.refresh()
}

// ---------------------------------------------------------------- scheduled-submission options (client 2026-09-23)
const SCHED_KINDS = [
  { value: 'hours', label: 'Every few hours' },
  { value: 'daily', label: 'Every day at a time' },
  { value: 'weekdays', label: 'Weekdays at a time' },
]
const schedLabel = (v) =>
  v.kind === 'hours' ? `Every ${Number(v.hours) === 1 ? 'hour' : `${Number(v.hours)} hours`}` : `${v.kind === 'daily' ? 'Every day' : 'Weekdays'} at ${v.time}`
const schedBody = () => {
  const rows = DB.settings.scheduleOptions
  return `${rows.length
    ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Option</th><th>Used now</th><th></th></tr></thead><tbody>${rows
        .map((o) => `<tr><td class="ink">${U.esc(o.label)}</td><td>${DB.settings.schedule === o.id ? UI.chip('success', 'In use') : '<span class="muted">—</span>'}</td><td class="r">${DB.settings.schedule === o.id ? '' : UI.iconBtn({ icon: 'trash', label: `Remove ${o.label}`, act: 'sched.del', data: { id: o.id }, danger: true })}</td></tr>`)
        .join('')}</tbody></table></div>`
    : UI.empty({ icon: 'clock', title: 'No options yet', text: 'Without one, released charges are only submitted by hand.' })}
  <div class="form-section-title" style="margin-top:20px">Add an option</div>
  ${UI.form(
    [
      { name: 'kind', label: 'How often', type: 'select', placeholder: false, span: 5, options: SCHED_KINDS },
      { name: 'hours', label: 'Every (hours)', type: 'number', span: 3, min: 1, max: 12, hidden: true },
      { name: 'time', label: 'At', type: 'time', span: 4 },
    ],
    { kind: 'daily', hours: 4, time: '18:00' },
    {
      onChange: (vals, formEl) => {
        const show = (n, on) => { const f = formEl.querySelector(`[data-field="${n}"]`); if (f) f.hidden = !on }
        show('hours', vals.kind === 'hours')
        show('time', vals.kind !== 'hours')
      },
    },
  )}`
}
ACT['sched.manage'] = () => {
  UI.modal({
    title: 'Scheduled submission options',
    desc: 'What the dropdown on this screen offers. The option in use cannot be removed.',
    size: 'md',
    body: `<div data-sched-body>${schedBody()}</div>`,
    foot: UI.btn({ label: 'Close', variant: 'quiet', act: 'layer.close' }) + UI.btn({ label: 'Add option', variant: 'primary', act: 'sched.add' }),
  })
}
const schedRefresh = (el) => {
  const box = el.closest('.layer').querySelector('[data-sched-body]')
  if (box) box.innerHTML = schedBody()
  R.refresh()
}
ACT['sched.add'] = (el) => {
  const vals = UI.submitForm(UI.formOf(el.closest('.layer')))
  if (!vals) return
  if (vals.kind === 'hours' ? !vals.hours : !vals.time) return UI.toast('warning', 'Nothing to add', vals.kind === 'hours' ? 'Say how many hours apart.' : 'Choose a time of day.')
  const label = schedLabel(vals)
  if (DB.settings.scheduleOptions.some((o) => o.label === label)) return UI.toast('warning', 'Already on the list', `“${label}” is already an option.`)
  DB.settings.scheduleOptions.push({ id: U.id('sch'), label, kind: vals.kind, hours: vals.kind === 'hours' ? Number(vals.hours) : null, time: vals.kind === 'hours' ? null : vals.time })
  S.log('Submission schedule option added', { module: 'ADMIN', detail: label })
  UI.toast('success', 'Option added', `“${label}” is now in the dropdown.`)
  schedRefresh(el)
}
ACT['sched.del'] = async (el) => {
  const o = DB.settings.scheduleOptions.find((x) => x.id === el.dataset.id)
  if (!o || DB.settings.schedule === o.id) return
  const ok = await UI.confirm({ title: 'Remove this option?', message: `“${o.label}” will no longer be offered.`, confirmLabel: 'Remove', tone: 'critical' })
  if (!ok) return
  DB.settings.scheduleOptions = DB.settings.scheduleOptions.filter((x) => x.id !== o.id)
  S.log('Submission schedule option removed', { module: 'ADMIN', detail: o.label })
  schedRefresh(el)
}

// ---------------------------------------------------------------- audit log
Adm.audit = () => {
  const v = S.view('audit', { q: '', mods: [], page: 1 })
  const MODS = ['CHARGES', 'BILLING', 'PAYMENTS', 'DENIALS', 'AR', 'PATIENT', 'ADMIN', 'INTEGRATION', 'MONTHEND']
  let rows = DB.audit.filter((a) => S.isGlobal() || a.practiceId === S.session.practiceId)
  if (v.mods.length) rows = rows.filter((a) => v.mods.includes(a.module))
  const qq = v.q.toLowerCase()
  if (qq) rows = rows.filter((a) => `${a.action} ${a.detail} ${S.userName(a.userId)}`.toLowerCase().includes(qq))
  const link = (a) => ({ claim: `#/claims/view/${a.entityId}`, visit: `#/charges/visit/${a.entityId}`, denial: '#/denials/all', exception: '#/exceptions/resolved' }[a.entityType])
  return `<div class="control-line">${UI.qsearch('audit-q', v.q, 'Search action, detail or user…', 'audit.search')}</div><div class="mt-12">${UI.pills(MODS.map((m) => ({ key: m, label: (MODULES.find((x) => x.key === m) || {}).label || m })), v.mods, 'audit.mod')}</div>
    ${UI.table({
      cols: [
        { key: 'at', label: 'When', render: (a) => `${U.stampLabel(a.at, DB.today)}<span class="sub">${U.date(a.at.slice(0, 10))}</span>` },
        { key: 'user', label: 'User', render: (a) => U.esc(S.userName(a.userId)) },
        { key: 'action', label: 'Action', render: (a) => `<span class="ink fw-500">${U.esc(a.action)}</span>${a.detail ? `<span class="sub" style="white-space:normal">${U.esc(a.detail)}</span>` : ''}` },
        { key: 'module', label: 'Module', render: (a) => (a.module ? UI.tag((MODULES.find((x) => x.key === a.module) || {}).label || a.module) : '') },
        { key: 'rec', label: '', cls: 'r', render: (a) => (link(a) && (a.entityType !== 'claim' || S.find('claims', a.entityId)) && (a.entityType !== 'visit' || S.find('visits', a.entityId)) ? `<a href="${link(a)}">Open</a>` : '') },
      ],
      rows, view: v, viewKey: 'audit', noun: 'entry', pageSize: 20,
    })}`
}
ACT['audit.search'] = U.debounce((el) => {
  const v = S.view('audit', {})
  v.q = el.value
  v.page = 1
  R.refresh()
}, 220)
ACT['audit.mod'] = (el) => {
  const v = S.view('audit', {})
  v.mods = v.mods.includes(el.dataset.key) ? v.mods.filter((m) => m !== el.dataset.key) : [...v.mods, el.dataset.key]
  v.page = 1
  R.refresh()
}
