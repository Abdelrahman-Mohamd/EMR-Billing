/* Dashboard — every figure is computed from the current data. */

const Dash = {
  scope() {
    const visits = DB.visits.filter(S.inScopeVisit)
    const claims = DB.claims.filter(S.inScopeClaim)
    return { visits, claims }
  },
  openAr(claims) {
    const lineIds = new Set()
    claims.filter((c) => !['Replaced', 'Voided', 'Cancelled', 'Hold', 'Scrubbing'].includes(c.status)).forEach((c) => c.lineIds.forEach((id) => lineIds.add(id)))
    return U.sum([...lineIds].map((id) => S.find('chargeLines', id)).filter((l) => l && !l.void), (l) => l.balIns + l.balPat)
  },
  aging(claims) {
    const buckets = Object.fromEntries(E.AGING.map((b) => [b, 0]))
    claims
      .filter((c) => c.sentDate && ['Submitted', 'Denied', 'Rejected', 'Paid'].includes(c.status))
      .forEach((c) => {
        const bal = E.claimInsBalance(c)
        if (bal <= 0) return
        buckets[E.agingBucket(U.daysBetween(c.sentDate, DB.today))] += bal
      })
    return buckets
  },
  collectedMonth() {
    const month = DB.today.slice(0, 7)
    return U.sum(
      DB.payments.filter((p) => ['Insurance payment', 'Patient payment'].includes(p.kind) && p.postedDate && p.postedDate.startsWith(month) && Dash.paymentInScope(p)),
      (p) => p.amount,
    )
  },
  paymentInScope(p) {
    if (p.chargeLineId) {
      const l = S.find('chargeLines', p.chargeLineId)
      const v = l && S.find('visits', l.visitId)
      return v ? S.inScopeVisit(v) : false
    }
    if (p.patientId) return S.find('patients', p.patientId)?.practiceId === S.session.practiceId
    return false
  },
  todayRuns() {
    return DB.runs.filter((r) => r.date === DB.today && r.practiceId === S.session.practiceId)
  },
}

