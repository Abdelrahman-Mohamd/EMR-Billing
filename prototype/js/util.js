/* Small helpers shared by every file. Classic scripts (not ES modules) so the
   prototype opens straight from the file system with a double-click. */

const U = (() => {
  const esc = (v) =>
    v === null || v === undefined
      ? ''
      : String(v)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;')

  const round = (n) => Math.round((Number(n) || 0) * 100) / 100

  const money = (n, opts = {}) => {
    const v = round(n)
    const s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    if (opts.plain) return (v < 0 ? '-' : '') + s
    return (v < 0 ? '−$' : '$') + s
  }

  const moneyShort = (n) => {
    const v = round(n)
    if (Math.abs(v) >= 1000) return '$' + (v / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 }) + 'k'
    return money(v)
  }

  const parseISO = (iso) => {
    if (!iso) return null
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d))
  }
  const toISO = (dt) => dt.toISOString().slice(0, 10)
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  /** US date as the PRD writes it: 07/10/2026 */
  const date = (iso) => {
    if (!iso) return ''
    const dt = parseISO(iso)
    return `${String(dt.getUTCMonth() + 1).padStart(2, '0')}/${String(dt.getUTCDate()).padStart(2, '0')}/${dt.getUTCFullYear()}`
  }
  const dateShort = (iso) => {
    if (!iso) return ''
    const dt = parseISO(iso)
    return `${MONTHS[dt.getUTCMonth()]} ${dt.getUTCDate()}`
  }
  const dateLong = (iso) => {
    const dt = parseISO(iso)
    return `${DAYS_LONG[dt.getUTCDay()]}, ${MONTHS_LONG[dt.getUTCMonth()]} ${dt.getUTCDate()}, ${dt.getUTCFullYear()}`
  }
  const monthLabel = (ym) => {
    const [y, m] = ym.split('-').map(Number)
    return `${MONTHS_LONG[m - 1]} ${y}`
  }
  const addDays = (iso, n) => {
    const dt = parseISO(iso)
    dt.setUTCDate(dt.getUTCDate() + n)
    return toISO(dt)
  }
  const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000)
  const age = (dob, today) => {
    const a = parseISO(dob)
    const t = parseISO(today)
    let years = t.getUTCFullYear() - a.getUTCFullYear()
    if (t.getUTCMonth() < a.getUTCMonth() || (t.getUTCMonth() === a.getUTCMonth() && t.getUTCDate() < a.getUTCDate())) years--
    return years
  }
  /** "timestamp" = ISO date + HH:MM — the prototype clock (see S.now) */
  const time = (stamp) => (stamp && stamp.length > 10 ? stamp.slice(11, 16) : '')
  const stampLabel = (stamp, today) => {
    if (!stamp) return ''
    const d = stamp.slice(0, 10)
    const t = time(stamp)
    if (d === today) return t ? `Today ${t}` : 'Today'
    if (d === addDays(today, -1)) return t ? `Yesterday ${t}` : 'Yesterday'
    return t ? `${dateShort(d)} ${t}` : dateShort(d)
  }

  const counters = {}
  const id = (prefix) => {
    counters[prefix] = (counters[prefix] || 1000) + 1
    return `${prefix}${counters[prefix]}`
  }
  /** Start every id sequence again — used when an environment is (re)loaded. */
  const resetCounters = () => Object.keys(counters).forEach((k) => delete counters[k])
  const bumpCounter = (prefix, value) => {
    counters[prefix] = Math.max(counters[prefix] || 1000, value)
  }

  const sum = (arr, fn) => round(arr.reduce((acc, x) => acc + (Number(fn ? fn(x) : x) || 0), 0))
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`
  const initials = (name) =>
    (name || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('')
  const debounce = (fn, ms) => {
    let t
    return (...args) => {
      clearTimeout(t)
      t = setTimeout(() => fn(...args), ms)
    }
  }
  const groupBy = (arr, fn) =>
    arr.reduce((acc, x) => {
      const k = fn(x)
      ;(acc[k] = acc[k] || []).push(x)
      return acc
    }, {})
  const uniq = (arr) => [...new Set(arr)]
  const cmp = (a, b) => {
    if (a === b) return 0
    if (a === null || a === undefined || a === '') return 1
    if (b === null || b === undefined || b === '') return -1
    if (typeof a === 'number' && typeof b === 'number') return a - b
    return String(a).localeCompare(String(b), 'en', { numeric: true, sensitivity: 'base' })
  }
  const phone = (p) => p || ''
  const qs = (sel, root = document) => root.querySelector(sel)
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel))
  const attr = (obj) =>
    Object.entries(obj)
      .filter(([, v]) => v !== undefined && v !== null && v !== false)
      .map(([k, v]) => (v === true ? k : `${k}="${esc(v)}"`))
      .join(' ')
  const clone = (o) => JSON.parse(JSON.stringify(o))
  const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0)

  return {
    esc, round, money, moneyShort, parseISO, toISO, date, dateShort, dateLong, monthLabel, addDays,
    daysBetween, age, time, stampLabel, id, bumpCounter, resetCounters, sum, plural, initials, debounce, groupBy,
    uniq, cmp, phone, qs, qsa, attr, clone, pct, MONTHS,
  }
})()
