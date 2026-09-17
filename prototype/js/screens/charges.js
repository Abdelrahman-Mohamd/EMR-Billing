/* Charges — Charge Review and the queues around it (§4.2, §5.1, §5.2, §10.5),
   the visit detail, manual charge entry, and the scrubbing run shown on submit. */

const POS_OPTIONS = [
  { value: '11', label: '11 — Office' },
  { value: '02', label: '02 — Telehealth (not in patient home)' },
  { value: '10', label: '10 — Telehealth in patient home' },
  { value: '12', label: '12 — Patient home' },
  { value: '22', label: '22 — Outpatient hospital' },
]

const CH_TABS = [
  { key: 'review', label: 'Charge review', status: ['Review'] },
  { key: 'pended', label: 'Pended', status: ['Pended'] },
  { key: 'delayed', label: 'Delayed', status: ['Delayed'] },
  { key: 'ready', label: 'Ready to submit', status: ['Released'] },
  { key: 'updated', label: 'Updated', status: [] },
  { key: 'inactive', label: 'Inactive records', status: ['Inactive'] },
]

const Ch = {
  visitRow(v) {
    const c = S.caseOf(v)
    const p = S.patientOf(c)
    const ins = E.primaryIns(c.id)
    const prov = S.find('providers', v.treatingProviderId)
    return {
      id: v.id, v, c, p, name: S.pname(p), dos: v.dos, loc: S.find('locations', v.locationId)?.name || '', prov: S.provName(prov, false),
      payer: ins ? ins.name : 'No insurance', amount: E.visitTotal(v), codes: UI.codesText(E.linesOfVisit(v.id)), source: v.source, created: v.createdOn,
    }
  },
  filtersCount: (f) => ['location', 'provider', 'payer', 'source'].filter((k) => f[k]).length,
  applyFilters(rows, v) {
    const q = v.q.toLowerCase()
    if (q) rows = rows.filter((r) => `${r.p.firstName} ${r.p.lastName}`.toLowerCase().includes(q) || r.name.toLowerCase().includes(q))
    const f = v.f
    if (f.location) rows = rows.filter((r) => r.v.locationId === f.location)
    if (f.provider) rows = rows.filter((r) => r.v.treatingProviderId === f.provider)
    if (f.payer) rows = rows.filter((r) => r.payer === f.payer)
    if (f.source) rows = rows.filter((r) => r.source === f.source)
    return rows
  },
}

Screens.charges = {
  render(parts, q) {
    if (parts[0] === 'visit') return VisitDetail.render(parts[1])
    if (parts[0] === 'new') return ManualCharge.render(q)
    const tab = CH_TABS.some((t) => t.key === parts[0]) ? parts[0] : 'review'
    const v = S.view(`charges-${tab}`, { q: '', sort: 'dos', dir: 'asc', page: 1, sel: [], f: { location: '', provider: '', payer: '', source: '' } })
    const all = DB.visits.filter(S.inScopeVisit)
    const count = (st) => all.filter((x) => st.includes(x.status)).length
    const updates = DB.updates.filter((u) => u.practiceId === S.session.practiceId && u.status === 'Open')
    const tabs = CH_TABS.map((t) => ({ key: t.key, label: t.label, count: t.key === 'updated' ? updates.length : t.key === 'inactive' ? count(t.status) + DB.updates.filter((u) => u.practiceId === S.session.practiceId && u.status === 'Inactivated').length : count(t.status), alert: t.key === 'updated', demo: `tab-${t.key}` }))
    const canSim = S.can('CHARGES', 'c') || S.can('INTEGRATION', 'c')
    const actions = `${S.can('CHARGES', 'c') ? UI.btn({ label: 'New charge', icon: 'plus', variant: 'primary', act: 'go', data: { hash: '#/charges/new' } }) : ''}`
    let body
    if (tab === 'updated') body = Ch.updatedTab(updates, v)
    else if (tab === 'inactive') body = Ch.inactiveTab(all, v)
    else body = Ch.visitTab(tab, all, v)
    const blurb = {
      review: 'Sessions and charges from finalized EMR notes or manual entry. Check them, then release them for claiming.',
      pended: 'Something is missing — most often an authorization the payer requires. Fixing the source releases them automatically.',
      delayed: 'The rendering provider is on claim hold (for example while credentialing is pending). They wait here instead of going out on claims.',
      ready: 'The ingestion queue: released charges ready for validation. Submit one, several, or let the scheduled job take them.',
      updated: 'Re-sent EMR notes whose Internal Record ID matches a claim that is already submitted. Choose what happens to each.',
      inactive: 'Superseded records and archived updates. Read-only, kept for history.',
    }[tab]
    return `<div class="screen"><div class="page-x screen-head"><div><h1 class="screen-title">Charges</h1><p class="screen-sub">${U.esc(S.practice().name)} · ${U.esc(S.locationScopeLabel())}${S.level('CHARGES') === 'view' ? ' · ' + UI.chip('inert', 'View only') : ''}</p></div><div class="screen-actions">${actions}</div></div>
      <div class="page-x">${UI.tabs(tabs, tab, 'ch.tab')}<p class="t-micro muted-2" style="margin:14px 0 12px">${blurb}</p>${body}</div></div>`
  },
}
ACT['ch.tab'] = (el) => R.go(`#/charges/${el.dataset.key}`)
ACT['ch.search'] = U.debounce((el) => {
  const v = S.view(el.dataset.view, {})
  v.q = el.value
  v.page = 1
  R.refresh()
}, 220)
ACT['ch.filters'] = (el) => {
  const key = el.dataset.view
  const v = S.view(key, {})
  UI.drawer({
    title: 'Filter charges',
    desc: 'Filters apply when you press Search.',
    body: UI.form(
      [
        { name: 'location', label: 'Location', type: 'select', options: S.locationsOfPractice().filter((l) => S.locAllowed(l.id)).map((l) => ({ value: l.id, label: l.name })), placeholder: 'All locations' },
        { name: 'provider', label: 'Rendering provider', type: 'select', options: DB.providers.filter((p) => p.practiceId === S.session.practiceId).map((p) => ({ value: p.id, label: S.provName(p) })), placeholder: 'Any provider' },
        { name: 'payer', label: 'Primary insurance', type: 'select', options: U.uniq(DB.insurances.filter((i) => i.practiceId === S.session.practiceId).map((i) => i.name)), placeholder: 'Any insurance' },
        { name: 'source', label: 'Source', type: 'select', options: ['EMR', 'Manual'], placeholder: 'EMR or manual' },
      ],
      v.f,
    ),
    foot: UI.btn({ label: 'Cancel', variant: 'quiet', act: 'layer.close' }) + UI.btn({ label: 'Search', icon: 'search', variant: 'primary', act: 'ch.filtersApply', data: { view: key } }),
  })
}
ACT['ch.filtersApply'] = (el) => {
  const v = S.view(el.dataset.view, {})
  v.f = UI.readValues(UI.formOf(el.closest('.drawer')))
  v.page = 1
  UI.closeTop()
  R.refresh()
}
ACT['ch.filtersClear'] = (el) => {
  S.view(el.dataset.view, {}).f = { location: '', provider: '', payer: '', source: '' }
  R.refresh()
}