Screens.dashboard = {
  render() {
    const u = S.user()
    const st = S.view('dash', { loaded: false })
    const hour = new Date().getHours()
    const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
    const head = `<div class="page-x screen-head"><div><h1 class="screen-title">${greet}, ${U.esc(u.installAccount ? u.displayName : u.displayName.split(' ')[0])}</h1><p class="screen-sub">${U.esc(S.practice().name)} · ${U.dateLong(DB.today)} · ${U.esc(S.locationScopeLabel())}</p></div>
      <div class="screen-actions">${S.can('CHARGES', 'r') ? UI.btn({ label: 'Review charges', icon: 'file', act: 'go', data: { hash: '#/charges' } }) : ''}${S.can('PAYMENTS', 'r') ? UI.btn({ label: 'Post payments', icon: 'wallet', variant: 'primary', act: 'go', data: { hash: '#/payments' } }) : ''}</div></div>`
    if (!st.loaded) {
      return `<div class="screen">${head}<div class="fig-band">${Array.from({ length: 6 }, () => `<div class="fig"><span class="skel" style="width:90px;height:13px"></span><span class="skel mt-12" style="width:70px;height:28px"></span></div>`).join('')}</div><div class="page-x">${UI.skeletonRows(8)}</div></div>`
    }
    const { visits, claims } = Dash.scope()
    const review = visits.filter((v) => v.status === 'Review').length
    const waiting = visits.filter((v) => ['Pended', 'Delayed'].includes(v.status)).length
    const ready = visits.filter((v) => v.status === 'Released').length
    const exc = DB.exceptions.filter((x) => x.status === 'Open' && inScopeException(x)).length
    const incomplete = visits.filter((v) => v.status === 'Incomplete').length
    const holds = claims.filter((c) => c.status === 'Hold')
    const rejected = claims.filter((c) => c.status === 'Rejected')
    const runs = Dash.todayRuns()
    const sentToday = U.sum(runs, (r) => r.sent)
    const attemptedToday = U.sum(runs, (r) => r.attempted)
    const openAr = Dash.openAr(claims)
    const collected = Dash.collectedMonth()
    const denialsOpen = DB.denials.filter((d) => d.status === 'Open' && d.practiceId === S.session.practiceId)
    const appealed = DB.denials.filter((d) => d.status === 'Appealed' && d.practiceId === S.session.practiceId).length
    const delayed = claims.filter((c) => c.ar === 'Delayed' && c.status === 'Submitted')
    const awaiting = claims.filter((c) => c.status === 'Submitted')
    const auths = DB.authorizations.filter((a) => {
      const cov = S.find('coverages', a.coverageId)
      const c = cov && S.find('cases', cov.caseId)
      return c && S.patientOf(c).practiceId === S.session.practiceId
    })
    const activeAuths = auths.filter((a) => E.authStatus(a).label === 'Active' || E.authStatus(a).label === 'Last visit').length
    const lowAuths = auths.filter((a) => ['Exhausted', 'Last visit'].includes(E.authStatus(a).label)).length

    const figs = `<div class="fig-band">
      ${UI.fig({ label: 'Charges to review', value: review, caption: `${waiting} pended or delayed · ${ready} ready to submit`, act: 'go', d: { hash: '#/charges' } })}
      ${UI.fig({ label: 'Open exceptions', value: exc + incomplete, caption: `${exc} billing exceptions · ${incomplete} incomplete profiles`, tone: exc + incomplete ? 'attention' : '', act: 'go', d: { hash: '#/exceptions' } })}
      ${UI.fig({ label: 'Claims on hold', value: holds.length, caption: `${rejected.length} clearinghouse rejections open`, tone: holds.length ? 'critical' : '', act: 'go', d: { hash: '#/claims/holds' } })}
      ${UI.fig({ label: 'Submitted today', value: sentToday, caption: `${attemptedToday} attempted in today’s batch`, act: 'go', d: { hash: '#/claims/batches' } })}
      ${UI.fig({ label: 'Open A/R', value: U.moneyShort(openAr), caption: `${awaiting.length} claims awaiting payment`, act: S.can('AR', 'r') ? 'go' : null, d: { hash: '#/ar' } })}
      ${UI.fig({ label: 'Collected this month', value: U.moneyShort(collected), caption: 'Insurance and patient payments', tone: 'success', act: S.can('PAYMENTS', 'r') ? 'go' : null, d: { hash: '#/payments/ledger' } })}
    </div>`

    // The revenue cycle, stage by stage
    const step = (name, val, cap, hash, off = false) =>
      off
        ? `<div class="pipe-step off"><div class="p-name">${name}</div><div class="p-val">Not yet specified</div><div class="p-cap">${cap}</div><span class="p-arrow"></span></div>`
        : `<button type="button" class="pipe-step" data-act="go" data-hash="${hash}"><div class="p-name">${name}</div><div class="p-val">${val}</div><div class="p-cap">${cap}</div><span class="p-arrow"></span></button>`
    const pipeline = `<div class="pipeline">
      ${step('Authorization', activeAuths, `${lowAuths} exhausted or on last visit`, '#/patients')}
      ${step('Encounter', review + waiting + ready, `${review} in review · ${ready} ready`, '#/charges')}
      ${step('Claim', awaiting.length + holds.length, `${holds.length} on hold · ${awaiting.length} submitted`, '#/claims/submitted')}
      ${step('Denial / A/R', denialsOpen.length + delayed.length, `${denialsOpen.length} denials · ${delayed.length} delayed`, '#/denials')}
      ${step('Payment', U.moneyShort(collected), 'Posted this month', '#/payments/ledger')}
      ${step('Appeals', appealed, 'Appealed denials', '#/denials/appealed')}
    </div>`

    // Holds by reason
    const byReason = E.HOLD_ORDER.map((k) => ({ k, n: holds.filter((c) => c.holdReason === k).length }))
    const maxHold = Math.max(1, ...byReason.map((x) => x.n))
    const holdBars = `<div class="bars">${byReason
      .map((x) => `<button type="button" class="bar-row" data-act="go" data-hash="#/claims/holds?reason=${x.k}"><span class="bar-label">${E.HOLDS[x.k].label}</span><span class="bar-track"><span class="bar-fill" style="width:${(x.n / maxHold) * 100}%;background:${x.n ? 'var(--critical)' : 'transparent'}"></span></span><span class="bar-val">${x.n}</span></button>`)
      .join('')}</div>`

    const aging = Dash.aging(claims)
    const maxAging = Math.max(1, ...Object.values(aging))
    const ramp = ['var(--ramp-1)', 'var(--ramp-2)', 'var(--ramp-3)', 'var(--ramp-4)', 'var(--ramp-5)']
    const agingChart = `<div class="col-chart">${E.AGING.map((b, i) => `<div class="col"><span class="col-v">${U.moneyShort(aging[b])}</span><span class="col-bar" style="height:${Math.max(2, (aging[b] / maxAging) * 100)}%;background:${ramp[i]}"></span><span class="col-l">${b} days</span></div>`).join('')}</div>`

    // Today's submission batch (§7.2)
    const heldToday = {}
    runs.forEach((r) => Object.entries(r.held).forEach(([k, n]) => (heldToday[k] = (heldToday[k] || 0) + n)))
    const rejToday = claims.filter((c) => c.rejection && c.rejection.date === DB.today).length
    const batch = `<div class="balance"><div><div class="eyebrow">Attempted</div><div class="bv">${attemptedToday}</div></div><div><div class="eyebrow">Actual batch count</div><div class="bv ok">${sentToday}</div></div><div><div class="eyebrow">Held / failed</div><div class="bv ${attemptedToday - sentToday ? 'off' : ''}">${attemptedToday - sentToday}</div></div><div><div class="eyebrow">Rejections (live)</div><div class="bv">${rejToday}</div></div></div>
      <div class="t-micro muted-2 mt-12">${Object.keys(heldToday).length ? 'Held by failure code: ' + Object.entries(heldToday).map(([k, n]) => `${E.HOLDS[k].label} ${n}`).join(' · ') : attemptedToday ? 'Nothing held today.' : 'No submissions yet today — the scheduled job runs at 18:00, or submit from Charges → Ready to submit.'}</div>`

    // Needs attention
    const alerts = []
    const pendingEras = DB.eras.filter((e) => e.status === 'Pending' && e.practiceId === S.session.practiceId)
    if (pendingEras.length) alerts.push({ tone: 'info', icon: 'inbox', text: `${U.plural(pendingEras.length, 'ERA file')} waiting to post (${pendingEras.map((e) => S.find('insurances', e.insuranceId).name).join(', ')})`, sub: `${U.money(U.sum(pendingEras, E.eraTotal))} in remittances`, hash: '#/payments' })
    const slaDue = claims.filter((c) => c.status === 'Submitted' && !c.ar && c.slaDue && c.slaDue < DB.today)
    if (slaDue.length) alerts.push({ tone: 'warning', icon: 'clock', text: `${U.plural(slaDue.length, 'claim')} past payer SLA with no payment`, sub: 'The SLA engine escalates them to A/R as Delayed', hash: '#/ar/delayed' })
    const heldProv = DB.providers.filter((p) => p.practiceId === S.session.practiceId && p.claimHoldUntil && p.claimHoldUntil > DB.today)
    heldProv.forEach((p) => {
      const n = visits.filter((v) => v.status === 'Delayed' && v.treatingProviderId === p.id).length
      alerts.push({ tone: 'attention', icon: 'pause', text: `${S.provName(p)} on claim hold until ${U.date(p.claimHoldUntil)}`, sub: `${p.claimHoldReason} · ${U.plural(n, 'visit')} delayed`, hash: '#/charges/delayed' })
    })
    const noAuth = visits.filter((v) => v.status === 'Pended' && v.pendReason === 'No authorization available').length
    if (noAuth) alerts.push({ tone: 'warning', icon: 'flag', text: `${U.plural(noAuth, 'visit')} pended for missing authorization`, sub: 'Record the new authorization on the case to release them', hash: '#/charges/pended' })
    const ups = DB.updates.filter((x) => x.status === 'Open' && x.practiceId === S.session.practiceId).length
    if (ups) alerts.push({ tone: 'info', icon: 'refresh', text: `${U.plural(ups, 'updated note')} for already-submitted claims`, sub: 'Inactivate, create a corrected claim or submit anyway', hash: '#/charges/updated' })
    const payEx = DB.exceptions.filter((x) => x.status === 'Open' && x.level === 'Payment' && x.practiceId === S.session.practiceId).length
    if (payEx) alerts.push({ tone: 'critical', icon: 'wallet', text: `${U.plural(payEx, 'remittance line')} could not be applied`, sub: 'Payment-level billing exceptions', hash: '#/exceptions?level=Payment' })
    const alertHtml = alerts.length
      ? `<ul class="alert-list">${alerts.map((a) => `<li><span class="a-ico tone-${a.tone}">${I(a.icon)}</span><div class="grow"><div class="a-text">${U.esc(a.text)}</div><div class="a-sub">${U.esc(a.sub)}</div></div>${UI.btn({ label: 'Open', size: 'sm', act: 'go', data: { hash: a.hash } })}</li>`).join('')}</ul>`
      : UI.empty({ icon: 'circleCheck', title: 'Nothing needs attention', text: DB.visits.some(S.inScopeVisit) ? 'Every queue is clear for this practice.' : 'No charges exist yet, so no queue has anything in it. Alerts appear here once visits, claims and remittances start flowing.' })

    const acts = DB.audit.filter((a) => a.practiceId === S.session.practiceId && a.entityType).slice(0, 9)
    const activity = !acts.length ? UI.empty({ icon: 'clock', title: 'No activity yet', text: 'Every change to a patient, charge, claim or payment in this practice is written to the audit trail and the latest appear here.' }) : `<ul class="activity">${acts.map((a) => `<li><div><span class="who">${U.esc(S.userName(a.userId))}</span> — ${U.esc(a.action)}${a.detail ? `<div class="t-micro muted">${U.esc(a.detail)}</div>` : ''}</div><span class="when">${U.esc(U.stampLabel(a.at, DB.today))}</span></li>`).join('')}</ul>`

    return `<div class="screen">${head}${figs}
      <div class="page-x screen-body">
        <div class="section">${UI.sectionHead('Revenue cycle', 'Work in each stage for this practice')}${'<div class="mt-12"></div>' + pipeline}</div>
        <div class="grid-2 section">
          <div class="card"><div class="card-head"><span class="card-title">Today’s submission batch</span><span class="muted t-micro">${U.date(DB.today)}</span>${S.can('BILLING', 'r') ? `<span class="ml-auto">${UI.btn({ label: 'Batch history', size: 'sm', act: 'go', data: { hash: '#/claims/batches' } })}</span>` : ''}</div><div class="card-body">${batch}</div></div>
          <div class="card"><div class="card-head"><span class="card-title">Claims on hold by reason</span><span class="muted t-micro">${holds.length} held</span></div><div class="card-body">${holdBars}</div></div>
        </div>
        <div class="grid-2 section">
          <div class="card"><div class="card-head"><span class="card-title">Insurance A/R aging</span><span class="muted t-micro">Days since submission · ${U.money(U.sum(Object.values(aging)))}</span></div><div class="card-body">${agingChart}</div></div>
          <div class="card"><div class="card-head"><span class="card-title">Needs attention</span><span class="muted t-micro">${alerts.length}</span></div><div class="card-body" style="padding-top:4px;padding-bottom:4px">${alertHtml}</div></div>
        </div>
        <div class="section card"><div class="card-head"><span class="card-title">Recent activity</span><span class="muted t-micro">From the audit trail</span>${S.can('ADMIN', 'r') ? `<span class="ml-auto">${UI.btn({ label: 'Audit log', size: 'sm', act: 'go', data: { hash: '#/admin/audit' } })}</span>` : ''}</div><div class="card-body" style="padding-top:2px;padding-bottom:2px">${activity}</div></div>
      </div></div>`
  },
  after() {
    const st = S.view('dash', { loaded: false })
    if (!st.loaded) {
      setTimeout(() => {
        st.loaded = true
        if (location.hash.startsWith('#/dashboard')) R.refresh()
      }, 450)
    }
    S.emit('nav.dashboard')
  },
}
