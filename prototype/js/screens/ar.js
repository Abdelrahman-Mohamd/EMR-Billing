/* A/R follow-up — aging, and claims escalated by the payer SLA engine as
   "Delayed". The AR Follow-up module is named in §10.6 but its
   workflow is not specified. */

Screens.ar = {
  render(parts) {
    const tab = ['delayed', 'open'].includes(parts[0]) ? parts[0] : 'aging'
    const claims = DB.claims.filter(S.inScopeClaim)
    const open = claims.filter((c) => ['Submitted', 'Rejected', 'Denied'].includes(c.status) && E.claimInsBalance(c) > 0)
    const delayed = claims.filter((c) => c.ar === 'Delayed' && c.status === 'Submitted')
    const due = claims.filter((c) => c.status === 'Submitted' && !c.ar && c.slaDue && c.slaDue < DB.today && E.claimPaid(c) === 0)
    const tabs = [{ key: 'aging', label: 'Aging' }, { key: 'delayed', label: 'Delayed (SLA exceeded)', count: delayed.length, alert: true, demo: 'artab-delayed' }, { key: 'open', label: 'All open claims', count: open.length }]
    const body = { aging: () => AR.aging(open), delayed: () => AR.delayed(delayed, due), open: () => AR.openList(open) }[tab]()
    return `<div class="screen"><div class="page-x screen-head"><div><h1 class="screen-title">A/R follow-up</h1><p class="screen-sub">${U.esc(S.practice().name)} · Payer turnaround against per-insurance SLAs${S.level('AR') === 'view' ? ' · ' + UI.chip('inert', 'View only') : ''}</p></div>
      <div class="screen-actions"></div></div>
      <div class="page-x screen-body">${UI.tabs(tabs, tab, 'ar.tab')}<div class="mt-16">${body}</div></div></div>`
  },
}
ACT['ar.tab'] = (el) => R.go(`#/ar${el.dataset.key === 'aging' ? '' : '/' + el.dataset.key}`)

