/* App shell: hash router, the brand sidebar, the phone drawer, the practice
   ("Company") scope, the account menu and sign-in.
   R.hooks lets an outer layer take over the first screen and observe renders. */

const Screens = {}

const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard', module: 'DASHBOARD' },
  { key: 'patients', label: 'Patients', icon: 'users', module: 'PATIENT' },
  { key: 'charges', label: 'Charges', icon: 'file', module: 'CHARGES', count: () => countVisits(['Review']) },
  { key: 'exceptions', label: 'Exceptions', icon: 'alert', module: 'CHARGES', count: () => DB.exceptions.filter((x) => x.status === 'Open' && inScopeException(x)).length + countVisits(['Incomplete']) },
  { key: 'claims', label: 'Claims', icon: 'send', module: 'BILLING', count: () => DB.claims.filter((c) => ['Hold', 'Rejected'].includes(c.status) && S.inScopeClaim(c)).length },
  { key: 'payments', label: 'Payments', icon: 'wallet', module: 'PAYMENTS', count: () => DB.eras.filter((e) => e.status === 'Pending' && e.practiceId === S.session.practiceId).length },
  { key: 'denials', label: 'Denials', icon: 'shieldX', module: 'DENIALS', count: () => DB.denials.filter((d) => d.status === 'Open' && d.practiceId === S.session.practiceId).length },
  { key: 'ar', label: 'A/R follow-up', icon: 'clock', module: 'AR', count: () => DB.claims.filter((c) => c.ar === 'Delayed' && c.status === 'Submitted' && S.inScopeClaim(c)).length },
  { sep: true },
  { key: 'reports', label: 'Reports', icon: 'chart', module: 'REPORTS' },
  { key: 'month-end', label: 'Month end', icon: 'calendarCheck', module: 'MONTHEND' },
  { key: 'admin', label: 'Admin', icon: 'settings', module: 'ADMIN', alt: 'INTEGRATION' },
]
const countVisits = (statuses) => DB.visits.filter((v) => statuses.includes(v.status) && S.inScopeVisit(v)).length
const inScopeException = (x) => {
  if (x.practiceId !== S.session.practiceId) return false
  if (!x.visitId) return true
  const v = S.find('visits', x.visitId)
  return v ? S.locAllowed(v.locationId) : true
}
const navAllowed = (item) => S.can(item.module, 'r') || (item.alt && S.can(item.alt, 'r'))

