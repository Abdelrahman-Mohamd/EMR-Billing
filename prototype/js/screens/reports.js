/* Reports and Month End. Both are named in the PRD (§10.6 modules, §11 next
   steps) without a specification, so each screen says so and offers working
   examples built only from data the prototype actually holds. */

const REPORTS = [
  { key: 'status', label: 'Claims by status' },
  { key: 'aging', label: 'A/R aging by payer' },
  { key: 'payments', label: 'Payments by payer' },
  { key: 'denials', label: 'Denials by reason' },
  { key: 'providers', label: 'Charges by provider' },
  { key: 'holds', label: 'Holds by reason' },
]

const Rep = {
  claimsFor(pids) {
    return DB.claims.filter((c) => {
      const v = S.visitOf(c)
      const p = v && S.patientOfVisit(v)
      return p && pids.includes(p.practiceId) && (pids.length > 1 || S.locAllowed(v.locationId))
    })
  },
  build(key, pids) {
    const claims = Rep.claimsFor(pids)
    const pname = (id) => S.find('practices', id).name
    const practiceOf = (c) => S.patientOfVisit(S.visitOf(c)).practiceId
    const multi = pids.length > 1
    if (key === 'status') {
      const statuses = ['Hold', 'Submitted', 'Rejected', 'Paid', 'Denied', 'Replaced', 'Voided']
      const rows = statuses.map((s) => { const list = claims.filter((c) => c.status === s); return { label: s, n: list.length, value: U.sum(list, (c) => c.total) } }).filter((r) => r.n)
      return { cols: ['Status', 'Claims', 'Billed'], rows: rows.map((r) => [r.label, r.n, U.money(r.value)]), bars: rows.map((r) => ({ label: r.label, v: r.n, text: `${r.n}` })) }
    }
    if (key === 'aging') {
      const open = claims.filter((c) => ['Submitted', 'Rejected', 'Denied'].includes(c.status) && E.claimInsBalance(c) > 0)
      const g = U.groupBy(open, (c) => (multi ? pname(practiceOf(c)) + ' · ' : '') + E.insOf(S.find('coverages', c.coverageId)).name)
      const rows = Object.entries(g).map(([payer, list]) => {
        const b = Object.fromEntries(E.AGING.map((k) => [k, 0]))
        list.forEach((c) => (b[E.agingBucket(U.daysBetween(c.sentDate, DB.today))] += E.claimInsBalance(c)))
        return [payer, ...E.AGING.map((k) => U.money(b[k])), U.money(U.sum(Object.values(b)))]
      })
      const totals = E.AGING.map((k) => U.sum(open.filter((c) => E.agingBucket(U.daysBetween(c.sentDate, DB.today)) === k), (c) => E.claimInsBalance(c)))
      return { cols: ['Payer', ...E.AGING, 'Total'], rows, bars: E.AGING.map((k, i) => ({ label: `${k} days`, v: totals[i], text: U.money(totals[i]) })) }
    }
    if (key === 'payments') {
      const month = DB.today.slice(0, 7)
      const pays = DB.payments.filter((p) => p.kind === 'Insurance payment' && p.postedDate.startsWith(month) && p.claimId && claims.some((c) => c.id === p.claimId))
      const g = U.groupBy(pays, (p) => S.find('insurances', p.insuranceId).name)
      const rows = Object.entries(g).map(([payer, list]) => ({ payer, n: U.uniq(list.map((p) => p.claimId)).length, v: U.sum(list, (p) => p.amount) })).sort((a, b) => b.v - a.v)
      return { cols: ['Payer', 'Claims paid', `Paid in ${U.monthLabel(month)}`], rows: rows.map((r) => [r.payer, r.n, U.money(r.v)]), bars: rows.map((r) => ({ label: r.payer, v: r.v, text: U.money(r.v) })) }
    }
    if (key === 'denials') {
      const dens = DB.denials.filter((d) => claims.some((c) => c.id === d.claimId))
      const g = U.groupBy(dens, (d) => d.carc)
      const rows = Object.entries(g).map(([carc, list]) => ({ carc, n: list.length, open: list.filter((d) => ['Open', 'Appealed'].includes(d.status)).length, v: U.sum(list, (d) => S.find('chargeLines', d.chargeLineId).amount) }))
      return { cols: ['Reason (CARC)', 'Description', 'Denied lines', 'Still open', 'Amount'], rows: rows.map((r) => [r.carc, E.carcDesc(r.carc), r.n, r.open, U.money(r.v)]), bars: rows.map((r) => ({ label: r.carc, v: r.n, text: `${r.n}` })) }
    }
    if (key === 'providers') {
      const visits = DB.visits.filter((v) => { const p = S.patientOfVisit(v); return p && pids.includes(p.practiceId) && v.status !== 'Inactive' && (multi || S.locAllowed(v.locationId)) })
      const g = U.groupBy(visits, (v) => S.provName(S.find('providers', v.treatingProviderId)))
      const rows = Object.entries(g).map(([prov, list]) => ({ prov, n: list.length, v: U.sum(list, (x) => E.visitTotal(x)) })).sort((a, b) => b.v - a.v)
      return { cols: ['Rendering provider', 'Visits', 'Charges'], rows: rows.map((r) => [r.prov, r.n, U.money(r.v)]), bars: rows.map((r) => ({ label: r.prov, v: r.v, text: U.money(r.v) })) }
    }
    const holds = claims.filter((c) => c.status === 'Hold')
    const rows = E.HOLD_ORDER.map((k) => ({ k, n: holds.filter((c) => c.holdReason === k).length, v: U.sum(holds.filter((c) => c.holdReason === k), (c) => c.total) }))
    return { cols: ['Hold reason', 'Source of rule', 'Claims', 'Billed'], rows: rows.map((r) => [E.HOLDS[r.k].label, E.HOLDS[r.k].source, r.n, U.money(r.v)]), bars: rows.map((r) => ({ label: E.HOLDS[r.k].label, v: r.n, text: `${r.n}` })) }
  },
}