const AR = {
  aging(open) {
    const byPayer = U.groupBy(open, (c) => E.insOf(S.find('coverages', c.coverageId)).name)
    const rows = Object.entries(byPayer).map(([payer, list]) => {
      const b = Object.fromEntries(E.AGING.map((k) => [k, 0]))
      list.forEach((c) => (b[E.agingBucket(U.daysBetween(c.sentDate, DB.today))] += E.claimInsBalance(c)))
      return { id: payer, payer, ...b, total: U.sum(Object.values(b)), n: list.length }
    })
    const tot = Object.fromEntries(E.AGING.map((k) => [k, U.sum(rows, (r) => r[k])]))
    const grand = U.sum(Object.values(tot))
    const ramp = ['var(--ramp-1)', 'var(--ramp-2)', 'var(--ramp-3)', 'var(--ramp-4)', 'var(--ramp-5)']
    const max = Math.max(1, ...Object.values(tot))
    return `<div class="grid-2 grid-1-2"><div class="card"><div class="card-head"><span class="card-title">Insurance balance by age</span></div><div class="card-body"><div class="bars">${E.AGING.map((k, i) => `<div class="bar-row"><span class="bar-label">${k} days</span><span class="bar-track"><span class="bar-fill" style="width:${(tot[k] / max) * 100}%;background:${ramp[i]}"></span></span><span class="bar-val">${U.money(tot[k])}</span></div>`).join('')}</div><div class="t-micro muted-2 mt-16">Total ${U.money(grand)} across ${U.plural(open.length, 'open claim')}. Age counts from the submission date.</div></div></div>
      <div>${UI.table({
        cols: [
          { key: 'payer', label: 'Payer', sort: true, render: (r) => `<span class="ink fw-500">${U.esc(r.payer)}</span><span class="sub">${U.plural(r.n, 'claim')}</span>` },
          ...E.AGING.map((k) => ({ key: k, label: k, sort: true, cls: 'r', render: (r) => `<span class="num ${r[k] ? 'ink' : 'muted'}">${U.money(r[k])}</span>` })),
          { key: 'total', label: 'Total', sort: true, cls: 'r', render: (r) => `<span class="num ink fw-500">${U.money(r.total)}</span>` },
        ],
        rows, view: S.view('aging', { sort: 'total', dir: 'desc', page: 1 }), viewKey: 'aging', noun: 'payer', rowAct: 'ar.payer',
        foot: `<tr><td>Total</td>${E.AGING.map((k) => `<td class="r num">${U.money(tot[k])}</td>`).join('')}<td class="r num">${U.money(grand)}</td></tr>`,
        empty: UI.empty({ icon: 'circleCheck', title: 'No open insurance A/R' }),
      })}</div></div>`
  },
  delayed(delayed, due) {
    const rows = delayed.map((c) => ({ ...Cl.row(c), days: U.daysBetween(c.sentDate, DB.today), owner: c.wi?.owner }))
    return `${due.length ? `<div class="mb-16">${UI.notice('warning', `${U.plural(due.length, 'claim')} passed the payer SLA without payment.`, 'The SLA engine escalates them to Delayed on its next run. Use “Run SLA check” to run it now.', 'clock')}</div>` : ''}
      ${UI.table({
        cols: [
          { key: 'number', label: 'Claim', sort: true, render: (r) => `<span class="ink fw-500 nowrap">${r.number}</span><span class="sub">${U.esc(r.name)}</span>` },
          { key: 'payer', label: 'Payer', sort: true, render: (r) => `${U.esc(r.payer)}<span class="sub">SLA ${r.ins.slaDays} days</span>` },
          { key: 'sent', label: 'Sent', sort: true, render: (r) => U.date(r.sent) },
          { key: 'sla', label: 'SLA due', sort: true, render: (r) => `<span class="status critical">${U.date(r.sla)}</span>` },
          { key: 'days', label: 'Outstanding', sort: true, cls: 'r', render: (r) => `${r.days} days` },
          { key: 'total', label: 'Amount', sort: true, cls: 'r', render: (r) => `<span class="num ink">${U.money(r.total)}</span>` },
          { key: 'owner', label: 'Owner', render: (r) => UI.ownerCell(r.c.wi) },
          { key: 'due', label: 'Due · next action', render: (r) => `${UI.dueCell(r.c.wi)}<span class="sub" style="white-space:normal;max-width:220px">${U.esc(r.c.wi?.next || '')}</span>` },
          { key: 'act', label: '', cls: 'r', render: (r) => (S.can('AR', 'u') ? UI.btn({ label: 'Log follow-up', size: 'sm', act: 'ar.follow', data: { id: r.id } }) : '') },
        ],
        rows, view: S.view('ar-delayed', { sort: 'days', dir: 'desc', page: 1 }), viewKey: 'ar-delayed', rowAct: 'ar.follow', noun: 'claim', mark: (r) => (r.c.wi?.priority === 'High' ? 'critical' : 'warning'),
        empty: UI.empty({ icon: 'clock', title: 'Nothing delayed', text: 'Claims that pass their payer SLA without payment acknowledgement are cloned here automatically.' }),
      })}`
  },
  openList(open) {
    const rows = open.map((c) => ({ ...Cl.row(c), days: U.daysBetween(c.sentDate, DB.today), bal: E.claimInsBalance(c), bucket: E.agingBucket(U.daysBetween(c.sentDate, DB.today)) }))
    const st = S.view('ar-open', { sort: 'days', dir: 'desc', page: 1, payer: '' })
    const list = st.payer ? rows.filter((r) => r.payer === st.payer) : rows
    return `${st.payer ? `<div class="mb-16 row-wrap">${UI.chip('brand', `Payer: ${st.payer}`)}${UI.btn({ label: 'Show all payers', variant: 'quiet', act: 'ar.payerClear' })}</div>` : ''}${UI.table({
      cols: [
        { key: 'number', label: 'Claim', sort: true, render: (r) => `<span class="ink fw-500 nowrap">${r.number}</span><span class="sub">${U.esc(r.name)}</span>` },
        { key: 'payer', label: 'Payer', sort: true, render: (r) => U.esc(r.payer) },
        { key: 'status', label: 'Status', render: (r) => UI.claimChip(r.c) },
        { key: 'days', label: 'Age', sort: true, cls: 'r', render: (r) => `${r.days} days` },
        { key: 'bucket', label: 'Bucket', render: (r) => UI.tag(r.bucket) },
        { key: 'bal', label: 'Insurance balance', sort: true, cls: 'r', render: (r) => `<span class="num ink">${U.money(r.bal)}</span>` },
      ],
      rows: list, view: st, viewKey: 'ar-open', rowAct: 'claim.open', noun: 'claim',
      empty: UI.empty({ icon: 'circleCheck', title: 'No open claims' }),
    })}`
  },
}
ACT['ar.payer'] = (el) => {
  S.view('ar-open', {}).payer = el.dataset.id
  R.go('#/ar/open')
}
ACT['ar.payerClear'] = () => {
  S.view('ar-open', {}).payer = ''
  R.refresh()
}
ACT['ar.sla'] = () => {
  const out = E.runSla()
  if (!out.length) UI.toast('info', 'SLA check complete', 'No claims crossed their payer SLA since the last run.')
  else UI.toast('warning', `${U.plural(out.length, 'claim')} escalated as Delayed`, `${out.map((c) => c.number).join(', ')} — cloned into A/R follow-up with an owner task.`, 7000)
  R.go('#/ar/delayed')
}
ACT['ar.follow'] = (el) => {
  const c = S.find('claims', el.dataset.id)
  const r = Cl.row(c)
  const ins = r.ins
  const h = UI.modal({
    title: `Follow up · ${c.number}`,
    desc: `${U.esc(r.name)} · ${U.esc(ins.name)} · sent ${U.date(c.sentDate)} · ${U.daysBetween(c.sentDate, DB.today)} days outstanding. Payer phone ${U.esc(ins.phone)}.`,
    size: 'md',
    body: `<div class="row-wrap mb-16">${UI.btn({ label: 'Open claim', size: 'sm', act: 'go', data: { hash: `#/claims/view/${c.id}` } })}</div>
      ${UI.form([
        { name: 'outcome', label: 'Outcome of this follow-up', type: 'select', required: true, options: ['Claim in process — call back', 'Payer has no record — resubmit', 'Paid — waiting for the ERA', 'Denied — waiting for the ERA', 'Other'] },
        { name: 'note', label: 'Note', type: 'textarea', required: true, rows: 2, placeholder: 'Who you spoke to, reference number…' },
        { name: 'next', label: 'Next action', span: 8, required: true, placeholder: 'e.g. Call back after 09/22' },
        { name: 'due', label: 'Due date', type: 'date', required: true, span: 4, validate: (v) => (v < DB.today ? 'Please enter a valid date.' : '') },
      ], { next: c.wi?.next, due: U.addDays(DB.today, 7) })}
      <div class="section">${UI.sectionHead('History')}${UI.historyView('claim', c.id)}</div>`,
    foot: UI.btn({ label: 'Cancel', variant: 'quiet', act: 'layer.close' }) + UI.btn({ label: 'Save follow-up', variant: 'primary', act: 'ar.followSave' }),
  })
  h.el.dataset.id = c.id
}
ACT['ar.followSave'] = (el) => {
  const layer = el.closest('.layer')
  const vals = UI.submitForm(UI.formOf(layer))
  if (!vals) return
  const c = S.find('claims', layer.dataset.id)
  c.wi = { ...S.workItem(), ...(c.wi || {}), next: vals.next, due: vals.due, owner: c.wi?.owner || S.session.userId }
  S.log('Follow-up logged', { module: 'AR', entityType: 'claim', entityId: c.id, detail: `${vals.outcome} — ${vals.note}` })
  if (vals.outcome === 'Payer has no record — resubmit' && S.can('BILLING', 'u')) {
    UI.closeTop()
    const r = E.resubmit(c)
    c.ar = null
    UI.toast('success', 'Follow-up saved and claim resubmitted', r === 'Submitted' ? 'A new SLA clock starts today.' : 'The claim is on hold — see Claims.')
  } else {
    UI.closeTop()
    UI.toast('success', 'Follow-up saved', `Next: ${U.esc(vals.next)} by ${U.date(vals.due)}.`)
  }
  R.refresh()
}