Ch.visitTab = (tab, all, v) => {
  const def = CH_TABS.find((t) => t.key === tab)
  const viewKey = `charges-${tab}`
  let rows = Ch.applyFilters(all.filter((x) => def.status.includes(x.status)).map(Ch.visitRow), v)
  v.sel = (v.sel || []).filter((id) => rows.some((r) => r.id === id))
  const cols = [
    { key: 'name', label: 'Patient', sort: true, render: (r) => `<span class="ink fw-500 t-meta">${U.esc(r.name)}</span><span class="sub">${U.esc(r.c.name)}</span>` },
    { key: 'dos', label: 'DOS', sort: true, render: (r) => U.date(r.dos) },
    { key: 'loc', label: 'Location', sort: true, render: (r) => U.esc(r.loc) },
    { key: 'prov', label: 'Rendering provider', sort: true, render: (r) => U.esc(r.prov) },
    { key: 'payer', label: 'Primary insurance', sort: true, render: (r) => U.esc(r.payer) },
    { key: 'codes', label: 'Codes', render: (r) => `<span class="nowrap">${U.esc(r.codes)}</span>` },
    { key: 'amount', label: 'Amount', sort: true, cls: 'r', render: (r) => `<span class="ink num">${U.money(r.amount)}</span>` },
  ]
  if (tab === 'review') cols.push({ key: 'source', label: 'Source', sort: true, render: (r) => UI.tag(r.source, r.source === 'EMR' ? 'brand' : '') })
  if (tab === 'pended') cols.push({ key: 'reason', label: 'Pend reason', render: (r) => `<span class="status warning">${U.esc(r.v.pendReason)}</span>` }, { key: 'act', label: '', cls: 'r', render: (r) => (S.can('CHARGES', 'u') ? UI.btn({ label: 'Re-check', size: 'sm', act: 'ch.recheck', data: { id: r.id } }) : '') })
  if (tab === 'delayed') cols.push({ key: 'reason', label: 'Provider hold', render: (r) => `<span class="status attention">${U.esc(r.v.delayReason)}</span>` })
  if (tab === 'ready') cols.push({ key: 'act', label: '', cls: 'r', render: (r) => (S.can('BILLING', 'c') ? UI.btn({ label: 'Submit', size: 'sm', act: 'ch.submitOne', data: { id: r.id } }) : '') })
  const selectable = (tab === 'review' && S.can('CHARGES', 'u')) || (tab === 'ready' && S.can('BILLING', 'c'))
  const n = Ch.filtersCount(v.f)
  const controls = `<div class="control-line">${UI.qsearch(`${viewKey}-q`, v.q, 'Search by patient…', 'ch.search').replace('data-input="ch.search"', `data-input="ch.search" data-view="${viewKey}"`)}${UI.filtersBtn(n, 'ch.filters', 'ch.filtersClear', { view: viewKey })}
    <div class="ml-auto row-wrap">${tab === 'review' && S.can('CHARGES', 'u') ? UI.btn({ label: v.sel.length ? `Release ${v.sel.length} selected` : 'Release selected', icon: 'check', variant: 'primary', act: 'ch.releaseSel', disabled: !v.sel.length, demo: 'release-sel' }) : ''}
    ${tab === 'ready' && S.can('BILLING', 'c') ? UI.btn({ label: v.sel.length ? `Submit ${v.sel.length} selected` : 'Submit selected', icon: 'send', variant: 'primary', act: 'ch.submitSel', disabled: !v.sel.length, demo: 'submit-sel' }) : ''}</div></div>`
  const scheduleNote = tab === 'ready' ? `<div class="mt-12">${UI.notice('info', 'Scheduled submission:', `${Ch.scheduleLabel()}. Last run ${DB.settings.lastScheduledRun ? U.stampLabel(DB.settings.lastScheduledRun, DB.today) : 'never'}. ${S.can('ADMIN', 'u') ? '<a href="#/admin/automation">Change the interval</a>' : ''}`, 'clock')}</div>` : ''
  const emptyText = {
    review: 'Nothing waiting for review. Sessions arrive from integrated EMR locations, or enter one with “New charge”.',
    pended: 'No pended visits.',
    delayed: 'No visits are delayed by a provider hold.',
    ready: 'Nothing is ready to submit. Release visits from Charge review first.',
  }[tab]
  return `${controls}${scheduleNote}${UI.table({ cols, rows, view: v, viewKey, rowAct: 'visit.open', selectable, noun: 'visit', mark: (r) => (tab === 'pended' ? 'warning' : tab === 'delayed' ? 'attention' : null), empty: v.q || n ? UI.empty({ icon: 'search', title: 'No visits match', text: 'Clear the search or filters to see everything.' }) : UI.empty({ icon: 'inbox', title: 'All clear', text: emptyText }) })}`
}
Ch.scheduleLabel = () => ({ off: 'Off — submit manually', hourly: 'Every hour', '4h': 'Every 4 hours', 'daily-18': 'Every day at 18:00' }[DB.settings.schedule])

Ch.updatedTab = (updates, v) => {
  const rows = updates.map((u) => {
    const visit = S.find('visits', u.visitId)
    const claim = S.find('claims', u.claimId)
    const p = S.patientOfVisit(visit)
    return { id: u.id, u, visit, claim, p, name: S.pname(p), dos: visit.dos, received: u.receivedAt }
  })
  return UI.table({
    cols: [
      { key: 'name', label: 'Patient', sort: true, render: (r) => `<span class="ink fw-500 t-meta">${U.esc(r.name)}</span><span class="sub">Record ${U.esc(r.visit.recordId)}</span>` },
      { key: 'dos', label: 'DOS', sort: true, render: (r) => U.date(r.dos) },
      { key: 'claim', label: 'Submitted claim', render: (r) => `<a href="#/claims/view/${r.claim.id}">${r.claim.number}</a> ${UI.claimChip(r.claim)}` },
      { key: 'change', label: 'What changed', render: (r) => U.esc(Ch.diffSummary(r.u)) },
      { key: 'received', label: 'Received', sort: true, render: (r) => U.stampLabel(r.received, DB.today) },
      { key: 'owner', label: 'Owner', render: (r) => UI.ownerCell(r.u.wi) },
      { key: 'act', label: '', cls: 'r', render: (r) => (S.can('CHARGES', 'u') ? UI.btn({ label: 'Review update', size: 'sm', act: 'up.review', data: { id: r.id }, demo: 'up-review' }) : '') },
    ],
    rows, view: v, viewKey: 'charges-updated', noun: 'update', rowAct: 'up.review', mark: () => 'attention',
    empty: UI.empty({ icon: 'refresh', title: 'No updated notes', text: 'When the EMR re-sends a note for a claim that was already submitted, it lands here instead of overwriting the claim.' }),
  })
}
Ch.diffSummary = (u) => {
  const claim = S.find('claims', u.claimId)
  const before = Object.fromEntries((claim.snapshot || E.snapshot(claim)).map((l) => [l.code, l.units]))
  const after = Object.fromEntries(u.payload.lines.map((l) => [E.pc(l.procedureCodeId).code, l.units]))
  const out = []
  Object.keys(after).forEach((c) => {
    if (!(c in before)) out.push(`${c}×${after[c]} added`)
    else if (before[c] !== after[c]) out.push(`${c} units ${before[c]} → ${after[c]}`)
  })
  Object.keys(before).forEach((c) => {
    if (!(c in after)) out.push(`${c} removed`)
  })
  return out.join(' · ') || 'No line changes'
}

Ch.inactiveTab = (all, v) => {
  const rows = [
    ...all.filter((x) => x.status === 'Inactive').map((x) => ({ id: x.id, kind: 'Superseded record', row: Ch.visitRow(x), when: x.inactiveOn, reason: x.inactiveReason, link: x.supersededBy ? `<a href="#/charges/visit/${x.supersededBy}">Replacement visit</a>` : '' })),
    ...DB.updates.filter((u) => u.practiceId === S.session.practiceId && u.status === 'Inactivated').map((u) => ({ id: u.id, kind: 'Archived update', row: Ch.visitRow(S.find('visits', u.visitId)), when: u.resolvedOn, reason: 'Incoming update inactivated — existing claim kept', link: `<a href="#/claims/view/${u.claimId}">Claim kept</a>` })),
  ].map((r) => ({ ...r, name: r.row.name, dos: r.row.dos }))
  return UI.table({
    cols: [
      { key: 'name', label: 'Patient', sort: true, render: (r) => `<span class="ink fw-500 t-meta">${U.esc(r.name)}</span><span class="sub">Record ${U.esc(r.row.v.recordId)}</span>` },
      { key: 'dos', label: 'DOS', sort: true, render: (r) => U.date(r.dos) },
      { key: 'kind', label: 'Type', render: (r) => UI.tag(r.kind) },
      { key: 'reason', label: 'Why inactive', render: (r) => U.esc(r.reason) },
      { key: 'when', label: 'Inactivated', sort: true, render: (r) => U.date(r.when) },
      { key: 'link', label: '', render: (r) => r.link },
    ],
    rows, view: v, viewKey: 'charges-inactive', noun: 'record', rowAct: 'visit.openInactive',
    empty: UI.empty({ icon: 'history', title: 'No inactive records' }),
  })
}
ACT['visit.openInactive'] = (el) => {
  const vis = S.find('visits', el.dataset.id)
  if (vis) R.go(`#/charges/visit/${vis.id}`)
  else {
    const u = S.find('updates', el.dataset.id)
    if (u) R.go(`#/claims/view/${u.claimId}`)
  }
}