Screens.reports = {
  render(parts) {
    const key = REPORTS.some((r) => r.key === parts[0]) ? parts[0] : 'status'
    const st = S.view('reports', { scope: 'practice' })
    const practices = S.practices()
    const pids = st.scope === 'all' && practices.length > 1 ? practices.map((p) => p.id) : [S.session.practiceId]
    const rep = Rep.build(key, pids)
    const max = Math.max(1, ...rep.bars.map((b) => b.v))
    const scopeCtl = practices.length > 1 ? UI.seg([{ value: 'practice', label: S.practice().name }, { value: 'all', label: `All practices · ${DB.company.name}` }], st.scope, 'rep.scope') : ''
    return `<div class="screen"><div class="page-x screen-head"><div><h1 class="screen-title">Reports</h1><p class="screen-sub">${pids.length > 1 ? `Cross-practice report for ${U.esc(DB.company.name)}` : `${U.esc(S.practice().name)} · granted practices only`}</p></div>
      <div class="screen-actions">${scopeCtl}${UI.btn({ label: 'Export CSV', icon: 'download', act: 'rep.export', data: { key } })}</div></div>
      <div class="page-x screen-body">
        <div class="mt-16">${UI.tabs(REPORTS, key, 'rep.tab')}</div>
        <div class="grid-2 grid-1-2 section"><div class="card"><div class="card-head"><span class="card-title">${U.esc(REPORTS.find((r) => r.key === key).label)}</span></div><div class="card-body"><div class="bars">${rep.bars.length ? rep.bars.map((b) => `<div class="bar-row"><span class="bar-label truncate">${U.esc(b.label)}</span><span class="bar-track"><span class="bar-fill" style="width:${(b.v / max) * 100}%"></span></span><span class="bar-val">${b.text}</span></div>`).join('') : '<span class="muted t-micro">No data.</span>'}</div></div></div>
        <div class="tbl-wrap scroll-x"><table class="tbl"><thead><tr>${rep.cols.map((c, i) => `<th class="${i ? 'r' : ''}">${U.esc(c)}</th>`).join('')}</tr></thead><tbody>${rep.rows.length ? rep.rows.map((r) => `<tr>${r.map((cell, i) => `<td class="${i ? 'r num' : 'ink fw-500'}">${U.esc(cell)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${rep.cols.length}" class="muted">No rows for this scope.</td></tr>`}</tbody></table></div></div></div></div>`
  },
}
ACT['rep.tab'] = (el) => R.go(`#/reports/${el.dataset.key}`)
ACT['rep.scope'] = (el) => {
  S.view('reports', {}).scope = el.dataset.value
  R.refresh()
}
ACT['rep.export'] = (el) => {
  const st = S.view('reports', { scope: 'practice' })
  const pids = st.scope === 'all' && S.practices().length > 1 ? S.practices().map((p) => p.id) : [S.session.practiceId]
  const rep = Rep.build(el.dataset.key, pids)
  const csv = [rep.cols, ...rep.rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  try {
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `billing-${el.dataset.key}-${DB.today}.csv`
    document.body.appendChild(a)
    a.click()
    setTimeout(() => {
      URL.revokeObjectURL(a.href)
      a.remove()
    }, 200)
    S.log('Report exported', { module: 'REPORTS', detail: REPORTS.find((r) => r.key === el.dataset.key).label })
    UI.toast('success', 'CSV exported', `${U.plural(rep.rows.length, 'row')} downloaded.`)
  } catch (e) {
    UI.toast('critical', 'Export failed', 'Your browser blocked the download.')
  }
}

// ================================================================ month end
Screens['month-end'] = {
  render() {
    const periods = DB.periods.filter((p) => p.practiceId === S.session.practiceId).sort((a, b) => U.cmp(b.id, a.id))
    const canClose = S.can('MONTHEND', 'c')
    const canReopen = S.can('MONTHEND', 'u')
    const inScopeLine = (l) => {
      const v = S.find('visits', l.visitId)
      return v && S.inScopeVisit(v)
    }
    const figs = (ym) => {
      const charges = U.sum(DB.claims.filter((c) => S.inScopeClaim(c) && c.rank === 1 && c.sentDate && S.visitOf(c).dos.startsWith(ym) && !['Replaced', 'Voided', 'Cancelled'].includes(c.status)), (c) => c.total)
      const pays = DB.payments.filter((p) => p.postedDate && p.postedDate.startsWith(ym) && p.chargeLineId && inScopeLine(S.find('chargeLines', p.chargeLineId)))
      return { charges, paid: U.sum(pays.filter((p) => ['Insurance payment', 'Patient payment'].includes(p.kind)), (p) => p.amount), adj: U.sum(pays.filter((p) => p.kind === 'Adjustment'), (p) => p.amount) }
    }
    const rows = periods.map((p) => ({ id: `${p.practiceId}-${p.id}`, p, ...figs(p.id) }))
    return `<div class="screen"><div class="page-x screen-head"><div><h1 class="screen-title">Month end</h1><p class="screen-sub">${U.esc(S.practice().name)} · Accounting periods${S.level('MONTHEND') === 'view' ? ' · ' + UI.chip('inert', 'View only') : ''}</p></div></div>
      <div class="page-x screen-body">${UI.notice('info', 'Closing a period', 'freezes its figures. Closing opens the next period.')}
      <div class="mt-16">${UI.table({
        cols: [
          { key: 'period', label: 'Period', render: (r) => `<span class="ink fw-500">${U.monthLabel(r.p.id)}</span>` },
          { key: 'status', label: 'Status', render: (r) => UI.chip(r.p.status === 'Closed' ? 'inert' : 'success', r.p.status) },
          { key: 'charges', label: 'Charges billed', cls: 'r', render: (r) => U.money(r.charges) },
          { key: 'paid', label: 'Payments posted', cls: 'r', render: (r) => U.money(r.paid) },
          { key: 'adj', label: 'Adjustments', cls: 'r', render: (r) => U.money(r.adj) },
          { key: 'closed', label: 'Closed', render: (r) => (r.p.closedOn ? `${U.date(r.p.closedOn)}<span class="sub">${U.esc(S.userName(r.p.closedBy))}</span>` : '<span class="muted">—</span>') },
          { key: 'act', label: '', cls: 'r', render: (r) => r.p.status === 'Open' ? (canClose ? UI.btn({ label: 'Close period', size: 'sm', act: 'me.close', data: { id: r.p.id } }) : '') : canReopen ? UI.btn({ label: 'Reopen', size: 'sm', act: 'me.reopen', data: { id: r.p.id } }) : `<span class="t-micro muted" title="Only a System Admin can reopen a closed period">${I('lock', 'icon-14')} Reopen needs System Admin</span>` },
        ],
        empty: UI.empty({ icon: 'calendarCheck', title: 'No accounting periods', text: 'This practice has no accounting period to close yet.' }),
        rows, view: S.view('periods', { page: 1 }), viewKey: 'periods', noun: 'period', noPaging: true,
      })}</div></div></div>`
  },
}
ACT['me.close'] = async (el) => {
  const p = DB.periods.find((x) => x.practiceId === S.session.practiceId && x.id === el.dataset.id)
  const ok = await UI.confirm({ title: `Close ${U.monthLabel(p.id)}?`, message: canReopenText(), confirmLabel: 'Close period', tone: 'critical' })
  if (!ok) return
  p.status = 'Closed'
  p.closedBy = S.session.userId
  p.closedOn = DB.today
  const [y, m] = p.id.split('-').map(Number)
  const next = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}`
  if (!DB.periods.some((x) => x.practiceId === p.practiceId && x.id === next)) DB.periods.push({ id: next, status: 'Open', closedBy: null, closedOn: null, practiceId: p.practiceId })
  S.log('Period closed', { module: 'MONTHEND', detail: U.monthLabel(p.id) })
  UI.toast('success', `${U.monthLabel(p.id)} closed`, `${U.monthLabel(next)} is now the open period.`)
  R.refresh()
}
const canReopenText = () => (S.can('MONTHEND', 'u') ? 'You can reopen it later if needed.' : 'Your role cannot reopen it afterwards.')
ACT['me.reopen'] = async (el) => {
  const p = DB.periods.find((x) => x.practiceId === S.session.practiceId && x.id === el.dataset.id)
  const ok = await UI.confirm({ title: `Reopen ${U.monthLabel(p.id)}?`, message: 'Postings dated in this period become editable again.', confirmLabel: 'Reopen period' })
  if (!ok) return
  p.status = 'Open'
  S.log('Period reopened', { module: 'MONTHEND', detail: U.monthLabel(p.id) })
  UI.toast('success', `${U.monthLabel(p.id)} reopened`)
  R.refresh()
}
