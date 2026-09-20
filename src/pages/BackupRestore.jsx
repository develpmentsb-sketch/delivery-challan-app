import React, { useState } from 'react'
import { DatabaseBackup, Upload, Loader2, AlertTriangle } from 'lucide-react'
import Header from '../components/Header'
import ConfirmDialog from '../components/ConfirmDialog'
import { createBackup, readBackupFile, restoreBackup } from '../utils/backupRestore'
import { useToast } from '../context/ToastContext'

export default function BackupRestorePage() {
  const toast = useToast()
  const [backingUp, setBackingUp] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [pendingFile, setPendingFile] = useState(null)
  const [progress, setProgress] = useState([])

  async function handleBackup() {
    setBackingUp(true)
    try {
      await createBackup()
      toast.success('Backup downloaded successfully')
    } catch (err) {
      toast.error(err.message || 'Backup failed')
    } finally {
      setBackingUp(false)
    }
  }

  function handlePickFile(e) {
    const file = e.target.files?.[0]
    if (file) setPendingFile(file)
    e.target.value = ''
  }

  async function confirmRestore() {
    if (!pendingFile) return
    setRestoring(true)
    setProgress([])
    try {
      const backup = await readBackupFile(pendingFile)
      await restoreBackup(backup, (table, count) => setProgress((p) => [...p, { table, count }]))
      toast.success('Data restored successfully')
    } catch (err) {
      toast.error(err.message || 'Restore failed')
    } finally {
      setRestoring(false)
      setPendingFile(null)
    }
  }

  return (
    <div>
      <Header title="Backup / Restore" subtitle="Download a full backup, or restore from a previous one" />

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-5">
          <div className="w-10 h-10 rounded-md bg-navy text-cream-100 flex items-center justify-center mb-3">
            <DatabaseBackup size={20} />
          </div>
          <h3 className="font-semibold text-navy mb-1">Backup Data</h3>
          <p className="text-sm text-navy-400 mb-4">
            Download a complete backup as a JSON file, including Vendors, Ship To addresses,
            Items, Delivery Challans, Delivery Challan Items, and E-Way Bills.
          </p>
          <button className="btn-primary" disabled={backingUp} onClick={handleBackup}>
            {backingUp ? <Loader2 size={16} className="animate-spin" /> : <DatabaseBackup size={16} />} Download Backup
          </button>
        </div>

        <div className="card p-5">
          <div className="w-10 h-10 rounded-md bg-gold text-navy-900 flex items-center justify-center mb-3">
            <Upload size={20} />
          </div>
          <h3 className="font-semibold text-navy mb-1">Restore Data</h3>
          <p className="text-sm text-navy-400 mb-4">
            Upload a backup file exported from this app to restore your data.
          </p>
          <div className="flex items-start gap-2 bg-brick-50 border border-brick-100 text-brick-600 text-xs rounded-md p-3 mb-4">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            Warning: Restoring data may overwrite existing records.
          </div>
          <label className="btn-outline cursor-pointer w-fit">
            <Upload size={16} /> Choose Backup File
            <input type="file" accept="application/json" className="hidden" onChange={handlePickFile} />
          </label>

          {restoring && (
            <div className="mt-4 text-xs text-navy-500 space-y-1">
              {progress.map((p) => (
                <div key={p.table}>Restored {p.count} record(s) into {p.table}</div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(pendingFile)}
        title="Restore data from backup?"
        message="Warning: Restoring data may overwrite existing records. This action cannot be undone. Do you want to continue?"
        confirmLabel="Restore"
        danger
        onConfirm={confirmRestore}
        onCancel={() => setPendingFile(null)}
      />
    </div>
  )
}
