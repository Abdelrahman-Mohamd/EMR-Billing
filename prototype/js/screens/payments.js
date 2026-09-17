/* Payments — ERA (835) ingestion with claim-level reconciliation, manual
   check-batch posting that must balance, and the payment ledger.
   The PRD marks the Posting module "not yet specified"; this is the
   simplest flow that exercises the rules it does state. */

Screens.payments = {
  render(parts) {
    if (parts[0] === 'batch') return BatchEditor.render(parts[1])
    const tab = ['batches', 'ledger'].includes(parts[0]) ? parts[0] : 'era'
    const eras = DB.eras.filter((e) => e.practiceId === S.session.practiceId)
    const pending = eras.filter((e) => e.status === 'Pending').length
    const openBatches = DB.batches.filter((b) => b.practiceId === S.session.practiceId && b.status === 'Open').length
    const tabs = [
      { key: 'era', label: 'ERA (835) inbox', count: pending, alert: true, demo: 'ptab-era' },
      { key: 'batches', label: 'Check batches', count: openBatches || undefined },
      { key: 'ledger', label: 'Payment ledger' },
    ]
    const canC = S.can('PAYMENTS', 'c')
    const actions = `${canC ? UI.btn({ label: 'New check batch', icon: 'plus', variant: 'primary', act: 'bt.new' }) : ''}`
    const body = { era: () => Pay.eraTab(eras), batches: () => Pay.batchTab(), ledger: () => Pay.ledgerTab() }[tab]()
    return `<div class="screen"><div class="page-x screen-head"><div><h1 class="screen-title">Payments</h1><p class="screen-sub">${U.esc(S.practice().name)} · Manual posting and automated ERA (835) ingestion${S.level('PAYMENTS') === 'view' ? ' · ' + UI.chip('inert', 'View only') : ''}</p></div><div class="screen-actions">${actions}</div></div>
      <div class="page-x screen-body">${UI.tabs(tabs, tab, 'pay.tab')}<div class="mt-16">${body}</div></div></div>`
  },
}
ACT['pay.tab'] = (el) => R.go(`#/payments${el.dataset.key === 'era' ? '' : '/' + el.dataset.key}`)

