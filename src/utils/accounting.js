// Accounting engine: pure functions, no database calls.
// Sign convention: balances are "signed" - debit positive, credit negative.

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100
const isZero = (n) => Math.abs(n) < 0.005

export const inr = (n) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ---------- Financial year (April - March) ----------
export function fyOf(dateStr) {
  const y = Number(dateStr.slice(0, 4)); const m = Number(dateStr.slice(5, 7))
  const s = m >= 4 ? y : y - 1
  return `${s}-${String(s + 1).slice(2)}`
}
export function fyRange(fy) {
  const y = Number(fy.slice(0, 4))
  return { from: `${y}-04-01`, to: `${y + 1}-03-31` }
}
export function prevFy(fy) {
  const y = Number(fy.slice(0, 4)) - 1
  return `${y}-${String(y + 1).slice(2)}`
}
export function fyList(booksStart, todayStr) {
  const first = Number(fyOf(booksStart).slice(0, 4))
  const last = Number(fyOf(todayStr).slice(0, 4))
  const out = []
  for (let y = Math.max(first, last); y >= first; y--) out.push(`${y}-${String(y + 1).slice(2)}`)
  return out
}

// ---------- Groups and ledgers ----------
export function indexGroups(groups) {
  const byId = Object.fromEntries(groups.map((g) => [g.id, g]))
  const top = (id) => { let g = byId[id]; let n = 0; while (g && g.parent_id && byId[g.parent_id] && n++ < 20) g = byId[g.parent_id]; return g }
  const sched = (id) => { let g = byId[id]; let n = 0; while (g && !g.sched3 && g.parent_id && n++ < 20) g = byId[g.parent_id]; return g?.sched3 || null }
  const path = (id) => { const p = []; let g = byId[id]; let n = 0; while (g && n++ < 20) { p.unshift(g.name); g = g.parent_id ? byId[g.parent_id] : null } return p }
  return { byId, top, sched, path }
}

export function ledgerInfos(ledgers, gi) {
  return ledgers.map((l) => {
    const g = gi.byId[l.group_id]
    const t = g ? gi.top(g.id) : null
    const nature = g?.nature || 'Asset'
    const nominal = nature === 'Income' || nature === 'Expense'
    const openSigned = nominal ? 0 : (l.opening_type === 'Cr' ? -1 : 1) * Number(l.opening_balance || 0)
    return { ...l, groupName: g?.name || '', topName: t?.name || '', nature, nominal, sched: gi.sched(l.group_id), openSigned }
  })
}

// totals: rows from acc_ledger_totals { ledger_id, pre_debit, pre_credit, per_debit, per_credit }
export function balances(infos, totals) {
  const tm = Object.fromEntries((totals || []).map((t) => [t.ledger_id, t]))
  const out = {}
  infos.forEach((l) => {
    const t = tm[l.id] || {}
    const preDr = Number(t.pre_debit || 0), preCr = Number(t.pre_credit || 0)
    const perDr = Number(t.per_debit || 0), perCr = Number(t.per_credit || 0)
    const opening = l.nominal ? 0 : l.openSigned + preDr - preCr
    out[l.id] = { opening, preDr, preCr, perDr, perCr, preNet: preCr - preDr, closing: opening + perDr - perCr }
  })
  return out
}

// ---------- Report shape ----------
// { title, subtitle, columns:[{label,align}], rows:[{cells:[], style, indent}] }
const money = (n) => (isZero(n) ? '' : inr(Math.abs(n)))
const drcr = (n) => (isZero(n) ? '' : `${inr(Math.abs(n))} ${n > 0 ? 'Dr' : 'Cr'}`)

// ---------- Trial balance ----------
const TOP_ORDER = ['Capital Account', 'Loans (Liability)', 'Current Liabilities', 'Fixed Assets', 'Investments', 'Current Assets',
  'Misc. Expenses (ASSET)', 'Suspense A/c', 'Sales Accounts', 'Purchase Accounts', 'Direct Incomes', 'Direct Expenses', 'Indirect Incomes', 'Indirect Expenses']

