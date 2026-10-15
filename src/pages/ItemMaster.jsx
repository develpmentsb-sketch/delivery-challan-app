import React, { useEffect, useMemo, useState } from 'react'
import { Plus, Search, Pencil, Trash2, FileSpreadsheet, Upload, X, Save, Loader2, AlertTriangle } from 'lucide-react'
import Header from '../components/Header'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'
import Pagination from '../components/Pagination'
import { listItems, createItem, updateItem, deleteItem, isDuplicateItemCode, bulkImportItems } from '../services/itemService'
import { validateItem } from '../utils/validation'
import { exportItemsToExcel, readExcelFile } from '../utils/excelExport'
import { UOM_OPTIONS, GST_RATES } from '../lib/constants'
import { useToast } from '../context/ToastContext'

const PAGE_SIZE = 10

const emptyItem = () => ({
  item_code: '', item_name: '', description: '', hsn: '', uom: 'NOS', gst_rate: 0,
  unit_price: 0, opening_quantity: 0, current_quantity: 0, reorder_level: 0, active: true,
  category: '', brand: '', tax_inclusive: false
})

// 'out' = nothing left, 'low' = at or below the reorder level, 'ok' = fine (inactive items never alert)
function stockStatus(i) {
  if (!i.active) return 'ok'
  const qty = Number(i.current_quantity) || 0
  const reorder = Number(i.reorder_level) || 0
  if (qty <= 0) return 'out'
  if (reorder > 0 && qty <= reorder) return 'low'
  return 'ok'
}