// ---- actions on queues
ACT['ch.recheck'] = (el) => {
  const v = S.find('visits', el.dataset.id)
  const st = E.returnToReview(v)
  UI.toast(st === 'Review' ? 'success' : 'warning', st === 'Review' ? 'Visit moved to Charge review' : `Still ${st.toLowerCase()}`, st === 'Review' ? '' : U.esc(v.pendReason || v.delayReason || ''))
  R.refresh()
}
ACT['ch.releaseSel'] = async () => {
  const v = S.view('charges-review', {})
  const ids = [...v.sel]
  if (!ids.length) return
  const ok = await UI.confirm({ title: `Release ${U.plural(ids.length, 'visit')} for claiming?`, message: 'They move to Ready to submit — the ingestion queue — where they are submitted to scrubbing.', confirmLabel: `Release ${ids.length}` })
  if (!ok) return
  ids.forEach((id) => E.release(S.find('visits', id)))
  v.sel = []
  UI.toast('success', `${U.plural(ids.length, 'visit')} released`, 'Next: submit them from Ready to submit.')
  R.go('#/charges/ready')
}
ACT['ch.submitOne'] = (el) => Scrub.run([el.dataset.id], 'Single')
ACT['ch.submitSel'] = () => {
  const v = S.view('charges-ready', {})
  if (!v.sel.length) return
  Scrub.run([...v.sel], v.sel.length > 1 ? 'Bulk' : 'Single')
  v.sel = []
}
ACT['ch.runScheduled'] = async () => {
  const ids = DB.visits.filter((x) => x.status === 'Released' && S.inScopeVisit(x)).map((x) => x.id)
  if (!ids.length) {
    UI.toast('info', 'Nothing to submit', 'The scheduled job found no released charges.')
    return
  }
  DB.settings.lastScheduledRun = S.now()
  Scrub.run(ids, 'Scheduled')
}

// ================================================================ scrubbing run
const Scrub = {
  run(visitIds, mode) {
    const { run, results } = E.submit(visitIds, mode)
    if (!results.length) {
      UI.toast('warning', 'Nothing was submitted', 'The selected visits are no longer ready to submit.')
      R.refresh()
      return
    }
    Scrub.show(results, `${mode} submission`, run)
    R.refresh()
  },
  show(claims, title, run) {
    const checkKeys = ['rules', ...E.HOLD_ORDER]
    const body = `<p class="t-micro muted-2 mb-16">Each claim runs through the coding rules engine and the scrubbing validation matrix. The first failing check decides the hold queue.</p>
      ${claims
        .map((c) => {
          const v = S.visitOf(c)
          const p = S.patientOfVisit(v)
          const ins = E.insOf(S.find('coverages', c.coverageId))
          return `<div class="card mb-16" data-scrub="${c.id}"><div class="card-head"><div class="grow"><div class="card-title">${U.esc(S.pfull(p))} · ${U.date(v.dos)}</div><div class="t-micro muted">${c.number} · ${U.esc(ins.name)} · ${U.money(c.total)}</div></div><span class="scrub-outcome">${UI.chip('info', 'Scrubbing…')}</span></div>
            <div class="card-body" style="padding-top:2px;padding-bottom:2px"><ul class="checks">${checkKeys
              .map((k) => {
                const r = c.scrub.results.find((x) => x.key === k)
                return `<li data-check="${k}" data-final="${r.status}"><span class="ck run"><span class="spinner" style="width:12px;height:12px;border-width:2px"></span></span><div class="grow"><div class="c-name">${U.esc(r.name)}</div><div class="c-detail" hidden>${U.esc(r.detail)}</div></div><span class="c-src">${U.esc(r.source)}</span></li>`
              })
              .join('')}</ul></div></div>`
        })
        .join('')}<div class="scrub-summary"></div>`
    const h = UI.modal({ title, desc: run ? `Batch ${run.ref} · ${run.by}` : '', size: 'lg', body, foot: `<span class="foot-left scrub-status">Scrubbing ${U.plural(claims.length, 'claim')}…</span>${UI.btn({ label: 'Done', variant: 'primary', act: 'layer.close' })}` })
    // Reveal the (already computed) results one check at a time
    const items = Array.from(h.el.querySelectorAll('.checks li'))
    let i = 0
    const ICON = { pass: 'check', fail: 'x', skip: 'more' }
    const tick = () => {
      if (h.closed) return
      const li = items[i]
      if (li) {
        const st = li.dataset.final
        li.querySelector('.ck').className = `ck ${st}`
        li.querySelector('.ck').innerHTML = I(ICON[st])
        li.querySelector('.c-detail').hidden = false
        const card = li.closest('[data-scrub]')
        const last = !li.nextElementSibling
        if (last || st === 'fail') {
          const c = S.find('claims', card.dataset.scrub)
          if (st === 'fail') Array.from(card.querySelectorAll('li')).forEach((x) => {
            if (x.querySelector('.ck.run')) {
              const s2 = x.dataset.final
              x.querySelector('.ck').className = `ck ${s2}`
              x.querySelector('.ck').innerHTML = I(ICON[s2])
              x.querySelector('.c-detail').hidden = false
            }
          })
          card.querySelector('.scrub-outcome').innerHTML = c.status === 'Hold' ? UI.chip('critical', `On hold — ${E.HOLDS[c.holdReason].label}`) : UI.chip('success', `Submitted to Waystar · ${c.format === 'CMS1500' ? 'CMS-1500 print queue' : 'EDI 837P'}`)
          i = items.indexOf(card.querySelector('li:last-child'))
        }
        i += 1
        setTimeout(tick, 110)
      } else {
        const sent = claims.filter((c) => c.status === 'Submitted')
        const held = claims.filter((c) => c.status === 'Hold')
        h.el.querySelector('.scrub-status').textContent = `${sent.length} submitted · ${held.length} on hold`
        h.el.querySelector('.scrub-summary').innerHTML = `${UI.notice(held.length ? 'warning' : 'success', held.length ? `${U.plural(held.length, 'claim')} on hold.` : 'All claims submitted.', `${sent.length ? `${U.plural(sent.length, 'claim')} went to Waystar and now appear under Claims → Submitted and in today’s batch metrics.` : ''} ${held.length ? 'Held claims are auto-resubmitted as soon as the hold reason is fixed.' : ''}`, held.length ? 'alert' : 'circleCheck')}<div class="row-wrap mt-12">${held.length ? UI.btn({ label: 'Open held claims', icon: 'alert', act: 'go', data: { hash: '#/claims/holds' } }) : ''}${sent.length ? UI.btn({ label: 'Open submitted claims', icon: 'send', act: 'go', data: { hash: '#/claims/submitted' } }) : ''}${UI.btn({ label: 'Today’s batch', icon: 'chart', act: 'go', data: { hash: '#/claims/batches' } })}</div>`
      }
    }
    setTimeout(tick, 250)
  },
}