export function trialBalance(infos, bal, meta) {
  const rows = []
  let tOpDr = 0, tOpCr = 0, tDr = 0, tCr = 0, tClDr = 0, tClCr = 0
  const tops = [...new Set(infos.map((l) => l.topName))].sort((a, b) => (TOP_ORDER.indexOf(a) + 100) % 100 - (TOP_ORDER.indexOf(b) + 100) % 100)
  tops.forEach((top) => {
    const ls = infos.filter((l) => l.topName === top && !l.nominalSkip).sort((a, b) => a.name.localeCompare(b.name))
    const lines = ls.map((l) => ({ l, b: bal[l.id] })).filter(({ b }) => !isZero(b.opening) || !isZero(b.perDr) || !isZero(b.perCr))
    if (!lines.length) return
    rows.push({ cells: [top, '', '', '', '', '', ''], style: 'sub' })
    lines.forEach(({ l, b }) => {
      const opDr = b.opening > 0 ? b.opening : 0, opCr = b.opening < 0 ? -b.opening : 0
      const clDr = b.closing > 0 ? b.closing : 0, clCr = b.closing < 0 ? -b.closing : 0
      tOpDr += opDr; tOpCr += opCr; tDr += b.perDr; tCr += b.perCr; tClDr += clDr; tClCr += clCr
      rows.push({ cells: [l.name, money(opDr), money(opCr), money(b.perDr), money(b.perCr), money(clDr), money(clCr)], indent: 1 })
    })
  })
  rows.push({ cells: ['Grand Total', money(tOpDr), money(tOpCr), money(tDr), money(tCr), money(tClDr), money(tClCr)], style: 'total' })
  const diff = r2(tClDr - tClCr)
  if (!isZero(diff)) rows.push({ cells: [`Difference (books do not tally): ${inr(Math.abs(diff))} ${diff > 0 ? 'Dr' : 'Cr'}`, '', '', '', '', '', ''], style: 'warn' })
  return {
    title: 'Trial Balance', subtitle: meta.subtitle,
    columns: [{ label: 'Particulars' }, { label: 'Opening Dr', align: 'right' }, { label: 'Opening Cr', align: 'right' }, { label: 'Debit', align: 'right' }, { label: 'Credit', align: 'right' }, { label: 'Closing Dr', align: 'right' }, { label: 'Closing Cr', align: 'right' }],
    rows
  }
}

// ---------- Trading and Profit & Loss ----------
export function profitAndLoss(infos, bal, stock) {
  const pick = (top, sign) => infos.filter((l) => l.topName === top)
    .map((l) => ({ name: l.name, amount: sign * (bal[l.id].perDr - bal[l.id].perCr) }))
    .filter((x) => !isZero(x.amount)).sort((a, b) => a.name.localeCompare(b.name))
  const sum = (a) => a.reduce((s, x) => s + x.amount, 0)
  const sales = pick('Sales Accounts', -1), directInc = pick('Direct Incomes', -1), indirectInc = pick('Indirect Incomes', -1)
  const purchases = pick('Purchase Accounts', 1), directExp = pick('Direct Expenses', 1), indirectExp = pick('Indirect Expenses', 1)
  const tradingDr = stock.opening + sum(purchases) + sum(directExp)
  const tradingCr = sum(sales) + sum(directInc) + stock.closing
  const gp = r2(tradingCr - tradingDr)
  const plDr = sum(indirectExp) + (gp < 0 ? -gp : 0)
  const plCr = sum(indirectInc) + (gp > 0 ? gp : 0)
  const np = r2(plCr - plDr)
  return { sales, directInc, indirectInc, purchases, directExp, indirectExp, openingStock: stock.opening, closingStock: stock.closing, gp, np,
    salesTotal: sum(sales), purchasesTotal: sum(purchases), tradingDr, tradingCr, plDr, plCr }
}

