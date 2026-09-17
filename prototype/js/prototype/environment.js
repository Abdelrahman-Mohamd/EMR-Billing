/* PROTOTYPE LAYER — environments.
   One application, two starting states:
   · Demo Data    — buildSeed(): a realistic practice already in use.
   · Fresh System — buildFresh(): day one, only what PRD V2 says exists by default.
   Both use the same screens, engine and rules; only the initial DB differs.
   Loading an environment builds a brand-new DB object and resets every sequence
   counter, so the two can never share or leak records. */

/** Day 1 state. PRD V2 seeds exactly two roles (§10.2 p14). Everything else starts empty. */
function buildFresh() {
  const TODAY = '2026-09-15'
  const db = {
    today: TODAY,
    company: null, practices: [], locations: [], roles: [], users: [], providers: [], insuranceClasses: [], insurances: [],
    releaseBuckets: [], procedureCodes: [], feeSchedules: [], payerContracts: [], referrers: [], patients: [], cases: [], coverages: [],
    authorizations: [], visits: [], chargeLines: [], claims: [], payments: [], batches: [], eras: [],
    denials: [], exceptions: [], updates: [], runs: [], periods: [], codingRules: [], audit: [],
    emrLog: [], icd10: [], carc: [], rarc: [],
    settings: { schedule: 'daily-18', aiCoding: true, slaSource: 'manual', lastScheduledRun: null },
  }
  DB = db
  // Standard code sets used by pickers — not practice data (assumption A-P47, Q-085)
  Object.assign(db, referenceCodeLists())
  // "Two roles are seeded: System Admin … and Practice Admin" (§10.2 p14)
  db.roles.push(...v2SeededRoles())
  // V2 does not say how the first account is created; one System Admin (assumption A-P48, Q-086)
  db.users.push({ id: 'u1', username: 'admin', displayName: 'System Administrator', email: 'admin@riverbend-billing.example', isServiceAccount: false, defaultPracticeId: null, isActive: true, roleIds: ['r1'], grants: [], installAccount: true })
  db.audit.push({ id: U.id('au'), at: `${TODAY}T08:00`, userId: 'u1', action: 'Billing System installed', module: 'ADMIN', entityType: 'system', entityId: '', detail: 'System roles created: System Admin and Practice Admin.', practiceId: null })
  return db
}

const Env = (() => {
  let current = null
  const META = {
    demo: {
      key: 'demo', label: 'Demo Data', icon: 'layers',
      pitch: 'Explore the finished system with a realistic practice that has been billing for months.',
      points: ['Two practices, 29 patients and 95 claims', 'Holds, denials, remittances and A/R already waiting', 'Seven accounts across five roles'],
      cta: 'Start with demo data',
    },
    fresh: {
      key: 'fresh', label: 'Fresh System', icon: 'sparkles',
      pitch: 'Start from zero on day one of a new installation and build the business process step by step.',
      points: ['Only what PRD V2 creates by default', 'One System Administrator account', 'Every record is one you create'],
      cta: 'Start a fresh system',
    },
  }
  const load = (mode) => {
    if (!META[mode]) throw new Error('Unknown environment ' + mode)
    UI.closeAll()
    UI.closeMenu()
    U.resetCounters()
    E.resetSequences()
    Sim.reset()
    S.session.userId = null
    S.session.practiceId = null
    S.resetViews()
    DB = mode === 'demo' ? buildSeed() : buildFresh()
    current = mode
    R.setLoginChoice(mode === 'demo' ? 'u3' : 'u1')
  }
  return {
    META, load,
    unload: () => {
      current = null
    },
    current: () => current,
    meta: () => META[current] || null,
    isFresh: () => current === 'fresh',
    isDemo: () => current === 'demo',
  }
})()

/** Data queries used by the Fresh System walkthrough and simulators. Read-only. */
const Fresh = (() => {
  const pid = () => S.session.practiceId
  const inPr = (x) => x.practiceId === pid()
  const patientsIn = () => DB.patients.filter(inPr)
  const casesIn = () => DB.cases.filter((c) => { const p = S.find('patients', c.patientId); return p && inPr(p) })
  const visitsIn = () => DB.visits.filter((v) => { const p = S.patientOfVisit(v); return p && inPr(p) })
  const claimsIn = () => DB.claims.filter((c) => { const v = S.visitOf(c); const p = v && S.patientOfVisit(v); return p && inPr(p) })
  const insIn = () => DB.insurances.filter((i) => inPr(i) && !i.draft)
  const caseReady = (c) => !!(c.referrerId && c.dx.length && E.coverage(c.id, 1))
  const readyCase = () => casesIn().find(caseReady)
  const counts = () => [
    { label: 'Practices', n: DB.practices.length, hash: '#/admin/practices' },
    { label: 'Locations', n: DB.locations.length, hash: '#/admin/practices' },
    { label: 'Users', n: DB.users.filter((u) => !u.isServiceAccount).length, hash: '#/admin/users' },
    { label: 'Insurance classes', n: DB.insuranceClasses.length, hash: '#/admin/classes' },
    { label: 'Insurances', n: DB.insurances.filter((i) => !i.draft).length, hash: '#/admin/insurances' },
    { label: 'Release buckets', n: DB.releaseBuckets.length, hash: '#/admin/buckets' },
    { label: 'Providers', n: DB.providers.filter((p) => !p.draft).length, hash: '#/admin/providers' },
    { label: 'Procedure codes', n: DB.procedureCodes.length, hash: '#/admin/codes' },
    { label: 'Fee schedule rows', n: DB.feeSchedules.length, hash: '#/admin/fees' },
    { label: 'Referring physicians', n: DB.referrers.length, hash: '#/admin/referrers' },
    { label: 'Patients', n: DB.patients.length, hash: '#/patients' },
    { label: 'Cases', n: DB.cases.length, hash: '#/patients' },
    { label: 'Visits (charges)', n: DB.visits.filter((v) => v.status !== 'Inactive').length, hash: '#/charges' },
    { label: 'Claims', n: DB.claims.length, hash: '#/claims/all' },
    { label: 'Payments & adjustments', n: DB.payments.length, hash: '#/payments/ledger' },
    { label: 'Denials', n: DB.denials.length, hash: '#/denials/all' },
  ]
  return { inPr, patientsIn, casesIn, visitsIn, claimsIn, insIn, caseReady, readyCase, counts }
})()