export default function ItemMaster() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyItem())
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [toDelete, setToDelete] = useState(null)
  const [viewOnly, setViewOnly] = useState(false)
  const [lowOnly, setLowOnly] = useState(false)

  async function load() {
    setLoading(true)
    try {
      setItems(await listItems())
    } catch (err) {
      toast.error(err.message || 'Failed to load items')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const stockCounts = useMemo(() => {
    let out = 0
    let low = 0
    items.forEach((i) => {
      const st = stockStatus(i)
      if (st === 'out') out++
      else if (st === 'low') low++
    })
    return { out, low }
  }, [items])
  const alertCount = stockCounts.out + stockCounts.low

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    let list = items
    if (lowOnly && alertCount > 0) list = list.filter((i) => stockStatus(i) !== 'ok')
    if (!q) return list
    return list.filter(
      (i) =>
        i.item_name.toLowerCase().includes(q) ||
        i.item_code.toLowerCase().includes(q) ||
        i.hsn?.toLowerCase().includes(q) ||
        i.category?.toLowerCase().includes(q) ||
        i.brand?.toLowerCase().includes(q)
    )
  }, [items, search, lowOnly, alertCount])

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  function openCreate() { setEditing(null); setForm(emptyItem()); setErrors({}); setViewOnly(false); setModalOpen(true) }
  function openEdit(item) { setEditing(item); setForm(item); setErrors({}); setViewOnly(false); setModalOpen(true) }
  function openView(item) { setEditing(item); setForm(item); setErrors({}); setViewOnly(true); setModalOpen(true) }

  async function handleSave() {
    const existingCodes = items.filter((i) => i.id !== editing?.id).map((i) => i.item_code.toUpperCase())
    const { valid, errors: errs } = validateItem(form, existingCodes)
    if (!valid) { setErrors(errs); return }
    setSaving(true)
    try {
      const dup = await isDuplicateItemCode(form.item_code, editing?.id)
      if (dup) { setErrors({ item_code: 'This Item Code already exists' }); setSaving(false); return }

      const payload = {
        ...form,
        item_code: form.item_code.trim().toUpperCase(),
        category: form.category?.trim() || null,
        brand: form.brand?.trim() || null,
        tax_inclusive: Boolean(form.tax_inclusive)
      }
      if (editing) {
        await updateItem(editing.id, payload)
        toast.success('Item updated')
      } else {
        await createItem(payload)
        toast.success('Item added')
      }
      setModalOpen(false)
      load()
    } catch (err) {
      toast.error(err.message || 'Failed to save item')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    try {
      await deleteItem(toDelete.id)
      toast.success('Item deleted')
      setToDelete(null)
      load()
    } catch (err) {
      toast.error(err.message || 'Failed to delete item')
    }
  }

  async function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const rows = await readExcelFile(file)
      const result = await bulkImportItems(rows)
      toast.success(`Imported ${result.imported} item(s)`)
      load()
    } catch (err) {
      toast.error(err.message || 'Failed to import file')
    } finally {
      e.target.value = ''
    }
  }

  return (
    <div>
      <Header
        title="Item List"
        subtitle="Manage your Item / Product Master"
        actions={
          <>
            <label className="btn-outline cursor-pointer">
              <Upload size={16} /> Import Excel
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
            </label>
            <button className="btn-outline" onClick={() => (items.length ? exportItemsToExcel(items) : toast.info('No items to export'))}>
              <FileSpreadsheet size={16} /> Export Excel
            </button>
            <button className="btn-gold" onClick={openCreate}><Plus size={16} /> Add Item</button>
          </>
        }
      />

      {alertCount > 0 && (
        <div className="card p-4 mb-6 flex flex-wrap items-center justify-between gap-3 border-amber-300">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <AlertTriangle size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-navy">Stock alert</p>
              <p className="text-xs text-navy-400">
                {stockCounts.out} out of stock &middot; {stockCounts.low} running low
              </p>
            </div>
          </div>
          <button className="btn-outline" onClick={() => { setLowOnly((v) => !v); setPage(1) }}>
            {lowOnly ? 'Show all items' : 'Show only these items'}
          </button>
        </div>
      )}

      <div className="card p-4 mb-6">
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-3 text-navy-300" />
          <input className="input pl-8" placeholder="Search by Item Code, Name, HSN, Category or Brand..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
      </div>

      <div className="card">
        {loading ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <EmptyState title="No items found" description="Add your first item to the Item Master." action={<button className="btn-primary mt-2" onClick={openCreate}><Plus size={16} /> Add Item</button>} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Item Code</th><th>Item Name</th><th>Category / Brand</th><th>HSN/SAC</th><th>UOM</th>
                    <th className="text-right">GST %</th><th className="text-right">Unit Price</th>
                    <th className="text-right">Current Qty</th><th className="text-right">Reorder Level</th>
                    <th>Status</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((i) => {
                    const st = stockStatus(i)
                    return (
                    <tr key={i.id} className={st === 'out' ? 'bg-red-50/60' : st === 'low' ? 'bg-amber-50/60' : ''}>
                      <td className="font-medium text-navy">{i.item_code}</td>
                      <td>{i.item_name}</td>
                      <td>
                        {i.category || '-'}
                        {i.brand && <span className="block text-[11px] text-navy-400">{i.brand}</span>}
                      </td>
                      <td>{i.hsn || '-'}</td>
                      <td>{i.uom}</td>
                      <td className="text-right">{i.gst_rate}%</td>
                      <td className="text-right">
                        {Number(i.unit_price).toFixed(2)}
                        {i.tax_inclusive && <span className="block text-[10px] text-navy-400">incl. GST</span>}
                      </td>
                      <td className="text-right">
                        <span className={st === 'out' ? 'text-red-600 font-semibold' : st === 'low' ? 'text-amber-600 font-semibold' : ''}>{i.current_quantity}</span>
                        {st !== 'ok' && (
                          <span className={`badge ml-2 ${st === 'out' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                            {st === 'out' ? 'Out of stock' : 'Low stock'}
                          </span>
                        )}
                      </td>
                      <td className="text-right">{i.reorder_level}</td>
                      <td><span className={`badge ${i.active ? 'bg-forest-100 text-forest-600' : 'bg-navy-100 text-navy-500'}`}>{i.active ? 'Active' : 'Inactive'}</span></td>
                      <td>
                        <div className="flex gap-2">
                          <button onClick={() => openView(i)} className="text-navy-400 hover:text-navy text-xs">View</button>
                          <button onClick={() => openEdit(i)} className="text-navy-400 hover:text-navy"><Pencil size={14} /></button>
                          <button onClick={() => setToDelete(i)} className="text-navy-400 hover:text-brick"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
          </>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[90] bg-navy-900/50 flex items-center justify-center p-4">
          <div className="card bg-white w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-navy">{viewOnly ? 'View Item' : editing ? 'Edit Item' : 'Add Item'}</h3>
              <button onClick={() => setModalOpen(false)} className="text-navy-300 hover:text-navy-600"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Item Code *" error={errors.item_code}>
                <input disabled={viewOnly} className="input" value={form.item_code} onChange={(e) => setForm({ ...form, item_code: e.target.value })} />
              </Field>
              <Field label="Item Name *" error={errors.item_name}>
                <input disabled={viewOnly} className="input" value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} />
              </Field>
              <Field label="Category">
                <input disabled={viewOnly} className="input" placeholder="e.g. Motors" value={form.category || ''} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              </Field>
              <Field label="Brand">
                <input disabled={viewOnly} className="input" placeholder="e.g. Crompton" value={form.brand || ''} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
              </Field>
              <Field label="HSN/SAC" full>
                <input disabled={viewOnly} className="input" value={form.hsn} onChange={(e) => setForm({ ...form, hsn: e.target.value })} />
              </Field>
              <Field label="Description" full>
                <textarea disabled={viewOnly} className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
              <Field label="UOM">
                <select disabled={viewOnly} className="input" value={form.uom} onChange={(e) => setForm({ ...form, uom: e.target.value })}>
                  {UOM_OPTIONS.map((u) => <option key={u}>{u}</option>)}
                </select>
              </Field>
              <Field label="GST %">
                <select disabled={viewOnly} className="input" value={form.gst_rate} onChange={(e) => setForm({ ...form, gst_rate: Number(e.target.value) })}>
                  {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                </select>
              </Field>
              <Field label="Unit Price" error={errors.unit_price}>
                <input disabled={viewOnly} type="number" min="0" step="0.01" className="input" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} />
              </Field>
              <Field label="Price Includes GST">
                <label className="flex items-center gap-2 text-sm h-[38px]">
                  <input disabled={viewOnly} type="checkbox" checked={Boolean(form.tax_inclusive)} onChange={(e) => setForm({ ...form, tax_inclusive: e.target.checked })} /> Tax inclusive price
                </label>
              </Field>
              <Field label="Opening Quantity">
                <input disabled={viewOnly} type="number" min="0" className="input" value={form.opening_quantity} onChange={(e) => setForm({ ...form, opening_quantity: e.target.value })} />
              </Field>
              <Field label="Current Quantity">
                <input disabled={viewOnly} type="number" min="0" className="input" value={form.current_quantity} onChange={(e) => setForm({ ...form, current_quantity: e.target.value })} />
              </Field>
              <Field label="Reorder Level">
                <input disabled={viewOnly} type="number" min="0" className="input" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} />
              </Field>
              <Field label="Status">
                <label className="flex items-center gap-2 text-sm">
                  <input disabled={viewOnly} type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active
                </label>
              </Field>
            </div>
            {!viewOnly && (
              <div className="flex justify-end gap-2 mt-5">
                <button className="btn-outline" onClick={() => setModalOpen(false)}>Cancel</button>
                <button className="btn-primary" disabled={saving} onClick={handleSave}>
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete this item?"
        message={`"${toDelete?.item_name}" will be permanently removed from the Item Master.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}

function Field({ label, children, error, full }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <label className="label">{label}</label>
      {children}
      {error && <p className="text-xs text-brick mt-1">{error}</p>}
    </div>
  )
}