export function plReport(pl, meta) {
  const side = (title, left, right) => ({ title, left, right })
  const build = (left, right, totalL, totalR) => {
    const n = Math.max(left.length, right.length)
    const rows = []
    for (let i = 0; i < n; i++) {
      const a = left[i], b = right[i]
      rows.push({ cells: [a ? a.name : '', a ? money(a.amount) : '', b ? b.name : '', b ? money(b.amount) : ''], indent: 0 })
    }
    rows.push({ cells: ['Total', money(totalL), 'Total', money(totalR)], style: 'total' })
    return rows
  }
  const L1 = [{ name: 'Opening Stock', amount: pl.openingStock }]
  if (pl.purchases.length) { L1.push({ name: 'Purchase Accounts', amount: pl.purchasesTotal }); }
  pl.purchases.forEach((x) => L1.push({ name: `   ${x.name}`, amount: 0 }))
  pl.directExp.forEach((x) => L1.push(x))
  if (pl.gp > 0) L1.push({ name: 'Gross Profit c/d', amount: pl.gp })
  const R1 = []
  pl.sales.forEach((x) => R1.push(x))
  pl.directInc.forEach((x) => R1.push(x))
  R1.push({ name: 'Closing Stock', amount: pl.closingStock })
  if (pl.gp < 0) R1.push({ name: 'Gross Loss c/d', amount: -pl.gp })
  const tradeTot = Math.max(pl.tradingDr + (pl.gp > 0 ? pl.gp : 0), pl.tradingCr + (pl.gp < 0 ? -pl.gp : 0))
  const L2 = []
  if (pl.gp < 0) L2.push({ name: 'Gross Loss b/d', amount: -pl.gp })
  pl.indirectExp.forEach((x) => L2.push(x))
  if (pl.np > 0) L2.push({ name: 'Net Profit', amount: pl.np })
  const R2 = []
  if (pl.gp > 0) R2.push({ name: 'Gross Profit b/d', amount: pl.gp })
  pl.indirectInc.forEach((x) => R2.push(x))
  if (pl.np < 0) R2.push({ name: 'Net Loss', amount: -pl.np })
  const plTot = Math.max(pl.plDr + (pl.np > 0 ? pl.np : 0), pl.plCr + (pl.np < 0 ? -pl.np : 0))
  const rows = [
    { cells: ['Trading Account', '', '', ''], style: 'sub' }, ...build(L1, R1, tradeTot, tradeTot),
    { cells: ['Profit & Loss Account', '', '', ''], style: 'sub' }, ...build(L2, R2, plTot, plTot)
  ]
  return {
    title: 'Trading and Profit & Loss Account', subtitle: meta.subtitle,
    columns: [{ label: 'Particulars' }, { label: 'Amount', align: 'right' }, { label: 'Particulars' }, { label: 'Amount', align: 'right' }],
    rows
  }
}

// ---------- Schedule III balance sheet ----------
const OPP_FOR_LIAB = { trade_payables: 'other_ca' }
const OPP_FOR_ASSET = { cash_bank: 'st_borrowings', trade_receivables: 'other_cl' }
const LIAB_KEYS = ['share_capital', 'reserves', 'lt_borrowings', 'st_borrowings', 'trade_payables', 'other_cl', 'st_provisions']
const ASSET_KEYS = ['ppe', 'nc_investments', 'lt_loans_adv', 'inventories', 'trade_receivables', 'cash_bank', 'st_loans_adv', 'other_ca']

export function stockContext(infos, bal, { fy, booksStart, closingByFy }) {
  const s0 = infos.filter((l) => l.sched === 'inventories').reduce((s, l) => s + l.openSigned, 0)
  const first = fyOf(booksStart) === fy
  const prevClosing = Number(closingByFy[prevFy(fy)] || 0)
  const closing = Number(closingByFy[fy] || 0)
  return { s0, first, opening: first ? s0 : prevClosing, closing, prevClosing }
}

