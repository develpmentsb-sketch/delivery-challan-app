import React, { useEffect, useMemo, useRef, useState } from 'react'
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

// HSN / SAC master (from HSN_SAC.xlsx). Loaded on first use so it doesn't slow the app start.
let hsnPromise = null
function loadHsn() {
  if (!hsnPromise) hsnPromise = import('../data/hsnSac.json').then((m) => m.default || m)
  return hsnPromise
}

// Type a code or a word (e.g. "8501" or "motor") and pick from the matching HSN / SAC list.
function HsnField({ value, onChange, disabled }) {
  const [data, setData] = useState(null)
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    let alive = true
    loadHsn().then((d) => { if (alive) setData(d) })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    const close = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const q = (value || '').trim().toLowerCase()
  const matches = useMemo(() => {
    if (!data || !q) return []
    const words = q.split(/\s+/)
    const starts = []
    const others = []
    for (const row of data) {
      const code = row[0]
      if (code.startsWith(q)) { starts.push(row); if (starts.length >= 40) break }
      else if (others.length < 40) {
        const text = (code + ' ' + row[1]).toLowerCase()
        if (words.every((w) => text.includes(w))) others.push(row)
      }
    }
    return [...starts, ...others].slice(0, 40)
  }, [data, q])

  const exact = data && value ? data.find((r) => r[0] === String(value).trim()) : null

  return (
    <div className="relative" ref={boxRef}>
      <input
        className="input"
        placeholder="Type HSN/SAC code or name"
        disabled={disabled}
        value={value || ''}
        onFocus={() => setOpen(true)}
        onChange={(e) => { onChange(e.target.value); setOpen(true) }}
      />
      {exact && <p className="mt-1 text-[11px] leading-snug text-navy-400">{exact[1]}</p>}
      {open && !disabled && q && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-auto rounded-md border border-navy-200 bg-white shadow-lg">
          {!data ? (
            <p className="px-3 py-2 text-xs text-navy-400">Loading HSN / SAC list...</p>
          ) : matches.length === 0 ? (
            <p className="px-3 py-2 text-xs text-navy-400">No match. The code you typed will be saved as it is.</p>
          ) : (
            matches.map(([c, d]) => (
              <button
                type="button"
                key={c}
                onMouseDown={(e) => { e.preventDefault(); onChange(c); setOpen(false) }}
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-navy-50"
              >
                <span className="font-semibold text-navy">{c}</span>
                <span className="ml-2 text-xs text-navy-500">{d.length > 90 ? d.slice(0, 90) + '...' : d}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

const emptyItem = () => ({
  item_code: '', item_name: '', description: '', hsn: '', uom: 'NOS', gst_rate: 0,
  unit_price: 0, opening_quantity: 0, current_quantity: 0, reorder_level: 0, active: true,
  category: '', brand: '', tax_inclusive: false,
  foreign_name: '', item_type: 'Item', barcode: '',
  is_inventory_item: true, is_sales_item: true, is_purchase_item: true,
  purchase_price: 0, preferred_vendor: '', lead_time_days: '',
  mrp: 0, discount_percent: 0,
  min_stock: 0, max_stock: 0, valuation_method: 'Weighted Average', item_cost: 0, weight: '', storage_location: '',
  remarks: ''
})

const ITEM_TYPES = ['Item', 'Service']
const VALUATION_METHODS = ['Weighted Average', 'FIFO', 'Standard']
const TABS = [
  { id: 'general', label: 'General' },
  { id: 'purchasing', label: 'Purchasing Data' },
  { id: 'sales', label: 'Sales Data' },
  { id: 'inventory', label: 'Inventory Data' },
  { id: 'remarks', label: 'Remarks' }
]

// Row from the database -> form values (empty fields become '' / defaults)
function fromDb(item) {
  const base = emptyItem()
  const out = { ...base }
  Object.keys(base).forEach((k) => {
    if (item[k] !== null && item[k] !== undefined) out[k] = item[k]
  })
  return out
}

// Form values -> exactly the columns saved to the database
function toDb(f) {
  const num = (v) => (v === '' || v == null ? 0 : Number(v) || 0)
  const numOrNull = (v) => (v === '' || v == null ? null : Number(v))
  const txt = (v) => String(v ?? '').trim() || null
  const lead = numOrNull(f.lead_time_days)
  return {
    item_code: f.item_code.trim().toUpperCase(),
    item_name: f.item_name.trim(),
    description: f.description?.trim() || '',
    hsn: f.hsn?.trim() || '',
    uom: f.uom,
    gst_rate: Number(f.gst_rate) || 0,
    unit_price: num(f.unit_price),
    opening_quantity: num(f.opening_quantity),
    current_quantity: num(f.current_quantity),
    reorder_level: num(f.reorder_level),
    active: Boolean(f.active),
    category: txt(f.category),
    brand: txt(f.brand),
    tax_inclusive: Boolean(f.tax_inclusive),
    foreign_name: txt(f.foreign_name),
    item_type: f.item_type || 'Item',
    barcode: txt(f.barcode),
    is_inventory_item: Boolean(f.is_inventory_item),
    is_sales_item: Boolean(f.is_sales_item),
    is_purchase_item: Boolean(f.is_purchase_item),
    purchase_price: num(f.purchase_price),
    preferred_vendor: txt(f.preferred_vendor),
    lead_time_days: lead === null ? null : Math.round(lead),
    mrp: num(f.mrp),
    discount_percent: num(f.discount_percent),
    min_stock: num(f.min_stock),
    max_stock: num(f.max_stock),
    valuation_method: f.valuation_method || 'Weighted Average',
    item_cost: num(f.item_cost),
    weight: numOrNull(f.weight),
    storage_location: txt(f.storage_location),
    remarks: txt(f.remarks)
  }
}

// 'out' = nothing left, 'low' = at or below the reorder level, 'ok' = fine (inactive items never alert)
function stockStatus(i) {
  if (!i.active || i.is_inventory_item === false) return 'ok'
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
  const [tab, setTab] = useState('general')

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

  const itemGroups = useMemo(
    () => [...new Set(items.map((i) => i.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [items]
  )

  function openCreate() { setEditing(null); setForm(emptyItem()); setErrors({}); setViewOnly(false); setTab('general'); setModalOpen(true) }
  function openEdit(item) { setEditing(item); setForm(fromDb(item)); setErrors({}); setViewOnly(false); setTab('general'); setModalOpen(true) }
  function openView(item) { setEditing(item); setForm(fromDb(item)); setErrors({}); setViewOnly(true); setTab('general'); setModalOpen(true) }

  const bind = (k) => ({
    value: form[k] ?? '',
    onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })),
    disabled: viewOnly
  })
  const check = (k) => ({
    checked: Boolean(form[k]),
    onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.checked })),
    disabled: viewOnly
  })
  const invOff = viewOnly || !form.is_inventory_item

  async function handleSave() {
    const existingCodes = items.filter((i) => i.id !== editing?.id).map((i) => i.item_code.toUpperCase())
    const { valid, errors: errs } = validateItem(form, existingCodes)
    if (!valid) { setErrors(errs); return }
    setSaving(true)
    try {
      const dup = await isDuplicateItemCode(form.item_code, editing?.id)
      if (dup) { setErrors({ item_code: 'This Item Code already exists' }); setSaving(false); return }

      const payload = toDb(form)
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
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-navy-900/50 p-4">
          <div className="card bg-white flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden !p-0">
            {/* Title bar */}
            <div className="flex items-center justify-between bg-navy px-5 py-3">
              <h3 className="text-sm font-semibold tracking-wide text-white">
                Item Master Data <span className="font-normal text-white/60">- {viewOnly ? 'View' : editing ? 'Edit' : 'New'}</span>
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-white/70 hover:text-white"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Header block (always visible) */}
              <div className="grid gap-x-10 gap-y-2.5 p-5 md:grid-cols-2">
                <div className="space-y-2.5">
                  <Row label="Item No. *" error={errors.item_code}>
                    <input className="input" {...bind('item_code')} />
                  </Row>
                  <Row label="Description *" error={errors.item_name}>
                    <input className="input" {...bind('item_name')} />
                  </Row>
                  <Row label="Foreign Name">
                    <input className="input" {...bind('foreign_name')} />
                  </Row>
                  <Row label="Item Type">
                    <select className="input" {...bind('item_type')}>
                      {ITEM_TYPES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </Row>
                  <Row label="Item Group">
                    <input className="input" list="item-groups" placeholder="e.g. Motors" {...bind('category')} />
                    <datalist id="item-groups">
                      {itemGroups.map((g) => <option key={g} value={g} />)}
                    </datalist>
                  </Row>
                  <Row label="UoM">
                    <select className="input" {...bind('uom')}>
                      {UOM_OPTIONS.map((u) => <option key={u}>{u}</option>)}
                    </select>
                  </Row>
                </div>

                <div className="space-y-2.5">
                  <Row label="Bar Code">
                    <input className="input" {...bind('barcode')} />
                  </Row>
                  <Row label="Unit Price" error={errors.unit_price}>
                    <div className="flex items-center gap-3">
                      <input type="number" min="0" step="0.01" className="input" {...bind('unit_price')} />
                      <label className="flex shrink-0 items-center gap-1.5 text-xs text-navy-500">
                        <input type="checkbox" {...check('tax_inclusive')} /> incl. GST
                      </label>
                    </div>
                  </Row>
                  <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-lg border border-navy-100 bg-navy-50/40 px-4 py-3 text-sm text-navy-700">
                    <label className="flex items-center gap-2"><input type="checkbox" {...check('is_inventory_item')} /> Inventory Item</label>
                    <label className="flex items-center gap-2"><input type="checkbox" {...check('is_sales_item')} /> Sales Item</label>
                    <label className="flex items-center gap-2"><input type="checkbox" {...check('is_purchase_item')} /> Purchase Item</label>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="border-b border-navy-100 px-5">
                <div className="flex flex-wrap gap-1">
                  {TABS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTab(t.id)}
                      className={`-mb-px rounded-t-lg border px-4 py-2 text-xs font-semibold transition-colors ${
                        tab === t.id
                          ? 'border-navy-100 border-b-white bg-white text-navy'
                          : 'border-transparent text-navy-400 hover:text-navy'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab content */}
              <div className="grid min-h-[230px] content-start gap-x-10 gap-y-2.5 p-5 md:grid-cols-2">
                {tab === 'general' && (
                  <>
                    <Row label="Brand"><input className="input" placeholder="e.g. Crompton" {...bind('brand')} /></Row>
                    <Row label="HSN/SAC"><HsnField value={form.hsn} disabled={viewOnly} onChange={(v) => setForm((f) => ({ ...f, hsn: v }))} /></Row>
                    <Row label="GST %">
                      <select
                        className="input"
                        value={form.gst_rate}
                        disabled={viewOnly}
                        onChange={(e) => setForm((f) => ({ ...f, gst_rate: Number(e.target.value) }))}
                      >
                        {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                      </select>
                    </Row>
                    <Row label="Status">
                      <label className="flex h-[38px] items-center gap-2 text-sm"><input type="checkbox" {...check('active')} /> Active</label>
                    </Row>
                    <div className="md:col-span-2">
                      <Row label="Details"><textarea className="input" rows={3} {...bind('description')} /></Row>
                    </div>
                  </>
                )}

                {tab === 'purchasing' && (
                  <>
                    <Row label="Preferred Vendor"><input className="input" {...bind('preferred_vendor')} /></Row>
                    <Row label="Purchase Price"><input type="number" min="0" step="0.01" className="input" {...bind('purchase_price')} /></Row>
                    <Row label="Lead Time (days)"><input type="number" min="0" step="1" className="input" {...bind('lead_time_days')} /></Row>
                  </>
                )}

                {tab === 'sales' && (
                  <>
                    <Row label="MRP"><input type="number" min="0" step="0.01" className="input" {...bind('mrp')} /></Row>
                    <Row label="Discount %"><input type="number" min="0" max="100" step="0.01" className="input" {...bind('discount_percent')} /></Row>
                  </>
                )}

                {tab === 'inventory' && (
                  <>
                    {!form.is_inventory_item && (
                      <p className="text-xs text-navy-400 md:col-span-2">This is not an inventory item, so stock fields are switched off. Tick "Inventory Item" above to use them.</p>
                    )}
                    <Row label="Opening Qty"><input type="number" min="0" className="input" {...bind('opening_quantity')} disabled={invOff} /></Row>
                    <Row label="Current Qty"><input type="number" min="0" className="input" {...bind('current_quantity')} disabled={invOff} /></Row>
                    <Row label="Reorder Level"><input type="number" min="0" className="input" {...bind('reorder_level')} disabled={invOff} /></Row>
                    <Row label="Minimum Stock"><input type="number" min="0" className="input" {...bind('min_stock')} disabled={invOff} /></Row>
                    <Row label="Maximum Stock"><input type="number" min="0" className="input" {...bind('max_stock')} disabled={invOff} /></Row>
                    <Row label="Valuation Method">
                      <select className="input" {...bind('valuation_method')} disabled={invOff}>
                        {VALUATION_METHODS.map((m) => <option key={m}>{m}</option>)}
                      </select>
                    </Row>
                    <Row label="Item Cost"><input type="number" min="0" step="0.01" className="input" {...bind('item_cost')} disabled={invOff} /></Row>
                    <Row label="Weight (kg)"><input type="number" min="0" step="0.001" className="input" {...bind('weight')} disabled={invOff} /></Row>
                    <Row label="Storage Location"><input className="input" placeholder="e.g. Rack A-2" {...bind('storage_location')} disabled={invOff} /></Row>
                  </>
                )}

                {tab === 'remarks' && (
                  <div className="md:col-span-2">
                    <textarea className="input" rows={7} placeholder="Internal notes about this item" {...bind('remarks')} />
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 border-t border-navy-100 bg-white px-5 py-3">
              <button className="btn-outline" onClick={() => setModalOpen(false)}>{viewOnly ? 'Close' : 'Cancel'}</button>
              {!viewOnly && (
                <button className="btn-primary" disabled={saving} onClick={handleSave}>
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save
                </button>
              )}
            </div>
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

// One form row: label on the left, input on the right (ERP-style)
function Row({ label, children, error }) {
  return (
    <div>
      <div className="grid grid-cols-[130px_1fr] items-center gap-3">
        <label className="text-xs font-semibold text-navy-500">{label}</label>
        <div>{children}</div>
      </div>
      {error && <p className="ml-[142px] mt-1 text-xs text-brick">{error}</p>}
    </div>
  )
}