// ================================================================ updated charges (§5.2)
ACT['up.review'] = (el) => {
  const u = S.find('updates', el.dataset.id)
  const claim = S.find('claims', u.claimId)
  const visit = S.find('visits', u.visitId)
  const p = S.patientOfVisit(visit)
  const before = claim.snapshot || E.snapshot(claim)
  const beforeMap = Object.fromEntries(before.map((l) => [l.code, l.units]))
  const afterLines = u.payload.lines.map((l) => ({ code: E.pc(l.procedureCodeId).code, units: l.units, amount: E.price(l.procedureCodeId, l.units, E.insOf(S.find('coverages', claim.coverageId)).id, visit.dos).amount }))
  const afterMap = Object.fromEntries(afterLines.map((l) => [l.code, l.units]))
  const col = (title, lines, other) => `<div class="d-col"><div class="eyebrow">${title}</div>${lines.map((l) => `<div class="d-line ${other[l.code] !== l.units ? 'changed' : ''}"><span><span class="code">${l.code}</span> × ${l.units}</span><span class="num">${U.money(l.amount)}</span></div>`).join('')}<div class="d-line"><span class="fw-500 ink">Total</span><span class="num fw-500 ink">${U.money(U.sum(lines, (l) => l.amount))}</span></div></div>`
  const h = UI.modal({
    title: 'Review updated note',
    desc: `${U.esc(S.pfull(p))} · DOS ${U.date(visit.dos)} · Record ${U.esc(visit.recordId)} matches claim ${claim.number}, which is ${claim.status.toLowerCase()}. The update was not applied automatically.`,
    size: 'lg',
    body: `<div class="diff">${col(`Submitted claim ${claim.number}`, before, afterMap)}${col('Incoming EMR note', afterLines, beforeMap)}</div>
      <div class="section-title mt-24 mb-8">Choose what happens</div>
      ${UI.form(
        [
          { name: 'action', type: 'radio', required: true, options: [
            { value: 'inactivate', label: '1 · Inactivate', desc: 'Archive the incoming update and keep the existing claim as it is.' },
            { value: 'corrected', label: '2 · Create corrected claim', desc: `Box 22 is pre-filled with the original reference (${claim.payerIcn || claim.clearinghouseRef}) and a resubmission frequency code.` },
            { value: 'anyway', label: '3 · Submit anyway', desc: 'Override the update logic and force-submit the note as a fresh claim. The payer may treat it as a duplicate.' },
          ] },
          { name: 'freq', label: 'Resubmission frequency code (Box 22)', type: 'select', placeholder: false, options: [{ value: '7', label: '7 — Replacement of prior claim' }, { value: '8', label: '8 — Void / cancel prior claim' }], requiredIf: (v) => v.action === 'corrected', span: 6 },
        ],
        { freq: '7' },
      )}`,
    foot: UI.btn({ label: 'Cancel', variant: 'quiet', act: 'layer.close' }) + UI.btn({ label: 'Apply decision', variant: 'primary', act: 'up.apply' }),
  })
  h.el.dataset.id = u.id
}
ACT['up.apply'] = async (el) => {
  const layer = el.closest('.layer')
  const vals = UI.submitForm(UI.formOf(layer))
  if (!vals) return
  const u = S.find('updates', layer.dataset.id)
  if (vals.action === 'anyway') {
    const ok = await UI.confirm({ title: 'Submit as a fresh claim?', message: 'A second claim goes to the payer for the same date of service.', confirmLabel: 'Submit anyway' })
    if (!ok) return
  }
  UI.closeAll()
  const res = E.resolveUpdate(u, vals.action, vals.freq)
  if (vals.action === 'inactivate') UI.toast('success', 'Update inactivated', 'The existing claim is unchanged; the update is archived under Inactive records.')
  else if (res) Scrub.show([res], vals.action === 'corrected' ? (vals.freq === '8' ? 'Void claim (frequency 8)' : 'Corrected claim (frequency 7)') : 'Submitted as a fresh claim', null)
  R.refresh()
}