export function scheduleIII(infos, bal, st, pl) {
  const items = Object.fromEntries([...LIAB_KEYS, ...ASSET_KEYS].map((k) => [k, []]))
  infos.filter((l) => !l.nominal && l.sched !== 'inventories').forEach((l) => {
    const b = bal[l.id].closing
    if (isZero(b)) return
    const liab = l.nature === 'Liability'
    const natural = liab ? -b : b
    let key = l.sched || (liab ? 'other_cl' : 'other_ca')
    if (!items[key]) key = liab ? 'other_cl' : 'other_ca'
    if (natural < 0) key = liab ? (OPP_FOR_LIAB[key] || 'other_ca') : (OPP_FOR_ASSET[key] || 'other_cl')
    items[key].push({ name: l.name, amount: Math.abs(natural) })
  })
  const nominalPre = infos.filter((l) => l.nominal).reduce((s, l) => s + bal[l.id].preNet, 0)
  const priorProfit = st.first ? 0 : nominalPre + st.prevClosing - st.s0
  const surplus = r2(priorProfit + pl.np)
  if (!isZero(surplus)) items.reserves.push({ name: 'Surplus in Statement of Profit and Loss', amount: surplus })
  if (st.closing > 0) items.inventories.push({ name: 'Closing stock', amount: st.closing })
  const sum = (k) => items[k].reduce((s, x) => s + x.amount, 0)
  const sec = (title, defs) => {
    const lines = defs.map(([label, key]) => ({ label, items: items[key], amount: sum(key) })).filter((x) => !isZero(x.amount))
    return { title, lines, total: lines.reduce((s, x) => s + x.amount, 0) }
  }
  const liabilities = [
    sec("Shareholders' funds", [['Share capital', 'share_capital'], ['Reserves and surplus', 'reserves']]),
    sec('Non-current liabilities', [['Long-term borrowings', 'lt_borrowings']]),
    sec('Current liabilities', [['Short-term borrowings', 'st_borrowings'], ['Trade payables', 'trade_payables'], ['Other current liabilities', 'other_cl'], ['Short-term provisions', 'st_provisions']])
  ]
  const assets = [
    sec('Non-current assets', [['Property, plant and equipment', 'ppe'], ['Non-current investments', 'nc_investments'], ['Long-term loans and advances', 'lt_loans_adv']]),
    sec('Current assets', [['Inventories', 'inventories'], ['Trade receivables', 'trade_receivables'], ['Cash and cash equivalents', 'cash_bank'], ['Short-term loans and advances', 'st_loans_adv'], ['Other current assets', 'other_ca']])
  ]
  const totalL = r2(liabilities.reduce((s, x) => s + x.total, 0))
  const totalA = r2(assets.reduce((s, x) => s + x.total, 0))
  const cur = (keys) => keys.reduce((s, k) => s + sum(k), 0)
  return {
    liabilities, assets, totalL, totalA, diff: r2(totalA - totalL), surplus,
    figures: {
      currentAssets: cur(['inventories', 'trade_receivables', 'cash_bank', 'st_loans_adv', 'other_ca']),
      currentLiabilities: cur(['st_borrowings', 'trade_payables', 'other_cl', 'st_provisions']),
      inventories: sum('inventories'), receivables: sum('trade_receivables'), payables: sum('trade_payables'), cash: sum('cash_bank'),
      equity: cur(['share_capital', 'reserves']), debt: cur(['lt_borrowings', 'st_borrowings'])
    }
  }
}

export function bsReport(bs, meta, detail) {
  const rows = []
  const block = (heading, secs, total) => {
    rows.push({ cells: [heading, ''], style: 'head' })
    secs.forEach((s, i) => {
      rows.push({ cells: [`${i + 1}. ${s.title}`, ''], style: 'sub' })
      s.lines.forEach((ln) => {
        rows.push({ cells: [ln.label, inr(ln.amount)], indent: 1 })
        if (detail) ln.items.forEach((it) => rows.push({ cells: [it.name, inr(it.amount)], indent: 2, style: 'muted' }))
      })
    })
    rows.push({ cells: ['TOTAL', inr(total)], style: 'total' })
  }
  block('EQUITY AND LIABILITIES', bs.liabilities, bs.totalL)
  block('ASSETS', bs.assets, bs.totalA)
  if (!isZero(bs.diff)) rows.push({ cells: [`Difference in books (assets - liabilities): ${inr(bs.diff)}. Check opening balances.`, ''], style: 'warn' })
  return { title: 'Balance Sheet (Schedule III format)', subtitle: meta.subtitle, columns: [{ label: 'Particulars' }, { label: 'Amount (Rs)', align: 'right' }], rows }
}

