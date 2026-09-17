/* Claims — lifecycle queues (§7.1), hold queues and release buckets (§6.2, PRD V2 §10.3),
   Rejections & Reasons and daily batch metrics, the claim detail, CMS-1500 and 837P. */

const CL_TABS = [
  { key: 'holds', label: 'Holds', match: (c) => c.status === 'Hold' },
  { key: 'buckets', label: 'Release buckets', match: (c) => c.status === 'Hold' && c.holdReason === 'manual' },
  { key: 'submitted', label: 'Submitted', match: (c) => c.status === 'Submitted' },
  { key: 'rejected', label: 'Rejections', match: (c) => c.status === 'Rejected' },
  { key: 'paid', label: 'Paid', match: (c) => c.status === 'Paid' },
  { key: 'denied', label: 'Denied', match: (c) => c.status === 'Denied' },
  { key: 'all', label: 'All claims', match: () => true },
  { key: 'batches', label: 'Daily batches', match: () => false },
]
const RANK_LABEL = { 1: 'Primary', 2: 'Secondary', 3: 'Tertiary' }

const Cl = {
  row(c) {
    const v = S.visitOf(c)
    const p = S.patientOfVisit(v)
    const ins = E.insOf(S.find('coverages', c.coverageId))
    return { id: c.id, c, v, p, ins, number: c.number, name: S.pname(p), dos: v.dos, payer: ins.name, total: c.total, sent: c.sentDate, sla: c.slaDue, held: c.heldSince, paid: E.claimPaid(c), bal: E.claimBalance(c) }
  },
  fixFor(c) {
    const v = S.visitOf(c)
    const cs = S.caseOf(v)
    const p = S.patientOf(cs)
    return {
      missing: { label: 'Complete claim data', hash: `#/patients/${p.id}/coverage?case=${cs.id}` },
      auth: { label: 'Add authorization', hash: `#/patients/${p.id}/authorizations?case=${cs.id}` },
      cred: { label: 'Update enrollment', hash: `#/admin/providers?open=${v.treatingProviderId}` },
      payer: { label: 'Correct the charge', hash: `#/charges/visit/${v.id}` },
      coding: { label: 'Review diagnosis pointers', hash: `#/charges/visit/${v.id}` },
      manual: null,
    }[c.holdReason]
  },
}

Screens.claims = {
  render(parts, q) {
    if (parts[0] === 'view') return ClaimDetail.render(parts[1], q)
    const tab = CL_TABS.some((t) => t.key === parts[0]) ? parts[0] : 'holds'
    const scope = DB.claims.filter(S.inScopeClaim)
    const tabs = CL_TABS.map((t) => ({ key: t.key, label: t.label, count: t.key === 'batches' || t.key === 'all' ? undefined : scope.filter(t.match).length, alert: ['holds', 'rejected', 'buckets'].includes(t.key), demo: `ctab-${t.key}` }))
    const v = S.view(`claims-${tab}`, { q: '', sort: tab === 'submitted' ? 'sent' : 'dos', dir: 'desc', page: 1, reasons: [] })
    // A deep link filters; plain navigation afterwards shows every reason again.
    if (q.reason && v.appliedQ !== q.reason) {
      v.reasons = [q.reason]
      v.appliedQ = q.reason
    } else if (!q.reason && v.appliedQ) {
      v.reasons = []
      v.appliedQ = null
    }
    const body = tab === 'batches' ? Cl.batches(q) : tab === 'buckets' ? Cl.buckets(scope) : Cl.list(tab, scope, v)
    return `<div class="screen"><div class="page-x screen-head"><div><h1 class="screen-title">Claims</h1><p class="screen-sub">${U.esc(S.practice().name)} · Scrubbing → Hold or Submitted to Waystar${S.level('BILLING') === 'view' ? ' · ' + UI.chip('inert', 'View only') : ''}</p></div>
      <div class="screen-actions">${S.can('BILLING', 'r') && S.can('CHARGES', 'r') ? UI.btn({ label: 'Ready to submit', icon: 'send', act: 'go', data: { hash: '#/charges/ready' } }) : ''}</div></div>
      <div class="page-x screen-body">${UI.tabs(tabs, tab, 'cl.tab')}<div class="mt-16">${body}</div></div></div>`
  },
}
ACT['cl.tab'] = (el) => R.go(`#/claims/${el.dataset.key}`)
ACT['claim.open'] = (el) => R.go(`#/claims/view/${el.dataset.id}`)
ACT['cl.search'] = U.debounce((el) => {
  const v = S.view(el.dataset.view, {})
  v.q = el.value
  v.page = 1
  R.refresh()
}, 220)
ACT['cl.reason'] = (el) => {
  const v = S.view('claims-holds', {})
  v.reasons = v.reasons.includes(el.dataset.key) ? v.reasons.filter((x) => x !== el.dataset.key) : [...v.reasons, el.dataset.key]
  v.page = 1
  R.refresh()
}