// ================================================================ visit detail
const VisitDetail = {
  render(id) {
    const v = S.find('visits', id)
    if (!v || !S.inScopeVisit(v)) return `<div class="screen"><div class="page-x screen-head"><h1 class="screen-title">Visit not found</h1></div><div class="page-x">${UI.empty({ title: 'This visit is not in the current practice', action: UI.btn({ label: 'Back to charges', act: 'go', data: { hash: '#/charges' } }) })}</div></div>`
    const c = S.caseOf(v)
    const p = S.patientOf(c)
    const ins = E.primaryIns(c.id)
    const editable = ['Review', 'Pended', 'Exception', 'Delayed'].includes(v.status) && S.can('CHARGES', 'u')
    const d = S.view(`vd-${v.id}`, { draft: null })
    if (!d.draft || !editable) d.draft = E.linesOfVisit(v.id).map((l) => ({ id: l.id, procedureCodeId: l.procedureCodeId, units: l.units, modifiers: l.modifiers.join(','), pointers: l.pointers.join(','), pos: l.pos, notes: l.notes || '' }))
    const claims = E.claimsOfVisit(v.id)
    const back = { Review: 'review', Pended: 'pended', Delayed: 'delayed', Released: 'ready', Inactive: 'inactive' }[v.status] || 'review'
    const auth = E.authUsable(v)
    const exs = DB.exceptions.filter((x) => x.visitId === v.id && x.status === 'Open')
    const notices = []
    if (v.status === 'Pended') notices.push(UI.notice('warning', 'Pended:', `${U.esc(v.pendReason)}.${v.pendReason === 'No authorization available' ? ` <a href="#/patients/${p.id}/authorizations?case=${c.id}">Add an authorization on the case</a> — the visit returns to review automatically.` : ''}`, 'flag'))
    if (v.status === 'Delayed') notices.push(UI.notice('sand', 'Delayed:', `${U.esc(v.delayReason)}. It is released automatically when the hold ends or is cleared${S.can('ADMIN', 'r') ? ` in <a href="#/admin/providers">Admin → Providers</a>` : ''}.`, 'pause'))
    if (v.status === 'Exception') notices.push(UI.notice('critical', 'Billing exception:', exs.map((x) => `${U.esc(x.level)} — ${U.esc(x.trigger)}: ${U.esc(x.detail)}`).join(' ') + ' <a href="#/exceptions">Resolve in Exceptions</a>', 'alert'))
    if (v.status === 'Incomplete') notices.push(UI.notice('critical', 'Quarantined:', `${U.esc(v.incompleteReason)}. <a href="#/exceptions/incomplete">Complete the profile</a> to release it.`, 'alert'))
    if (v.status === 'Inactive') notices.push(UI.notice('info', 'Inactive record:', `${U.esc(v.inactiveReason)} on ${U.date(v.inactiveOn)}.${v.supersededBy ? ` <a href="#/charges/visit/${v.supersededBy}">Open the replacement</a>.` : ''}`, 'history'))
    if (v.replaces) notices.push(UI.notice('info', 'Replacement record:', `This version replaced an earlier note with the same Internal Record ID. <a href="#/charges/visit/${v.replaces}">See the superseded record</a>.`, 'refresh'))
    let actions = ''
    if (v.status === 'Review' && S.can('CHARGES', 'u')) actions = UI.btn({ label: 'Pend', icon: 'pause', act: 'vd.pend', data: { id: v.id } }) + UI.btn({ label: 'Release for claiming', icon: 'check', variant: 'primary', act: 'vd.release', data: { id: v.id }, demo: 'vd-release' })
    if (['Pended', 'Delayed', 'Exception', 'Incomplete'].includes(v.status) && S.can('CHARGES', 'u')) actions = UI.btn({ label: v.manualPend ? 'Return to review' : 'Re-check now', icon: 'refresh', act: 'ch.recheck', data: { id: v.id } })
    if (v.status === 'Released') actions = (S.can('CHARGES', 'u') ? UI.btn({ label: 'Move back to review', act: 'vd.unrelease', data: { id: v.id } }) : '') + (S.can('BILLING', 'c') ? UI.btn({ label: 'Submit claim', icon: 'send', variant: 'primary', act: 'ch.submitOne', data: { id: v.id } }) : '')
    if (S.can('CHARGES', 'd') && !['Billed', 'Inactive'].includes(v.status)) actions += UI.iconBtn({ icon: 'trash', label: 'Delete visit', act: 'vd.delete', data: { id: v.id }, danger: true })
    // "Inactive codes cannot be added to new charge lines" (PRD V2 §10.3) — a line that already has one keeps it.
    const codeOptsFor = (l) => DB.procedureCodes.filter((x) => x.isActive || (l.id && x.id === l.procedureCodeId))
    const posLabel = (val) => (POS_OPTIONS.find((o) => o.value === val) || { label: val || '—' }).label
    const lineRows = d.draft
      .map((l, i) => {
        const pr = E.price(l.procedureCodeId, Number(l.units) || 0, ins ? ins.id : null, v.dos)
        const code = E.pc(l.procedureCodeId)
        if (!editable) return `<tr><td><span class="code">${code.code}</span> <span class="muted-2">${U.esc(code.description)}</span>${l.notes ? `<span class="sub">Note: ${U.esc(l.notes)}</span>` : ''}</td><td class="r">${l.units}</td><td>${U.esc(l.modifiers)}</td><td>${U.esc(l.pointers)}</td><td><span class="t-micro">${U.esc(posLabel(l.pos))}</span></td><td class="r num ink">${U.money(pr.amount)}</td><td><span class="t-micro muted">${pr.source === 'payer' ? `${U.esc(ins.name)} schedule ${U.money(pr.rate)} × ${l.units}` : `Default fee ${U.money(pr.rate)} × ${l.units}`}</span></td></tr>`
        return `<tr><td><select class="mini-select" style="max-width:260px" data-change="vd.line" data-id="${v.id}" data-i="${i}" data-f="procedureCodeId" aria-label="Procedure code">${codeOptsFor(l).map((o) => `<option value="${o.id}" ${o.id === l.procedureCodeId ? 'selected' : ''}>${o.code} — ${U.esc(o.description)}${o.isActive ? '' : ' (inactive)'}</option>`).join('')}</select><input class="mini-input mt-4" style="width:260px;display:block" value="${U.esc(l.notes || '')}" data-change="vd.line" data-id="${v.id}" data-i="${i}" data-f="notes" aria-label="Internal line note" placeholder="Internal note (optional)"></td>
          <td class="r"><input class="mini-input" type="number" min="1" max="12" value="${U.esc(l.units)}" data-change="vd.line" data-id="${v.id}" data-i="${i}" data-f="units" aria-label="Units"></td>
          <td><input class="mini-input" style="width:84px" value="${U.esc(l.modifiers)}" data-change="vd.line" data-id="${v.id}" data-i="${i}" data-f="modifiers" aria-label="Modifiers" placeholder="GP"></td>
          <td><input class="mini-input" style="width:84px" value="${U.esc(l.pointers)}" data-change="vd.line" data-id="${v.id}" data-i="${i}" data-f="pointers" aria-label="Diagnosis pointers" placeholder="1,2"></td>
          <td><select class="mini-select" style="max-width:150px" data-change="vd.line" data-id="${v.id}" data-i="${i}" data-f="pos" aria-label="Place of service">${POS_OPTIONS.map((o) => `<option value="${o.value}" ${o.value === l.pos ? 'selected' : ''}>${U.esc(o.label)}</option>`).join('')}</select></td>
          <td class="r num ink">${U.money(pr.amount)}</td><td><span class="t-micro muted">${pr.source === 'payer' ? `${U.esc(ins.name)} ${U.money(pr.rate)}/unit` : `Default fee ${U.money(pr.rate)}/unit`}</span></td>
          <td class="r">${UI.iconBtn({ icon: 'trash', label: 'Remove line', act: 'vd.removeLine', data: { id: v.id, i }, danger: true, disabled: d.draft.length === 1 })}</td></tr>`
      })
      .join('')
    const total = U.sum(d.draft, (l) => E.price(l.procedureCodeId, Number(l.units) || 0, ins ? ins.id : null, v.dos).amount)
    const locs = S.locationsOfPractice().filter((l) => l.isActive)
    const provs = DB.providers.filter((x) => x.practiceId === p.practiceId && x.isActive)
    const sel = (name, opts, value) => `<div class="control ${editable ? '' : 'disabled'}"><select data-change="vd.field" data-id="${v.id}" data-f="${name}" ${editable ? '' : 'disabled'} aria-label="${name}">${opts.map((o) => `<option value="${o.value}" ${o.value === value ? 'selected' : ''}>${U.esc(o.label)}</option>`).join('')}</select><span class="chev">${I('chevronDown', 'icon-14')}</span></div>`
    return `<div class="screen"><div class="page-x screen-head"><div class="grow"><a class="back-link" href="#/charges/${back}">${I('arrowLeft', 'icon-14')} Charges</a><h1 class="screen-title">${U.esc(S.pfull(p))} <span style="font-weight:400;color:var(--n500)">· ${U.date(v.dos)}</span></h1>
        <p class="screen-sub row-wrap">${UI.visitChip(v)} <span>${U.esc(c.name)}</span><span class="muted">·</span><span>${v.source === 'EMR' ? 'From EMR' : 'Manual entry'}</span><span class="muted">·</span><span>Record ${U.esc(v.recordId)}</span><span class="muted">·</span><a href="#/patients/${p.id}/visits?case=${c.id}">Open chart</a></p></div><div class="screen-actions">${actions}</div></div>
      <div class="page-x screen-body">${notices.join('<div class="mt-8"></div>')}
        <div class="grid-2 grid-2-1 section"><div>
          ${UI.sectionHead('Charge lines', `Priced from ${ins ? U.esc(ins.name) : 'the default'} fee schedule, falling back to the default fee`, editable ? UI.btn({ label: 'Add line', icon: 'plus', size: 'sm', act: 'vd.addLine', data: { id: v.id } }) + UI.btn({ label: 'Save changes', size: 'sm', act: 'vd.save', data: { id: v.id } }) : '')}
          <div class="tbl-wrap scroll-x"><table class="tbl"><thead><tr><th>Code</th><th class="r">Units</th><th>Modifiers</th><th>Dx pointers</th><th>POS (24B)</th><th class="r">Amount</th><th>Price</th>${editable ? '<th></th>' : ''}</tr></thead><tbody>${lineRows}</tbody><tfoot><tr><td colspan="5">Visit total</td><td class="r num">${U.money(total)}</td><td colspan="${editable ? 2 : 1}"></td></tr></tfoot></table></div>
          <div class="section">${UI.sectionHead('Diagnosis snapshot', 'Copied from the case at arrival', editable ? UI.btn({ label: 'Refresh from case', size: 'sm', act: 'vd.refreshDx', data: { id: v.id } }) : '')}<ul class="dx-list">${v.dx.map((code, i) => `<li><span class="dx-ptr">${i + 1}</span><span class="code">${U.esc(code)}</span><span class="muted-2 t-micro">${U.esc(E.dxLabel(code))}</span></li>`).join('') || '<li class="muted t-micro">No diagnoses on the case.</li>'}</ul></div>
          <div class="section">${UI.sectionHead('Visit details', 'Location and providers are set on the visit, from the EMR payload or manual entry')}
            <div class="form-grid mt-12"><div class="field span-6"><span class="field-label">Location</span>${sel('locationId', locs.map((l) => ({ value: l.id, label: `${l.name} · default POS ${l.pos}` })), v.locationId)}</div>
            <div class="field span-6"><span class="field-label">Billing provider</span>${sel('billingProviderId', provs.map((x) => ({ value: x.id, label: S.provName(x) })), v.billingProviderId)}</div>
            <div class="field span-6"><span class="field-label">Rendering provider</span>${sel('treatingProviderId', provs.map((x) => ({ value: x.id, label: S.provName(x) + (x.draft ? ' (draft)' : '') })), v.treatingProviderId)}</div></div>
            <div class="t-micro muted mt-8">Place of service is set on each charge line and defaults from the location.</div></div>
          ${claims.length ? `<div class="section">${UI.sectionHead('Claims for this visit')}${claims.map((cl) => `<div class="row" style="padding:10px 0;border-bottom:1px solid var(--rule-row)"><a href="#/claims/view/${cl.id}" class="fw-500">${cl.number}</a>${UI.claimChip(cl)}<span class="muted t-micro">${U.esc(E.insOf(S.find('coverages', cl.coverageId)).name)} · ${{ 1: 'primary', 2: 'secondary', 3: 'tertiary' }[cl.rank]}${cl.frequency !== '1' ? ` · frequency ${cl.frequency}` : ''}</span><span class="ml-auto num ink">${U.money(cl.total)}</span></div>`).join('')}</div>` : ''}
        </div><div class="stack gap-16">
          <div class="card"><div class="card-head"><span class="card-title">Coverage & authorization</span></div><div class="card-body" style="padding-top:4px">${UI.kv([
            ['Primary insurance', ins ? S.insLabel(ins) : 'None'],
            ['Authorization', ins && E.eff(ins, 'authRequired') ? (auth ? `${auth.number} · ${E.authRemaining(auth)} of ${auth.qty} left` : 'None available') : 'Not required'],
            ['Referring physician', S.find('referrers', c.referrerId)?.name || ''],
            ['Insurance hold', ins && ins.insuranceHold ? `Yes — claims wait in ${U.esc((S.find('releaseBuckets', ins.releaseBucketId) || {}).name || 'a release bucket')}` : 'No'],
          ])}</div></div>
          ${UI.workItemView(v.wi || S.workItem(), 'visit', v.id, 'CHARGES', UI.VISIT_LABEL[v.status])}
          <div class="card"><div class="card-head"><span class="card-title">History</span></div><div class="card-body">${UI.historyView('visit', v.id, claims.map((cl) => ['claim', cl.id]))}</div></div>
        </div></div></div></div>`
  },
}
const vdDraft = (id) => S.view(`vd-${id}`, { draft: null })
ACT['vd.line'] = (el) => {
  const d = vdDraft(el.dataset.id)
  d.draft[Number(el.dataset.i)][el.dataset.f] = el.value
  if (el.dataset.f === 'procedureCodeId') {
    const code = E.pc(el.value)
    d.draft[Number(el.dataset.i)].modifiers = code.defaultModifier || ''
  }
  R.refresh()
}
ACT['vd.addLine'] = (el) => {
  const v = S.find('visits', el.dataset.id)
  const firstCode = DB.procedureCodes.find((x) => x.isActive && x.id === 'pc97110') || DB.procedureCodes.find((x) => x.isActive) || { id: '' }
  vdDraft(el.dataset.id).draft.push({ id: null, procedureCodeId: firstCode.id, units: 1, modifiers: 'GP', pointers: '1', pos: (S.find('locations', v.locationId) || {}).pos || '11', notes: '' })
  R.refresh()
}
ACT['vd.removeLine'] = (el) => {
  vdDraft(el.dataset.id).draft.splice(Number(el.dataset.i), 1)
  R.refresh()
}
ACT['vd.save'] = (el) => {
  const v = S.find('visits', el.dataset.id)
  const d = vdDraft(v.id)
  const errs = []
  d.draft.forEach((l, i) => {
    const units = Number(l.units)
    if (!Number.isInteger(units) || units < 1) errs.push(`Line ${i + 1}: units must be a whole number of 1 or more.`)
    const ptrs = String(l.pointers).split(',').map((x) => x.trim()).filter(Boolean).map(Number)
    if (!ptrs.length || ptrs.length > 4 || ptrs.some((x) => !Number.isInteger(x) || x < 1 || x > v.dx.length)) errs.push(`Line ${i + 1}: pointers must be 1–4 positions between 1 and ${v.dx.length}.`)
    const mods = String(l.modifiers).split(',').map((x) => x.trim()).filter(Boolean)
    if (mods.some((m) => !/^[A-Z0-9]{2}$/i.test(m))) errs.push(`Line ${i + 1}: modifiers are two characters each.`)
  })
  if (errs.length) {
    UI.toast('critical', 'Charge lines need attention', `<ul>${errs.map((e) => `<li>${U.esc(e)}</li>`).join('')}</ul>`, 8000)
    return
  }
  DB.chargeLines.filter((l) => l.visitId === v.id && !l.void && !l.dropped && !d.draft.some((x) => x.id === l.id)).forEach((l) => (l.dropped = true))
  d.draft.forEach((l) => {
    const data = { procedureCodeId: l.procedureCodeId, units: Number(l.units), modifiers: String(l.modifiers).split(',').map((x) => x.trim().toUpperCase()).filter(Boolean), pointers: String(l.pointers).split(',').map((x) => Number(x.trim())).filter(Boolean), pos: l.pos, notes: (l.notes || '').trim() }
    let line = l.id ? S.find('chargeLines', l.id) : null
    if (line) Object.assign(line, data)
    else {
      line = { id: U.id('ln'), visitId: v.id, amount: 0, balIns: 0, balPat: 0, ...data }
      DB.chargeLines.push(line)
    }
    E.priceLine(line, v)
  })
  d.draft = null
  S.log('Charge lines edited', { module: 'CHARGES', entityType: 'visit', entityId: v.id, detail: UI.codesText(E.linesOfVisit(v.id)) })
  if (v.status !== 'Review') E.intake(v)
  UI.toast('success', 'Charge lines saved', `Visit total ${U.money(E.visitTotal(v))}.`)
  R.refresh()
}
ACT['vd.field'] = (el) => {
  const v = S.find('visits', el.dataset.id)
  v[el.dataset.f] = el.value
  S.log('Visit details changed', { module: 'CHARGES', entityType: 'visit', entityId: v.id, detail: `${el.dataset.f} updated` })
  if (el.dataset.f === 'treatingProviderId') E.intake(v)
  UI.toast('success', 'Visit updated')
  R.refresh()
}
ACT['vd.refreshDx'] = (el) => {
  const v = S.find('visits', el.dataset.id)
  v.dx = S.caseOf(v).dx.map((d) => d.code)
  S.log('Diagnosis snapshot refreshed from case', { module: 'CHARGES', entityType: 'visit', entityId: v.id, detail: v.dx.join(', ') })
  UI.toast('success', 'Diagnoses refreshed from the case')
  R.refresh()
}
ACT['vd.release'] = (el) => {
  const v = S.find('visits', el.dataset.id)
  const d = vdDraft(v.id)
  const saved = E.linesOfVisit(v.id)
  const dirty = d.draft && (d.draft.length !== saved.length || d.draft.some((l, i) => !saved[i] || l.procedureCodeId !== saved[i].procedureCodeId || String(l.units) !== String(saved[i].units) || l.modifiers !== saved[i].modifiers.join(',') || l.pointers !== saved[i].pointers.join(',') || l.pos !== saved[i].pos || (l.notes || '') !== (saved[i].notes || '')))
  if (dirty) {
    UI.toast('warning', 'Save your charge line changes first', 'Release uses the saved lines.')
    return
  }
  E.release(v)
  UI.toast('success', 'Released for claiming', 'The visit is in Ready to submit — the ingestion queue.')
  R.go(`#/charges/visit/${v.id}`)
}
ACT['vd.unrelease'] = (el) => {
  const v = S.find('visits', el.dataset.id)
  v.status = 'Review'
  S.log('Moved back to Charge Review', { module: 'CHARGES', entityType: 'visit', entityId: v.id })
  R.refresh()
}
ACT['vd.pend'] = (el) => {
  const h = UI.modal({
    title: 'Pend this visit',
    desc: 'Pended visits wait until someone returns them to review.',
    size: 'md',
    body: UI.form([{ name: 'reason', label: 'Reason', type: 'select', required: true, options: ['Waiting for signed plan of care', 'Referral order not on file', 'Verify coverage with the patient', 'Waiting for corrected note from the clinician', 'Other'] }, { name: 'note', label: 'Note', type: 'textarea', placeholder: 'Optional detail', rows: 2, requiredIf: (v) => v.reason === 'Other' }]),
    foot: UI.btn({ label: 'Cancel', variant: 'quiet', act: 'layer.close' }) + UI.btn({ label: 'Pend visit', variant: 'primary', act: 'vd.pendSave' }),
  })
  h.el.dataset.id = el.dataset.id
}
ACT['vd.pendSave'] = (el) => {
  const layer = el.closest('.layer')
  const vals = UI.submitForm(UI.formOf(layer))
  if (!vals) return
  const v = S.find('visits', layer.dataset.id)
  E.pend(v, vals.reason === 'Other' ? vals.note : vals.reason + (vals.note ? ` — ${vals.note}` : ''))
  UI.closeTop()
  UI.toast('success', 'Visit pended')
  R.refresh()
}
ACT['vd.delete'] = async (el) => {
  const v = S.find('visits', el.dataset.id)
  const ok = await UI.confirm({ title: 'Delete this visit?', message: 'The visit and its charge lines are removed. No claim has been created for it yet.', confirmLabel: 'Delete visit', tone: 'critical' })
  if (!ok) return
  DB.visits = DB.visits.filter((x) => x.id !== v.id)
  DB.exceptions = DB.exceptions.filter((x) => x.visitId !== v.id)
  S.log('Visit deleted', { module: 'CHARGES', entityType: 'visit', entityId: v.id })
  UI.toast('success', 'Visit deleted')
  R.go('#/charges')
}

