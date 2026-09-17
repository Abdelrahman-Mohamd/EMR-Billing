/* UI kit — the EMR-V.2 primitives rebuilt as small HTML-string functions plus
   one delegated event system. Screens return markup; clicks on anything with
   `data-act` are routed to the matching handler in ACT. */

const ACT = {}

const UI = (() => {
  const esc = U.esc

  // ------------------------------------------------------------------ atoms
  const chip = (tone, text, extra = '') => `<span class="chip tone-${tone} ${extra}">${esc(text)}</span>`
  const status = (tone, text) => `<span class="status ${tone}">${esc(text)}</span>`
  const tag = (text, cls = '') => `<span class="tag ${cls}">${esc(text)}</span>`
  const data = (obj = {}) =>
    Object.entries(obj)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `data-${k}="${esc(v)}"`)
      .join(' ')

  /** A button. `act` wires it to ACT[act]; `sim` marks a prototype-only simulation. */
  const btn = ({ label, icon, variant = '', act, data: d, size = '', disabled = false, title, id, demo, type = 'button' } = {}) =>
    `<button type="${type}" class="btn ${variant ? 'btn-' + variant : ''} ${size ? 'btn-' + size : ''}" ${act ? `data-act="${esc(act)}"` : ''} ${data(d)} ${disabled ? 'disabled' : ''} ${title ? `title="${esc(title)}"` : ''} ${id ? `id="${id}"` : ''} ${demo ? `data-demo="${demo}"` : ''}>${icon ? I(icon) : ''}${label ? `<span>${esc(label)}</span>` : ''}</button>`
  const iconBtn = ({ icon, label, act, data: d, danger = false, disabled = false }) =>
    `<button type="button" class="icon-btn ${danger ? 'danger' : ''}" title="${esc(label)}" aria-label="${esc(label)}" ${act ? `data-act="${act}"` : ''} ${data(d)} ${disabled ? 'disabled' : ''}>${I(icon)}</button>`

  const empty = ({ icon = 'inbox', title, text = '', action = '' }) =>
    `<div class="empty"><div class="e-ico">${I(icon, 'icon-20')}</div><div class="e-title">${esc(title)}</div>${text ? `<div class="e-text">${text}</div>` : ''}${action}</div>`
  const notice = (tone, title, text = '', icon = 'info') =>
    `<div class="notice ${tone}">${I(icon)}<div>${title ? `<strong>${esc(title)}</strong>${text ? ' ' : ''}` : ''}${text}</div></div>`

  const fig = ({ label, value, caption = '', tone = '', act, d }) => {
    const inner = `<div class="eyebrow">${esc(label)}</div><div class="fig-v">${value}</div>${caption ? `<div class="fig-c">${caption}</div>` : ''}`
    return act ? `<button type="button" class="fig ${tone}" data-act="${act}" ${data(d)}>${inner}</button>` : `<div class="fig ${tone}">${inner}</div>`
  }
  const kv = (items) =>
    `<div class="kv">${items
      .filter(Boolean)
      .map(([k, v, raw]) => {
        const val = v === null || v === undefined || v === '' ? '—' : raw ? v : esc(v)
        return `<div><div class="k">${esc(k)}</div><div class="v ${val === '—' ? 'v-empty' : ''}">${val}</div></div>`
      })
      .join('')}</div>`
  const sectionHead = (title, aside = '', actions = '') =>
    `<div class="section-head"><div class="section-title">${esc(title)}</div>${aside ? `<div class="section-aside">${aside}</div>` : ''}<div class="ml-auto row-wrap">${actions}</div></div>`

  const tabs = (items, active, act, d = {}, actions = '') =>
    `<div class="tabs"><div class="tabs-scroll" role="tablist">${items
      .filter(Boolean)
      .map(
        (t) =>
          `<button type="button" role="tab" aria-selected="${t.key === active}" class="tab ${t.key === active ? 'active' : ''}" data-act="${act}" data-key="${t.key}" ${data(d)} ${t.demo ? `data-demo="${t.demo}"` : ''}>${esc(t.label)}${t.count !== undefined && t.count !== null ? `<span class="tab-count ${t.alert && t.count ? 'alert' : ''}">${t.count}</span>` : ''}</button>`,
      )
      .join('')}</div>${actions ? `<div class="tabs-actions">${actions}</div>` : ''}</div>`

  const pills = (items, activeSet, act, d = {}) =>
    `<div class="pills">${items
      .map((p) => `<button type="button" class="pill ${activeSet.includes(p.key) ? 'on' : ''}" data-act="${act}" data-key="${p.key}" ${data(d)}>${esc(p.label)}${p.count !== undefined ? `<span class="n">${p.count}</span>` : ''}</button>`)
      .join('')}</div>`

  const seg = (options, value, act, d = {}, disabled = false) =>
    `<div class="seg" role="radiogroup">${options
      .map((o) => `<button type="button" role="radio" aria-checked="${o.value === value}" class="${o.value === value ? 'on' : ''}" data-act="${act}" data-value="${o.value}" ${data(d)} ${disabled || o.disabled ? 'disabled' : ''}>${esc(o.label)}</button>`)
      .join('')}</div>`

  const qsearch = (id, value, placeholder, input) =>
    `<label class="qsearch">${I('search')}<span class="sr-only">${esc(placeholder)}</span><input id="${id}" type="search" value="${esc(value)}" placeholder="${esc(placeholder)}" data-input="${input}" autocomplete="off">${value ? `<button type="button" class="icon-btn" data-act="qs.clear" data-target="${id}" aria-label="Clear search">${I('x')}</button>` : ''}</label>`

  const filtersBtn = (count, openAct, clearAct, d = {}) =>
    `<div class="filters ${count ? 'on' : ''}"><button type="button" data-act="${openAct}" ${data(d)}>${I('sliders')}Filters${count ? `<span class="count">${count}</span>` : ''}</button>${count ? `<span class="split"></span><button type="button" class="clear" data-act="${clearAct}" ${data(d)} aria-label="Clear filters">${I('x')}</button>` : ''}</div>`

  const avatar = (name, cls = '') => `<span class="avatar ${cls}">${esc(U.initials(name))}</span>`

  // ------------------------------------------------------------------ tables
  /**
   * cols: [{ key, label, sort: fn|true, render: fn(row), cls, head }]
   * opts: { view (state), viewKey, rows, rowId, rowAct, selectable, mark(row), empty, pageSize, foot, id }
   */
  const table = (opts) => {
    const { cols, view, viewKey, rowAct, selectable, mark } = opts
    const rowId = opts.rowId || ((r) => r.id)
    let rows = [...opts.rows]
    if (view.sort) {
      const col = cols.find((c) => c.key === view.sort)
      if (col) {
        const val = typeof col.sort === 'function' ? col.sort : (r) => r[col.key]
        rows.sort((a, b) => U.cmp(val(a), val(b)) * (view.dir === 'desc' ? -1 : 1))
      }
    }
    const pageSize = opts.pageSize || 12
    const total = rows.length
    const pages = Math.max(1, Math.ceil(total / pageSize))
    if (view.page > pages) view.page = pages
    if (!view.page) view.page = 1
    const start = (view.page - 1) * pageSize
    const pageRows = opts.noPaging ? rows : rows.slice(start, start + pageSize)
    const sel = view.sel || []
    const allSel = selectable && pageRows.length && pageRows.every((r) => sel.includes(rowId(r)))
    if (!total) return opts.empty || empty({ title: 'Nothing here yet' })
    const head = `<tr>${mark ? '<th class="mark"></th>' : ''}${selectable ? `<th class="sel"><input type="checkbox" aria-label="Select all on this page" data-act="tbl.selAll" data-view="${viewKey}" data-ids="${pageRows.map(rowId).join(',')}" ${allSel ? 'checked' : ''}></th>` : ''}${cols
      .map((c) => {
        const on = view.sort === c.key
        const inner = c.sort
          ? `<button type="button" class="sort-btn ${on ? 'on' : ''}" data-act="tbl.sort" data-view="${viewKey}" data-col="${c.key}">${esc(c.label)}${on ? I(view.dir === 'desc' ? 'arrowDown' : 'arrowUp') : ''}</button>`
          : esc(c.label)
        return `<th class="${c.cls || ''}" ${on ? `aria-sort="${view.dir === 'desc' ? 'descending' : 'ascending'}"` : ''}>${inner}</th>`
      })
      .join('')}</tr>`
    const body = pageRows
      .map((r) => {
        const id = rowId(r)
        const m = mark ? mark(r) : null
        const isSel = sel.includes(id)
        return `<tr class="${rowAct ? 'clickable' : ''} ${isSel ? 'selected' : ''}" ${rowAct ? `data-act="${rowAct}" data-id="${esc(id)}"` : ''}>${mark ? `<td class="mark"><span class="margin-mark ${m || ''}"></span></td>` : ''}${selectable ? `<td class="sel"><input type="checkbox" aria-label="Select row" data-act="tbl.sel" data-view="${viewKey}" data-id="${esc(id)}" ${isSel ? 'checked' : ''}></td>` : ''}${cols.map((c) => `<td class="${c.tdCls ? (typeof c.tdCls === 'function' ? c.tdCls(r) : c.tdCls) : c.cls || ''}">${c.render ? c.render(r) : esc(r[c.key])}</td>`).join('')}</tr>`
      })
      .join('')
    const foot = opts.foot ? `<tfoot>${opts.foot}</tfoot>` : ''
    const scope = opts.noPaging || total <= pageSize ? `${U.plural(total, opts.noun || 'row')}` : `Showing ${start + 1}–${Math.min(start + pageSize, total)} of ${total} ${opts.noun ? opts.noun + 's' : 'rows'}`
    return `<div class="tbl-wrap scroll-x"><table class="tbl" ${opts.id ? `id="${opts.id}"` : ''}><thead>${head}</thead><tbody>${body}</tbody>${foot}</table></div>${opts.hideFoot ? '' : `<div class="tbl-foot"><span>${scope}</span>${!opts.noPaging && pages > 1 ? pager(view.page, pages, viewKey) : ''}</div>`}`
  }
  const pager = (page, pages, viewKey) => {
    const nums = []
    for (let i = 1; i <= pages; i++) if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i)
    const withGaps = []
    nums.forEach((n, i) => {
      if (i && n - nums[i - 1] > 1) withGaps.push('…')
      withGaps.push(n)
    })
    return `<div class="pager"><button type="button" data-act="tbl.page" data-view="${viewKey}" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''} aria-label="Previous page">${I('chevronLeft', 'icon-14')}</button>${withGaps
      .map((n) => (n === '…' ? '<span class="muted">…</span>' : `<button type="button" class="${n === page ? 'on' : ''}" data-act="tbl.page" data-view="${viewKey}" data-page="${n}">${n}</button>`))
      .join('')}<button type="button" data-act="tbl.page" data-view="${viewKey}" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''} aria-label="Next page">${I('chevronRight', 'icon-14')}</button></div>`
  }
  ACT['tbl.sort'] = (el) => {
    const v = S.view(el.dataset.view, {})
    if (v.sort === el.dataset.col) v.dir = v.dir === 'asc' ? 'desc' : 'asc'
    else {
      v.sort = el.dataset.col
      v.dir = 'asc'
    }
    v.page = 1
    R.refresh()
  }
  ACT['tbl.page'] = (el) => {
    S.view(el.dataset.view, {}).page = Number(el.dataset.page)
    R.refresh()
  }
  ACT['tbl.sel'] = (el, ev) => {
    ev.stopPropagation()
    const v = S.view(el.dataset.view, {})
    v.sel = v.sel || []
    const id = el.dataset.id
    v.sel = v.sel.includes(id) ? v.sel.filter((x) => x !== id) : [...v.sel, id]
    R.refresh()
  }
  ACT['tbl.selAll'] = (el) => {
    const v = S.view(el.dataset.view, {})
    const ids = el.dataset.ids.split(',').filter(Boolean)
    v.sel = v.sel || []
    const all = ids.every((id) => v.sel.includes(id))
    v.sel = all ? v.sel.filter((x) => !ids.includes(x)) : U.uniq([...v.sel, ...ids])
    R.refresh()
  }
  ACT['qs.clear'] = (el) => {
    const input = document.getElementById(el.dataset.target)
    if (input) {
      input.value = ''
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.focus()
    }
  }

  // ------------------------------------------------------------------ forms
  const forms = {}
  let formSeq = 0
  const MSG = {
    required: 'This field is required.',
    npi: 'Please enter a valid NPI.',
    phone: 'Please enter a valid phone number.',
    zip: 'Please enter a valid ZIP code.',
    email: 'Please enter a valid email address.',
    date: 'Please enter a valid date.',
    money: 'Please enter a valid amount.',
    number: 'Please enter a valid number.',
    state: 'Please enter a valid state.',
  }
  const optList = (options) => (options || []).map((o) => (typeof o === 'string' ? { value: o, label: o } : o))

  const fieldHtml = (fid, spec, value) => {
    const id = `${fid}-${spec.name}`
    const span = spec.span ? `span-${spec.span}` : ''
    if (spec.type === 'section') return `<div class="form-section-title">${esc(spec.label)}</div>`
    if (spec.type === 'note') return `<div class="form-note">${spec.html || esc(spec.label)}</div>`
    if (spec.type === 'html') return `<div class="field ${span}">${spec.html}</div>`
    const req = spec.required ? '<span class="req" aria-hidden="true">*</span>' : ''
    const label = spec.label ? `<label class="field-label" for="${id}">${esc(spec.label)}${req}${spec.labelAside ? `<span class="muted" style="text-transform:none;font-weight:400">${esc(spec.labelAside)}</span>` : ''}</label>` : ''
    const v = value === undefined || value === null ? '' : value
    const common = `id="${id}" name="${spec.name}" ${spec.required ? 'aria-required="true"' : ''} ${spec.disabled ? 'disabled' : ''} data-field-input="${spec.name}"`
    let control
    if (spec.type === 'select') {
      const opts = optList(typeof spec.options === 'function' ? spec.options() : spec.options)
      control = `<div class="control ${spec.disabled ? 'disabled' : ''}"><select ${common}>${spec.placeholder !== false ? `<option value="">${esc(spec.placeholder || 'Select…')}</option>` : ''}${opts.map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(v) ? 'selected' : ''} ${o.disabled ? 'disabled' : ''}>${esc(o.label)}</option>`).join('')}</select><span class="chev">${I('chevronDown', 'icon-14')}</span></div>`
    } else if (spec.type === 'textarea') {
      control = `<div class="control textarea"><textarea ${common} placeholder="${esc(spec.placeholder || '')}" rows="${spec.rows || 3}" ${spec.maxLength ? `maxlength="${spec.maxLength}"` : ''}>${esc(v)}</textarea></div>`
    } else if (spec.type === 'checkbox') {
      return `<div class="field ${span}" data-field="${spec.name}"><label class="check-row"><input type="checkbox" ${common} ${v ? 'checked' : ''}><span>${esc(spec.label)}${spec.desc ? `<span class="desc">${esc(spec.desc)}</span>` : ''}</span></label></div>`
    } else if (spec.type === 'radio') {
      const opts = optList(spec.options)
      control = `<div class="choice-list" role="radiogroup">${opts
        .map((o) => `<label class="choice ${String(o.value) === String(v) ? 'selected' : ''}"><input type="radio" name="${spec.name}" value="${esc(o.value)}" data-field-input="${spec.name}" ${String(o.value) === String(v) ? 'checked' : ''} ${o.disabled ? 'disabled' : ''}><span><span class="c-title">${esc(o.label)}</span>${o.desc ? `<span class="c-desc" style="display:block">${esc(o.desc)}</span>` : ''}</span></label>`)
        .join('')}</div>`
    } else {
      const map = { money: 'text', npi: 'text', zip: 'text', state: 'text', tel: 'tel', number: 'number', date: 'date', email: 'email', password: 'password' }
      const t = map[spec.type] || 'text'
      const mode = { money: 'decimal', npi: 'numeric', zip: 'numeric', tel: 'tel', number: 'numeric' }[spec.type]
      const max = { npi: 10, zip: 5, state: 2, tel: 12 }[spec.type] || spec.maxLength
      control = `<div class="control ${spec.disabled ? 'disabled' : ''}">${spec.type === 'money' ? '<span class="affix">$</span>' : ''}<input ${common} type="${t}" value="${esc(v)}" placeholder="${esc(spec.placeholder || '')}" ${mode ? `inputmode="${mode}"` : ''} ${max ? `maxlength="${max}"` : ''} ${spec.min !== undefined ? `min="${spec.min}"` : ''} ${spec.max !== undefined ? `max="${spec.max}"` : ''} ${spec.step ? `step="${spec.step}"` : ''} autocomplete="${spec.autocomplete || 'off'}">${spec.suffix ? `<span class="affix">${esc(spec.suffix)}</span>` : ''}</div>`
    }
    return `<div class="field ${span}" data-field="${spec.name}" ${spec.hidden ? 'hidden' : ''}>${label}${control}<div class="field-error" hidden></div>${spec.help ? `<div class="field-help">${spec.help}</div>` : ''}</div>`
  }

  /** Render a form. Returns markup; call UI.bindForm(root) after it is in the DOM. */
  const form = (specs, values = {}, opts = {}) => {
    const fid = `fm${++formSeq}`
    forms[fid] = { specs, touched: {}, attempted: false, onChange: opts.onChange }
    return `<form class="form-grid" data-form="${fid}" novalidate autocomplete="off">${specs.filter(Boolean).map((s) => fieldHtml(fid, s, values[s.name])).join('')}</form>`
  }
  const readValues = (formEl) => {
    const out = {}
    const reg = forms[formEl.dataset.form]
    reg.specs.filter(Boolean).forEach((s) => {
      if (['section', 'note', 'html'].includes(s.type)) return
      if (s.type === 'checkbox') out[s.name] = !!formEl.querySelector(`[name="${s.name}"]`)?.checked
      else if (s.type === 'radio') out[s.name] = formEl.querySelector(`[name="${s.name}"]:checked`)?.value || ''
      else {
        const el = formEl.querySelector(`[name="${s.name}"]`)
        out[s.name] = el ? el.value.trim() : ''
      }
      if (s.type === 'money' || s.type === 'number') out[s.name] = out[s.name] === '' ? '' : out[s.name]
    })
    return out
  }
  const checkField = (s, v, vals) => {
    if (s.disabled) return ''
    const required = typeof s.requiredIf === 'function' ? s.requiredIf(vals) : s.required
    if (s.type === 'checkbox') return required && !v ? MSG.required : s.validate ? s.validate(v, vals) || '' : ''
    if (v === '' || v === null || v === undefined) return required ? MSG.required : ''
    if (s.type === 'npi' && !/^\d{10}$/.test(v)) return MSG.npi
    if (s.type === 'tel' && !/^\d{3}-\d{3}-\d{4}$/.test(v)) return MSG.phone
    if (s.type === 'zip' && !/^\d{5}$/.test(v)) return MSG.zip
    if (s.type === 'state' && !/^[A-Z]{2}$/.test(v)) return MSG.state
    if (s.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return MSG.email
    if (s.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return MSG.date
    if (s.type === 'money' && (!/^\d+(\.\d{1,2})?$/.test(v) || (s.min !== undefined && Number(v) < s.min))) return MSG.money
    if (s.type === 'number' && (isNaN(Number(v)) || (s.min !== undefined && Number(v) < s.min) || (s.max !== undefined && Number(v) > s.max))) return MSG.number
    return s.validate ? s.validate(v, vals) || '' : ''
  }
  const showError = (formEl, name, msg) => {
    const field = formEl.querySelector(`[data-field="${name}"]`)
    if (!field) return
    const err = field.querySelector('.field-error')
    const ctrl = field.querySelector('.control')
    if (err) {
      err.textContent = msg || ''
      err.hidden = !msg
    }
    if (ctrl) ctrl.classList.toggle('invalid', !!msg)
    const input = field.querySelector('[data-field-input]')
    if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false')
  }
  const syncRequired = (formEl) => {
    const reg = forms[formEl.dataset.form]
    if (!reg) return
    const vals = readValues(formEl)
    reg.specs.filter((s) => s && typeof s.requiredIf === 'function').forEach((s) => {
      const lbl = formEl.querySelector(`[data-field="${s.name}"] .field-label`)
      if (!lbl) return
      const has = lbl.querySelector('.req')
      const need = s.requiredIf(vals)
      if (need && !has) lbl.insertAdjacentHTML('beforeend', '<span class="req" aria-hidden="true">*</span>')
      if (!need && has) has.remove()
    })
  }
  /** Validate all fields at once — the "form attempt" (errors on every field, first one focused). */
  const submitForm = (formEl) => {
    const reg = forms[formEl.dataset.form]
    reg.attempted = true
    const vals = readValues(formEl)
    let first = null
    reg.specs.filter(Boolean).forEach((s) => {
      if (['section', 'note', 'html'].includes(s.type)) return
      const msg = checkField(s, vals[s.name], vals)
      showError(formEl, s.name, msg)
      if (msg && !first) first = s.name
    })
    if (first) {
      const input = formEl.querySelector(`[name="${first}"]`)
      if (input) input.focus()
      return null
    }
    return vals
  }
  const setFieldError = (formEl, name, msg) => {
    showError(formEl, name, msg)
    const input = formEl.querySelector(`[name="${name}"]`)
    if (input && msg) input.focus()
  }
  const formOf = (root) => (root.matches && root.matches('form[data-form]') ? root : root.querySelector('form[data-form]'))

  // Input masks: a field refuses what it cannot hold (EMR-V.2 rule)
  document.addEventListener('input', (ev) => {
    const el = ev.target
    const formEl = el.closest && el.closest('form[data-form]')
    if (formEl && el.dataset.fieldInput) {
      const reg = forms[formEl.dataset.form]
      const spec = reg && reg.specs.find((s) => s && s.name === el.dataset.fieldInput)
      if (spec) {
        let v = el.value
        if (spec.type === 'npi' || spec.type === 'zip') v = v.replace(/\D/g, '')
        if (spec.type === 'state') v = v.replace(/[^a-z]/gi, '').toUpperCase()
        if (spec.type === 'money') v = v.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1')
        if (spec.type === 'tel') {
          const d = v.replace(/\D/g, '').slice(0, 10)
          v = d.length > 6 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : d.length > 3 ? `${d.slice(0, 3)}-${d.slice(3)}` : d
        }
        if (v !== el.value) el.value = v
        if (reg.attempted || reg.touched[spec.name]) showError(formEl, spec.name, checkField(spec, readValues(formEl)[spec.name], readValues(formEl)))
        syncRequired(formEl)
        if (reg.onChange) reg.onChange(readValues(formEl), formEl, spec.name)
      }
    }
    const handler = el.dataset && el.dataset.input
    if (handler && ACT[handler]) ACT[handler](el, ev)
  })
  document.addEventListener('change', (ev) => {
    const el = ev.target
    const formEl = el.closest && el.closest('form[data-form]')
    if (formEl && el.dataset.fieldInput) {
      const reg = forms[formEl.dataset.form]
      const spec = reg && reg.specs.find((s) => s && s.name === el.dataset.fieldInput)
      if (spec && (spec.type === 'select' || spec.type === 'checkbox' || spec.type === 'radio' || spec.type === 'date')) {
        reg.touched[spec.name] = true
        showError(formEl, spec.name, checkField(spec, readValues(formEl)[spec.name], readValues(formEl)))
        if (spec.type === 'radio') {
          formEl.querySelectorAll(`[name="${spec.name}"]`).forEach((r) => r.closest('.choice')?.classList.toggle('selected', r.checked))
        }
      }
      syncRequired(formEl)
      if (reg && reg.onChange) reg.onChange(readValues(formEl), formEl, el.dataset.fieldInput)
    }
    const handler = el.dataset && el.dataset.change
    if (handler && ACT[handler]) ACT[handler](el, ev)
  })
  // An error waits until the field is left (EMR-V.2 rule)
  document.addEventListener('focusout', (ev) => {
    const el = ev.target
    const formEl = el.closest && el.closest('form[data-form]')
    if (!formEl || !el.dataset.fieldInput) return
    const reg = forms[formEl.dataset.form]
    const spec = reg && reg.specs.find((s) => s && s.name === el.dataset.fieldInput)
    if (!spec) return
    reg.touched[spec.name] = true
    const vals = readValues(formEl)
    showError(formEl, spec.name, checkField(spec, vals[spec.name], vals))
  })
  document.addEventListener('submit', (ev) => {
    if (ev.target.matches('form[data-form]')) ev.preventDefault()
  })

  // ------------------------------------------------------------------ layers
  const layersRoot = () => document.getElementById('layers')
  const stack = []
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

  const openLayer = (el, onClose, closingClass) => {
    const prev = document.activeElement
    layersRoot().appendChild(el)
    const handle = {
      el,
      closed: false,
      close: () => {
        if (handle.closed) return
        handle.closed = true
        const i = stack.indexOf(handle)
        if (i >= 0) stack.splice(i, 1)
        el.classList.add(closingClass)
        setTimeout(() => el.remove(), 200)
        if (prev && prev.focus && document.body.contains(prev)) prev.focus()
        if (onClose) onClose()
      },
    }
    stack.push(handle)
    setTimeout(() => {
      const target = el.querySelector('[autofocus]') || el.querySelector('.dialog-body ' + FOCUSABLE.split(',').join(', .dialog-body ')) || el.querySelector('.drawer-body ' + 'input, select, textarea') || el.querySelector('[tabindex="-1"]')
      if (target) target.focus({ preventScroll: true })
    }, 30)
    return handle
  }
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      if (closeMenu()) return
      const top = stack[stack.length - 1]
      if (top && !top.el.dataset.noEsc) {
        ev.preventDefault()
        top.close()
      }
    }
    if (ev.key === 'Tab') {
      const top = stack[stack.length - 1]
      if (!top) return
      const items = Array.from(top.el.querySelectorAll(FOCUSABLE)).filter((x) => x.offsetParent !== null)
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (ev.shiftKey && document.activeElement === first) {
        ev.preventDefault()
        last.focus()
      } else if (!ev.shiftKey && document.activeElement === last) {
        ev.preventDefault()
        first.focus()
      }
    }
  })

  /** A centred dialog. body/foot are markup; returns a handle with close(). */
  const modal = ({ title, desc = '', size = 'md', body = '', foot = '', onClose, noEsc = false, footLeft = '', cls = '' }) => {
    const el = document.createElement('div')
    el.className = `layer ${cls}`.trim()
    if (noEsc) el.dataset.noEsc = '1'
    el.innerHTML = `<div class="scrim" data-act="layer.close"></div><div class="dialog ${size}" role="dialog" aria-modal="true" aria-labelledby="dlg-t" tabindex="-1"><div class="dialog-head"><div class="grow"><h2 class="dialog-title" id="dlg-t">${esc(title)}</h2>${desc ? `<p class="dialog-desc">${desc}</p>` : ''}</div><button type="button" class="x-btn" data-act="layer.close" aria-label="Close">${I('x', 'icon-18')}</button></div><div class="dialog-body">${body}</div>${foot ? `<div class="dialog-foot">${footLeft ? `<span class="foot-left">${footLeft}</span>` : ''}${foot}</div>` : ''}</div>`
    return openLayer(el, onClose, 'closing')
  }
  /** A right-hand drawer (SlideOver). */
  const drawer = ({ title, desc = '', body = '', foot = '', wide = false, onClose, cls = '' }) => {
    const el = document.createElement('div')
    el.className = `drawer-layer ${cls}`.trim()
    el.innerHTML = `<div class="scrim" data-act="layer.close"></div><aside class="drawer ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="dr-t" tabindex="-1"><div class="dialog-head"><div class="grow"><h2 class="dialog-title" id="dr-t">${esc(title)}</h2>${desc ? `<p class="dialog-desc">${desc}</p>` : ''}</div><button type="button" class="x-btn" data-act="layer.close" aria-label="Close">${I('x', 'icon-18')}</button></div><div class="dialog-body drawer-body">${body}</div>${foot ? `<div class="dialog-foot">${foot}</div>` : ''}</aside>`
    return openLayer(el, onClose, 'closing')
  }
  const topLayer = () => stack[stack.length - 1] || null
  const closeTop = () => {
    const t = topLayer()
    if (t) t.close()
  }
  const closeAll = () => [...stack].reverse().forEach((h) => h.close())
  ACT['layer.close'] = (el) => {
    const layer = el.closest('.layer, .drawer-layer')
    const h = stack.find((x) => x.el === layer)
    if (h) h.close()
  }

  /** An action you cannot undo asks first — the confirm says what it does. */
  const confirm = ({ title, message, confirmLabel = 'Confirm', tone = 'primary', detail = '', cls = '' }) =>
    new Promise((resolve) => {
      let answered = false
      const h = modal({
        title,
        desc: message,
        size: 'sm',
        cls,
        body: detail || '',
        foot: `${btn({ label: 'Cancel', variant: 'quiet', act: 'confirm.no' })}${btn({ label: confirmLabel, variant: tone === 'critical' ? 'danger-fill' : 'primary', act: 'confirm.yes' })}`,
        onClose: () => {
          if (!answered) resolve(false)
        },
      })
      if (!detail) h.el.querySelector('.dialog-body').remove()
      h.el.querySelector('[data-act="confirm.yes"]').addEventListener('click', (e) => {
        e.stopPropagation()
        answered = true
        resolve(true)
        h.close()
      })
      h.el.querySelector('[data-act="confirm.no"]').addEventListener('click', (e) => {
        e.stopPropagation()
        answered = true
        resolve(false)
        h.close()
      })
      setTimeout(() => h.el.querySelector('[data-act="confirm.yes"]').focus(), 40)
    })

  // ------------------------------------------------------------------ menus
  let openMenuEl = null
  const closeMenu = () => {
    if (!openMenuEl) return false
    openMenuEl.remove()
    openMenuEl = null
    return true
  }
  /** items: [{ label, sub, icon, act, data, danger, disabled, selected } | 'sep' | { head }] */
  const menu = (anchor, items, opts = {}) => {
    closeMenu()
    const el = document.createElement('div')
    el.className = 'menu'
    el.setAttribute('role', 'menu')
    el.innerHTML = items
      .map((it) => {
        if (it === 'sep') return '<div class="menu-sep"></div>'
        if (it.head) return `<div class="menu-head">${it.head}</div>`
        return `<button type="button" role="menuitem" class="menu-item ${it.danger ? 'danger' : ''} ${it.selected ? 'selected' : ''}" ${it.act ? `data-act="${it.act}"` : ''} ${data(it.data)} ${it.disabled ? 'disabled' : ''} ${it.title ? `title="${esc(it.title)}"` : ''}>${it.icon ? I(it.icon) : ''}<span class="grow">${esc(it.label)}${it.sub ? `<span class="mi-sub">${esc(it.sub)}</span>` : ''}</span>${it.selected ? I('check') : ''}</button>`
      })
      .join('')
    document.body.appendChild(el)
    const r = anchor.getBoundingClientRect()
    const mw = el.offsetWidth
    const mh = el.offsetHeight
    let left = opts.side === 'right' ? r.right + 8 : r.left
    let top = opts.side === 'right' ? r.bottom - mh : r.bottom + 6
    if (opts.align === 'end') left = r.right - mw
    left = Math.max(8, Math.min(left, window.innerWidth - mw - 8))
    if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 6)
    top = Math.max(8, top)
    el.style.left = `${left}px`
    el.style.top = `${top}px`
    openMenuEl = el
    const first = el.querySelector('.menu-item:not(:disabled)')
    if (first) first.focus()
    return el
  }
  document.addEventListener('mousedown', (ev) => {
    if (openMenuEl && !openMenuEl.contains(ev.target)) closeMenu()
  })

  // ------------------------------------------------------------------ toasts
  const TOAST_ICON = { success: 'circleCheck', info: 'info', critical: 'circleAlert', warning: 'alert' }
  const toast = (tone, title, desc = '', ms = 5200) => {
    const root = document.getElementById('toasts')
    const el = document.createElement('div')
    el.className = 'toast'
    el.setAttribute('role', tone === 'critical' ? 'alert' : 'status')
    el.innerHTML = `<span class="t-ico tone-${tone === 'warning' ? 'warning' : tone}">${I(TOAST_ICON[tone] || 'info', 'icon-18')}</span><div class="grow"><div class="t-title">${esc(title)}</div>${desc ? `<div class="t-desc">${desc}</div>` : ''}</div><button type="button" class="x-btn" aria-label="Dismiss" style="width:24px;height:24px">${I('x', 'icon-14')}</button>`
    const dismiss = () => {
      if (el.classList.contains('leaving')) return
      el.classList.add('leaving')
      setTimeout(() => el.remove(), 170)
    }
    el.querySelector('button').addEventListener('click', dismiss)
    root.appendChild(el)
    while (root.children.length > 3) root.firstElementChild.remove()
    setTimeout(dismiss, ms)
  }

  // ------------------------------------------------------------------ work item & history (core principle)
  const PRIORITY_TONE = { High: 'critical', Medium: 'warning', Low: 'inert' }
  const workItemView = (wi, entityType, entityId, module, statusText) => {
    const canEdit = S.can(module, 'u')
    const overdue = wi.due && wi.due < DB.today
    return `<div class="card"><div class="card-head"><span class="card-title">Ownership</span>${canEdit ? `<span class="ml-auto">${btn({ label: 'Edit', icon: 'pencil', size: 'sm', act: 'wi.edit', data: { type: entityType, id: entityId } })}</span>` : ''}</div><div class="card-body" style="padding-top:4px">${kv([
      ['Owner', S.userName(wi.owner)],
      ['Status', statusText || '—'],
      ['Priority', `<span class="status ${PRIORITY_TONE[wi.priority] || 'inert'}">${esc(wi.priority || '—')}</span>`, true],
      ['Due date', wi.due ? `${U.date(wi.due)}${overdue ? ' <span class="chip tone-critical nodot">Overdue</span>' : ''}` : '', true],
      ['Next action', wi.next || ''],
    ])}</div></div>`
  }
  const historyView = (entityType, entityId, extraIds = []) => {
    const rows = DB.audit.filter((a) => (a.entityType === entityType && a.entityId === entityId) || extraIds.some(([t, i]) => a.entityType === t && a.entityId === i))
    if (!rows.length) return `<div class="muted t-micro" style="padding:12px 0">No history recorded yet.</div>`
    return `<ul class="timeline">${rows
      .map((a) => `<li><div class="t-what">${esc(a.action)}</div><div class="t-meta">${esc(S.userName(a.userId))} · ${esc(U.stampLabel(a.at, DB.today))}${a.at.slice(0, 10) !== DB.today && a.at.slice(0, 10) !== U.addDays(DB.today, -1) ? ' · ' + U.date(a.at.slice(0, 10)) : ''}</div>${a.detail ? `<div class="t-detail">${esc(a.detail)}</div>` : ''}</li>`)
      .join('')}</ul>`
  }
  const findEntity = (type, id) =>
    ({ claim: 'claims', visit: 'visits', denial: 'denials', exception: 'exceptions', update: 'updates' }[type] ? S.find({ claim: 'claims', visit: 'visits', denial: 'denials', exception: 'exceptions', update: 'updates' }[type], id) : null)
  ACT['wi.edit'] = (el) => {
    const ent = findEntity(el.dataset.type, el.dataset.id)
    if (!ent) return
    ent.wi = ent.wi || S.workItem()
    const owners = DB.users.filter((u) => u.isActive && !u.isServiceAccount).map((u) => ({ value: u.id, label: `${u.displayName} — ${S.roleLabel(u)}` }))
    const h = modal({
      title: 'Edit ownership',
      desc: 'Every actionable item carries an owner, priority, due date and next action.',
      size: 'md',
      body: form(
        [
          { name: 'owner', label: 'Owner', type: 'select', options: owners, placeholder: 'Unassigned', span: 6 },
          { name: 'priority', label: 'Priority', type: 'select', options: ['High', 'Medium', 'Low'], required: true, span: 6, placeholder: false },
          { name: 'due', label: 'Due date', type: 'date', span: 6 },
          { name: 'next', label: 'Next action', type: 'text', placeholder: 'What happens next', span: 12, maxLength: 120 },
        ],
        ent.wi,
      ),
      foot: btn({ label: 'Cancel', variant: 'quiet', act: 'layer.close' }) + btn({ label: 'Save ownership', variant: 'primary', act: 'wi.save' }),
    })
    h.el.dataset.type = el.dataset.type
    h.el.dataset.id = el.dataset.id
  }
  ACT['wi.save'] = (el) => {
    const layer = el.closest('.layer')
    const vals = submitForm(formOf(layer))
    if (!vals) return
    const ent = findEntity(layer.dataset.type, layer.dataset.id)
    const before = { ...ent.wi }
    ent.wi = { ...ent.wi, owner: vals.owner || null, priority: vals.priority, due: vals.due || null, next: vals.next }
    const changes = []
    if (before.owner !== ent.wi.owner) changes.push(`owner → ${S.userName(ent.wi.owner)}`)
    if (before.priority !== ent.wi.priority) changes.push(`priority → ${ent.wi.priority}`)
    if (before.due !== ent.wi.due) changes.push(`due → ${ent.wi.due ? U.date(ent.wi.due) : 'none'}`)
    if (before.next !== ent.wi.next) changes.push(`next action → ${ent.wi.next || 'none'}`)
    S.log('Ownership updated', { entityType: layer.dataset.type, entityId: layer.dataset.id, detail: changes.join(' · ') || 'No changes' })
    closeTop()
    toast('success', 'Ownership saved')
    R.refresh()
  }

  // ------------------------------------------------------------------ misc
  const ownerCell = (wi) => (wi && wi.owner ? esc(S.userName(wi.owner)) : '<span class="muted">Unassigned</span>')
  const dueCell = (wi) => (wi && wi.due ? `<span class="${wi.due < DB.today ? 'status critical' : ''}">${U.date(wi.due)}</span>` : '<span class="muted">—</span>')
  const skeletonRows = (n = 6) =>
    `<div class="stack gap-12" style="padding-top:18px">${Array.from({ length: n }, (_, i) => `<div class="row gap-16"><span class="skel" style="width:${140 + ((i * 37) % 80)}px;height:14px"></span><span class="skel" style="width:90px;height:14px"></span><span class="skel" style="width:${60 + ((i * 23) % 60)}px;height:14px"></span><span class="skel grow" style="height:14px"></span></div>`).join('')}</div>`
  const pulse = (selector) => {
    setTimeout(() => {
      const el = document.querySelector(selector)
      if (!el) return
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      el.classList.remove('demo-pulse')
      void el.offsetWidth
      el.classList.add('demo-pulse')
      setTimeout(() => el.classList.remove('demo-pulse'), 4600)
    }, 250)
  }

  // ------------------------------------------------------------------ status vocabularies
  const VISIT_TONE = { Review: 'info', Pended: 'warning', Delayed: 'attention', Released: 'brand', Billed: 'success', Exception: 'critical', Incomplete: 'critical', Inactive: 'inert' }
  const VISIT_LABEL = { Review: 'In review', Pended: 'Pended', Delayed: 'Delayed', Released: 'Ready to submit', Billed: 'Claim created', Exception: 'Billing exception', Incomplete: 'Incomplete profile', Inactive: 'Inactive' }
  const CLAIM_TONE = { Scrubbing: 'info', Hold: 'critical', Submitted: 'brand', Rejected: 'critical', Paid: 'success', Denied: 'critical', Replaced: 'inert', Voided: 'inert', Cancelled: 'inert' }
  const visitChip = (v) => chip(VISIT_TONE[v.status] || 'inert', VISIT_LABEL[v.status] || v.status)
  const claimLabel = (c) => (c.status === 'Hold' ? E.HOLDS[c.holdReason].label : c.status)
  const claimChip = (c) =>
    chip(CLAIM_TONE[c.status] || 'inert', claimLabel(c)) + (c.ar === 'Delayed' && c.status === 'Submitted' ? ' ' + chip('warning', 'Delayed A/R') : '')
  const codesText = (lines) => lines.map((l) => `${E.pc(l.procedureCodeId).code}×${l.units}`).join(' · ')

  return {
    VISIT_TONE, VISIT_LABEL, CLAIM_TONE, visitChip, claimChip, claimLabel, codesText,
    chip, status, tag, btn, iconBtn, empty, notice, fig, kv, sectionHead, tabs, pills, seg, qsearch, filtersBtn, avatar,
    table, form, readValues, submitForm, setFieldError, formOf, syncRequired, modal, drawer, confirm, topLayer, closeTop,
    closeAll, menu, closeMenu, toast, workItemView, historyView, ownerCell, dueCell, skeletonRows, pulse, PRIORITY_TONE, esc,
  }
})()