const ERA_TONE = { Pending: 'info', Posted: 'success', 'Partially posted': 'warning', Exceptions: 'critical' }
const Pay = {
  eraTab(eras) {
    const v = S.view('eras', { sort: 'received', dir: 'desc', page: 1 })
    const rows = eras.map((e) => ({ id: e.id, e, control: e.control, payer: S.find('insurances', e.insuranceId).name, received: e.received, n: e.claims.length, total: E.eraTotal(e), status: e.status }))
    return `
      ${UI.table({
        cols: [
          { key: 'control', label: 'ERA / EFT trace', sort: true, render: (r) => `<span class="ink fw-500">${U.esc(r.control)}</span>` },
          { key: 'payer', label: 'Payer', sort: true, render: (r) => U.esc(r.payer) },
          { key: 'received', label: 'Received', sort: true, render: (r) => U.stampLabel(r.received, DB.today) },
          { key: 'n', label: 'Claims', sort: true, cls: 'r', render: (r) => r.n },
          { key: 'total', label: 'Total paid', sort: true, cls: 'r', render: (r) => `<span class="num ink">${U.money(r.total)}</span>` },
          { key: 'status', label: 'Status', sort: true, render: (r) => UI.chip(ERA_TONE[r.status] || 'inert', r.status) },
          { key: 'act', label: '', cls: 'r', render: (r) => (r.status === 'Pending' && S.can('PAYMENTS', 'c') ? UI.btn({ label: 'Review & post', size: 'sm', act: 'era.open', data: { id: r.id }, demo: 'era-open' }) : UI.btn({ label: 'View', size: 'sm', act: 'era.open', data: { id: r.id } })) },
        ],
        rows, view: v, viewKey: 'eras', rowAct: 'era.open', noun: 'ERA file', mark: (r) => (r.status === 'Pending' ? 'attention' : r.status !== 'Posted' ? 'critical' : null),
        empty: UI.empty({ icon: 'inbox', title: 'No remittances yet', text: 'Electronic remittances from payers appear here when they arrive.' }),
      })}`
  },
  batchTab() {
    const v = S.view('batches-list', { sort: 'checkDate', dir: 'desc', page: 1 })
    const rows = DB.batches.filter((b) => b.practiceId === S.session.practiceId).map((b) => ({ id: b.id, b, checkNumber: b.checkNumber, payer: S.find('insurances', b.insuranceId)?.name || '', checkDate: b.checkDate, amount: b.checkAmount, applied: b.status === 'Open' ? U.sum(b.entries || [], (e) => e.paid) : b.checkAmount, status: b.status, source: b.source }))
    return UI.table({
      cols: [
        { key: 'checkNumber', label: 'Check / EFT', sort: true, render: (r) => `<span class="ink fw-500">${U.esc(r.checkNumber)}</span>` },
        { key: 'source', label: 'Source', sort: true, render: (r) => UI.tag(r.source === 'ERA' ? 'ERA 835' : 'Manual', r.source === 'ERA' ? 'brand' : '') },
        { key: 'payer', label: 'Payer', sort: true, render: (r) => U.esc(r.payer) },
        { key: 'checkDate', label: 'Check date', sort: true, render: (r) => U.date(r.checkDate) },
        { key: 'amount', label: 'Check amount', sort: true, cls: 'r', render: (r) => `<span class="num ink">${U.money(r.amount)}</span>` },
        { key: 'applied', label: 'Applied', cls: 'r', render: (r) => `<span class="num ${Math.abs(r.applied - r.amount) < 0.005 ? 'status success' : 'status critical'}">${U.money(r.applied)}</span>` },
        { key: 'status', label: 'Status', sort: true, render: (r) => UI.chip(r.status === 'Open' ? 'warning' : 'success', r.status) },
      ],
      rows, view: v, viewKey: 'batches-list', rowAct: 'bt.open', noun: 'batch',
      empty: UI.empty({ icon: 'wallet', title: 'No check batches', text: 'Start one with “New check batch” to post a paper check or EFT by hand.' }),
    })
  },
  ledgerTab() {
    const v = S.view('ledger', { sort: 'postedDate', dir: 'desc', page: 1, q: '', kinds: [] })
    let rows = DB.payments.filter((p) => Dash.paymentInScope(p)).map((p) => {
      const claim = p.claimId ? S.find('claims', p.claimId) : null
      const line = p.chargeLineId ? S.find('chargeLines', p.chargeLineId) : null
      const pt = line ? S.patientOfVisit(S.find('visits', line.visitId)) : p.patientId ? S.find('patients', p.patientId) : null
      return { id: p.id, p, postedDate: p.postedDate, kind: p.kind, amount: p.amount, claim, code: line ? E.pc(line.procedureCodeId).code : '', who: p.insuranceId ? S.find('insurances', p.insuranceId).name : pt ? `${S.pfull(pt)} (patient)` : '', patient: pt ? S.pname(pt) : '' }
    })
    const KINDS = ['Insurance payment', 'Patient payment', 'Adjustment', 'Reversal']
    const counts = Object.fromEntries(KINDS.map((k) => [k, rows.filter((r) => r.kind === k).length]))
    if (v.kinds.length) rows = rows.filter((r) => v.kinds.includes(r.kind))
    const qq = v.q.toLowerCase()
    if (qq) rows = rows.filter((r) => r.patient.toLowerCase().includes(qq) || (r.claim && r.claim.number.toLowerCase().includes(qq)) || String(r.p.checkNumber).toLowerCase().includes(qq))
    const canU = S.can('PAYMENTS', 'u')
    const canD = S.can('PAYMENTS', 'd')
    return `<div class="control-line">${UI.qsearch('ledger-q', v.q, 'Search patient, claim # or check…', 'led.search')}<div class="ml-auto t-micro muted-2">${canD ? 'Your role may delete payment rows.' : 'Reversals are posted, never deleted.'}</div></div>
      <div class="mt-12">${UI.pills(KINDS.map((k) => ({ key: k, label: k, count: counts[k] })), v.kinds, 'led.kind')}</div>
      ${UI.table({
        cols: [
          { key: 'postedDate', label: 'Posted', sort: true, render: (r) => U.date(r.postedDate) },
          { key: 'kind', label: 'Type', sort: true, render: (r) => UI.tag(r.kind, r.kind === 'Insurance payment' ? 'brand' : r.kind === 'Reversal' ? 'sand' : '') + (r.p.reversed ? ' ' + UI.chip('inert', 'Reversed') : '') },
          { key: 'patient', label: 'Patient', sort: true, render: (r) => U.esc(r.patient) },
          { key: 'who', label: 'Paid by', render: (r) => U.esc(r.who) },
          { key: 'claim', label: 'Claim · line', render: (r) => (r.claim ? `<a href="#/claims/view/${r.claim.id}?tab=payments">${r.claim.number}</a> <span class="code">${r.code}</span>` : r.p.unapplied ? '<span class="muted">Unapplied credit</span>' : `<span class="code">${r.code}</span>`) },
          { key: 'reason', label: 'Reason', render: (r) => (r.p.reasonCode ? U.esc(r.p.reasonCode) : '') },
          { key: 'check', label: 'Check / ERA', render: (r) => `<span class="muted">${U.esc(r.p.checkNumber || '')}</span>` },
          { key: 'amount', label: 'Amount', sort: true, cls: 'r', render: (r) => `<span class="num ink">${r.kind === 'Reversal' ? '−' : ''}${U.money(r.amount)}</span>` },
          { key: 'act', label: '', cls: 'r', render: (r) => `<div class="row-actions">${canU && r.kind !== 'Reversal' && !r.p.reversed && !r.p.unapplied ? UI.iconBtn({ icon: 'undo', label: 'Post a reversal', act: 'led.reverse', data: { id: r.id } }) : ''}${canD && r.kind !== 'Reversal' ? UI.iconBtn({ icon: 'trash', label: 'Delete payment row', act: 'led.delete', data: { id: r.id }, danger: true }) : ''}</div>` },
        ],
        rows, view: v, viewKey: 'ledger', noun: 'payment row', pageSize: 15,
        empty: UI.empty({ icon: 'search', title: 'No payment rows match' }),
      })}`
  },
}
ACT['led.search'] = U.debounce((el) => {
  const v = S.view('ledger', {})
  v.q = el.value
  v.page = 1
  R.refresh()
}, 220)
ACT['led.kind'] = (el) => {
  const v = S.view('ledger', {})
  v.kinds = v.kinds.includes(el.dataset.key) ? v.kinds.filter((k) => k !== el.dataset.key) : [...v.kinds, el.dataset.key]
  v.page = 1
  R.refresh()
}
ACT['led.reverse'] = (el) => {
  const p = S.find('payments', el.dataset.id)
  const h = UI.modal({
    title: 'Post a reversal',
    desc: `Reverses ${p.kind.toLowerCase()} of ${U.money(p.amount)}. The original row stays in the ledger; a reversal row restores the balance.`,
    size: 'md',
    body: UI.form([{ name: 'reason', label: 'Reason', type: 'select', required: true, options: ['Posted to the wrong claim', 'Payer recoupment', 'Check returned', 'Duplicate posting', 'Other'] }]),
    foot: UI.btn({ label: 'Cancel', variant: 'quiet', act: 'layer.close' }) + UI.btn({ label: 'Post reversal', variant: 'danger-fill', act: 'led.reverseSave' }),
  })
  h.el.dataset.id = p.id
}
ACT['led.reverseSave'] = (el) => {
  const layer = el.closest('.layer')
  const vals = UI.submitForm(UI.formOf(layer))
  if (!vals) return
  E.reversePayment(S.find('payments', layer.dataset.id), vals.reason)
  UI.closeTop()
  UI.toast('success', 'Reversal posted', 'The balance was restored; both rows stay in the ledger.')
  R.refresh()
}
ACT['led.delete'] = async (el) => {
  const p = S.find('payments', el.dataset.id)
  const ok = await UI.confirm({ title: 'Delete this payment row?', message: 'The row disappears from the ledger and the balance is restored. Practice Admins cannot do this — they post reversals instead.', confirmLabel: 'Delete payment row', tone: 'critical' })
  if (!ok) return
  const line = S.find('chargeLines', p.chargeLineId)
  if (line) {
    if (p.kind === 'Patient payment') line.balPat = U.round(line.balPat + p.amount)
    else line.balIns = U.round(line.balIns + p.amount)
  }
  DB.payments = DB.payments.filter((x) => x.id !== p.id)
  S.log('Payment row deleted', { module: 'PAYMENTS', entityType: 'payment', entityId: p.id, detail: `${p.kind} ${U.money(p.amount)}` })
  UI.toast('success', 'Payment row deleted')
  R.refresh()
}

