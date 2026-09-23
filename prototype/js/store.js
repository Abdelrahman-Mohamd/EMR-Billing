/* The in-memory "database" and the session around it.
   Nothing here is persisted — a refresh rebuilds the seed (see data.js). */

let DB = null

/** Permission modules, exactly as PRD §10.6 lists them — plus INTEGRATION,
 *  which the prototype adds as its own key (assumption, see coverage doc). */
const MODULES = [
  { key: 'DASHBOARD', label: 'Dashboard' },
  { key: 'PATIENT', label: 'Patient' },
  { key: 'CHARGES', label: 'Charges' },
  { key: 'BILLING', label: 'Billing' },
  { key: 'PAYMENTS', label: 'Payments' },
  { key: 'DENIALS', label: 'Denial Management' },
  { key: 'AR', label: 'AR Follow-up' },
  { key: 'REPORTS', label: 'Reports' },
  { key: 'MONTHEND', label: 'Month End' },
  { key: 'ADMIN', label: 'Admin' },
  { key: 'INTEGRATION', label: 'EMR Integration' },
]

const S = (() => {
  const session = { userId: null, practiceId: null }
  const ui = {}
  const listeners = {}

  const find = (coll, id) => (id ? DB[coll].find((x) => x.id === id) || null : null)
  const user = () => find('users', session.userId)
  const rolesOf = (u) => (u ? u.roleIds.map((r) => find('roles', r)).filter(Boolean) : [])
  const roles = () => rolesOf(user())

  /** CRUD check — union across the user's roles (PRD §10.2 user_role). */
  const can = (mod, op = 'r') => roles().some((r) => r.permissions[mod] && r.permissions[mod][op])
  /** The §1.4 three-tier reading of the same flags. */
  const level = (mod) => (can(mod, 'c') || can(mod, 'u') ? 'edit' : can(mod, 'r') ? 'view' : 'hidden')
  const levelOf = (perm) => (!perm ? 'hidden' : perm.c || perm.u ? 'edit' : perm.r ? 'view' : 'hidden')
  const hasRole = (code) => roles().some((r) => r.code === code)
  const isGlobal = () => roles().some((r) => r.isGlobal)
  const canDecrypt = () => hasRole('SYSTEM_ADMIN')
  const roleLabel = (u = user()) => rolesOf(u).map((r) => r.name).join(' + ')

  const practices = () => {
    const u = user()
    if (!u) return []
    if (isGlobal()) return DB.practices.filter((p) => p.isActive)
    return u.grants.map((g) => find('practices', g.practiceId)).filter((p) => p && p.isActive)
  }
  const practice = () => find('practices', session.practiceId)
  /** The organization a practice belongs to, if any (optional grouping). */
  const companyOf = (p) => (p && p.companyId ? find('companies', p.companyId) : null)
  const grant = () => {
    const u = user()
    return u ? u.grants.find((g) => g.practiceId === session.practiceId) : null
  }
  /** Location narrowing (user_practice.location_ids — empty means all). */
  const locAllowed = (locationId) => {
    if (isGlobal()) return true
    const g = grant()
    if (!g) return false
    return !g.locationIds.length || g.locationIds.includes(locationId)
  }
  const locationScopeLabel = () => {
    const g = grant()
    if (isGlobal() || !g || !g.locationIds.length) return 'all locations'
    return g.locationIds.map((id) => find('locations', id).name).join(', ') + ' only'
  }

  // ---- relationship helpers ----
  const caseOf = (visit) => find('cases', visit.caseId)
  const patientOf = (c) => find('patients', c.patientId)
  const patientOfVisit = (v) => patientOf(caseOf(v))
  const visitOf = (claim) => find('visits', claim.visitId)
  const locationsOfPractice = (pid = session.practiceId) => DB.locations.filter((l) => l.practiceId === pid)

  const inScopeVisit = (v) => {
    const c = caseOf(v)
    if (!c) return false
    const p = patientOf(c)
    return p && p.practiceId === session.practiceId && locAllowed(v.locationId)
  }
  const inScopeClaim = (cl) => {
    const v = visitOf(cl)
    return v && inScopeVisit(v)
  }
  const inScopePatient = (p) => {
    if (p.practiceId !== session.practiceId) return false
    const g = grant()
    if (isGlobal() || !g || !g.locationIds.length) return true
    // PRD V2 puts the location on the visit, not the case (CH-04). A location-restricted
    // user sees a patient treated at one of their locations, or a patient with no visits yet
    // (prototype assumption A-P39, Q-031).
    const cases = DB.cases.filter((c) => c.patientId === p.id).map((c) => c.id)
    const visits = DB.visits.filter((v) => cases.includes(v.caseId))
    return !visits.length || visits.some((v) => locAllowed(v.locationId))
  }

  // ---- display names ----
  const pname = (p) => (p ? `${p.lastName}, ${p.firstName}` : '')
  const pfull = (p) => (p ? `${p.firstName} ${p.lastName}` : '')
  const provName = (pr, withCred = true) =>
    pr ? `${pr.firstName} ${pr.lastName}${withCred && pr.credential ? ', ' + pr.credential : ''}` : ''
  const userName = (id) => {
    const u = find('users', id)
    return u ? u.displayName : id ? 'Unknown user' : 'Unassigned'
  }
  const insLabel = (ins) => (ins ? `${ins.code ? ins.code + ' – ' : ''}${ins.name}` : '')

  // ---- clock: the demo date is fixed; time of day is real ----
  const now = () => {
    const d = new Date()
    return `${DB.today}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  /** The audit trail — every record's "History" (core principle) reads from here. */
  const log = (action, meta = {}) => {
    // The seed builds history with explicit dates; engine calls made while
    // seeding must not stamp "today" onto records that are weeks old.
    if (S.quiet) return null
    const entry = {
      id: U.id('au'),
      at: meta.at || now(),
      userId: meta.userId || session.userId,
      action,
      module: meta.module || '',
      entityType: meta.entityType || '',
      entityId: meta.entityId || '',
      detail: meta.detail || '',
      practiceId: meta.practiceId || session.practiceId,
    }
    DB.audit.unshift(entry)
    return entry
  }
  const historyOf = (entityType, entityId) =>
    DB.audit.filter((a) => a.entityType === entityType && a.entityId === entityId)

  const emit = (event, data) => (listeners[event] || []).concat(listeners['*'] || []).forEach((fn) => fn(event, data))
  const on = (event, fn) => {
    ;(listeners[event] = listeners[event] || []).push(fn)
  }

  /** Per-screen UI memory (tab, search, sort, page...) so a re-render keeps its place. */
  const view = (key, defaults) => {
    if (!ui[key]) ui[key] = U.clone(defaults)
    return ui[key]
  }
  const resetViews = () => Object.keys(ui).forEach((k) => delete ui[k])

  /** The standard work-item block every actionable record carries (core principle). */
  const workItem = (overrides = {}) => ({ owner: null, priority: 'Medium', due: null, next: '', ...overrides })

  return {
    quiet: false,
    session, find, user, roles, rolesOf, can, level, levelOf, hasRole, isGlobal, canDecrypt, roleLabel,
    practices, practice, companyOf, grant, locAllowed, locationScopeLabel, caseOf, patientOf, patientOfVisit, visitOf,
    locationsOfPractice, inScopeVisit, inScopeClaim, inScopePatient, pname, pfull, provName, userName,
    insLabel, now, log, historyOf, emit, on, view, resetViews, workItem,
  }
})()