Cl.list = (tab, scope, v) => {
  const def = CL_TABS.find((t) => t.key === tab)
  let rows = scope.filter(def.match).map(Cl.row)
  const allTab = rows
  if (tab === 'holds' && v.reasons.length) rows = rows.filter((r) => v.reasons.includes(r.c.holdReason))
  const qq = v.q.toLowerCase()
  if (qq) rows = rows.filter((r) => r.number.toLowerCase().includes(qq) || `${r.p.firstName} ${r.p.lastName}`.toLowerCase().includes(qq) || r.name.toLowerCase().includes(qq))
  const base = [
    { key: 'number', label: 'Claim', sort: true, render: (r) => `<span class="ink fw-500 t-meta nowrap">${r.number}</span><span class="sub">${RANK_LABEL[r.c.rank]}${r.c.frequency !== '1' ? ` · freq ${r.c.frequency}` : ''}</span>` },
    { key: 'name', label: 'Patient', sort: true, render: (r) => `${U.esc(r.name)}<span class="sub">DOS ${U.date(r.dos)}</span>` },
    { key: 'payer', label: 'Payer', sort: true, render: (r) => U.esc(r.payer) },
    { key: 'total', label: 'Amount', sort: true, cls: 'r', render: (r) => `<span class="ink num">${U.money(r.total)}</span>` },
  ]
  let cols
  const canU = S.can('BILLING', 'u')
  if (tab === 'holds') {
    cols = [...base,
      { key: 'reason', label: 'Hold reason', sort: (r) => E.HOLD_ORDER.indexOf(r.c.holdReason), render: (r) => `${r.c.holdReason === 'manual' ? UI.chip('warning', `Release bucket · ${U.esc((E.bucketOf(r.c) || {}).name || '')}`) : UI.chip('critical', E.HOLDS[r.c.holdReason].label)}<span class="sub" style="max-width:320px;white-space:normal">${U.esc(r.c.scrub.results.find((x) => x.key === r.c.holdReason).detail)}</span>` },
      { key: 'held', label: 'Held since', sort: true, render: (r) => U.date(r.held) },
      { key: 'owner', label: 'Owner', render: (r) => UI.ownerCell(r.c.wi) },
      { key: 'act', label: '', cls: 'r', render: (r) => {
        if (!canU) return ''
        if (r.c.holdReason === 'manual') return UI.btn({ label: 'Release', size: 'sm', icon: 'send', act: 'cl.release', data: { id: r.id } })
        const fx = Cl.fixFor(r.c)
        return `<div class="row-actions">${fx ? UI.btn({ label: fx.label, size: 'sm', act: 'go', data: { hash: fx.hash } }) : ''}${UI.btn({ label: 'Re-scrub', size: 'sm', icon: 'refresh', act: 'cl.rescrub', data: { id: r.id } })}</div>`
      } },
    ]
  } else if (tab === 'submitted') {
    cols = [...base,
      { key: 'format', label: 'Format', render: (r) => (r.c.format === 'CMS1500' ? UI.tag('CMS-1500 print') : UI.tag('EDI 837P', 'brand')) },
      { key: 'sent', label: 'Sent', sort: true, render: (r) => `${U.date(r.sent)}<span class="sub">${r.c.accepted ? 'Accepted by Waystar' : 'Awaiting acknowledgement'}</span>` },
      { key: 'sla', label: 'Payer SLA', sort: true, render: (r) => (r.c.ar === 'Delayed' ? UI.chip('warning', 'Delayed — in A/R') : r.sla < DB.today ? `<span class="status critical">Overdue ${U.date(r.sla)}</span>` : `<span class="muted-2">Due ${U.date(r.sla)}</span>`) },
      { key: 'act', label: '', cls: 'r', render: (r) => UI.iconBtn({ icon: 'more', label: 'Claim actions', act: 'cl.menu', data: { id: r.id } }) },
    ]
  } else if (tab === 'rejected') {
    cols = [...base,
      { key: 'rej', label: 'Rejection & reason', render: (r) => `<span class="status critical">${U.esc(r.c.rejection.code)}</span><span class="sub" style="white-space:normal;max-width:320px">${U.esc(r.c.rejection.reason)}</span>` },
      { key: 'when', label: 'Received', sort: (r) => r.c.rejection.date, render: (r) => U.date(r.c.rejection.date) },
      { key: 'owner', label: 'Owner', render: (r) => UI.ownerCell(r.c.wi) },
      { key: 'act', label: '', cls: 'r', render: (r) => (canU ? UI.btn({ label: 'Fix & resubmit', size: 'sm', act: 'cl.fixRejection', data: { id: r.id } }) : '') },
    ]
  } else if (tab === 'paid') {
    cols = [...base,
      { key: 'paidDate', label: 'Paid', sort: (r) => r.c.paidDate, render: (r) => U.date(r.c.paidDate) },
      { key: 'paid', label: 'Paid amount', sort: true, cls: 'r', render: (r) => `<span class="num status success">${U.money(r.paid)}</span>` },
      { key: 'bal', label: 'Balance left', sort: true, cls: 'r', render: (r) => `<span class="num ${r.bal ? 'ink' : 'muted'}">${U.money(r.bal)}</span>` },
    ]
  } else if (tab === 'denied') {
    cols = [...base,
      { key: 'carc', label: 'Denial', render: (r) => { const d = DB.denials.find((x) => x.claimId === r.id); return d ? `<span class="status critical">${U.esc(d.carc)}</span><span class="sub">${U.esc(E.carcDesc(d.carc))}</span>` : '' } },
      { key: 'dstatus', label: 'Denial status', render: (r) => { const d = DB.denials.find((x) => x.claimId === r.id); return d ? UI.chip(DenialTone[d.status], d.status) : '' } },
    ]
  } else {
    cols = [...base, { key: 'status', label: 'Status', sort: (r) => r.c.status, render: (r) => UI.claimChip(r.c) }, { key: 'sent', label: 'Sent', sort: true, render: (r) => (r.sent ? U.date(r.sent) : '<span class="muted">—</span>') }]
  }
  const counts = Object.fromEntries(E.HOLD_ORDER.map((k) => [k, allTab.filter((r) => r.c.holdReason === k).length]))
  const pills = tab === 'holds' ? `<div class="mt-12">${UI.pills(E.HOLD_ORDER.map((k) => ({ key: k, label: E.HOLDS[k].label, count: counts[k] })), v.reasons, 'cl.reason')}</div>` : ''
  const blurb = {
    holds: 'Claims that failed scrubbing, filed strictly by hold reason. Fix the cause and the claim is re-scrubbed and resubmitted automatically. Claims for insurances with the insurance hold checked wait in their release bucket instead, and go out only when a user releases them.',
    submitted: 'Validated, compiled into 837P files or the CMS-1500 print queue, and dispatched to Waystar. Unpaid claims past the payer SLA escalate to A/R.',
    rejected: 'Rejections & Reasons: clearinghouse rejections mapped to their reason codes.',
    paid: 'Adjudicated and paid. Remaining patient responsibility or a secondary claim follows automatically.',
    denied: 'Electronic 835 denials — each is cloned into Denial Management.',
    all: 'Every claim in this practice.',
  }[tab]
  return `<p class="t-micro muted-2" style="margin:0 0 12px">${blurb}</p><div class="control-line">${UI.qsearch(`claims-${tab}-q`, v.q, 'Search by claim # or patient…', 'cl.search').replace('data-input="cl.search"', `data-input="cl.search" data-view="claims-${tab}"`)}${tab === 'holds' && v.reasons.length ? UI.btn({ label: 'Show all hold reasons', variant: 'quiet', act: 'cl.reasonClear' }) : ''}</div>${pills}
    ${UI.table({ cols, rows, view: v, viewKey: `claims-${tab}`, rowAct: 'claim.open', noun: 'claim', mark: (r) => (tab === 'holds' || tab === 'rejected' ? 'critical' : r.c.ar === 'Delayed' ? 'warning' : null), empty: UI.empty({ icon: tab === 'holds' ? 'circleCheck' : 'send', title: qq || v.reasons.length ? 'No claims match' : { holds: 'No claims on hold', submitted: 'Nothing awaiting payment', rejected: 'No open rejections', paid: 'No paid claims', denied: 'No denied claims', all: 'No claims yet' }[tab], text: tab === 'holds' ? 'Every scrubbed claim passed validation.' : '' }) })}`
}
ACT['cl.reasonClear'] = () => {
  S.view('claims-holds', {}).reasons = []
  R.refresh()
}
const DenialTone = { Open: 'critical', Appealed: 'info', Resolved: 'success', 'Written off': 'inert' }