const R = (() => {
  let railExpanded = false
  try {
    railExpanded = localStorage.getItem('bs.rail') === 'expanded'
  } catch (e) {
    railExpanded = false
  }
  let lastRouteKey = ''
  /** gate(app, parts) → true when an outer layer rendered the screen itself.
   *  afterRender() → called after every render. */
  const hooks = { gate: null, afterRender: null }

  const parse = () => {
    const raw = (location.hash || '#/').slice(1)
    const [path, query = ''] = raw.split('?')
    const parts = path.split('/').filter(Boolean)
    const q = {}
    query.split('&').filter(Boolean).forEach((kv) => {
      const [k, v] = kv.split('=')
      q[decodeURIComponent(k)] = decodeURIComponent(v || '')
    })
    return { parts, q, path }
  }
  const go = (hash) => {
    if (location.hash === hash) render()
    else location.hash = hash
  }

  // --------------------------------------------------------------- sidebar
  const railHtml = (active, inDrawer = false) => {
    const u = S.user()
    const pr = S.practice() || { name: 'No practice yet' }
    const items = NAV.filter((n) => n.sep || navAllowed(n))
    const expanded = inDrawer || railExpanded
    return `<nav class="rail ${expanded ? 'expanded' : ''}" aria-label="Sections">
      <a class="rail-logo" href="#/${firstAllowed()}" aria-label="Billing System — home"><img src="assets/logo.png" alt=""></a>
      <div class="rail-tag">Billing System</div>
      <div class="rail-nav">${items
        .map((n) => {
          if (n.sep) return '<div class="nav-sep"></div>'
          const count = n.count ? n.count() : 0
          return `<a class="nav-link ${active === n.key ? 'active' : ''}" href="#/${n.key}" ${active === n.key ? 'aria-current="page"' : ''} data-tip="${U.esc(n.label)}${count ? ` · ${count}` : ''}" data-demo="nav-${n.key}">${I(n.icon)}<span class="nav-label">${n.label}</span>${count ? `<span class="nav-count">${count > 99 ? '99+' : count}</span><span class="nav-dot"></span>` : ''}</a>`
        })
        .join('')}</div>
      ${inDrawer ? '' : `<button type="button" class="rail-toggle" data-act="rail.toggle" aria-pressed="${railExpanded}" aria-label="${railExpanded ? 'Collapse the sidebar' : 'Expand the sidebar'}">${I(railExpanded ? 'chevronLeft' : 'chevronRight', 'icon-14')}</button>`}
      <div class="rail-foot">
        <button type="button" class="rail-scope" data-act="scope.menu" data-tip="Company · ${U.esc(pr.name)}">
          <span class="scope-ico">${I('building', 'icon-18')}</span>
          <span class="scope-text"><span class="k">Company</span><span class="v">${U.esc(pr.name)}</span></span>
        </button>
        <button type="button" class="rail-account" data-act="account.menu" data-tip="${U.esc(u.displayName)} · ${U.esc(S.roleLabel())}">
          ${UI.avatar(u.displayName)}
          <span class="acct-text"><span class="v">${U.esc(u.displayName)}</span><span class="k">${U.esc(S.roleLabel())}</span></span>
        </button>
      </div>
    </nav>`
  }
  const firstAllowed = () => (NAV.find((n) => !n.sep && navAllowed(n)) || { key: 'dashboard' }).key

  // Collapsed-rail tooltip, drawn beside the rail (EMR-V.2 pattern)
  let tipEl = null
  document.addEventListener('mouseover', (ev) => {
    const t = ev.target.closest && ev.target.closest('.rail:not(.expanded) [data-tip]')
    if (!t) {
      if (tipEl) {
        tipEl.remove()
        tipEl = null
      }
      return
    }
    if (tipEl && tipEl.dataset.for === t.dataset.tip) return
    if (tipEl) tipEl.remove()
    const r = t.getBoundingClientRect()
    tipEl = document.createElement('div')
    tipEl.className = 'nav-tip'
    tipEl.dataset.for = t.dataset.tip
    tipEl.textContent = t.dataset.tip
    tipEl.style.left = `${r.right + 14}px`
    tipEl.style.top = `${r.top + r.height / 2}px`
    document.body.appendChild(tipEl)
  })

  ACT['rail.toggle'] = () => {
    railExpanded = !railExpanded
    try {
      localStorage.setItem('bs.rail', railExpanded ? 'expanded' : 'collapsed')
    } catch (e) {
      /* preference only */
    }
    if (tipEl) {
      tipEl.remove()
      tipEl = null
    }
    render()
  }
  ACT['mobile.open'] = () => {
    const wrap = document.createElement('div')
    wrap.className = 'mobile-drawer'
    wrap.innerHTML = `<div class="scrim" data-act="mobile.close"></div>${railHtml(parse().parts[0], true)}`
    document.body.appendChild(wrap)
    wrap.addEventListener('click', (ev) => {
      if (ev.target.closest('a.nav-link')) ACT['mobile.close']()
    })
  }
  ACT['mobile.close'] = () => {
    const d = document.querySelector('.mobile-drawer')
    if (!d) return
    d.classList.add('closing')
    setTimeout(() => d.remove(), 200)
  }

  ACT['scope.menu'] = (el) => {
    const items = [{ head: `<div class="eyebrow">Working company (practice)</div><div class="t-micro muted-2" style="margin-top:2px">Scopes every list and count</div>` }]
    if (!S.practices().length) items.push(S.isGlobal() ? { label: 'No practice yet', sub: 'Create the first practice', icon: 'plus', act: 'go', data: { hash: '#/admin/practices' } } : { head: '<div class="t-micro muted-2">No practice is available to you yet. A System Admin creates practices and grants access.</div>' })
    S.practices().forEach((p) =>
      items.push({ label: p.name, sub: `${p.code} · NPI ${p.npi}`, icon: 'building', act: 'scope.set', data: { id: p.id }, selected: p.id === S.session.practiceId }),
    )
    UI.menu(el, items, { side: el.closest('.rail') && !el.closest('.mobile-drawer') ? 'right' : undefined })
  }
  ACT['scope.set'] = (el) => {
    UI.closeMenu()
    ACT['mobile.close']()
    if (el.dataset.id === S.session.practiceId) return
    S.session.practiceId = el.dataset.id
    S.resetViews()
    UI.toast('info', `Working in ${S.practice().name}`, 'Every list, count and dashboard figure now reflects this practice.')
    go('#/' + firstAllowed())
  }
  ACT['account.menu'] = (el) => {
    const u = S.user()
    UI.menu(
      el,
      [
        { head: `<div class="fw-500 ink">${U.esc(u.displayName)}</div><div class="t-micro muted">${U.esc(S.roleLabel())}</div><div class="t-micro muted">${U.esc(u.email)}</div>` },
        { label: 'Switch account', icon: 'users', act: 'account.switch' },
        'sep',
        { label: 'Sign out', icon: 'logOut', act: 'account.signout', danger: true },
      ],
      { side: el.closest('.rail') && !el.closest('.mobile-drawer') ? 'right' : undefined },
    )
  }
  ACT['account.switch'] = () => {
    UI.closeMenu()
    signOut(false)
  }
  ACT['account.signout'] = async () => {
    UI.closeMenu()
    const ok = await UI.confirm({ title: 'Sign out?', message: 'You will return to the sign-in screen.', confirmLabel: 'Sign out', tone: 'critical' })
    if (ok) signOut(true)
  }
  const signOut = (toast) => {
    UI.closeAll()
    S.session.userId = null
    S.resetViews()
    if (toast) UI.toast('info', 'Signed out')
    go('#/login')
  }

  // --------------------------------------------------------------- login
  let loginChoice = null
  const setLoginChoice = (id) => {
    loginChoice = id
  }
  const loginOptions = () =>
    DB.users
      .filter((u) => u.isActive && !u.isServiceAccount)
      .map((u) => ({
        userId: u.id,
        u,
        role: S.roleLabel(u) || 'No role',
        scope: S.rolesOf(u).some((r) => r.isGlobal) ? 'All practices' : u.grants.map((g) => (DB.practices.find((p) => p.id === g.practiceId) || {}).name).filter(Boolean).join(', ') || 'No practice access yet',
      }))
  const loginHtml = () => {
    const opts = loginOptions()
    if (!opts.some((o) => o.userId === loginChoice)) loginChoice = opts.length ? opts[0].userId : null
    return `<div class="login">
    <div class="login-art"><img src="assets/login.webp" alt=""><div class="tint"></div><div class="fade"></div>
      <div class="copy"><div class="stroke"></div><h2>Every claim, owned from session to payment.</h2>
      <p>The revenue cycle for Physical Therapy and multi-specialty practices — from the finalized clinical note to the posted payment.</p></div></div>
    <div class="login-main"><div class="login-box">
      <img class="logo" src="assets/logo.png" alt="EMR">
      <h1 class="mt-16">Sign in <span style="font-weight:300;color:var(--n500)">to Billing</span></h1>
      <p class="lede">Choose your account.</p>
      <div class="choice-list mt-24" role="radiogroup" aria-label="Account">${opts.map((r) => `<label class="choice role-card ${loginChoice === r.userId ? 'selected' : ''}"><input type="radio" name="demo-role" value="${r.userId}" ${loginChoice === r.userId ? 'checked' : ''} data-change="login.pick"><span class="row gap-12 grow">${UI.avatar(r.u.displayName)}<span class="grow"><span class="c-title">${U.esc(r.u.displayName)}</span><span class="c-desc" style="display:block">${U.esc(r.role)} · ${U.esc(r.scope)}</span><span class="c-desc" style="display:block">${U.esc(r.u.email)}</span></span></span></label>`).join('')}</div>
      <button type="button" class="btn btn-primary btn-block mt-24" style="height:50px;font-size:15px" data-act="login.enter" data-demo="login-enter">Sign in ${I('arrowRight')}</button>
    </div></div></div>`
  }
  ACT['login.pick'] = (el) => {
    loginChoice = el.value
    document.querySelectorAll('.role-card').forEach((c) => c.classList.toggle('selected', c.querySelector('input').checked))
  }
  ACT['login.enter'] = () => {
    const u = DB.users.find((x) => x.id === loginChoice)
    S.session.userId = u.id
    S.session.practiceId = S.practices().some((p) => p.id === u.defaultPracticeId) ? u.defaultPracticeId : (S.practices()[0] || {}).id || null
    S.resetViews()
    S.log('Signed in', { detail: S.roleLabel() })
    UI.toast('success', `Signed in as ${u.displayName}`, `${S.roleLabel()} · ${S.practice() ? S.practice().name : 'no practice yet'}`)
    S.emit('login', u)
    go('#/' + firstAllowed())
  }

  // --------------------------------------------------------------- render
  const noAccess = (item) => `<div class="screen"><div class="page-x screen-head"><div><h1 class="screen-title">${U.esc(item ? item.label : 'Page not found')}</h1></div></div><div class="page-x">${UI.empty({
    icon: 'lock',
    title: item ? `Your role does not open ${item.label}` : 'This page does not exist',
    text: item ? `The ${S.roleLabel()} role has this section set to <strong>Hidden</strong>. Ask a System Admin to grant access in Admin → Roles & permissions.` : 'Use the sidebar to pick a section.',
    action: UI.btn({ label: 'Go to my start page', variant: 'primary', act: 'go', data: { hash: '#/' + firstAllowed() } }),
  })}</div></div>`
  const noPractice = (label) => `<div class="screen"><div class="page-x screen-head"><div><h1 class="screen-title">${U.esc(label)}</h1></div></div>
      <div class="page-x screen-body">${UI.empty({
        icon: 'building',
        title: 'No practice yet',
        text: `Patients, providers, insurances, charges and claims all belong to a practice. ${U.esc(label)} is available once a practice and its primary location exist.${S.isGlobal() ? '' : ' A System Admin creates practices.'}`,
        action: S.isGlobal() ? UI.btn({ label: 'Create the practice', icon: 'plus', variant: 'primary', act: 'go', data: { hash: '#/admin/practices' } }) : '',
      })}</div></div>`
  ACT.go = (el) => {
    UI.closeAll()
    UI.closeMenu()
    go(el.dataset.hash)
  }

  // Re-entrancy guard: replacing the DOM removes a focused input, and the
  // browser can fire that input's change/blur handlers mid-replacement — a
  // nested render then would fail. Queue it for the next tick instead.
  let rendering = false
  const render = () => {
    if (rendering) {
      setTimeout(render, 0)
      return
    }
    rendering = true
    try {
      renderNow()
    } finally {
      rendering = false
    }
  }
  const renderNow = () => {
    const app = document.getElementById('app')
    const { parts, q } = parse()
    if (hooks.gate && hooks.gate(app, parts)) {
      document.body.classList.remove('rail-expanded')
      if (hooks.afterRender) hooks.afterRender()
      return
    }
    if (!S.user()) {
      if (parts[0] !== 'login') {
        location.replace('#/login')
        return
      }
      app.innerHTML = loginHtml()
      document.body.classList.remove('rail-expanded')
      if (hooks.afterRender) hooks.afterRender()
      return
    }
    if (!parts.length || parts[0] === 'login') {
      location.replace('#/' + firstAllowed())
      return
    }
    const key = parts[0]
    const item = NAV.find((n) => n.key === key)
    const screen = Screens[key]
    let main
    if (!screen) main = noAccess(null)
    else if (item && !navAllowed(item)) main = noAccess(item)
    else if (!S.practice() && key !== 'admin') main = noPractice(item ? item.label : 'This page')
    else {
      try {
        main = screen.render(parts.slice(1), q)
      } catch (err) {
        console.error(err)
        main = `<div class="screen"><div class="page-x screen-head"><h1 class="screen-title">Something went wrong</h1></div><div class="page-x">${UI.notice('critical', 'This screen could not be drawn.', U.esc(err.message))}</div></div>`
      }
    }
    // Keep focus and caret (search boxes) and the scroll position across re-renders
    const active = document.activeElement
    const focusId = active && active.id && app.contains(active) ? active.id : null
    const caret = focusId && active.selectionStart !== undefined ? active.selectionStart : null
    const routeKey = location.hash.split('?')[0]
    const scrollers = Array.from(app.querySelectorAll('.screen, .subnav-content')).map((s) => s.scrollTop)
    app.innerHTML = `<div class="app">${railHtml(key)}<div class="main"><header class="mobile-bar"><button type="button" class="mb-btn" data-act="mobile.open" aria-label="Open the menu">${I('menu', 'icon-20')}</button><img src="assets/logo.png" alt="EMR"><span class="grow"></span><button type="button" class="mb-btn" data-act="scope.menu" aria-label="Switch company">${I('building', 'icon-20')}</button><button type="button" class="mb-btn" data-act="account.menu" aria-label="Account">${UI.avatar(S.user().displayName)}</button></header>${main}</div></div>`
    document.body.classList.toggle('rail-expanded', railExpanded)
    if (routeKey === lastRouteKey) {
      Array.from(app.querySelectorAll('.screen, .subnav-content')).forEach((s, i) => {
        if (scrollers[i]) s.scrollTop = scrollers[i]
      })
    }
    lastRouteKey = routeKey
    if (focusId) {
      const el = document.getElementById(focusId)
      if (el) {
        el.focus({ preventScroll: true })
        if (caret !== null && el.setSelectionRange && el.type !== 'date' && el.type !== 'number') {
          try {
            el.setSelectionRange(caret, caret)
          } catch (e) {
            /* not a text input */
          }
        }
      }
    }
    if (screen && screen.after) screen.after(parts.slice(1), q)
    if (hooks.afterRender) hooks.afterRender()
  }
  const refresh = () => render()

  window.addEventListener('hashchange', () => {
    UI.closeMenu()
    render()
  })

  // One delegated click handler for the whole app
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-act]')
    if (!el) return
    const name = el.dataset.act
    if (el.tagName === 'TR' && ev.target.closest('a, button, input, select, label')) return
    const fn = ACT[name]
    if (!fn) {
      console.warn('No handler for', name)
      return
    }
    if (el.tagName === 'A') ev.preventDefault()
    fn(el, ev)
  })

  return { go, render, refresh, parse, firstAllowed, railHtml, hooks, setLoginChoice }
})()
