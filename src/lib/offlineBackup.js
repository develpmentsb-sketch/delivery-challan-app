import { supabase } from './supabase'

// Everything that goes into the offline backup file. Tables that do not exist are skipped.
const TABLES = [
  'company_locations', 'partners', 'partner_ship_to', 'items', 'stock_movements',
  'acc_settings', 'acc_groups', 'acc_ledgers', 'acc_vouchers', 'acc_entries', 'acc_invoices', 'acc_invoice_lines', 'acc_stock_values',
  'delivery_challans', 'delivery_challan_items', 'challans', 'challan_items'
]

async function readTable(name) {
  const all = []
  for (let from = 0; ; from += 1000) {
    let res = await supabase.from(name).select('*').order('id').range(from, from + 999)
    if (res.error) res = await supabase.from(name).select('*').range(from, from + 999) // tables without an id column
    if (res.error) return { error: res.error }
    all.push(...res.data)
    if (res.data.length < 1000) break
  }
  return { rows: all }
}

// Reads every table and returns the backup object (does not download).
export async function collectBackup({ userEmail = '', onProgress } = {}) {
  const tables = {}
  const skipped = []
  for (const name of TABLES) {
    onProgress?.(name)
    const r = await readTable(name)
    if (r.error) skipped.push(name)
    else tables[name] = r.rows
  }
  return { app: 'dc-eway', version: 1, created_at: new Date().toISOString(), created_by: userEmail, tables, skipped }
}

const stamp = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}` }

function saveBlob(blob, name) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

// Downloads the .dcbackup file. Returns { counts, skipped } for a confirmation message.
export async function downloadOfflineBackup(opts = {}) {
  const backup = await collectBackup(opts)
  saveBlob(new Blob([JSON.stringify(backup)], { type: 'application/json' }), `DC-Backup-${stamp()}.dcbackup`)
  const counts = Object.fromEntries(Object.entries(backup.tables).map(([k, v]) => [k, v.length]))
  return { counts, skipped: backup.skipped }
}

// The offline viewer is a single HTML file kept with the app.
export async function downloadOfflineViewer() {
  const res = await fetch(`${import.meta.env.BASE_URL}DC-Offline-Viewer.html`, { cache: 'no-cache' })
  if (!res.ok) throw new Error('The offline viewer file was not found on the site yet. Wait for the deploy to finish and reload.')
  saveBlob(await res.blob(), 'DC-Offline-Viewer.html')
}