// ---- claim actions
ACT['cl.rescrub'] = (el) => {
  const c = S.find('claims', el.dataset.id)
  const r = E.scrub(c, {})
  if (r === 'Submitted') {
    S.emit('hold.autoresubmitted', { holdsSent: [c] })
    UI.toast('success', `${c.number} passed scrubbing`, 'Submitted to Waystar.')
  } else UI.toast('warning', `${c.number} is still on hold`, U.esc(`${E.HOLDS[c.holdReason].label}: ${c.scrub.results.find((x) => x.key === c.holdReason).detail}`), 7000)
  R.refresh()
}
ACT['cl.release'] = async (el) => {
  const c = S.find('claims', el.dataset.id)
  const ins = E.insOf(S.find('coverages', c.coverageId))
  const b = E.bucketOf(c)
  const ok = await UI.confirm({ title: `Release ${c.number}?`, message: `${ins.name} has the insurance hold checked, so this claim waits in “${b ? b.name : 'its release bucket'}” until a user releases it. Releasing re-runs the checks and sends it to Waystar.`, confirmLabel: 'Release and submit' })
  if (!ok) return
  E.releaseFromBucket(c)
  UI.toast(c.status === 'Submitted' ? 'success' : 'warning', c.status === 'Submitted' ? `${c.number} released and submitted` : `${c.number} is still on hold`, c.status === 'Submitted' ? `${c.format === 'CMS1500' ? 'Added to the CMS-1500 print queue' : 'Sent as EDI 837P'} via Waystar.` : E.HOLDS[c.holdReason].label)
  R.refresh()
}
ACT['cl.releaseAll'] = async (el) => {
  const b = S.find('releaseBuckets', el.dataset.id)
  const waiting = E.waitingInBucket(b.id).filter(S.inScopeClaim)
  if (!waiting.length) return
  const ok = await UI.confirm({ title: `Release all ${U.plural(waiting.length, 'claim')} in “${b.name}”?`, message: 'Each claim re-runs the scrubbing checks and is submitted to Waystar if it still passes.', confirmLabel: `Release ${U.plural(waiting.length, 'claim')}` })
  if (!ok) return
  let sent = 0
  waiting.forEach((c) => { if (E.releaseFromBucket(c) === 'Submitted') sent += 1 })
  UI.toast(sent === waiting.length ? 'success' : 'warning', `${sent} of ${U.plural(waiting.length, 'claim')} submitted`, sent === waiting.length ? 'Released from the bucket and sent via Waystar.' : 'Some claims failed a check on release and are now in Holds.')
  R.refresh()
}

// ---- release buckets (PRD V2 §6.2, §10.3 — CH-01, CH-03)
Cl.buckets = (scope) => {
  const buckets = DB.releaseBuckets.filter((b) => b.practiceId === S.session.practiceId)
  const canU = S.can('BILLING', 'u')
  const cards = buckets
    .map((b) => ({ b, waiting: scope.filter((c) => c.status === 'Hold' && c.holdReason === 'manual' && c.bucketId === b.id), ins: DB.insurances.filter((i) => i.releaseBucketId === b.id && i.insuranceHold) }))
    .filter((x) => x.b.isActive || x.waiting.length)
    .map(({ b, waiting, ins }) => `<div class="card mb-16"><div class="card-head"><span class="card-title">${U.esc(b.name)}</span>${b.isActive ? '' : ' ' + UI.chip('inert', 'Inactive')}<span class="ml-auto">${canU && waiting.length ? UI.btn({ label: `Release all ${waiting.length}`, icon: 'send', act: 'cl.releaseAll', data: { id: b.id } }) : ''}</span></div>
      <div class="card-body" style="padding-top:4px">
        ${b.description ? `<p class="t-meta muted-2" style="margin:0 0 8px">${U.esc(b.description)}</p>` : ''}
        <div class="t-micro muted mb-8">Held insurances: ${ins.length ? ins.map((i) => U.esc(S.insLabel(i))).join(' · ') : 'none assigned'}</div>
        ${UI.table({
          cols: [
            { key: 'number', label: 'Claim', render: (r) => `<span class="ink fw-500 t-meta nowrap">${r.number}</span><span class="sub">${RANK_LABEL[r.c.rank]}</span>` },
            { key: 'name', label: 'Patient', render: (r) => `${U.esc(r.name)}<span class="sub">DOS ${U.date(r.dos)}</span>` },
            { key: 'payer', label: 'Payer', render: (r) => U.esc(r.payer) },
            { key: 'total', label: 'Amount', cls: 'r', render: (r) => `<span class="ink num">${U.money(r.total)}</span>` },
            { key: 'held', label: 'Waiting since', render: (r) => U.date(r.held) },
            { key: 'act', label: '', cls: 'r', render: (r) => (canU ? UI.btn({ label: 'Release', size: 'sm', icon: 'send', act: 'cl.release', data: { id: r.id } }) : '') },
          ],
          rows: waiting.map(Cl.row), view: S.view(`bucket-${b.id}`, { page: 1 }), viewKey: `bucket-${b.id}`, rowAct: 'claim.open', noun: 'claim',
          empty: UI.empty({ icon: 'circleCheck', title: 'Nothing waiting', text: 'Claims for the insurances above stop here after scrubbing.' }),
        })}
      </div></div>`)
    .join('')
  return `<p class="t-micro muted-2" style="margin:0 0 12px">A release bucket is a named manual-release queue created by a Practice Admin. Claims for insurances with the insurance hold checked stop here after scrubbing and go out only when a user releases them. Releasing checks the claim again before sending it.</p>
    ${cards || UI.empty({ icon: 'layers', title: 'No release buckets', text: 'Create one in Admin → Release buckets, then check the insurance hold on an insurance.' })}
    ${S.can('ADMIN', 'r') ? `<div class="mt-8">${UI.btn({ label: 'Manage release buckets', icon: 'arrowRight', variant: 'quiet', act: 'go', data: { hash: '#/admin/buckets' } })}</div>` : ''}`
}
ACT['cl.menu'] = (el) => {
  const c = S.find('claims', el.dataset.id)
  const canC = S.can('BILLING', 'c')
  UI.menu(el, [
    { label: 'Open claim', icon: 'file', act: 'go', data: { hash: `#/claims/view/${c.id}` } },
    ...(canC && ['Submitted', 'Paid', 'Denied'].includes(c.status) ? [{ label: 'Create corrected claim', sub: 'Frequency 7 — replacement', icon: 'copy', act: 'cl.corrected', data: { id: c.id, freq: '7' } }, { label: 'Void claim', sub: 'Frequency 8', icon: 'ban', act: 'cl.corrected', data: { id: c.id, freq: '8' }, danger: true }] : []),
  ], { align: 'end' })
}
ACT['cl.corrected'] = async (el) => {
  UI.closeMenu()
  const c = S.find('claims', el.dataset.id)
  const freq = el.dataset.freq
  const ok = await UI.confirm({
    title: freq === '8' ? `Void ${c.number}?` : `Create a corrected claim for ${c.number}?`,
    message: freq === '8' ? 'A frequency-8 claim tells the payer to cancel the original. Box 22 carries the original reference.' : 'A frequency-7 replacement is created from the current charge lines and scrubbed. Box 22 carries the original reference.',
    confirmLabel: freq === '8' ? 'Void claim' : 'Create corrected claim',
    tone: freq === '8' ? 'critical' : 'primary',
  })
  if (!ok) return
  const nc = E.corrected(c, freq, null)
  Scrub.show([nc], freq === '8' ? 'Void claim (frequency 8)' : 'Corrected claim (frequency 7)', null)
  R.refresh()
}
ACT['cl.fixRejection'] = (el) => {
  const c = S.find('claims', el.dataset.id)
  const v = S.visitOf(c)
  const cs = S.caseOf(v)
  const p = S.patientOf(cs)
  const hint = /Subscriber|member/i.test(c.rejection.reason) ? { label: 'Check coverage', hash: `#/patients/${p.id}/coverage?case=${cs.id}` } : /NPI/.test(c.rejection.reason) ? { label: 'Check providers', hash: '#/admin/providers' } : { label: 'Open the case', hash: `#/patients/${p.id}/case?case=${cs.id}` }
  const h = UI.modal({
    title: `Fix & resubmit ${c.number}`,
    desc: `Waystar rejected this claim on ${U.date(c.rejection.date)}.`,
    size: 'md',
    body: `${UI.notice('critical', `${c.rejection.code}.`, U.esc(c.rejection.reason), 'alert')}<p class="t-meta mt-16">Correct the source data, then resubmit. The claim runs through scrubbing again before it is sent.</p><div class="mt-12">${UI.btn({ label: hint.label, icon: 'arrowRight', act: 'go', data: { hash: hint.hash } })}</div>`,
    foot: UI.btn({ label: 'Cancel', variant: 'quiet', act: 'layer.close' }) + UI.btn({ label: 'Resubmit now', variant: 'primary', act: 'cl.resubmit' }),
  })
  h.el.dataset.id = c.id
}
ACT['cl.resubmit'] = (el) => {
  const c = S.find('claims', el.closest('.layer').dataset.id)
  UI.closeTop()
  E.resubmit(c)
  Scrub.show([c], 'Resubmission', null)
  R.refresh()
}
ACT['cl.delete'] = async (el) => {
  const c = S.find('claims', el.dataset.id)
  const ok = await UI.confirm({ title: `Delete ${c.number}?`, message: 'Only claims that were never sent can be deleted; the visit returns to Ready to submit.', confirmLabel: 'Delete claim', tone: 'critical' })
  if (!ok) return
  DB.claims = DB.claims.filter((x) => x.id !== c.id)
  const v = S.visitOf(c) || S.find('visits', c.visitId)
  if (v && !E.claimsOfVisit(v.id).length) v.status = 'Released'
  S.log('Unsent claim deleted', { module: 'BILLING', entityType: 'visit', entityId: c.visitId, detail: c.number })
  UI.toast('success', 'Claim deleted', 'The visit is back in Ready to submit.')
  R.go('#/claims/holds')
}

