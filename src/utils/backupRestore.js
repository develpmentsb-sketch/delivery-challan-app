import { supabase } from '../lib/supabase'

const TABLES = [
  'companies',
  'company_locations',
  'partners',
  'partner_ship_to',
  'items',
  'delivery_challans',
  'delivery_challan_items',
  'eway_bills'
]

export async function createBackup() {
  const backup = { generated_at: new Date().toISOString(), version: 1, data: {} }

  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select('*')
    if (error) throw new Error(`Failed to read ${table}: ${error.message}`)
    backup.data[table] = data || []
  }

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const dateStr = new Date().toISOString().slice(0, 10)
  link.href = url
  link.download = `DC_EwayBill_Backup_${dateStr}.json`
  link.click()
  URL.revokeObjectURL(url)
  return backup
}

export function readBackupFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result)
        if (!parsed.data) throw new Error('Invalid backup file: missing "data" section')
        resolve(parsed)
      } catch (err) {
        reject(new Error('Could not parse backup file. Make sure it is a valid JSON export from this app.'))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read the file'))
    reader.readAsText(file)
  })
}

/**
 * Restores a backup. Tables are restored in dependency order so foreign
 * keys resolve correctly. Uses upsert (by id) so restoring is safe to
 * re-run, but existing rows with the same id ARE overwritten - the
 * caller must have already confirmed this with the user.
 */
export async function restoreBackup(backup, onProgress) {
  const order = [
    'companies',
    'company_locations',
    'partners',
    'partner_ship_to',
    'items',
    'delivery_challans',
    'delivery_challan_items',
    'eway_bills'
  ]

  for (const table of order) {
    const rows = backup.data[table]
    if (!rows || rows.length === 0) {
      onProgress?.(table, 0)
      continue
    }
    const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' })
    if (error) throw new Error(`Failed to restore ${table}: ${error.message}`)
    onProgress?.(table, rows.length)
  }
}