// ================================================================ start screen (prototype layer)
const Welcome = {
  html() {
    const card = (m) => `<div class="card env-card ${m.key}">
      <div class="card-body">
        <div class="row gap-8"><span class="env-ico ${m.key}">${I(m.icon, 'icon-18')}</span><div class="grow"><div class="eyebrow">${m.key === 'demo' ? 'Show me the finished system' : 'Teach me how it works'}</div><div class="env-title">${U.esc(m.label)}</div></div></div>
        <p class="t-meta muted-2 mt-12" style="line-height:1.6">${U.esc(m.pitch)}</p>
        <ul class="env-points">${m.points.map((p) => `<li>${I('check', 'icon-14')}<span>${U.esc(p)}</span></li>`).join('')}</ul>
        <div class="mt-16">${UI.btn({ label: m.cta, icon: 'arrowRight', variant: m.key === 'demo' ? 'primary' : '', act: 'env.choose', data: { mode: m.key }, demo: `env-${m.key}` }).replace('class="btn ', 'class="btn btn-block ')}</div>
      </div></div>`
    return `<div class="login">
      <div class="login-art"><img src="assets/login.webp" alt=""><div class="tint"></div><div class="fade"></div>
        <div class="copy"><div class="stroke"></div><h2>Same system. Two starting points.</h2>
        <p>Both environments run the same screens, the same PRD V2 business rules and the same workflows. Only the data you start with is different.</p></div></div>
      <div class="login-main"><div class="login-box" style="max-width:780px">
        <div class="rn-start-badge">Billing System prototype · PRD V2</div>
        <h1 class="mt-12">How would you like <span style="font-weight:300;color:var(--n500)">to explore it?</span></h1>
        <p class="lede">Nothing is saved. Refreshing the page brings you back here.</p>
        <div class="env-grid mt-24">${card(Env.META.demo)}${card(Env.META.fresh)}</div>
        <label class="rn-start-toggle mt-24"><input type="checkbox" ${Review.isOn() ? 'checked' : ''} data-change="rn.pick">
          <span><strong>Review notes</strong> — small annotations on the screens they belong to: assumptions the prototype had to make, open client questions and short notes. Turn them off for a clean run-through; Alt + Shift + N brings them back.</span></label>
        <p class="t-micro muted mt-16">All people, practices, payers and identifiers are fictional. Today in the prototype is ${U.dateLong('2026-09-15')}.</p>
      </div></div></div>`
  },
}
ACT['env.choose'] = (el) => {
  Env.load(el.dataset.mode)
  R.go('#/login')
}
ACT['env.switch'] = async (el) => {
  UI.closeMenu()
  const to = el.dataset.mode
  const from = Env.meta()
  const target = Env.META[to]
  const ok = await UI.confirm({
    title: `Switch to ${target.label}?`,
    message: `Your current ${from.label} session will be reset — everything created or changed in it is discarded. ${target.label} starts from its beginning${to === 'fresh' ? ': an empty system' : ': the original demo data'}.`,
    confirmLabel: `Switch to ${target.label}`,
    tone: 'critical',
    cls: 'proto-layer',
  })
  if (!ok) return
  Env.load(to)
  UI.toast('info', `Switched to ${target.label}`, to === 'fresh' ? 'Sign in as the System Administrator to start from zero.' : 'Choose an account to sign in.')
  R.go('#/login')
}
ACT['env.reset'] = async () => {
  UI.closeMenu()
  const fresh = Env.isFresh()
  const ok = await UI.confirm({
    title: fresh ? 'Reset the Fresh System?' : 'Reset the demo data?',
    message: fresh
      ? 'This removes every record created during this session and returns the system to its initial empty state: two seeded roles and the System Administrator account.'
      : 'Every change made in this session is discarded and the original demo data is restored.',
    confirmLabel: fresh ? 'Reset to empty' : 'Reset demo data',
    tone: 'critical',
    cls: 'proto-layer',
  })
  if (!ok) return
  const uid = S.session.userId
  Env.load(Env.current())
  // Stay signed in if the same account still exists after the reset
  if (DB.users.some((u) => u.id === uid && u.isActive)) {
    S.session.userId = uid
    S.session.practiceId = (S.practices()[0] || {}).id || null
    const u = S.user()
    if (u.defaultPracticeId && S.practices().some((p) => p.id === u.defaultPracticeId)) S.session.practiceId = u.defaultPracticeId
  }
  UI.toast('info', fresh ? 'Fresh System reset' : 'Demo data reset', fresh ? 'The system is empty again.' : 'The demo data is back to its starting point.')
  R.go(S.user() ? '#/' + R.firstAllowed() : '#/login')
}
ACT['env.welcome'] = async () => {
  UI.closeMenu()
  const ok = await UI.confirm({ title: 'Back to the start screen?', message: 'The current session is discarded. You can choose an environment and Guide mode again.', confirmLabel: 'Go to the start screen', tone: 'critical', cls: 'proto-layer' })
  if (!ok) return
  UI.closeAll()
  S.session.userId = null
  Env.unload()
  R.go('#/welcome')
}