// ---- daily batch metrics (§7.2)
Cl.batches = (q) => {
  const runs = DB.runs.filter((r) => r.practiceId === S.session.practiceId)
  const dates = U.uniq([DB.today, ...runs.map((r) => r.date)]).sort().reverse().slice(0, 8)
  const st = S.view('batches', { date: DB.today })
  const day = st.date
  const dayRuns = runs.filter((r) => r.date === day)
  const attempted = U.sum(dayRuns, (r) => r.attempted)
  const sent = U.sum(dayRuns, (r) => r.sent)
  const held = {}
  dayRuns.forEach((r) => Object.entries(r.held).forEach(([k, n]) => (held[k] = (held[k] || 0) + n)))
  const claims = DB.claims.filter(S.inScopeClaim)
  const rej = claims.filter((c) => (c.rejection && c.rejection.date === day) || (c.rejectionHistory || []).some((x) => x && x.date === day))
  return `<p class="t-micro muted-2" style="margin:0 0 12px">Submissions within a calendar day are consolidated into one batch view across all users and jobs.</p>
    ${UI.pills(dates.map((d) => ({ key: d, label: d === DB.today ? 'Today' : U.dateShort(d) })), [day], 'cl.batchDay')}
    <div class="balance mt-16"><div><div class="eyebrow">Attempted submissions</div><div class="bv">${attempted}</div><div class="t-micro muted">All users and jobs</div></div><div><div class="eyebrow">Actual batch count</div><div class="bv ok">${sent}</div><div class="t-micro muted">Reached the clearinghouse</div></div><div><div class="eyebrow">Held / failed</div><div class="bv ${attempted - sent ? 'off' : ''}">${attempted - sent}</div><div class="t-micro muted">${Object.entries(held).map(([k, n]) => `${E.HOLDS[k].label} ${n}`).join(' · ') || 'None'}</div></div><div><div class="eyebrow">Clearinghouse rejections</div><div class="bv">${rej.length}</div><div class="t-micro muted">${rej.length ? `<a href="#/claims/rejected">See Rejections & Reasons</a>` : 'None received'}</div></div></div>
    <div class="section">${UI.sectionHead('Submission runs', U.dateLong(day))}
    ${UI.table({
      cols: [
        { key: 'time', label: 'Time', render: (r) => `<span class="ink fw-500">${r.time}</span>` },
        { key: 'mode', label: 'Mode', render: (r) => UI.tag(r.mode, r.mode === 'Scheduled' ? '' : 'brand') },
        { key: 'by', label: 'Run by', render: (r) => U.esc(r.by) },
        { key: 'attempted', label: 'Attempted', cls: 'r', render: (r) => r.attempted },
        { key: 'sent', label: 'Sent', cls: 'r', render: (r) => `<span class="status success">${r.sent}</span>` },
        { key: 'held', label: 'Held', cls: 'r', render: (r) => (r.attempted - r.sent ? `<span class="status critical">${r.attempted - r.sent}</span>` : '0') },
        { key: 'ref', label: 'Batch ref', render: (r) => `<span class="muted">${r.ref}</span>` },
      ],
      rows: dayRuns, view: S.view('batch-runs', { page: 1 }), viewKey: 'batch-runs', rowAct: 'cl.run', noun: 'run',
      empty: UI.empty({ icon: 'clock', title: 'No submissions on this day', text: day === DB.today ? 'Submit from Charges → Ready to submit, or run the scheduled job.' : '' }),
    })}</div>`
}
ACT['cl.batchDay'] = (el) => {
  S.view('batches', {}).date = el.dataset.key
  R.refresh()
}
ACT['cl.run'] = (el) => {
  const run = S.find('runs', el.dataset.id)
  UI.drawer({
    title: `${run.mode} run · ${run.time}`,
    desc: `${U.dateLong(run.date)} · ${U.esc(run.by)} · ${run.ref}`,
    wide: true,
    body: run.claimIds.map((id) => S.find('claims', id)).filter(Boolean).map((c) => { const r = Cl.row(c); return `<div class="row" style="padding:10px 0;border-bottom:1px solid var(--rule-row)"><a href="#/claims/view/${c.id}" class="fw-500" data-act="go" data-hash="#/claims/view/${c.id}">${c.number}</a><span class="muted-2 t-micro">${U.esc(r.name)} · ${U.esc(r.payer)}</span><span class="ml-auto">${UI.claimChip(c)}</span></div>` }).join(''),
    foot: UI.btn({ label: 'Close', variant: 'primary', act: 'layer.close' }),
  })
}

