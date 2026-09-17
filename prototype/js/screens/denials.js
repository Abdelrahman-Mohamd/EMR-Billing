/* Denial Management — the denial work queue (§9.2, §10.5 denial). The module
   itself is listed as "not yet specified"; statuses and work types come
   from the data model: Open → Appealed / Resolved / Written off. */

const DN_TABS = ['open', 'appealed', 'resolved', 'written-off', 'all']
const DN_STATUS = { open: 'Open', appealed: 'Appealed', resolved: 'Resolved', 'written-off': 'Written off' }

Screens.denials = {
  render(parts) {
    const tab = DN_TABS.includes(parts[0]) ? parts[0] : 'open'
    const all = DB.denials.filter((d) => d.practiceId === S.session.practiceId && S.inScopeClaim(S.find('claims', d.claimId)))
    const tabs = DN_TABS.map((k) => ({ key: k, label: k === 'all' ? 'All denials' : DN_STATUS[k], count: k === 'all' ? undefined : all.filter((d) => d.status === DN_STATUS[k]).length, alert: k === 'open' }))
    const v = S.view(`den-${tab}`, { sort: 'received', dir: 'desc', page: 1, q: '' })
    let rows = all.filter((d) => tab === 'all' || d.status === DN_STATUS[tab]).map((d) => {
      const claim = S.find('claims', d.claimId)
      const line = S.find('chargeLines', d.chargeLineId)
      const r = Cl.row(claim)
      return { id: d.id, d, claim, line, name: r.name, payer: r.payer, cpt: E.pc(line.procedureCodeId).code, amount: line.amount, balance: line.balIns, received: d.receivedDate, priority: ['High', 'Medium', 'Low'].indexOf(d.wi.priority), due: d.wi.due }
    })
    const qq = v.q.toLowerCase()
    if (qq) rows = rows.filter((r) => r.name.toLowerCase().includes(qq) || r.claim.number.toLowerCase().includes(qq) || r.d.carc.toLowerCase().includes(qq))
    const table = UI.table({
      cols: [
        { key: 'claim', label: 'Claim · line', sort: (r) => r.claim.number, render: (r) => `<span class="ink fw-500 nowrap">${r.claim.number}</span><span class="sub">${r.cpt} · DOS ${U.date(S.visitOf(r.claim).dos)}</span>` },
        { key: 'name', label: 'Patient', sort: true, render: (r) => `${U.esc(r.name)}<span class="sub">${U.esc(r.payer)}</span>` },
        { key: 'carc', label: 'Reason', sort: (r) => r.d.carc, render: (r) => `<span class="status critical">${U.esc(r.d.carc)}${r.d.rarc ? ' · ' + U.esc(r.d.rarc) : ''}</span><span class="sub" style="white-space:normal;max-width:280px">${U.esc(E.carcDesc(r.d.carc))}</span>` },
        { key: 'balance', label: 'At stake', sort: true, cls: 'r', render: (r) => `<span class="num ink">${U.money(r.balance || r.amount)}</span>` },
        { key: 'received', label: 'Received', sort: true, render: (r) => U.date(r.received) },
        { key: 'status', label: 'Status', render: (r) => UI.chip(DenialTone[r.d.status], r.d.status) },
        { key: 'owner', label: 'Owner', render: (r) => UI.ownerCell(r.d.wi) },
        { key: 'priority', label: 'Priority', sort: true, render: (r) => UI.status(UI.PRIORITY_TONE[r.d.wi.priority] || 'inert', r.d.wi.priority) },
        { key: 'due', label: 'Due · next action', sort: true, render: (r) => `${UI.dueCell(r.d.wi)}<span class="sub" style="white-space:normal;max-width:220px">${U.esc(r.d.wi.next || '')}</span>` },
      ],
      rows, view: v, viewKey: `den-${tab}`, rowAct: 'den.open', noun: 'denial', mark: (r) => (r.d.status === 'Open' ? (r.d.wi.priority === 'High' ? 'critical' : 'warning') : null),
      empty: UI.empty({ icon: 'shieldX', title: tab === 'open' ? 'No open denials' : tab === 'appealed' ? 'No appealed denials' : 'No denials yet', text: tab === 'open' ? 'Electronic 835 denials are cloned into this queue automatically when an ERA posts.' : tab === 'appealed' ? 'Denials move here when someone records an appeal on an open denial.' : 'A denial appears when a posted remittance denies a claim line.' }),
    })
    return `<div class="screen"><div class="page-x screen-head"><div><h1 class="screen-title">Denial management</h1><p class="screen-sub">${U.esc(S.practice().name)} · Appeal, correct and resend, or write off${S.level('DENIALS') === 'view' ? ' · ' + UI.chip('inert', 'View only') : ''}</p></div></div>
      <div class="page-x screen-body">${UI.tabs(tabs, tab, 'den.tab')}
      <div class="control-line mt-16">${UI.qsearch(`den-${tab}-q`, v.q, 'Search patient, claim # or reason…', 'den.search').replace('data-input="den.search"', `data-input="den.search" data-view="den-${tab}"`)}</div>${table}</div></div>`
  },
}
ACT['den.tab'] = (el) => R.go(`#/denials${el.dataset.key === 'open' ? '' : '/' + el.dataset.key}`)
ACT['den.search'] = U.debounce((el) => {
  const v = S.view(el.dataset.view, {})
  v.q = el.value
  v.page = 1
  R.refresh()
}, 220)