// ---------- Cash flow (from cash / bank vouchers) ----------
export function cashFlow(infos, bal, vouchers, from, to) {
  const byId = Object.fromEntries(infos.map((l) => [l.id, l]))
  const isCash = (id) => byId[id]?.sched === 'cash_bank'
  const cls = (l) => (['Fixed Assets', 'Investments'].includes(l.topName) ? 'Investing' : ['Capital Account', 'Loans (Liability)'].includes(l.topName) ? 'Financing' : 'Operating')
  const acc = { Operating: {}, Investing: {}, Financing: {} }
  vouchers.filter((v) => v.voucher_date >= from && v.voucher_date <= to).forEach((v) => {
    const es = v.acc_entries || []
    const cashNet = es.filter((e) => isCash(e.ledger_id)).reduce((s, e) => s + Number(e.debit) - Number(e.credit), 0)
    if (isZero(cashNet)) return
    es.filter((e) => !isCash(e.ledger_id)).forEach((e) => {
      const l = byId[e.ledger_id]; if (!l) return
      const amt = -(Number(e.debit) - Number(e.credit))
      if (isZero(amt)) return
      const c = cls(l)
      acc[c][l.name] = (acc[c][l.name] || 0) + amt
    })
  })
  const cashLedgers = infos.filter((l) => l.sched === 'cash_bank')
  const opening = cashLedgers.reduce((s, l) => s + bal[l.id].opening, 0)
  const closing = cashLedgers.reduce((s, l) => s + bal[l.id].closing, 0)
  const rows = []
  let net = 0
  ;['Operating', 'Investing', 'Financing'].forEach((c) => {
    const entries = Object.entries(acc[c]).sort((a, b) => a[0].localeCompare(b[0]))
    const total = entries.reduce((s, [, v]) => s + v, 0)
    net += total
    rows.push({ cells: [`${c} activities`, ''], style: 'sub' })
    entries.forEach(([n, v]) => rows.push({ cells: [n, `${v < 0 ? '(' : ''}${inr(Math.abs(v))}${v < 0 ? ')' : ''}`], indent: 1 }))
    rows.push({ cells: [`Net cash from ${c.toLowerCase()} activities`, inr(total)], style: 'total' })
  })
  rows.push({ cells: ['Net increase / (decrease) in cash and bank', inr(net)], style: 'total' })
  rows.push({ cells: ['Opening cash and bank balance', inr(opening)] })
  rows.push({ cells: ['Closing cash and bank balance', inr(closing)], style: 'total' })
  const diff = r2(opening + net - closing)
  if (!isZero(diff)) rows.push({ cells: [`Does not reconcile by ${inr(diff)} (check vouchers dated outside this year)`, ''], style: 'warn' })
  return { net, opening, closing, rows }
}

// ---------- Ratios ----------
export function ratios(pl, bs) {
  const f = bs.figures
  const d = (a, b) => (isZero(b) ? null : a / b)
  const fmt = (v, suffix = '') => (v === null ? 'n/a' : `${v.toFixed(2)}${suffix}`)
  const revenue = pl.salesTotal
  const rows = [
    ['Current ratio', fmt(d(f.currentAssets, f.currentLiabilities)), 'Current assets / current liabilities'],
    ['Quick ratio', fmt(d(f.currentAssets - f.inventories, f.currentLiabilities)), '(Current assets - inventories) / current liabilities'],
    ['Working capital (Rs)', inr(f.currentAssets - f.currentLiabilities), 'Current assets - current liabilities'],
    ['Debt-equity ratio', fmt(d(f.debt, f.equity)), 'Borrowings / shareholders\' funds'],
    ['Gross profit margin', fmt(d(pl.gp * 100, revenue), ' %'), 'Gross profit / sales'],
    ['Net profit margin', fmt(d(pl.np * 100, revenue), ' %'), 'Net profit / sales'],
    ['Return on equity', fmt(d(pl.np * 100, f.equity), ' %'), 'Net profit / shareholders\' funds'],
    ['Debtor days', fmt(d(f.receivables * 365, revenue), ' days'), 'Receivables / sales x 365 (full-year basis)'],
    ['Creditor days', fmt(d(f.payables * 365, pl.purchasesTotal), ' days'), 'Payables / purchases x 365 (full-year basis)']
  ]
  return { rows }
}
export function ratiosReport(r, meta) {
  return { title: 'Key Ratios', subtitle: meta.subtitle, columns: [{ label: 'Ratio' }, { label: 'Value', align: 'right' }, { label: 'How it is worked out' }], rows: r.rows.map((x) => ({ cells: x })) }
}