// ================================================================ claim detail
const ClaimDetail = {
  render(id, q) {
    const c = S.find('claims', id)
    if (!c || !S.inScopeClaim(c)) return `<div class="screen"><div class="page-x screen-head"><h1 class="screen-title">Claim not found</h1></div><div class="page-x">${UI.empty({ title: 'This claim is not in the current practice', action: UI.btn({ label: 'Back to claims', act: 'go', data: { hash: '#/claims' } }) })}</div></div>`
    const r = Cl.row(c)
    const tab = ['summary', 'cms1500', 'edi', 'payments', 'history'].includes(q.tab) ? q.tab : 'summary'
    const cov = S.find('coverages', c.coverageId)
    let actions = ''
    const canU = S.can('BILLING', 'u')
    const canC = S.can('BILLING', 'c')
    if (c.status === 'Hold' && canU) {
      if (c.holdReason === 'manual') actions += UI.btn({ label: 'Release from bucket', icon: 'send', variant: 'primary', act: 'cl.release', data: { id: c.id } })
      else {
        const fx = Cl.fixFor(c)
        actions += UI.btn({ label: 'Re-scrub', icon: 'refresh', act: 'cl.rescrub', data: { id: c.id } }) + (fx ? UI.btn({ label: fx.label, icon: 'arrowRight', variant: 'primary', act: 'go', data: { hash: fx.hash } }) : '')
      }
      if (S.can('BILLING', 'd')) actions += UI.iconBtn({ icon: 'trash', label: 'Delete unsent claim', act: 'cl.delete', data: { id: c.id }, danger: true })
    }
    if (c.status === 'Rejected' && canU) actions += UI.btn({ label: 'Fix & resubmit', icon: 'refresh', variant: 'primary', act: 'cl.fixRejection', data: { id: c.id } })
    if (canC && ['Submitted', 'Paid', 'Denied'].includes(c.status)) actions += UI.btn({ label: 'More', icon: 'more', act: 'cl.menu', data: { id: c.id } })
    if (c.format === 'CMS1500' || tab === 'cms1500') actions += UI.btn({ label: 'Print CMS-1500', icon: 'printer', act: 'cms.print', data: { id: c.id } })
    const notices = []
    if (c.status === 'Hold' && c.holdReason === 'manual') notices.push(UI.notice('warning', 'Waiting in a release bucket:', `${U.esc(c.scrub.results.find((x) => x.key === 'manual').detail)} It is never resubmitted automatically.`, 'clock'))
    else if (c.status === 'Hold') notices.push(UI.notice('critical', `${E.HOLDS[c.holdReason].label}:`, `${U.esc(c.scrub.results.find((x) => x.key === c.holdReason).detail)} Fix the cause and the claim is resubmitted automatically.`, 'alert'))
    if (c.status === 'Rejected') notices.push(UI.notice('critical', `Rejected ${U.date(c.rejection.date)} — ${U.esc(c.rejection.code)}:`, U.esc(c.rejection.reason), 'alert'))
    if (c.ar === 'Delayed' && c.status === 'Submitted') notices.push(UI.notice('warning', 'Delayed A/R:', `The payer SLA was due ${U.date(c.slaDue)} with no payment acknowledgement, so the claim was cloned into A/R follow-up on ${U.date(c.arSince)}.`, 'clock'))
    if (['Replaced', 'Voided'].includes(c.status)) notices.push(UI.notice('info', `${c.status}:`, `See <a href="#/claims/view/${c.replacedBy}">${S.find('claims', c.replacedBy)?.number}</a>.`, 'history'))
    if (c.originalClaimId) notices.push(UI.notice('info', `Frequency ${c.frequency} ${c.frequency === '8' ? 'void' : 'replacement'}:`, `Box 22 carries original reference ${U.esc(c.originalRef)} from <a href="#/claims/view/${c.originalClaimId}">${S.find('claims', c.originalClaimId)?.number}</a>.`, 'copy'))
    if (c.primaryClaimId) notices.push(UI.notice('info', 'Secondary claim:', `Created after the primary remit posted on <a href="#/claims/view/${c.primaryClaimId}">${S.find('claims', c.primaryClaimId)?.number}</a>. Box 29 shows the ${U.money(c.box29)} the primary paid.`, 'layers'))
    const tabs = [{ key: 'summary', label: 'Summary' }, { key: 'cms1500', label: 'CMS-1500' }, { key: 'edi', label: '837P' }, { key: 'payments', label: 'Payments', count: E.paymentsOfClaim(c.id).length }, { key: 'history', label: 'History' }]
    const body = { summary: () => ClaimDetail.summary(c, r, cov), cms1500: () => Cms.view(c), edi: () => `<p class="t-micro muted-2 mb-8">X12 837P professional claim built from the same fields as the CMS-1500.</p><pre class="edi">${U.esc(Edi.build(c))}</pre>`, payments: () => ClaimDetail.payments(c), history: () => UI.historyView('claim', c.id, [['visit', c.visitId]]) }[tab]()
    return `<div class="screen"><div class="page-x screen-head"><div class="grow"><a class="back-link" href="#/claims/${{ Hold: 'holds', Submitted: 'submitted', Rejected: 'rejected', Paid: 'paid', Denied: 'denied' }[c.status] || 'all'}">${I('arrowLeft', 'icon-14')} Claims</a><h1 class="screen-title">Claim ${c.number}</h1>
      <p class="screen-sub row-wrap">${UI.claimChip(c)} ${UI.tag(RANK_LABEL[c.rank], 'brand')} <a href="#/patients/${r.p.id}/visits?case=${r.v.caseId}">${U.esc(S.pfull(r.p))}</a><span class="muted">·</span><span>DOS ${U.date(r.dos)}</span><span class="muted">·</span><span>${U.esc(S.insLabel(r.ins))}</span><span class="muted">·</span><span>${c.format === 'CMS1500' ? 'CMS-1500 (paper)' : 'EDI 837P'}</span></p></div><div class="screen-actions">${actions}</div></div>
      <div class="page-x screen-body">${notices.join('<div class="mt-8"></div>')}<div class="mt-16">${UI.tabs(tabs, tab, 'cd.tab', { id: c.id })}</div><div class="mt-16">${body}</div></div></div>`
  },
  summary(c, r, cov) {
    const lines = E.claimLines(c)
    const pm = (l, kind) => U.sum(DB.payments.filter((p) => p.claimId === c.id && p.chargeLineId === l.id && p.kind === kind && !p.reversed), (p) => p.amount)
    const snap = c.snapshot || E.snapshot(c)
    const rows = (c.snapshot ? snap.map((s) => ({ s, l: S.find('chargeLines', s.lineId) })) : lines.map((l) => ({ s: null, l })))
      .map(({ s, l }) => {
        const code = s ? s.code : E.pc(l.procedureCodeId).code
        return `<tr><td><span class="code">${code}</span> <span class="muted">${U.esc((s ? s.modifiers : l.modifiers).join(' '))}</span></td><td>${(s ? s.pointers : l.pointers).join(', ')}</td><td class="r">${s ? s.units : l.units}</td><td class="r num ink">${U.money(s ? s.amount : l.amount)}</td><td class="r num">${U.money(pm(l, 'Insurance payment'))}</td><td class="r num">${U.money(pm(l, 'Adjustment'))}</td><td class="r num">${U.money(l.balPat)}</td><td class="r num ink">${U.money(l.void ? 0 : l.balIns)}</td></tr>`
      })
      .join('')
    const ICON = { pass: 'check', fail: 'x', skip: 'more' }
    const scrub = c.scrub
      ? `<ul class="checks">${c.scrub.results.map((x) => `<li><span class="ck ${x.status}">${I(ICON[x.status])}</span><div class="grow"><div class="c-name">${U.esc(x.name)}</div><div class="c-detail">${U.esc(x.detail)}</div></div><span class="c-src">${U.esc(x.source)}</span></li>`).join('')}</ul>`
      : '<p class="muted t-micro">Not scrubbed yet.</p>'
    const canU = S.can('BILLING', 'u')
    return `<div class="grid-2 grid-2-1"><div>
      ${UI.sectionHead('Charge lines', c.snapshot ? 'As billed — frozen at submission' : 'Current lines')}
      <div class="tbl-wrap scroll-x"><table class="tbl"><thead><tr><th>Code</th><th>Pointers</th><th class="r">Units</th><th class="r">Charge</th><th class="r">Ins. paid</th><th class="r">Adjusted</th><th class="r">Pt. balance</th><th class="r">Ins. balance</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="3">Total (Box 28)</td><td class="r num">${U.money(c.total)}</td><td class="r num">${U.money(E.claimPaid(c))}</td><td colspan="3"></td></tr></tfoot></table></div>
      <div class="section">${UI.sectionHead('Scrubbing results', c.scrub ? `Run ${U.stampLabel(c.scrub.at, DB.today)}` : '')}${scrub}</div>
      <div class="section">${UI.sectionHead('Box 19 — claim comment', 'Free-text comment per claim')}
        <div class="row gap-8 mt-12"><div class="control grow ${canU && !c.snapshot ? '' : 'disabled'}"><input id="box19-${c.id}" value="${U.esc(c.box19)}" maxlength="80" placeholder="${canU && !c.snapshot ? 'Optional note printed in Box 19' : 'No comment'}" ${canU && !c.snapshot ? '' : 'disabled'} aria-label="Box 19 comment"></div>${canU && !c.snapshot ? UI.btn({ label: 'Save', act: 'cd.box19', data: { id: c.id } }) : ''}</div>
        ${c.snapshot ? '<div class="t-micro muted mt-8">Sent claims are frozen — use a corrected claim to change what was billed.</div>' : ''}</div>
    </div><div class="stack gap-16">
      <div class="card"><div class="card-head"><span class="card-title">Claim facts</span></div><div class="card-body" style="padding-top:4px">${UI.kv([
        ['Payer', S.insLabel(r.ins)], ['Coverage', `${RANK_LABEL[c.rank]} · member ${cov.memberId}`], ['Format', c.format === 'CMS1500' ? 'CMS-1500 print queue' : 'EDI 837P'],
        ['Frequency code', c.frequency === '1' ? '1 — Original' : c.frequency === '7' ? '7 — Replacement' : '8 — Void'], ['Sent', c.sentDate ? U.date(c.sentDate) : ''],
        ['Referring physician', (() => { const rf = S.find('referrers', c.referrerId); return rf ? `${rf.name} · ${rf.type === 'DQ' ? 'DQ supervising' : 'DN referring'} (snapshot at creation)` : '' })()],
        ['Release bucket', c.released ? `Released from ${U.esc((S.find('releaseBuckets', c.released.bucketId) || {}).name || '')} by ${U.esc(S.userName(c.released.by))}` : c.holdReason === 'manual' ? U.esc((E.bucketOf(c) || {}).name || '') : ''],
        ['Clearinghouse ref', c.clearinghouseRef], ['Payer claim #', c.payerIcn], ['Payer SLA due', c.slaDue ? U.date(c.slaDue) : ''], ['Amount paid (Box 29)', U.money(c.box29 || 0)], ['Balance', U.money(E.claimBalance(c))],
      ])}</div></div>
      ${UI.workItemView(c.wi || S.workItem(), 'claim', c.id, 'BILLING', UI.claimLabel(c))}
    </div></div>`
  },
  payments(c) {
    const rows = E.paymentsOfClaim(c.id).map((p) => ({ ...p, code: p.chargeLineId ? E.pc(S.find('chargeLines', p.chargeLineId).procedureCodeId).code : '' }))
    return UI.table({
      cols: [
        { key: 'postedDate', label: 'Posted', sort: true, render: (p) => U.date(p.postedDate) },
        { key: 'kind', label: 'Type', render: (p) => UI.tag(p.kind, p.kind === 'Insurance payment' ? 'brand' : p.kind === 'Reversal' ? 'sand' : '') },
        { key: 'code', label: 'Line', render: (p) => `<span class="code">${p.code}</span>` },
        { key: 'reasonCode', label: 'Reason', render: (p) => (p.reasonCode ? `${U.esc(p.reasonCode)} <span class="muted">${U.esc(E.carcDesc(p.reasonCode))}</span>` : p.prCode ? `<span class="muted">Patient resp. ${U.money(p.pr)} (${p.prCode})</span>` : '') },
        { key: 'checkNumber', label: 'Check / ERA', render: (p) => U.esc(p.checkNumber) },
        { key: 'amount', label: 'Amount', cls: 'r', render: (p) => `<span class="num ink">${U.money(p.amount)}</span>${p.reversed ? ' ' + UI.chip('inert', 'Reversed') : ''}` },
      ],
      rows, view: S.view(`cpay-${c.id}`, { page: 1, sort: 'postedDate', dir: 'desc' }), viewKey: `cpay-${c.id}`, noun: 'payment row',
      empty: UI.empty({ icon: 'wallet', title: 'No payments yet', text: 'Payments appear once an ERA or a check batch is posted.' }),
    })
  },
}
ACT['cd.tab'] = (el) => R.go(`#/claims/view/${el.dataset.id}?tab=${el.dataset.key}`)
ACT['cd.box19'] = (el) => {
  const c = S.find('claims', el.dataset.id)
  c.box19 = document.getElementById(`box19-${c.id}`).value.trim()
  S.log('Box 19 comment updated', { module: 'BILLING', entityType: 'claim', entityId: c.id, detail: c.box19 || '(cleared)' })
  UI.toast('success', 'Box 19 comment saved')
  R.refresh()
}