ACT['den.open'] = (el) => {
  const d = S.find('denials', el.dataset.id)
  const claim = S.find('claims', d.claimId)
  const line = S.find('chargeLines', d.chargeLineId)
  const r = Cl.row(claim)
  const ins = r.ins
  const canU = S.can('DENIALS', 'u')
  const active = ['Open', 'Appealed'].includes(d.status)
  const portal = ins.portalUrl ? `${U.esc(ins.portalUrl)} · user ${U.esc(ins.portalUser)} · password ${S.canDecrypt() ? U.esc(ins.portalPassword) : '••••••••'}` : 'No portal on file'
  UI.drawer({
    title: `Denial · ${claim.number}`,
    desc: `${U.esc(r.name)} · ${U.esc(ins.name)} · DOS ${U.date(r.dos)}`,
    wide: true,
    body: `${UI.notice('critical', `${d.carc}${d.rarc ? ' / ' + d.rarc : ''}:`, `${U.esc(E.carcDesc(d.carc))}${d.rarc ? ' — ' + U.esc((DB.rarc.find((x) => x.code === d.rarc) || {}).desc || '') : ''}`, 'shieldX')}
      ${UI.kv([['Charge line', `${E.pc(line.procedureCodeId).code} × ${line.units} · ${U.money(line.amount)}`], ['Still owed by payer', U.money(line.balIns)], ['Received', U.date(d.receivedDate)], ['Status', d.status], ['Appealed', d.appealedOn ? U.date(d.appealedOn) : ''], ['Notes', d.notes], ['Payer portal', portal, true]])}
      <div class="mt-16">${UI.workItemView(d.wi, 'denial', d.id, 'DENIALS', d.status)}</div>
      ${canU && active ? `<div class="section">${UI.sectionHead('Work this denial')}<div class="row-wrap mt-12">${d.status === 'Open' ? UI.btn({ label: 'Appeal', icon: 'send', variant: 'primary', act: 'den.appeal', data: { id: d.id }, demo: 'den-appeal' }) : ''}${S.can('BILLING', 'c') ? UI.btn({ label: 'Correct & resend', icon: 'copy', act: 'den.correct', data: { id: d.id } }) : ''}${UI.btn({ label: 'Record outcome', icon: 'check', act: 'den.resolve', data: { id: d.id } })}${UI.btn({ label: 'Write off', icon: 'ban', variant: 'danger', act: 'den.writeoff', data: { id: d.id } })}</div></div>` : ''}
      <div class="section">${UI.sectionHead('History')}${UI.historyView('denial', d.id, [['claim', claim.id]])}</div>`,
    foot: `${UI.btn({ label: 'Open claim', act: 'go', data: { hash: `#/claims/view/${claim.id}` } })}${UI.btn({ label: 'Close', variant: 'primary', act: 'layer.close' })}`,
  })
}
ACT['den.appeal'] = (el) => {
  const h = UI.modal({
    title: 'Submit an appeal',
    desc: 'Records the appeal and moves the denial to Appealed with a 30-day follow-up.',
    size: 'md',
    body: UI.form([
      { name: 'method', label: 'Sent by', type: 'select', required: true, options: ['Payer portal', 'Fax', 'Mail', 'Clearinghouse attachment'] },
      { name: 'notes', label: 'What was sent', type: 'textarea', required: true, placeholder: 'e.g. Plan of care, progress note and functional test results', rows: 3 },
    ]),
    foot: UI.btn({ label: 'Cancel', variant: 'quiet', act: 'layer.close' }) + UI.btn({ label: 'Record appeal', variant: 'primary', act: 'den.appealSave' }),
  })
  h.el.dataset.id = el.dataset.id
}
ACT['den.appealSave'] = (el) => {
  const layer = el.closest('.layer')
  const vals = UI.submitForm(UI.formOf(layer))
  if (!vals) return
  const d = S.find('denials', layer.dataset.id)
  E.appealDenial(d, vals.method, vals.notes)
  UI.closeAll()
  UI.toast('success', 'Appeal recorded', `Follow up by ${U.date(d.wi.due)}.`)
  R.go('#/denials/appealed')
}
ACT['den.correct'] = async (el) => {
  const d = S.find('denials', el.dataset.id)
  const claim = S.find('claims', d.claimId)
  const ok = await UI.confirm({ title: 'Correct and resend?', message: `A frequency-7 replacement of ${claim.number} is created from the current charge lines and scrubbed. Fix the charge or case first if the denial asks for it.`, confirmLabel: 'Create corrected claim' })
  if (!ok) return
  UI.closeAll()
  const nc = E.corrected(claim, '7', null)
  DB.denials.filter((x) => x.claimId === claim.id && ['Open', 'Appealed'].includes(x.status)).forEach((x) => {
    x.status = 'Resolved'
    x.notes = `Corrected claim ${nc.number} sent`
    x.wi.next = ''
    S.log('Denial resolved — corrected claim sent', { module: 'DENIALS', entityType: 'denial', entityId: x.id, detail: nc.number })
  })
  S.emit('denial.worked', d)
  Scrub.show([nc], 'Corrected claim (frequency 7)', null)
  R.refresh()
}
ACT['den.writeoff'] = (el) => {
  const d = S.find('denials', el.dataset.id)
  const line = S.find('chargeLines', d.chargeLineId)
  const h = UI.modal({
    title: 'Write off this denial',
    desc: `${U.money(line.balIns)} is adjusted off the insurance balance. This cannot be undone from the queue.`,
    size: 'md',
    body: UI.form([
      { name: 'code', label: 'Adjustment reason (CARC)', type: 'select', required: true, options: DB.carc.filter((c) => c.code.startsWith('CO')).map((c) => ({ value: c.code, label: `${c.code} — ${c.desc}` })) },
      { name: 'notes', label: 'Why', type: 'textarea', required: true, rows: 2, placeholder: 'e.g. Timely filing limit passed' },
    ], { code: d.carc }),
    foot: UI.btn({ label: 'Cancel', variant: 'quiet', act: 'layer.close' }) + UI.btn({ label: `Write off ${U.money(line.balIns)}`, variant: 'danger-fill', act: 'den.writeoffSave' }),
  })
  h.el.dataset.id = d.id
}
ACT['den.writeoffSave'] = (el) => {
  const layer = el.closest('.layer')
  const vals = UI.submitForm(UI.formOf(layer))
  if (!vals) return
  const d = S.find('denials', layer.dataset.id)
  E.writeOffDenial(d, vals.code, vals.notes)
  UI.closeAll()
  UI.toast('success', 'Written off', 'An adjustment row was posted to the ledger.')
  R.refresh()
}
ACT['den.resolve'] = (el) => {
  const d = S.find('denials', el.dataset.id)
  const line = S.find('chargeLines', d.chargeLineId)
  const h = UI.modal({
    title: 'Record the outcome',
    desc: 'For example, the payer reprocessed the line after an appeal.',
    size: 'md',
    body: UI.form([
      { name: 'amount', label: 'Amount paid by the payer', type: 'money', required: true, placeholder: '0.00', help: `Up to ${U.money(line.balIns)} is still owed.`, validate: (v) => (Number(v) > line.balIns + 0.001 ? 'Please enter a valid amount.' : '') },
      { name: 'notes', label: 'Notes', type: 'textarea', rows: 2, placeholder: 'Optional' },
    ]),
    foot: UI.btn({ label: 'Cancel', variant: 'quiet', act: 'layer.close' }) + UI.btn({ label: 'Resolve denial', variant: 'primary', act: 'den.resolveSave' }),
  })
  h.el.dataset.id = d.id
}
ACT['den.resolveSave'] = (el) => {
  const layer = el.closest('.layer')
  const vals = UI.submitForm(UI.formOf(layer))
  if (!vals) return
  const d = S.find('denials', layer.dataset.id)
  E.resolveDenial(d, Number(vals.amount), vals.notes)
  UI.closeAll()
  UI.toast('success', 'Denial resolved', Number(vals.amount) ? `${U.money(vals.amount)} posted as an insurance payment.` : '')
  R.refresh()
}