// ---------- Ledger report ----------
export function ledgerReport(info, b, vouchers, nameById, from, to, meta) {
  const rows = []
  let run = b.opening
  rows.push({ cells: ['', '', 'Opening balance', '', '', drcr(run)], style: 'sub' })
  let tDr = 0, tCr = 0
  vouchers.filter((v) => v.voucher_date >= from && v.voucher_date <= to)
    .sort((a, c) => (a.voucher_date + a.voucher_no).localeCompare(c.voucher_date + c.voucher_no))
    .forEach((v) => {
      const mine = (v.acc_entries || []).filter((e) => e.ledger_id === info.id)
      if (!mine.length) return
      const others = (v.acc_entries || []).filter((e) => e.ledger_id !== info.id).map((e) => nameById[e.ledger_id]).filter(Boolean)
      const dr = mine.reduce((s, e) => s + Number(e.debit), 0), cr = mine.reduce((s, e) => s + Number(e.credit), 0)
      run += dr - cr; tDr += dr; tCr += cr
      rows.push({ cells: [v.voucher_date, `${v.voucher_type} ${v.voucher_no}`, [...new Set(others)].join(', '), money(dr), money(cr), drcr(run)] })
    })
  rows.push({ cells: ['', '', 'Total for the period', money(tDr), money(tCr), ''], style: 'total' })
  rows.push({ cells: ['', '', 'Closing balance', '', '', drcr(run)], style: 'total' })
  return { title: `Ledger: ${info.name}`, subtitle: meta.subtitle, columns: [{ label: 'Date' }, { label: 'Voucher' }, { label: 'Particulars' }, { label: 'Debit', align: 'right' }, { label: 'Credit', align: 'right' }, { label: 'Balance', align: 'right' }], rows }
}

// ---------- Export ----------
export function reportToAoa(rep) {
  const a = [[rep.title], [rep.subtitle || ''], [], rep.columns.map((c) => c.label)]
  rep.rows.forEach((r) => a.push(r.cells.map((c, i) => (i === 0 && r.indent ? `${'    '.repeat(r.indent)}${c}` : c))))
  return a
}
export function reportToHtml(rep, company) {
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const th = rep.columns.map((c) => `<th style="text-align:${c.align || 'left'}">${esc(c.label)}</th>`).join('')
  const body = rep.rows.map((r) => {
    const bold = ['total', 'head', 'sub'].includes(r.style)
    const bg = r.style === 'head' ? '#e8eef7' : r.style === 'sub' ? '#f3f5f9' : r.style === 'warn' ? '#fdecea' : ''
    const tds = r.cells.map((c, i) => `<td style="text-align:${rep.columns[i]?.align || 'left'};padding-left:${i === 0 ? 6 + (r.indent || 0) * 14 : 6}px">${esc(c)}</td>`).join('')
    return `<tr style="${bold ? 'font-weight:bold;' : ''}${bg ? `background:${bg};` : ''}${r.style === 'total' ? 'border-top:1px solid #333;' : ''}">${tds}</tr>`
  }).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(rep.title)}</title>
<style>body{font-family:Arial,sans-serif;font-size:12px;margin:24px;color:#111}h2{margin:0}p{margin:2px 0 12px;color:#555}
table{border-collapse:collapse;width:100%}th{background:#1f2f4f;color:#fff;padding:6px}td{padding:4px 6px;border-bottom:1px solid #e3e3e3}</style></head>
<body><h2>${esc(company || '')}</h2><h3 style="margin:2px 0">${esc(rep.title)}</h3><p>${esc(rep.subtitle || '')}</p>
<table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table></body></html>`
}