// ================================================================ CMS-1500 (§8)
const Cms = {
  boxes(c) {
    const v = S.visitOf(c)
    const cs = S.caseOf(v)
    const p = S.patientOf(cs)
    const cov = S.find('coverages', c.coverageId)
    const ins = E.insOf(cov)
    const pr = S.find('practices', p.practiceId)
    const loc = S.find('locations', v.locationId)
    const prov = S.find('providers', v.treatingProviderId)
    // Box 17 / 17b: the claim's own snapshot of the referring physician (PRD V2 §10.5, CH-11)
    const ref = S.find('referrers', c.referrerId)
    const other = c.rank === 1 ? E.coverage(cs.id, 2) : E.coverage(cs.id, 1)
    const otherIns = other ? E.insOf(other) : null
    const sub = cov.subscriber
    const insuredName = sub ? sub.name : `${p.lastName}, ${p.firstName}`
    const addr = (a) => (a ? `${a.line1}${a.line2 ? ', ' + a.line2 : ''}, ${a.city}, ${a.state} ${a.zip}` : '')
    const plan = { Medicare: 'Medicare', Commercial: 'Group health plan', 'Workers Comp': 'Other', PIP: 'Other' }[ins.type] || 'Other'
    // Place of service is per charge line in PRD V2 (CH-10). Box 32 is omitted only when every
    // line is home or telehealth (prototype assumption A-P40, Q-079).
    const snapLines = c.snapshot || E.snapshot(c)
    const linePos = U.uniq(snapLines.map((s) => s.pos))
    const home = linePos.length > 0 && linePos.every((x) => ['02', '10', '12'].includes(x))
    const L = 'ABCDEFGHIJKL'
    const dxList = (v.dx || []).map((d, i) => `${L[i]}. ${d}`).join('   ')
    const B = (box, label, value, mand, source, comment = '', span = 6) => ({ box, label, value, mand, source, comment, span })
    return {
      carrier: B('Top', 'Carrier', `${ins.name}, ${addr(ins.address)}`, 'Y', 'Insurance', 'Name and address of the insurance.', 12),
      boxes: [
        B('1', 'Plan type', plan, 'Y', 'Insurance', 'Plan type.', 6),
        B('1a', 'Insured’s ID number', cov.memberId, 'Y', 'Insurance', 'Patient ID.', 6),
        B('2', 'Patient’s name', `${p.lastName}, ${p.firstName}${p.middleName ? ' ' + p.middleName[0] : ''}`, 'Y', 'Patient chart', 'Name.', 4),
        B('3', 'Patient DOB · sex', `${U.date(p.dob)} · ${p.gender === 'Female' ? 'F' : p.gender === 'Male' ? 'M' : '—'}`, 'Y', 'Patient chart', 'DOB and sex.', 3),
        B('4', 'Insured’s name', insuredName, 'Y', 'Insurance', 'Insured name.', 5),
        B('5', 'Patient’s address', addr(p.address), 'Y', 'Patient chart', 'Patient address.', 4),
        B('6', 'Relationship to insured', sub ? sub.relationship || 'Other' : 'Self', 'Y', 'Insurance', 'Relationship to insured.', 3),
        B('7', 'Insured’s address', sub ? '(subscriber address not captured)' : addr(p.address), 'Y', 'Insurance', 'Insured’s address.', 5),
        B('8', 'Reserved for NUCC use', '', 'NA', '—', '', 2),
        B('9', 'Other insured’s name', other ? (other.subscriber ? other.subscriber.name : `${p.lastName}, ${p.firstName}`) : '', 'N', 'Case / insurance', 'If a secondary insurance is on the case.', 3),
        B('9a', 'Other insured’s policy', other ? other.memberId : '', 'N', 'Case / insurance', 'Secondary insurance ID.', 3),
        B('9b', 'Reserved', '', 'NA', '—', '', 1),
        B('9c', 'Reserved', '', 'NA', '—', '', 1),
        B('9d', 'Other plan name', otherIns ? otherIns.name : '', 'N', 'Case / insurance', 'Secondary insurance name.', 2),
        B('10a', 'Employment related', cs.injuryType === 'Employment Related' ? 'YES' : 'NO', 'Y', 'Case', 'Related cause.', 4),
        B('10b', 'Auto accident · state', cs.injuryType === 'Auto' ? `YES · ${cs.accidentState || '??'}` : 'NO', 'Y', 'Case', 'If YES, 2-letter state.', 4),
        B('10c', 'Other accident', 'NO', 'Y', 'Case', '', 4),
        B('11', 'Insured’s group number', cov.groupNumber, 'N', 'Insurance', 'Filled if a group number exists.', 3),
        B('11a', 'Insured’s DOB · sex', sub ? (sub.dob ? U.date(sub.dob) : '') : `${U.date(p.dob)} · ${p.gender === 'Female' ? 'F' : 'M'}`, 'Y', 'Insurance', 'Insured DOB and gender.', 3),
        B('11b', 'Other claim ID', cov.claimNumber ? `Y4 · ${cov.claimNumber}` : '', 'N', 'Insurance + type', 'PIP/WC claim number with qualifier.', 3),
        B('11c', 'Insurance plan name', '', 'NA', '—', '', 1),
        B('11d', 'Another health plan?', other ? 'YES' : 'NO', 'Y', 'Case', 'Y if a secondary exists.', 2),
        B('12', 'Patient signature', `SOF · ${U.date(v.dos)}`, 'Y', 'Constant', 'SOF + date of service.', 6),
        B('13', 'Insured signature', 'SOF', 'Y', 'Constant', 'SOF.', 6),
        B('14', 'Date of current illness', cs.injuryDate ? `431 · ${U.date(cs.injuryDate)}` : '', 'N', 'Case', 'Onset / injury date with qualifier.', 4),
        B('15', 'Other date', ['Auto', 'Employment Related'].includes(cs.injuryType) && cs.injuryDate ? `439 · ${U.date(cs.injuryDate)}` : '', 'N', 'Case', 'Mostly the accident date.', 4),
        B('16', 'Unable to work', '', 'NA', '—', '', 4),
        B('17', 'Referring / supervising', ref ? `${ref.type || 'DN'} · ${ref.name}` : '', 'N', 'Case + referring profile', 'Snapshot taken when the claim was created; the physician’s type sets DN (referring) or DQ (supervising).', 5),
        B('17a', 'Other ID', '', 'N', 'Referring physician', 'Other ID + qualifier.', 3),
        B('17b', 'NPI', ref ? ref.npi : '', 'N', 'Referring physician', 'NPI.', 4),
        B('18', 'Hospitalization dates', '', 'NA', '—', '', 4),
        B('19', 'Additional claim information', c.box19, 'N', 'Custom comment', 'Free text per claim.', 4),
        B('20', 'Outside lab', 'NO', 'Y', 'Constant', 'No by default.', 4),
        B('21', `Diagnoses · ICD ind. ${E.eff(ins, 'icdVersion') === 'ICD9' ? '9' : '0'}`, dxList, 'Y', 'Case', 'ICD indicator 0 (ICD-10).', 12),
        B('22', 'Resubmission code · original ref', c.frequency !== '1' ? `${c.frequency} · ${c.originalRef}` : '', 'N', 'Corrected / void', 'Required on a corrected claim.', 6),
        B('23', 'Prior authorization', c.authId ? S.find('authorizations', c.authId).number : E.authUsable(v)?.number || '', 'N', 'Case / insurance (auth)', 'Authorization reference number.', 6),
      ],
      lines: snapLines.map((s) => ({
        a: U.date(v.dos), b: s.pos, c: '', d: `${s.code} ${s.modifiers.join(' ')}`, e: s.pointers.map((ptr) => L[ptr - 1]).join(''),
        f: U.money(s.amount, { plain: true }), g: s.units, h: '', i: 'NPI', j: prov ? prov.npi || '(missing)' : '',
      })),
      bottom: [
        B('25', 'Federal tax ID', `${pr.taxId} · ${pr.taxIdType === 'EIN' ? 'EIN ☑' : 'SSN ☑'}`, 'Y', 'Organization', 'Tax ID or SSN (EIN checked).', 3),
        B('26', 'Patient account no.', String(p.billingId), 'Y', 'Patient chart', 'Internal patient ID.', 3),
        B('27', 'Accept assignment', E.eff(ins, 'acceptAssignment') === false ? 'NO' : 'YES', 'Y', 'System default', 'Yes unless set to No (effective insurance/class setting).', 2),
        B('28', 'Total charge', U.money(c.total), 'Y', 'Calculation', 'Sum of charge amounts.', 2),
        B('29', 'Amount paid', U.money(c.rank > 1 ? c.box29 || 0 : 0), 'Y', 'Calculation', 'Paid amount when billing secondary; 0 for primary.', 1),
        B('30', 'Reserved', '', 'NA', '—', '', 1),
        B('31', 'Signature of physician', prov ? `${S.provName(prov)} · ${U.date(v.dos)}` : '', 'Y', 'Provider', 'Provider name + DOS.', 4),
        B('32', 'Service facility', home ? '(omitted — POS ' + linePos.join(', ') + ')' : `${loc.name}, ${addr(loc.address)}`, 'Conditional', 'Clinic profile', 'All POS except home or telehealth (02, 10, 12).', 4),
        B('32a', 'Facility NPI', pr.npi, 'Y', 'Organization', 'Group NPI.', 2),
        B('32b', 'Other ID', '', 'NA', '—', '', 2),
        B('33', 'Billing provider', `${pr.legalName}, ${addr(pr.address)} · ${pr.phone}`, 'Y', 'Organization', 'Organization name + billing address.', 6),
        B('33a', 'Billing NPI', pr.npi, 'Y', 'Organization', 'Group NPI.', 3),
        B('33b', 'Other ID', `ZZ · ${pr.taxonomy}`, 'Y', 'Organization', 'Qualifier + group taxonomy.', 3),
      ],
    }
  },
  html(c, showSrc) {
    const b = Cms.boxes(c)
    const flag = (m) => (m === 'Y' ? 'Mandatory' : m === 'NA' ? 'Left blank (NA)' : m === 'Conditional' ? 'Conditional' : 'Optional')
    const box = (x) => `<div class="cms-box ${x.mand === 'Y' ? 'mand' : ''}" style="grid-column:span ${x.span}" title="Box ${x.box} · ${U.esc(x.label)}"><div class="bx"><b>${x.box}</b> ${U.esc(x.label)}</div><div class="bv ${x.value ? '' : 'blank'}">${x.value ? U.esc(x.value) : x.mand === 'NA' ? 'Left blank' : '—'}</div><div class="bsrc"><b style="color:#b8433a;font-weight:600">${flag(x.mand)}</b> · ${U.esc(x.source)}${x.comment ? ' · ' + U.esc(x.comment) : ''}</div></div>`
    return `<div class="cms ${showSrc ? 'show-src' : ''}"><div class="cms-title"><span>HEALTH INSURANCE CLAIM FORM · CMS-1500 (02/12)</span><span>${c.number}</span></div><div class="cms-grid">
      ${box(b.carrier)}<div class="cms-sec">Patient and insured information</div>${b.boxes.slice(0, 24).map(box).join('')}
      <div class="cms-sec">Physician or supplier information</div>${b.boxes.slice(24).map(box).join('')}
      <div style="grid-column:1/-1"><table class="cms-lines"><thead><tr><th>24A Date(s) of service</th><th>24B POS</th><th>24C EMG</th><th>24D CPT / modifiers</th><th>24E Dx pointer</th><th>24F Charges</th><th>24G Units</th><th>24H EPSDT</th><th>24I Qual.</th><th>24J Rendering NPI</th></tr></thead><tbody>${b.lines.map((l) => `<tr><td>${l.a}</td><td>${l.b}</td><td class="muted">${l.c}</td><td>${U.esc(l.d)}</td><td>${l.e}</td><td class="r">${l.f}</td><td>${l.g}</td><td></td><td>${l.i}</td><td>${U.esc(l.j)}</td></tr>`).join('')}</tbody></table></div>
      ${b.bottom.map(box).join('')}</div></div>`
  },
  view(c) {
    const st = S.view('cms', { src: false })
    return `<div class="row-wrap mb-16"><span class="t-micro muted">CMS-1500 (02/12) as it prints.</span></div><div class="scroll-x" style="padding-bottom:8px">${Cms.html(c, st.src)}</div>`
  },
}
ACT['cms.src'] = (el) => {
  S.view('cms', {}).src = el.checked
  R.refresh()
}
ACT['cms.print'] = (el) => {
  const c = S.find('claims', el.dataset.id)
  const root = document.getElementById('print-root')
  root.innerHTML = Cms.html(c, false)
  document.body.classList.add('printing')
  S.log('CMS-1500 printed', { module: 'BILLING', entityType: 'claim', entityId: c.id })
  setTimeout(() => {
    window.print()
    document.body.classList.remove('printing')
  }, 60)
}