/* Prerequisites: when an action needs records that do not exist yet, say which ones,
   whether each exists, and where to create it. */
const Dep = {
  panel({ title, text = '', needs }) {
    const rows = needs
      .map((n) => `<li class="dep-row ${n.ok ? 'ok' : 'missing'}"><span class="dep-ck">${I(n.ok ? 'check' : 'x', 'icon-14')}</span><div class="grow"><div class="dep-label">${U.esc(n.label)}</div>${n.why ? `<div class="t-micro muted-2">${n.why}</div>` : ''}</div>${!n.ok && n.action ? UI.btn({ label: n.action.label, size: 'sm', icon: 'arrowRight', act: 'go', data: { hash: n.action.hash } }) : ''}</li>`)
      .join('')
    return `<div class="card dep-card"><div class="card-head">${I('alert', 'icon-18')}<span class="card-title">${U.esc(title)}</span></div><div class="card-body">${text ? `<p class="t-meta muted-2" style="margin:0 0 12px;line-height:1.6">${text}</p>` : ''}<ul class="dep-list">${rows}</ul></div></div>`
  },
  modal({ title, text, needs, cls = '' }) {
    UI.modal({ title, size: 'md', cls, body: Dep.panel({ title: 'What is missing', text, needs }), foot: UI.btn({ label: 'Close', variant: 'primary', act: 'layer.close' }) })
  },
}
