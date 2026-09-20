import { getCompany } from '../lib/companyProfile'
import { applyDispatchFrom } from '../lib/locations'

/**
 * Mecwin-style Delivery Challan print layout.
 *
 * Fields read from the challan row (all optional – sensible defaults are printed):
 *   dc_number, dc_date, dc_type ('Non-Returnable' | 'Returnable'),
 *   purpose (or reason), note, insurance_value,
 *   reference_name, kind_attention, no_of_packages, weight_kg,
 *   bill_to_snapshot / ship_to_snapshot { name, address_line1, address_line2,
 *     city, district, state, pin_code, phone, gstin }
 * Item rows: item_name, description, hsn, uom, quantity
 */

const PAGE_ORIENTATION = 'landscape' // change to 'portrait' if you prefer
const MIN_ITEM_ROWS = 4

export function buildChallanHtml(challan, items, eway, mode = 'pdf') {
  // Company profile + the address / GSTIN of the location this challan was dispatched from
  const dispatch = challan.dispatch_from_snapshot || {}
  const COMPANY = applyDispatchFrom(getCompany(), dispatch)
  const billTo = challan.bill_to_snapshot || {}
  const shipTo = challan.ship_to_snapshot || {}
  const list = items || []

  const companyAddressLine = [
    COMPANY.address,
    [COMPANY.state, COMPANY.pincode].filter(Boolean).join(' - ')
  ].filter(Boolean).join(', ')
  const gstin = COMPANY.gstin || ''
  // PAN is characters 3–12 of a GSTIN, so we derive it if it isn't configured
  const pan = COMPANY.pan || (gstin.length >= 12 ? gstin.slice(2, 12) : '')
  const logoSrc = resolveLogo(COMPANY.logo || '/logo.png')

  const totalQty =
    challan.total_quantity != null
      ? challan.total_quantity
      : list.reduce((s, it) => s + (Number(it.quantity) || 0), 0)

  const purpose = challan.purpose || challan.reason || ''
  const insurance = challan.insurance_value
  const defaultNote =
    'The listed above materials is only for service purpose. There is no commercial value involved in the above material.' +
    (insurance ? ` The insurance value is ${formatInr(insurance)}` : '')
  const note = challan.note || defaultNote

  const pkgText = challan.no_of_packages ? String(challan.no_of_packages) : ''
  const weightText = challan.weight_kg ? `${challan.weight_kg} KG` : ''

  // Item rows (padded so the table never looks empty)
  const rowCount = Math.max(list.length, MIN_ITEM_ROWS)
  const rowsHtml = Array.from({ length: rowCount }, (_, i) => {
    const it = list[i]
    const purposeCell =
      i === 0 ? `<td class="purpose" rowspan="${rowCount + 1}">${esc(purpose)}</td>` : ''
    if (!it) {
      return `<tr class="blank"><td>&nbsp;</td><td></td><td></td><td></td><td></td>${purposeCell}</tr>`
    }
    return `<tr>
      <td class="r">${i + 1}</td>
      <td>${esc(it.item_name || '')}${it.description ? ` <span class="muted">– ${esc(it.description)}</span>` : ''}</td>
      <td class="c">${esc(it.hsn || '')}</td>
      <td class="c">${esc(it.uom || "No's")}</td>
      <td class="c">${fmtQty(it.quantity)}</td>
      ${purposeCell}
    </tr>`
  }).join('')

  const ewayRow =
    eway && eway.eway_bill_number
      ? `<div class="row full"><div class="cell"><b>E-Way Bill No:</b> ${esc(eway.eway_bill_number)}
           &nbsp;|&nbsp; <b>Date:</b> ${fmtDate(eway.eway_bill_date)}
           &nbsp;|&nbsp; <b>Valid Until:</b> ${fmtDate(eway.valid_until)}
           &nbsp;|&nbsp; <b>Status:</b> ${esc(eway.status || '')}</div></div>`
      : ''

  const fallbackName = esc((COMPANY.name || '').split(' ')[0])

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${esc(challan.dc_number || 'Delivery Challan')}</title>
<style>
  @page { size: A4 ${PAGE_ORIENTATION}; margin: 8mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 10px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sheet { border: 1px solid #000; width: 100%; }
  .row { display: grid; border-top: 1px solid #000; }
  .cell { padding: 2px 5px; min-width: 0; }
  .cell + .cell { border-left: 1px solid #000; }
  .b { font-weight: 700; }
  .c { text-align: center; }
  .r { text-align: right; }
  .muted { color: #444; font-size: 9px; }

  /* Header */
  .hdr { display: grid; grid-template-columns: 30% 70%; }
  .logo { display: flex; align-items: center; justify-content: center; padding: 6px; }
  .logo img { max-width: 100%; max-height: 92px; object-fit: contain; }
  .logo .fallback { font-size: 26px; font-weight: 800; letter-spacing: 1px; color: #1c5fa8; }
  .hdr-right { border-left: 1px solid #000; }
  .co-name { text-align: center; font-weight: 700; font-size: 13px; padding: 3px 5px; }
  .co-addr { text-align: center; font-size: 8px; padding: 3px 5px; border-top: 1px solid #000; min-height: 16px; }
  .co-loc { text-align: center; font-size: 8px; font-weight: 700; padding: 2px 5px; border-top: 1px solid #000; }
  .co-gst { text-align: center; font-weight: 700; font-size: 9px; padding: 3px 5px; border-top: 1px solid #000; }
  .dc-row { display: grid; grid-template-columns: 36% 64%; border-top: 1px solid #000; }
  .dc-title { display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 10px; }
  .dc-meta { border-left: 1px solid #000; }
  .kv { display: grid; grid-template-columns: 34% 66%; border-bottom: 1px solid #000; }
  .kv b { text-align: right; padding: 1px 5px; border-right: 1px solid #000; }
  .kv span { padding: 1px 5px; }
  .dc-type { text-align: right; font-weight: 700; padding: 1px 5px; }

  /* Bill / Ship */
  .two { grid-template-columns: 1fr 1fr; }
  .party-h { font-weight: 700; font-size: 10.5px; }
  .party-name { font-weight: 700; }
  .party-addr { min-height: 40px; padding-top: 14px; }

  /* Items */
  table.items { width: 100%; border-collapse: collapse; border-top: 1px solid #000; table-layout: fixed; }
  table.items th, table.items td { border: 1px solid #000; padding: 2px 5px; font-size: 10px; }
  table.items tr > *:first-child { border-left: 0; }
  table.items tr > *:last-child { border-right: 0; }
  table.items thead th { font-size: 9.5px; font-weight: 700; text-align: center; }
  table.items thead { display: table-header-group; }
  table.items tr { page-break-inside: avoid; }
  table.items td.purpose { text-align: center; vertical-align: middle; font-size: 10.5px; }
  table.items tr.total td { font-weight: 700; }

  .note { padding: 6px 5px; min-height: 26px; }
  .ref { grid-template-columns: 1fr 1fr; }
  .pkg { display: flex; align-items: flex-end; justify-content: space-between; padding: 2px 5px; }
  .ref-r { padding: 0; }
  .ref-r .g2 { display: grid; grid-template-columns: 1fr 1fr; }
  .ref-r .g2 > div { padding: 2px 5px; }
  .ref-r .g2 > div + div { border-left: 1px solid #000; }
  .ref-r .g2.top { border-bottom: 1px solid #000; font-weight: 700; }
  .sign { grid-template-columns: 1fr 1fr; height: 78px; }
  .sign .cell { display: flex; align-items: flex-end; font-weight: 700; }
  .sign .cell.right { justify-content: center; }
  .certify { padding: 2px 5px; }
  .full { grid-template-columns: 1fr; }
</style>
</head>
<body>
<div class="sheet">

  <div class="hdr">
    <div class="logo">
      <img src="${esc(logoSrc)}" alt="${esc(COMPANY.name)}"
           onerror="this.outerHTML='<div class=&quot;fallback&quot;>${fallbackName}</div>'" />
    </div>
    <div class="hdr-right">
      <div class="co-name">${esc(COMPANY.name)}</div>
      <div class="co-addr">${esc(companyAddressLine)}</div>
      ${dispatch.location_id && (dispatch.location_name || '').trim().toLowerCase() !== (COMPANY.name || '').trim().toLowerCase() ? `<div class="co-loc">Dispatch From: ${esc(dispatch.location_name || '')}</div>` : ''}
      <div class="co-gst">GSTIN: ${esc(gstin)}${pan ? ` &nbsp; PAN: ${esc(pan)}` : ''}</div>
      <div class="dc-row">
        <div class="dc-title">DELIVERY CHALLAN</div>
        <div class="dc-meta">
          <div class="kv"><b>DC No:</b><span>${esc(challan.dc_number || '')}</span></div>
          <div class="kv"><b>DC Date:</b><span>${fmtDate(challan.dc_date)}</span></div>
          <div class="dc-type">DC Type: ${esc(challan.dc_type || 'Non-Returnable')}</div>
        </div>
      </div>
    </div>
  </div>

  <div class="row two">
    <div class="cell party-h">Bill To</div>
    <div class="cell party-h">Ship To:</div>
  </div>
  <div class="row two">
    <div class="cell party-name">${esc(billTo.name || '')}</div>
    <div class="cell party-name">${esc(shipTo.name || '')}</div>
  </div>
  <div class="row two">
    <div class="cell party-addr">${esc(addressLine(billTo))}<br/>${phoneLine(billTo)}</div>
    <div class="cell party-addr">${esc(addressLine(shipTo))}<br/>${phoneLine(shipTo)}</div>
  </div>
  <div class="row two">
    <div class="cell b">GSTIN: ${esc(billTo.gstin || 'URP')}</div>
    <div class="cell b">GSTIN: ${esc(shipTo.gstin || 'URP')}</div>
  </div>

  <table class="items">
    <colgroup>
      <col style="width:5%"><col><col style="width:12%"><col style="width:7%"><col style="width:6%"><col style="width:22%">
    </colgroup>
    <thead>
      <tr><th>SL.No</th><th>Item Description</th><th>HSN</th><th>UOM</th><th>Qty</th><th>Purpose</th></tr>
    </thead>
    <tbody>
      ${rowsHtml}
      <tr class="total"><td colspan="2" class="c">Total</td><td></td><td></td><td class="c">${fmtQty(totalQty)}</td></tr>
    </tbody>
  </table>

  <div class="row full"><div class="cell note"><b>Note:</b>${esc(note)}</div></div>

  <div class="row ref">
    <div class="cell pkg">
      <span><b>No of Package:</b> ${esc(pkgText)}</span>
      <span class="b">${esc(weightText)}</span>
    </div>
    <div class="cell ref-r">
      <div class="g2 top"><div>Reference Name/Department:</div><div>Kind Attention:</div></div>
      <div class="g2"><div>${esc(challan.reference_name || '')}</div><div>${esc(challan.kind_attention || 'Not for Sale')}</div></div>
    </div>
  </div>

  ${ewayRow}

  <div class="row full"><div class="cell certify">I /We certify that to best of my knowledge the particulars are true, correct, and complete.</div></div>

  <div class="row sign">
    <div class="cell">Name and signature of the person to whom the goods were delivered.</div>
    <div class="cell right">Name and signature of the Consignor</div>
  </div>

</div>
<script>
  window.onload = function () { window.print(); };
</script>
</body>
</html>`
}

/**
 * Opens the printable challan in a new tab and triggers the browser print /
 * "Save as PDF" dialog. Signature is unchanged, so MasterList and the
 * create/edit pages keep working without edits.
 */
export function openChallanPrintView(challan, items, eway, mode = 'pdf') {
  const html = buildChallanHtml(challan, items, eway, mode)
  const win = window.open('', '_blank', 'width=1100,height=800')
  if (!win) {
    throw new Error('Pop-up blocked. Please allow pop-ups for this site to generate the PDF / print.')
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
}

/* ------------------------------ helpers ------------------------------ */

function resolveLogo(src) {
  if (/^(https?:|data:)/i.test(src)) return src
  if (typeof window !== 'undefined') return window.location.origin + (src.startsWith('/') ? src : '/' + src)
  return src
}

function addressLine(p) {
  const street = [p.address_line1, p.address_line2, p.city, p.district].filter(Boolean).join(', ')
  const stateBit = [p.state, p.pin_code].filter(Boolean).join('-')
  const all = [street, stateBit].filter(Boolean).join(', ')
  return all ? all + '.' : ''
}

function phoneLine(p) {
  const ph = p.phone || p.mobile || p.contact_number
  return ph ? `Ph. No.-${esc(ph)}` : ''
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function fmtDate(d) {
  if (!d) return '-'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d))
  if (m) return `${m[3]}-${MONTHS[Number(m[2]) - 1]}-${m[1]}`
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return String(d)
  return `${String(date.getDate()).padStart(2, '0')}-${MONTHS[date.getMonth()]}-${date.getFullYear()}`
}

function fmtQty(q) {
  const n = Number(q)
  if (!Number.isFinite(n)) return ''
  return String(+n.toFixed(3))
}

function formatInr(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return String(v)
  return `INR ${n.toLocaleString('en-IN')}/-`
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