// ---------------------------------------------------------------- ERA review & posting
ACT['era.open'] = (el) => {
  const era = S.find('eras', el.dataset.id)
  const ins = S.find('insurances', era.insuranceId)
  const pending = era.status === 'Pending'
  const rows = era.claims
    .map((ec) => {
      const claim = ec.claimId ? S.find('claims', ec.claimId) : DB.claims.find((c) => c.number === ec.claimNumber)
      const t = (k) => U.sum(ec.lines, (l) => l[k])
      const extra = U.sum(ec.lines, (l) => U.sum(l.extra || [], (x) => x.amount))
      const unmapped = U.uniq(ec.lines.flatMap((l) => (l.extra || []).map((x) => x.code)).filter((c) => !E.carcKnown(c)))
      const okAllowed = Math.abs(t('charge') - t('contractual') - t('allowed')) < 0.01 || ec.outcome === 'denied'
      const okPaid = Math.abs(t('allowed') - t('pr') - extra - t('paid')) < 0.01 || ec.outcome === 'denied'
      const problem = !claim ? 'Claim not found' : unmapped.length ? `Unmapped ${unmapped.join(', ')}` : ''
      const stat = ec.status === 'posted' ? UI.chip('success', 'Posted') : ec.status === 'exception' ? UI.chip('critical', 'Exception') : problem ? UI.chip('critical', problem) : ec.outcome === 'denied' ? UI.chip('critical', `Denied ${ec.carc}`) : UI.chip('info', 'Ready')
      return `<tr><td class="nowrap">${claim ? `<a href="#/claims/view/${claim.id}" data-act="go" data-hash="#/claims/view/${claim.id}">${ec.claimNumber}</a>` : `<span class="status critical">${U.esc(ec.claimNumber)}</span>`}<span class="sub">${U.esc(ec.patient)}${claim && claim.rank > 1 ? ' · secondary' : ''}</span></td><td class="r num">${U.money(t('charge'))}</td><td class="r num">${U.money(t('allowed'))}</td><td class="r num">${U.money(t('contractual'))}</td><td class="r num">${U.money(t('pr'))}${extra ? `<span class="sub">+${U.money(extra)} other</span>` : ''}</td><td class="r num ink fw-500">${U.money(t('paid'))}</td><td>${stat}<span class="sub">${okAllowed && okPaid ? 'Reconciles' : 'Does not reconcile'}</span></td></tr>`
    })
    .join('')
  const h = UI.drawer({
    title: `ERA ${era.control}`,
    desc: `${U.esc(ins.name)} · received ${U.stampLabel(era.received, DB.today)} · ${U.money(E.eraTotal(era))} paid · ${era.claims.length} claims`,
    wide: true,
    body: `${UI.notice('info', 'Reconciliation.', 'Each claim is checked before posting: Charge − Contractual = Allowed, and Allowed − Patient responsibility = Paid.')}
      <div class="tbl-wrap scroll-x mt-16"><table class="tbl"><thead><tr><th>Claim</th><th class="r">Charge</th><th class="r">Allowed</th><th class="r">CO-45</th><th class="r">Pt. resp.</th><th class="r">Paid</th><th>Result</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="t-micro muted-2 mt-12">What posting does: insurance payment and CO-45 adjustment rows per charge line · remaining patient responsibility moves to the next coverage (a secondary claim is created) or to the patient · electronic denials are cloned into Denial management · unmatched lines and unmapped codes become payment-level billing exceptions.</div>`,
    foot: pending && S.can('PAYMENTS', 'c') ? UI.btn({ label: 'Close', variant: 'quiet', act: 'layer.close' }) + UI.btn({ label: 'Post ERA', icon: 'check', variant: 'primary', act: 'era.post', data: { id: era.id }, demo: 'era-post' }) : UI.btn({ label: 'Close', variant: 'primary', act: 'layer.close' }),
  })
  void h
}
ACT['era.post'] = (el) => {
  const era = S.find('eras', el.dataset.id)
  UI.closeTop()
  const s = E.postEra(era)
  const parts = [`${U.plural(s.posted, 'claim')} posted · ${U.money(s.paid)}`]
  if (s.secondary.length) parts.push(`${U.plural(s.secondary.length, 'secondary claim')} created and ${s.secondary.every((c) => c.status === 'Submitted') ? 'submitted' : 'scrubbed'}`)
  if (s.denials) parts.push(`${U.plural(s.denials, 'denied line')} sent to Denial management`)
  if (s.exceptions) parts.push(`${U.plural(s.exceptions, 'remittance')} sent to Billing exceptions`)
  UI.toast(s.exceptions ? 'warning' : 'success', 'ERA posted', `<ul>${parts.map((x) => `<li>${x}</li>`).join('')}</ul>`, 9000)
  R.refresh()
}
// ---------------------------------------------------------------- manual check batches
ACT['bt.new'] = () => {
  if (!DB.claims.some((c) => S.inScopeClaim(c) && c.status === 'Submitted')) {
    Dep.modal({
      title: 'Nothing to post a check against yet',
      text: 'A check batch applies a payer’s check to the claims it pays, line by line, and must balance to the check amount. There are no submitted claims awaiting payment.',
      needs: [
        { ok: DB.insurances.some((i) => i.practiceId === S.session.practiceId && !i.draft), label: 'An insurance (the payer)', action: { label: 'Add an insurance', hash: '#/admin/insurances' } },
        { ok: false, label: 'A submitted claim for that payer', why: 'Enter and release a charge, then submit it.', action: { label: 'Open Ready to submit', hash: '#/charges/ready' } },
      ],
    })
    return
  }
  UI.modal({
    title: 'New check batch',
    desc: 'Rows sharing a check number form a batch that must balance to the check amount.',
    size: 'md',
    body: UI.form([
      { name: 'insuranceId', label: 'Payer', type: 'select', required: true, options: DB.insurances.filter((i) => i.practiceId === S.session.practiceId && !i.draft).map((i) => ({ value: i.id, label: S.insLabel(i) })) },
      { name: 'checkNumber', label: 'Check / EFT number', required: true, span: 6, placeholder: 'e.g. 004512', validate: (v) => (DB.batches.some((b) => b.checkNumber === v) ? 'This check number is already posted.' : '') },
      { name: 'checkDate', label: 'Check date', type: 'date', required: true, span: 6, validate: (v) => (v > DB.today ? 'Please enter a valid date.' : '') },
      { name: 'checkAmount', label: 'Check amount', type: 'money', required: true, span: 6, placeholder: '0.00', min: 0.01 },
    ], { checkDate: DB.today }),
    foot: UI.btn({ label: 'Cancel', variant: 'quiet', act: 'layer.close' }) + UI.btn({ label: 'Start posting', variant: 'primary', act: 'bt.create' }),
  })
}
ACT['bt.create'] = (el) => {
  const vals = UI.submitForm(UI.formOf(el.closest('.layer')))
  if (!vals) return
  const b = { id: U.id('bt'), practiceId: S.session.practiceId, source: 'Manual', insuranceId: vals.insuranceId, checkNumber: vals.checkNumber, checkDate: vals.checkDate, checkAmount: U.round(vals.checkAmount), status: 'Open', entries: [], createdBy: S.session.userId }
  DB.batches.unshift(b)
  S.log('Check batch opened', { module: 'PAYMENTS', entityType: 'batch', entityId: b.id, detail: `${b.checkNumber} · ${U.money(b.checkAmount)}` })
  UI.closeTop()
  R.go(`#/payments/batch/${b.id}`)
}
ACT['bt.open'] = (el) => {
  const b = S.find('batches', el.dataset.id)
  if (b.status === 'Open') R.go(`#/payments/batch/${b.id}`)
  else if (b.eraId) ACT['era.open']({ dataset: { id: b.eraId } })
  else R.go(`#/payments/batch/${b.id}`)
}