// ================================================================ manual charge entry (§4.1 "or created manually")
const ManualCharge = {
  render(q) {
    if (!S.can('CHARGES', 'c')) return `<div class="screen"><div class="page-x screen-head"><h1 class="screen-title">New charge</h1></div><div class="page-x">${UI.empty({ icon: 'lock', title: 'Your role cannot create charges' })}</div></div>`
    const st = S.view('manual', { patientId: q.patient || '', caseId: q.case || '', dos: DB.today, providerId: '', locationId: '', billingProviderId: '', lines: [{ procedureCodeId: 'pc97110', units: 2, modifiers: 'GP', pointers: '1', pos: '', notes: '' }], errors: {} })
    // The link's patient applies once; after that the user's own picks win.
    if (q.patient && st.appliedQ !== q.patient) Object.assign(st, { appliedQ: q.patient, patientId: q.patient, caseId: q.case || '', providerId: '' })
    const patients = DB.patients.filter((p) => S.inScopePatient(p) && p.isActive).sort((a, b) => U.cmp(S.pname(a), S.pname(b)))
    const cases = st.patientId ? Pt.cases(st.patientId).filter((c) => c.isActive) : []
    if (st.caseId && !cases.some((c) => c.id === st.caseId)) st.caseId = ''
    if (!st.caseId && cases.length === 1) st.caseId = cases[0].id
    const c = S.find('cases', st.caseId)
    const ins = c ? E.primaryIns(c.id) : null
    // PRD V2: the case supplies no location or provider (CH-04) — the person entering the charge picks them.
    const locChoices = S.locationsOfPractice().filter((l) => l.isActive && S.locAllowed(l.id))
    if (!st.locationId && locChoices.length === 1) st.locationId = locChoices[0].id
    const locPos = (S.find('locations', st.locationId) || {}).pos || ''
    st.lines.forEach((l) => { if (!l.pos) l.pos = locPos })
    const provChoices = DB.providers.filter((p) => p.practiceId === S.session.practiceId && p.isActive && !p.draft)
    // Explain what a charge needs before it can be entered (Fresh System day one, or any gap)
    const activeCodes = DB.procedureCodes.filter((x) => x.isActive)
    const needs = [
      { ok: patients.length > 0, label: 'A patient', why: 'Each patient comes with a Default case.', action: { label: 'Add a patient', hash: '#/patients' } },
      { ok: DB.cases.some((x) => x.isActive && x.dx.length && patients.some((p) => p.id === x.patientId)), label: 'A case with at least one diagnosis', why: 'Each charge line points at the case’s ICD-10 diagnoses.', action: patients.length ? { label: 'Open the patient', hash: `#/patients/${patients[0].id}/diagnoses` } : null },
      { ok: locChoices.length > 0, label: 'An active location', why: 'The visit records where treatment happened.', action: { label: 'Open Practices & locations', hash: '#/admin/practices' } },
      { ok: provChoices.length > 0, label: 'A provider', why: 'The visit records its billing and rendering provider.', action: { label: 'Add a provider', hash: '#/admin/providers' } },
      { ok: activeCodes.length > 0, label: 'An active procedure code', why: 'A charge line is one CPT / HCPCS procedure.', action: { label: 'Add a procedure code', hash: '#/admin/codes' } },
    ]
    // A line may still point at a code that does not exist in this environment (e.g. the default 97110 on day one)
    st.lines.forEach((l) => { if (!activeCodes.some((x) => x.id === l.procedureCodeId) && activeCodes[0]) { l.procedureCodeId = activeCodes[0].id; l.modifiers = activeCodes[0].defaultModifier || '' } })
    const depHtml = needs.every((n) => n.ok) ? '' : `<div class="mb-16">${Dep.panel({ title: 'Before a charge can be entered', text: 'A charge (a visit and its charge lines) connects several records. These are still missing:', needs })}</div>`
    const err = (k) => (st.errors[k] ? `<div class="field-error">${U.esc(st.errors[k])}</div>` : '')
    const selCtl = (name, opts, value, placeholder, change = 'mc.field') => `<div class="control ${st.errors[name] ? 'invalid' : ''}"><select id="mc-${name}" data-change="${change}" data-f="${name}" aria-required="true">${placeholder ? `<option value="">${placeholder}</option>` : ''}${opts.map((o) => `<option value="${o.value}" ${o.value === value ? 'selected' : ''}>${U.esc(o.label)}</option>`).join('')}</select><span class="chev">${I('chevronDown', 'icon-14')}</span></div>`
    const lines = st.lines
      .map((l, i) => {
        const pr = E.price(l.procedureCodeId, Number(l.units) || 0, ins ? ins.id : null, st.dos || DB.today)
        return `<tr><td><select class="mini-select" style="max-width:280px" data-change="mc.line" data-i="${i}" data-f="procedureCodeId" aria-label="Procedure code">${DB.procedureCodes.filter((x) => x.isActive).map((o) => `<option value="${o.id}" ${o.id === l.procedureCodeId ? 'selected' : ''}>${o.code} — ${U.esc(o.description)}</option>`).join('')}</select><input class="mini-input mt-4" style="width:280px;display:block" value="${U.esc(l.notes || '')}" data-change="mc.line" data-i="${i}" data-f="notes" aria-label="Internal line note" placeholder="Internal note (optional)"></td>
        <td><input class="mini-input" type="number" min="1" max="12" value="${U.esc(l.units)}" data-change="mc.line" data-i="${i}" data-f="units" aria-label="Units"></td>
        <td><input class="mini-input" style="width:84px" value="${U.esc(l.modifiers)}" data-change="mc.line" data-i="${i}" data-f="modifiers" aria-label="Modifiers"></td>
        <td><input class="mini-input" style="width:84px" value="${U.esc(l.pointers)}" data-change="mc.line" data-i="${i}" data-f="pointers" aria-label="Diagnosis pointers"></td>
        <td><select class="mini-select" style="max-width:150px" data-change="mc.line" data-i="${i}" data-f="pos" aria-label="Place of service"><option value="">Select…</option>${POS_OPTIONS.map((o) => `<option value="${o.value}" ${o.value === l.pos ? 'selected' : ''}>${U.esc(o.label)}</option>`).join('')}</select></td>
        <td class="r num ink">${U.money(pr.amount)}</td><td>${UI.iconBtn({ icon: 'trash', label: 'Remove line', act: 'mc.removeLine', data: { i }, danger: true, disabled: st.lines.length === 1 })}</td></tr>`
      })
      .join('')
    return `<div class="screen"><div class="page-x screen-head"><div><a class="back-link" href="#/charges">${I('arrowLeft', 'icon-14')} Charges</a><h1 class="screen-title">New charge</h1><p class="screen-sub">Manual entry starts the same billing cycle as an EMR push and goes through the same intake checks.</p></div></div>
      <div class="page-x screen-body">${depHtml}<div class="grid-2 grid-2-1"><div>
        <div class="form-grid">
          <div class="form-section-title">Who and when</div>
          <div class="field span-6"><label class="field-label" for="mc-patientId">Patient<span class="req">*</span></label>${selCtl('patientId', patients.map((p) => ({ value: p.id, label: `${S.pname(p)} · ${U.date(p.dob)}` })), st.patientId, 'Select a patient…', 'mc.patient')}${err('patientId')}</div>
          <div class="field span-6"><label class="field-label" for="mc-caseId">Case<span class="req">*</span></label>${selCtl('caseId', cases.map((x) => ({ value: x.id, label: `${x.name} · ${E.primaryIns(x.id)?.name || 'No insurance'}` })), st.caseId, st.patientId ? 'Select a case…' : 'Pick a patient first', 'mc.case')}${err('caseId')}</div>
          <div class="field span-4"><label class="field-label" for="mc-dos">Date of service<span class="req">*</span></label><div class="control ${st.errors.dos ? 'invalid' : ''}"><input id="mc-dos" type="date" value="${st.dos}" max="${DB.today}" data-change="mc.field" data-f="dos"></div>${err('dos')}</div>
          <div class="field span-8"><label class="field-label" for="mc-locationId">Location<span class="req">*</span></label>${selCtl('locationId', locChoices.map((l) => ({ value: l.id, label: `${l.name} · default POS ${l.pos}` })), st.locationId, 'Select…', 'mc.location')}${err('locationId')}</div>
          <div class="field span-6"><label class="field-label" for="mc-billingProviderId">Billing provider<span class="req">*</span></label>${selCtl('billingProviderId', provChoices.map((p) => ({ value: p.id, label: S.provName(p) })), st.billingProviderId, 'Select…')}${err('billingProviderId')}</div>
          <div class="field span-6"><label class="field-label" for="mc-providerId">Rendering provider<span class="req">*</span></label>${selCtl('providerId', provChoices.map((p) => ({ value: p.id, label: S.provName(p) })), st.providerId, 'Select…')}${err('providerId')}</div>
          <div class="field" style="grid-column:1/-1"><div class="t-micro muted">Each line’s place of service defaults from the location.</div></div>
          <div class="form-section-title">Charge lines</div>
          <div class="field" style="grid-column:1/-1"><div class="tbl-wrap scroll-x"><table class="tbl"><thead><tr><th>Code</th><th>Units</th><th>Modifiers</th><th>Dx pointers</th><th>POS (24B)</th><th class="r">Amount</th><th></th></tr></thead><tbody>${lines}</tbody></table></div>${err('lines')}
          <div class="mt-8">${UI.btn({ label: 'Add line', icon: 'plus', size: 'sm', act: 'mc.addLine' })}</div></div>
        </div>
        <div class="row-wrap mt-24">${UI.btn({ label: 'Cancel', variant: 'quiet', act: 'mc.cancel' })}${UI.btn({ label: 'Save charge', icon: 'check', variant: 'primary', act: 'mc.save' })}</div>
      </div><div class="stack gap-16">
        <div class="card"><div class="card-head"><span class="card-title">What happens next</span></div><div class="card-body t-micro muted-2" style="line-height:1.6">The new visit is checked exactly like an EMR session:<br>· unknown provider or insurance → Incomplete profiles<br>· dummy phone, ZIP/state, $0.00 codes… → Billing exceptions<br>· provider on claim hold → Delayed<br>· payer needs authorization and none is left → Pended<br>· otherwise → Charge review</div></div>
        ${c ? `<div class="card"><div class="card-head"><span class="card-title">From the case</span></div><div class="card-body" style="padding-top:4px">${UI.kv([['Referring physician', S.find('referrers', c.referrerId)?.name || 'None — add on the case'], ['Primary insurance', ins ? ins.name + (ins.insuranceHold ? ' · insurance hold' : '') : 'None'], ['Diagnoses', c.dx.map((d, i) => `${i + 1}. ${d.code}`).join(' · ') || 'None — add on the case']])}</div></div>` : ''}
      </div></div></div></div>`
  },
}
const mc = () => S.view('manual', {})
ACT['mc.patient'] = (el) => {
  Object.assign(mc(), { patientId: el.value, caseId: '', providerId: '' })
  mc().errors = {}
  R.refresh()
}
ACT['mc.case'] = (el) => {
  Object.assign(mc(), { caseId: el.value })
  R.refresh()
}
ACT['mc.location'] = (el) => {
  const st = mc()
  const before = (S.find('locations', st.locationId) || {}).pos
  st.locationId = el.value
  const now = (S.find('locations', el.value) || {}).pos || ''
  st.lines.forEach((l) => { if (!l.pos || l.pos === before) l.pos = now })
  delete st.errors.locationId
  R.refresh()
}
ACT['mc.field'] = (el) => {
  mc()[el.dataset.f] = el.value
  delete mc().errors[el.dataset.f]
  R.refresh()
}
ACT['mc.line'] = (el) => {
  const l = mc().lines[Number(el.dataset.i)]
  l[el.dataset.f] = el.value
  if (el.dataset.f === 'procedureCodeId') l.modifiers = E.pc(el.value).defaultModifier || ''
  R.refresh()
}
ACT['mc.addLine'] = () => {
  const firstCode = DB.procedureCodes.find((x) => x.isActive && x.id === 'pc97140') || DB.procedureCodes.find((x) => x.isActive) || { id: '' }
  mc().lines.push({ procedureCodeId: firstCode.id, units: 1, modifiers: 'GP', pointers: '1', pos: (S.find('locations', mc().locationId) || {}).pos || '', notes: '' })
  R.refresh()
}
ACT['mc.removeLine'] = (el) => {
  mc().lines.splice(Number(el.dataset.i), 1)
  R.refresh()
}
ACT['mc.cancel'] = () => {
  delete S.view('manual', {}).patientId
  S.resetViews()
  R.go('#/charges')
}
ACT['mc.save'] = () => {
  const st = mc()
  st.errors = {}
  if (!st.patientId) st.errors.patientId = 'This field is required.'
  if (!st.caseId) st.errors.caseId = 'This field is required.'
  if (!st.dos) st.errors.dos = 'This field is required.'
  else if (st.dos > DB.today) st.errors.dos = 'Please enter a valid date.'
  if (!st.providerId) st.errors.providerId = 'This field is required.'
  if (!st.locationId) st.errors.locationId = 'This field is required.'
  if (!st.billingProviderId) st.errors.billingProviderId = 'This field is required.'
  const c = S.find('cases', st.caseId)
  const lineErr = []
  st.lines.forEach((l, i) => {
    const units = Number(l.units)
    if (!Number.isInteger(units) || units < 1) lineErr.push(`line ${i + 1} units`)
    const ptrs = String(l.pointers).split(',').map((x) => Number(x.trim())).filter(Boolean)
    if (!ptrs.length || (c && ptrs.some((x) => x > c.dx.length))) lineErr.push(`line ${i + 1} pointers`)
    if (!l.pos) lineErr.push(`line ${i + 1} place of service`)
  })
  if (c && !c.dx.length) st.errors.lines = 'The case has no diagnoses yet — add one on the case first.'
  else if (lineErr.length) st.errors.lines = `Check ${lineErr.join(', ')}.`
  if (c && DB.visits.some((v) => v.caseId === c.id && v.dos === st.dos && v.status !== 'Inactive')) st.errors.dos = 'This case already has a visit on that date.'
  if (Object.keys(st.errors).length) {
    R.refresh()
    const first = ['patientId', 'caseId', 'dos', 'locationId', 'billingProviderId', 'providerId'].find((k) => st.errors[k])
    if (first) document.getElementById(`mc-${first}`)?.focus()
    return
  }
  const v = {
    id: U.id('v'), caseId: c.id, dos: st.dos, locationId: st.locationId, billingProviderId: st.billingProviderId, treatingProviderId: st.providerId,
    authorizationId: null, dx: c.dx.map((d) => d.code), status: 'Review', pendReason: '', source: 'Manual', recordId: `MAN-${String(Date.now()).slice(-7)}`,
    createdOn: DB.today, wi: S.workItem(),
  }
  DB.visits.unshift(v)
  st.lines.forEach((l) => {
    const line = { id: U.id('ln'), visitId: v.id, procedureCodeId: l.procedureCodeId, units: Number(l.units), modifiers: String(l.modifiers).split(',').map((x) => x.trim().toUpperCase()).filter(Boolean), pointers: String(l.pointers).split(',').map((x) => Number(x.trim())).filter(Boolean), pos: l.pos, notes: (l.notes || '').trim(), amount: 0, balIns: 0, balPat: 0 }
    DB.chargeLines.push(line)
    E.priceLine(line, v)
  })
  S.log('Charge entered manually', { module: 'CHARGES', entityType: 'visit', entityId: v.id, detail: UI.codesText(E.linesOfVisit(v.id)) })
  E.intake(v)
  S.resetViews()
  UI.toast(v.status === 'Review' ? 'success' : 'warning', `Charge saved — ${UI.VISIT_LABEL[v.status]}`, v.status === 'Review' ? 'It is waiting in Charge review.' : U.esc(v.pendReason || v.delayReason || v.incompleteReason || 'See the visit for details.'))
  R.go(`#/charges/visit/${v.id}`)
}