// ================================================================ 837P preview
const Edi = {
  build(c) {
    const v = S.visitOf(c)
    const cs = S.caseOf(v)
    const p = S.patientOf(cs)
    const cov = S.find('coverages', c.coverageId)
    const ins = E.insOf(cov)
    const pr = S.find('practices', p.practiceId)
    const prov = S.find('providers', v.treatingProviderId)
    const ref = S.find('referrers', c.referrerId)
    const d8 = (iso) => (iso || '').replace(/-/g, '')
    const up = (s) => String(s || '').toUpperCase()
    const ctl = String(c.number.replace(/\D/g, '')).padStart(9, '0').slice(-9)
    const snap = c.snapshot || E.snapshot(c)
    const segs = [
      `ISA*00*          *00*          *ZZ*${pr.code.padEnd(15)}*ZZ*WAYSTAR        *${d8(c.sentDate || DB.today).slice(2)}*1800*^*00501*${ctl}*0*P*:~`,
      `GS*HC*${pr.code}*WAYSTAR*${d8(c.sentDate || DB.today)}*1800*${Number(ctl)}*X*005010X222A1~`,
      `ST*837*0001*005010X222A1~`,
      `BHT*0019*00*${ctl}*${d8(c.sentDate || DB.today)}*1800*CH~`,
      `NM1*41*2*${up(pr.name)}*****46*${pr.code}~`,
      `NM1*40*2*WAYSTAR*****46*WAYSTAR~`,
      `HL*1**20*1~`,
      `NM1*85*2*${up(pr.legalName)}*****XX*${pr.npi}~`,
      `N3*${up(pr.address.line1)}~`,
      `N4*${up(pr.address.city)}*${pr.address.state}*${pr.address.zip}~`,
      `REF*EI*${pr.taxId.replace('-', '')}~`,
      `HL*2*1*22*0~`,
      `SBR*${{ 1: 'P', 2: 'S', 3: 'T' }[c.rank]}*${cov.subscriber ? '' : '18'}*${cov.groupNumber}******${{ Medicare: 'MB', Commercial: 'CI', 'Workers Comp': 'WC', PIP: 'AM' }[ins.type] || 'ZZ'}~`,
      `NM1*IL*1*${up(p.lastName)}*${up(p.firstName)}****MI*${cov.memberId}~`,
      `N3*${up(p.address.line1)}~`,
      `N4*${up(p.address.city)}*${p.address.state}*${p.address.zip}~`,
      `DMG*D8*${d8(p.dob)}*${p.gender === 'Female' ? 'F' : 'M'}~`,
      `NM1*PR*2*${up(ins.name)}*****PI*${ins.payerId}~`,
      `CLM*${c.number}*${c.total.toFixed(2)}***${(snap[0] || {}).pos || '11'}:B:${c.frequency}*Y*A*Y*Y~`,
      ...(c.frequency !== '1' ? [`REF*F8*${c.originalRef}~`] : []),
      ...(c.authId ? [`REF*G1*${S.find('authorizations', c.authId).number}~`] : []),
      ...(c.box19 ? [`NTE*ADD*${up(c.box19)}~`] : []),
      `HI*${(v.dx || []).map((d, i) => `${i ? 'ABF' : 'ABK'}:${d.replace('.', '')}`).join('*')}~`,
      ...(ref ? [`NM1*${ref.type || 'DN'}*1*${up(ref.name.split(',')[0].split(' ').slice(-1)[0])}*${up(ref.name.split(' ')[0])}****XX*${ref.npi}~`] : []),
      `NM1*82*1*${up(prov.lastName)}*${up(prov.firstName)}****XX*${prov.npi}~`,
      ...snap.flatMap((s, i) => [`LX*${i + 1}~`, `SV1*HC:${s.code}${s.modifiers.map((m) => ':' + m).join('')}*${s.amount.toFixed(2)}*UN*${s.units}*${s.pos}**${s.pointers.join(':')}~`, `DTP*472*D8*${d8(v.dos)}~`]),
    ]
    const count = segs.length - 2 + 1
    return [...segs, `SE*${count}*0001~`, `GE*1*${Number(ctl)}~`, `IEA*1*${ctl}~`].join('\n')
  },
}