const BatchEditor = {
  render(id) {
    const b = S.find('batches', id)
    if (!b) return `<div class="screen"><div class="page-x screen-head"><h1 class="screen-title">Batch not found</h1></div></div>`
    const ins = S.find('insurances', b.insuranceId)
    const open = b.status === 'Open'
    const applied = open ? U.sum(b.entries, (e) => e.paid) : U.sum(DB.payments.filter((p) => p.batchId === b.id && p.kind === 'Insurance payment'), (p) => p.amount)
    const remaining = U.round(b.checkAmount - applied)
    const canEdit = open && S.can('PAYMENTS', 'u')
    const byClaim = U.groupBy(b.entries || [], (e) => e.claimId)
    const claimsHtml = Object.entries(byClaim)
      .map(([cid, ents]) => {
        const c = S.find('claims', cid)
        const r = Cl.row(c)
        return `<div class="card mb-16"><div class="card-head"><div class="grow"><div class="card-title">${c.number} · ${U.esc(r.name)}</div><div class="t-micro muted">DOS ${U.date(r.dos)} · ${RANK_LABEL[c.rank]} · billed ${U.money(c.total)}</div></div>${canEdit ? UI.iconBtn({ icon: 'trash', label: 'Remove claim from batch', act: 'bt.removeClaim', data: { id: b.id, claim: cid }, danger: true }) : ''}</div>
          <div class="tbl-wrap scroll-x"><table class="tbl" style="margin:0 20px;width:calc(100% - 40px)"><thead><tr><th>Line</th><th class="r">Charge</th><th class="r">Allowed</th><th class="r">Contractual</th><th class="r">Patient resp.</th><th class="r">Paid</th></tr></thead><tbody>${ents
            .map((e) => {
              const i = b.entries.indexOf(e)
              const inp = (f) => (canEdit ? `<input class="money-input" inputmode="decimal" value="${e[f].toFixed(2)}" data-change="bt.entry" data-id="${b.id}" data-i="${i}" data-f="${f}" aria-label="${f}">` : U.money(e[f]))
              return `<tr><td><span class="code">${e.cpt}</span></td><td class="r num">${U.money(e.charge)}</td><td class="r">${inp('allowed')}</td><td class="r num">${U.money(e.contractual)}</td><td class="r">${inp('pr')}</td><td class="r">${inp('paid')}</td></tr>`
            })
            .join('')}</tbody></table></div><div style="height:10px"></div></div>`
      })
      .join('')
    return `<div class="screen"><div class="page-x screen-head"><div class="grow"><a class="back-link" href="#/payments/batches">${I('arrowLeft', 'icon-14')} Check batches</a><h1 class="screen-title">Check ${U.esc(b.checkNumber)}</h1><p class="screen-sub">${U.esc(ins.name)} · check date ${U.date(b.checkDate)} · ${b.source === 'ERA' ? 'ERA batch' : 'Manual posting'} · ${UI.chip(open ? 'warning' : 'success', b.status)}</p></div>
      <div class="screen-actions">${canEdit ? UI.btn({ label: 'Delete batch', variant: 'quiet', act: 'bt.delete', data: { id: b.id } }) + UI.btn({ label: 'Add claim', icon: 'plus', act: 'bt.addClaim', data: { id: b.id } }) + UI.btn({ label: 'Post batch', icon: 'check', variant: 'primary', act: 'bt.post', data: { id: b.id } }) : ''}</div></div>
      <div class="page-x screen-body"><div class="balance"><div><div class="eyebrow">Check amount</div><div class="bv">${U.money(b.checkAmount)}</div></div><div><div class="eyebrow">Applied to claims</div><div class="bv">${U.money(applied)}</div></div><div><div class="eyebrow">Left to apply</div><div class="bv ${Math.abs(remaining) < 0.005 ? 'ok' : 'off'}">${U.money(remaining)}</div></div><div><div class="eyebrow">Balanced</div><div class="bv ${Math.abs(remaining) < 0.005 ? 'ok' : 'off'}">${Math.abs(remaining) < 0.005 ? 'Yes' : 'Not yet'}</div></div></div>
        <div class="section">${open ? (claimsHtml || UI.empty({ icon: 'receipt', title: 'No claims in this batch yet', text: `Add the ${U.esc(ins.name)} claims this check pays. Enter the allowed, patient responsibility and paid amounts as they appear on the EOB.`, action: canEdit ? UI.btn({ label: 'Add claim', icon: 'plus', variant: 'primary', act: 'bt.addClaim', data: { id: b.id } }) : '' })) : UI.notice('success', 'Posted.', `Posted ${U.date(b.postedOn)} by ${U.esc(S.userName(b.postedBy))}. See the rows in the payment ledger.`, 'circleCheck')}</div></div></div>`
  },
}
ACT['bt.addClaim'] = (el) => {
  const b = S.find('batches', el.dataset.id)
  const cands = DB.claims.filter((c) => S.inScopeClaim(c) && ['Submitted', 'Denied'].includes(c.status) && E.insOf(S.find('coverages', c.coverageId)).id === b.insuranceId && !b.entries.some((e) => e.claimId === c.id))
  if (!cands.length) {
    UI.toast('info', 'No open claims for this payer', 'Only submitted claims for the batch’s payer can be paid by this check.')
    return
  }
  const h = UI.modal({
    title: 'Add a claim to the batch',
    size: 'md',
    body: UI.form([{ name: 'claimId', label: 'Claim', type: 'select', required: true, options: cands.map((c) => { const r = Cl.row(c); return { value: c.id, label: `${c.number} · ${r.name} · DOS ${U.date(r.dos)} · ${U.money(c.total)}` } }) }]),
    foot: UI.btn({ label: 'Cancel', variant: 'quiet', act: 'layer.close' }) + UI.btn({ label: 'Add claim', variant: 'primary', act: 'bt.addClaimSave' }),
  })
  h.el.dataset.id = b.id
}
ACT['bt.addClaimSave'] = (el) => {
  const layer = el.closest('.layer')
  const vals = UI.submitForm(UI.formOf(layer))
  if (!vals) return
  const b = S.find('batches', layer.dataset.id)
  const c = S.find('claims', vals.claimId)
  E.adjudicate(c, 'paid').lines.forEach((l) => b.entries.push({ claimId: c.id, lineId: l.lineId, cpt: l.cpt, charge: l.charge, allowed: l.allowed, contractual: l.contractual, pr: l.pr, paid: l.paid }))
  UI.closeTop()
  R.refresh()
}
ACT['bt.entry'] = (el) => {
  const b = S.find('batches', el.dataset.id)
  const e = b.entries[Number(el.dataset.i)]
  const val = U.round(parseFloat(String(el.value).replace(/[^\d.]/g, '')) || 0)
  e[el.dataset.f] = val
  if (el.dataset.f === 'allowed') {
    e.contractual = U.round(Math.max(0, e.charge - e.allowed))
    e.paid = U.round(Math.max(0, e.allowed - e.pr))
  }
  if (el.dataset.f === 'pr') e.paid = U.round(Math.max(0, e.allowed - e.pr))
  R.refresh()
}
ACT['bt.removeClaim'] = (el) => {
  const b = S.find('batches', el.dataset.id)
  b.entries = b.entries.filter((e) => e.claimId !== el.dataset.claim)
  R.refresh()
}
ACT['bt.post'] = async (el) => {
  const b = S.find('batches', el.dataset.id)
  if (!b.entries.length) {
    UI.toast('critical', 'The batch is empty', 'Add the claims this check pays before posting.')
    return
  }
  const applied = U.sum(b.entries, (e) => e.paid)
  if (Math.abs(applied - b.checkAmount) >= 0.005) {
    UI.toast('critical', 'The batch must balance to the check amount', `Applied ${U.money(applied)} of ${U.money(b.checkAmount)} — ${U.money(b.checkAmount - applied)} ${applied < b.checkAmount ? 'left to apply' : 'over'}.`, 8000)
    return
  }
  const ok = await UI.confirm({ title: `Post check ${b.checkNumber}?`, message: `${U.money(applied)} is applied to ${U.plural(Object.keys(U.groupBy(b.entries, (e) => e.claimId)).length, 'claim')}. Balances update and any secondary claims are created.`, confirmLabel: 'Post batch' })
  if (!ok) return
  const s = E.postBatch(b)
  UI.toast('success', `Check ${b.checkNumber} posted`, `${U.plural(s.posted, 'claim')} paid${s.secondary.length ? ` · ${U.plural(s.secondary.length, 'secondary claim')} created` : ''}.`)
  R.refresh()
}
ACT['bt.delete'] = async (el) => {
  const b = S.find('batches', el.dataset.id)
  const ok = await UI.confirm({ title: 'Delete this open batch?', message: 'Nothing has been posted from it yet.', confirmLabel: 'Delete batch', tone: 'critical' })
  if (!ok) return
  DB.batches = DB.batches.filter((x) => x.id !== b.id)
  S.log('Open check batch deleted', { module: 'PAYMENTS', detail: b.checkNumber })
  R.go('#/payments/batches')
}
