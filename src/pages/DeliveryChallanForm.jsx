import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, Trash2, Zap, Loader2, Download } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import PartnerSelect from '../components/PartnerSelect'
import ItemSelect from '../components/ItemSelect'
import LoadingSpinner from '../components/LoadingSpinner'
import { createChallan, getChallan, updateChallan } from '../services/challanService'
import { generateEwayBillViaApi } from '../services/ewayBillService'
import { calculateChallanTotals, isIntraState, formatCurrency, formatNumber } from '../utils/calculations'
import { validateChallan } from '../utils/validation'
import { buildEwayBill, buildEwayBulkJson, downloadEwayJson, SUB_TYPES } from '../utils/ewayJson'
import { getCompany, loadCompanyProfile } from '../lib/companyProfile'
import { listLocations, buildDispatchFrom, applyDispatchFrom } from '../lib/locations'
import {
  DOCUMENT_TYPES,
  TRANSPORT_MODES,
  VEHICLE_TYPES,
  EWAY_STATUSES,
  UOM_OPTIONS,
  GST_RATES,
  INDIAN_STATES,
  stateCodeFromName
} from '../lib/constants'

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const today = () => new Date().toISOString().slice(0, 10)

let rowCounter = 0
const newRow = () => ({
  _clientId: `row-${Date.now()}-${rowCounter++}`,
  item_id: null,
  item_code: '',
  item_name: '',
  description: '',
  hsn: '',
  uom: 'NOS',
  quantity: '1',
  unit_price: '0',
  gst_rate: '0',
  batch_no: '',
  serial_no: ''
})

const emptyAddress = {
  name: '',
  gstin: '',
  address_line1: '',
  address_line2: '',
  city: '',
  district: '',
  state: '',
  state_code: '',
  pin_code: ''
}

const emptyHeader = () => ({
  dc_number: '',
  dc_date: today(),
  document_type: 'Delivery Challan',
  reference_number: '',
  reference_date: '',
  transporter_name: '',
  vehicle_number: '',
  transport_mode: 'Road',
  place_of_supply: getCompany().state || '',
  reason: '',
  dc_type: 'Non-Returnable',
  purpose: '',
  no_of_packages: '',
  weight_kg: '',
  reference_name: '',
  kind_attention: '',
  insurance_value: '',
  dc_status: 'Draft'
})

const emptyEway = () => ({
  eway_bill_number: '',
  eway_bill_date: '',
  valid_until: '',
  distance_km: '',
  transporter_id: '',
  transporter_name: '',
  vehicle_number: '',
  vehicle_type: 'Regular',
  transport_mode: 'Road',
  status: 'Pending'
})

const partnerToBillTo = (p) => ({
  name: p.name || '',
  gstin: p.gstin || '',
  address_line1: p.bill_to_address_line1 || '',
  address_line2: p.bill_to_address_line2 || '',
  city: p.bill_to_city || '',
  district: p.bill_to_district || '',
  state: p.bill_to_state || '',
  state_code: p.bill_to_state_code || stateCodeFromName(p.bill_to_state),
  pin_code: p.bill_to_pin || ''
})

const shipRowToAddress = (s, partner) => ({
  name: s.ship_to_name || partner.name || '',
  gstin: s.gstin || '',
  address_line1: s.address_line1 || '',
  address_line2: s.address_line2 || '',
  city: s.city || '',
  district: s.district || '',
  state: s.state || '',
  state_code: s.state_code || stateCodeFromName(s.state),
  pin_code: s.pin_code || ''
})

const toText = (v) => (v === null || v === undefined ? '' : String(v))
const orNull = (v) => (v === '' || v === undefined ? null : v)
const numOrNull = (v) => (v === '' || v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v))
const safeNumber = (value, fallback = 0) => {
  if (value === '' || value === null || value === undefined) return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function Field({ label, error, children, className = '', hint }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs font-medium text-navy-600 mb-1">{label}</span>
      {children}
      {hint && !error && <span className="block text-[11px] text-navy-400 mt-1">{hint}</span>}
      {error && <span className="block text-xs text-brick mt-1">{error}</span>}
    </label>
  )
}

function AddressBlock({ title, address }) {
  const lines = [
    address.address_line1,
    address.address_line2,
    [address.city, address.district].filter(Boolean).join(', '),
    [address.state, address.pin_code].filter(Boolean).join(' - ')
  ].filter(Boolean)

  return (
    <div className="rounded-md border border-navy-100 p-3 text-sm">
      <p className="text-xs font-medium text-navy-500 mb-1">{title}</p>
      {address.name ? (
        <>
          <p className="font-medium text-navy-800">{address.name}</p>
          {address.gstin && <p className="text-xs text-navy-500">GSTIN {address.gstin}</p>}
          {lines.map((l, i) => (
            <p key={i} className="text-navy-600">{l}</p>
          ))}
        </>
      ) : (
        <p className="text-navy-300">Select a customer / vendor first</p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

function DeliveryChallanForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { session } = useAuth()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generatingEway, setGeneratingEway] = useState(false)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState({})

  const [partners, setPartners] = useState([])
  const [items, setItems] = useState([])

  const [header, setHeader] = useState(emptyHeader())
  const [partnerId, setPartnerId] = useState(null)
  const [billTo, setBillTo] = useState(emptyAddress)
  const [shipTo, setShipTo] = useState(emptyAddress)
  const [shipChoice, setShipChoice] = useState('bill')
  const [savedShip, setSavedShip] = useState(null)
  const [rows, setRows] = useState([newRow()])
  const [ewayEnabled, setEwayEnabled] = useState(false)
  const [portalSubType, setPortalSubType] = useState('')
  const [portalSubTypeDesc, setPortalSubTypeDesc] = useState('')
  const [eway, setEway] = useState(emptyEway())

  // Dispatch-from location ('' = Head Office / company profile, 'saved' = location stored on an old challan)
  const [locations, setLocations] = useState([])
  const [locationId, setLocationId] = useState('')
  const [dispatchFrom, setDispatchFrom] = useState({})
  const [savedDispatch, setSavedDispatch] = useState(null)

  /* ---------------- load masters (+ challan when editing) ---------------- */
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [pRes, iRes, locs] = await Promise.all([
          supabase.from('partners').select('*, partner_ship_to(*)').eq('partner_type', 'Vendor').order('name'),
          supabase.from('items').select('*').eq('active', true).order('item_name'),
          listLocations().catch(() => []) // table not created yet -> Head Office only
        ])
        if (pRes.error) throw pRes.error
        if (iRes.error) throw iRes.error
        if (cancelled) return

        setPartners(pRes.data || [])
        setItems(iRes.data || [])
        setLocations(locs)

        // Company details (state) may have been edited by an admin in Settings
        const company = await loadCompanyProfile()
        if (!id && !cancelled) {
          // New challan: start from the default location (or the Head Office)
          const def = locs.find((l) => l.is_default && l.active !== false)
          const snap = buildDispatchFrom(def || null)
          setLocationId(def ? def.id : '')
          setDispatchFrom(snap)
          setHeader((h) => ({ ...h, place_of_supply: snap.state || h.place_of_supply || company.state || '' }))
        }

        if (id) {
          const dc = await getChallan(id)
          if (cancelled) return

          setHeader({
            dc_number: dc.dc_number || '',
            dc_date: dc.dc_date || today(),
            document_type: dc.document_type || 'Delivery Challan',
            reference_number: dc.reference_number || '',
            reference_date: dc.reference_date || '',
            transporter_name: dc.transporter_name || '',
            vehicle_number: dc.vehicle_number || '',
            transport_mode: dc.transport_mode || 'Road',
            place_of_supply: dc.place_of_supply || '',
            reason: dc.reason || '',
            dc_type: dc.dc_type || 'Non-Returnable',
            purpose: dc.purpose || '',
            no_of_packages: dc.no_of_packages || '',
            weight_kg: toText(dc.weight_kg),
            reference_name: dc.reference_name || '',
            kind_attention: dc.kind_attention || '',
            insurance_value: toText(dc.insurance_value),
            dc_status: dc.dc_status || 'Draft'
          })
          const snapSaved = dc.dispatch_from_snapshot && Object.keys(dc.dispatch_from_snapshot).length ? dc.dispatch_from_snapshot : null
          if (snapSaved) {
            setDispatchFrom(snapSaved)
            setSavedDispatch(snapSaved)
            setLocationId(
              locs.some((l) => l.id === snapSaved.location_id) ? snapSaved.location_id : snapSaved.location_id ? 'saved' : ''
            )
          } else {
            setDispatchFrom({})
            setLocationId('')
          }
          setPartnerId(dc.partner_id || null)
          setBillTo({ ...emptyAddress, ...(dc.bill_to_snapshot || {}) })
          const ship = { ...emptyAddress, ...(dc.ship_to_snapshot || {}) }
          setShipTo(ship)
          setSavedShip(ship)
          setShipChoice('saved')

          const dbRows = [...(dc.delivery_challan_items || [])].sort((a, b) => (a.sl_no || 0) - (b.sl_no || 0))
          setRows(
            dbRows.length
              ? dbRows.map((r) => ({
                  ...newRow(),
                  item_id: r.item_id,
                  item_code: r.item_code || '',
                  item_name: r.item_name || '',
                  description: r.description || '',
                  hsn: r.hsn || '',
                  uom: r.uom || 'NOS',
                  quantity: toText(r.quantity),
                  unit_price: toText(r.unit_price),
                  gst_rate: toText(r.gst_rate),
                  batch_no: r.batch_no || '',
                  serial_no: r.serial_no || ''
                }))
              : [newRow()]
          )

          const e = Array.isArray(dc.eway_bills) ? dc.eway_bills[0] : dc.eway_bills
          if (e) {
            setEwayEnabled(true)
            setEway({
              eway_bill_number: e.eway_bill_number || '',
              eway_bill_date: e.eway_bill_date || '',
              valid_until: e.valid_until || '',
              distance_km: toText(e.distance_km),
              transporter_id: e.transporter_id || '',
              transporter_name: e.transporter_name || '',
              vehicle_number: e.vehicle_number || '',
              vehicle_type: e.vehicle_type || 'Regular',
              transport_mode: e.transport_mode || 'Road',
              status: e.status || 'Pending'
            })
          }
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [id])

  /* ---------------- derived values ---------------- */
  // Vendors are allocated to a company (Vendor Master). Only vendors allocated
  // to the chosen dispatch-from company - plus vendors allocated to "All
  // Companies" (company_location_id = null) - are selectable for this challan.
  const selectablePartners = useMemo(() => {
    const activeCompanyId = locationId && locationId !== 'saved' ? locationId : null
    return partners.filter((p) => {
      const isActive = p.active !== false || p.id === partnerId
      if (!isActive) return false
      return !p.company_location_id || p.company_location_id === activeCompanyId || p.id === partnerId
    })
  }, [partners, partnerId, locationId])
  const selectedPartner = partners.find((p) => p.id === partnerId) || null
  const shipOptions = selectedPartner?.partner_ship_to || []

  // Company details for this challan = company profile + the chosen dispatch location
  const dispatchCompany = applyDispatchFrom(getCompany(), dispatchFrom)

  const intra = isIntraState(header.place_of_supply, shipTo.state)
  const { rows: calcRows, totals } = useMemo(() => calculateChallanTotals(rows, intra), [rows, intra])

  /* ---------------- handlers ---------------- */
  const setH = (key, value) => setHeader((h) => ({ ...h, [key]: value }))
  const setE = (key, value) => setEway((e) => ({ ...e, [key]: value }))

  function handleLocationChange(value) {
    setLocationId(value)
    let snap
    if (value === 'saved') snap = savedDispatch
    else if (value === '') snap = buildDispatchFrom(null)
    else snap = buildDispatchFrom(locations.find((l) => l.id === value))
    setDispatchFrom(snap || {})
    // GST is intra/inter-state from the dispatching state, so follow the location's state
    if (snap?.state) setH('place_of_supply', snap.state)
  }

  // Shared input for validateChallan (the vehicle number now lives in the E-Way Bill section)
  const validationInput = () => ({
    ...header,
    vehicle_number: ewayEnabled ? eway.vehicle_number : '',
    partner_id: partnerId,
    bill_to: billTo,
    ship_to: shipTo
  })

  function handlePartnerChange(pid) {
    setPartnerId(pid)
    if (!pid) {
      setBillTo(emptyAddress)
      setShipTo(emptyAddress)
      setShipChoice('bill')
      return
    }
    const p = partners.find((x) => x.id === pid)
    if (!p) return
    const bill = partnerToBillTo(p)
    setBillTo(bill)

    const list = p.partner_ship_to || []
    const def = list.find((s) => s.is_default) || list[0]
    if (def) {
      setShipChoice(def.id)
      setShipTo(shipRowToAddress(def, p))
    } else {
      setShipChoice('bill')
      setShipTo({ ...bill })
    }
  }

  function handleShipChoice(value) {
    setShipChoice(value)
    if (value === 'bill') {
      setShipTo({ ...billTo })
    } else if (value === 'saved') {
      if (savedShip) setShipTo(savedShip)
    } else {
      const s = shipOptions.find((x) => x.id === value)
      if (s && selectedPartner) setShipTo(shipRowToAddress(s, selectedPartner))
    }
  }

  const updateRow = (cid, patch) => setRows((rs) => rs.map((r) => (r._clientId === cid ? { ...r, ...patch } : r)))
  const addRow = () => setRows((rs) => [...rs, newRow()])
  const removeRow = (cid) => setRows((rs) => (rs.length <= 1 ? [newRow()] : rs.filter((r) => r._clientId !== cid)))

  function pickItem(cid, item) {
    updateRow(cid, {
      item_id: item.id,
      item_code: item.item_code || '',
      item_name: item.item_name || '',
      description: item.description || '',
      hsn: item.hsn || '',
      uom: item.uom || 'NOS',
      unit_price: toText(item.unit_price ?? 0),
      gst_rate: toText(item.gst_rate ?? 0)
    })
  }

  /* ---------------- payload (matches schema.sql columns) ---------------- */
  function buildPayload(status) {
    // Transport details are entered in the E-Way Bill section; keep the challan columns in sync
    const vehicle = ((ewayEnabled && eway.vehicle_number) || header.vehicle_number || '').toUpperCase().replace(/\s+/g, '')
    const transporterName = ewayEnabled && eway.transporter_name ? eway.transporter_name : header.transporter_name
    const transportMode = ewayEnabled ? eway.transport_mode : header.transport_mode
    const locationIdForDb = locations.some((l) => l.id === dispatchFrom?.location_id) ? dispatchFrom.location_id : null

    return {
      header: {
        dc_number: String(header.dc_number || '').trim(),
        dc_date: header.dc_date || null,
        document_type: header.document_type || 'Delivery Challan',
        partner_id: partnerId || null,
        reference_number: orNull(header.reference_number),
        reference_date: orNull(header.reference_date),
        transporter_name: orNull(transporterName),
        vehicle_number: vehicle || null,
        transport_mode: orNull(transportMode),
        place_of_supply: orNull(header.place_of_supply),
        reason: orNull(header.reason),

        location_id: locationIdForDb,
        dispatch_from_snapshot: dispatchFrom || {},

        dc_type: header.dc_type || 'Non-Returnable',
        purpose: orNull(header.purpose),
        no_of_packages: orNull(header.no_of_packages),
        weight_kg: numOrNull(header.weight_kg),
        reference_name: orNull(header.reference_name),
        kind_attention: orNull(header.kind_attention),
        insurance_value: numOrNull(header.insurance_value),

        bill_to_snapshot: billTo,
        ship_to_snapshot: shipTo,

        total_quantity: safeNumber(totals.totalQuantity),
        taxable_value: safeNumber(totals.taxableValue),
        cgst: safeNumber(totals.cgst),
        sgst: safeNumber(totals.sgst),
        igst: safeNumber(totals.igst),
        grand_total: safeNumber(totals.grandTotal),

        dc_status: status
      },

      items: calcRows.map((r) => ({
        item_id: r.item_id || null,
        item_code: orNull(r.item_code),
        item_name: orNull(r.item_name),
        description: orNull(r.description),
        hsn: orNull(r.hsn),
        uom: r.uom || 'NOS',
        quantity: safeNumber(r.quantity),
        unit_price: safeNumber(r.unit_price),
        taxable_value: safeNumber(r.taxable_value),
        gst_rate: safeNumber(r.gst_rate),
        cgst: safeNumber(r.cgst),
        sgst: safeNumber(r.sgst),
        igst: safeNumber(r.igst),
        total_value: safeNumber(r.total_value),
        batch_no: orNull(r.batch_no),
        serial_no: orNull(r.serial_no)
      })),

      eway: ewayEnabled
        ? {
            generate: true,
            eway_bill_number: orNull(eway.eway_bill_number),
            eway_bill_date: orNull(eway.eway_bill_date),
            valid_until: orNull(eway.valid_until),
            distance_km: eway.distance_km === '' ? null : safeNumber(eway.distance_km, null),
            transporter_id: orNull(eway.transporter_id),
            transporter_name: orNull(eway.transporter_name),
            vehicle_number: orNull((eway.vehicle_number || '').toUpperCase().replace(/\s+/g, '')),
            vehicle_type: eway.vehicle_type || 'Regular',
            transport_mode: eway.transport_mode || 'Road',
            status: eway.status || 'Pending'
          }
        : { generate: false }
    }
  }

  async function handleGenerateEway() {
    const check = validateChallan(validationInput(), calcRows)
    if (!check.valid) {
      setErrors(check.errors)
      setError('Fill in the delivery challan details below before generating an E-Way Bill.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setErrors({})
    setEwayEnabled(true)
    setGeneratingEway(true)
    try {
      const result = await generateEwayBillViaApi({
        dc_number: header.dc_number,
        dc_date: header.dc_date,
        document_type: header.document_type,
        bill_to: billTo,
        ship_to: shipTo,
        company: dispatchCompany,
        transporter_id: eway.transporter_id,
        transporter_name: eway.transporter_name || header.transporter_name,
        vehicle_number: eway.vehicle_number || header.vehicle_number,
        transport_mode: eway.transport_mode || header.transport_mode,
        vehicle_type: eway.vehicle_type,
        distance_km: eway.distance_km,
        items: calcRows,
        totals
      })
      setEway((e) => ({
        ...e,
        eway_bill_number: result.eway_bill_number || e.eway_bill_number,
        eway_bill_date: result.eway_bill_date || e.eway_bill_date,
        valid_until: result.valid_until || e.valid_until,
        status: 'Generated'
      }))
      toast.success('E-Way Bill generated')
    } catch (e) {
      toast.error(e.message || 'Could not generate E-Way Bill')
    } finally {
      setGeneratingEway(false)
    }
  }

  // Downloads the JSON file for the government portal's bulk upload
  // (E-Way Bill portal -> Generate Bulk -> upload this file).
  function handleDownloadEwayJson() {
    if (!String(header.dc_number || '').trim()) {
      toast.error('Enter the DC number first.')
      return
    }
    const check = validateChallan(validationInput(), calcRows)
    if (!check.valid) {
      setErrors(check.errors)
      setError('Fill in the delivery challan details below before downloading the E-Way Bill JSON.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setErrors({})
    setEwayEnabled(true) // vehicle / transporter fields live in the E-Way Bill section
    try {
      const bill = buildEwayBill({
        company: dispatchCompany,
        header,
        billTo,
        shipTo,
        rows: calcRows,
        totals,
        eway,
        subType: portalSubType,
        subTypeDesc: portalSubTypeDesc
      })
      const safeName = String(header.dc_number || 'challan').replace(/[^A-Za-z0-9_-]+/g, '_')
      downloadEwayJson(buildEwayBulkJson([bill]), `EWB_${safeName}.json`)
      toast.success('E-Way Bill JSON downloaded')
    } catch (e) {
      toast.error(e.message || 'Could not create the E-Way Bill JSON')
    }
  }

  async function handleSave(status) {
    setError('')

    const check = validateChallan(validationInput(), calcRows)
    const errs = { ...check.errors }
    {
      const no = String(header.dc_number || '').trim()
      if (!no) errs.dc_number = 'Enter the DC number'
      else if (!/^[A-Za-z0-9/-]{1,16}$/.test(no)) {
        errs.dc_number = 'DC number must be 1 to 16 characters: letters, digits, "/" or "-" only'
      }
    }
    if (Object.keys(errs).length) {
      setErrors(errs)
      setError('Please fix the items listed below and save again.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setErrors({})

    setSaving(true)
    try {
      const payload = buildPayload(status)
      if (isEdit) {
        await updateChallan(id, payload)
      } else {
        await createChallan({
          header: { ...payload.header, dc_number: String(header.dc_number).trim(), created_by: session?.user?.id },
          items: payload.items,
          eway: payload.eway,
          autoNumber: false
        })
      }
      navigate('/master-list')
    } catch (e) {
      setError(
        /duplicate key/i.test(e.message || '') && /dc_no|dc_number/i.test(e.message || '')
          ? `DC number ${header.dc_number} already exists. Enter a different DC number.`
          : e.message || 'Could not save the delivery challan'
      )
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setSaving(false)
    }
  }

  /* ---------------- render ---------------- */
  if (loading) {
    return (
      <div className="p-10">
        <LoadingSpinner label="Loading delivery challan..." />
      </div>
    )
  }

  const errorList = Object.values(errors)
  const gstOptions = (current) =>
    GST_RATES.includes(Number(current)) ? GST_RATES : [...GST_RATES, Number(current)]

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-navy-800">
            {isEdit ? 'Edit Delivery Challan' : 'New Delivery Challan'}
          </h1>
          <p className="text-sm text-navy-400">
            {isEdit ? header.dc_number : 'Enter the DC number manually.'}
          </p>
        </div>
      </div>

      {(error || errorList.length > 0) && (
        <div className="mb-5 rounded-md border border-brick bg-white p-4 text-sm">
          {error && <p className="text-brick font-medium">{error}</p>}
          {errorList.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-navy-600 space-y-0.5">
              {errorList.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Challan details */}
      <section className="card p-5 mb-5">
        <h2 className="text-sm font-semibold text-navy-800 mb-4">Challan details</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Field label="DC number *" error={errors.dc_number} hint={isEdit ? 'You can change this, but it must stay unique across all challans.' : undefined}>
            <input
              className="input"
              placeholder="e.g. DC-2026-0001"
              maxLength={16}
              value={header.dc_number}
              onChange={(e) => setH('dc_number', e.target.value.toUpperCase())}
            />
          </Field>
          <Field label="DC date" error={errors.dc_date}>
            <input type="date" className="input" value={header.dc_date} onChange={(e) => setH('dc_date', e.target.value)} />
          </Field>
          <Field label="Document type">
            <select className="input" value={header.document_type} onChange={(e) => setH('document_type', e.target.value)}>
              {DOCUMENT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Reference number">
            <input className="input" value={header.reference_number} onChange={(e) => setH('reference_number', e.target.value)} />
          </Field>
          <Field label="Company (DC generated for)" className="md:col-span-2">
            <select className="input" value={locationId} onChange={(e) => handleLocationChange(e.target.value)}>
              <option value="">{getCompany().name || 'Head Office'} (Head Office)</option>
              {isEdit && savedDispatch?.location_id && !locations.some((l) => l.id === savedDispatch.location_id) && (
                <option value="saved">{savedDispatch.company_name || savedDispatch.location_name || 'Saved company'} (saved on this challan)</option>
              )}
              {locations
                .filter((l) => l.active !== false || l.id === locationId)
                .map((l) => (
                  <option key={l.id} value={l.id}>{l.legal_name || l.location_name}{l.is_default ? ' (default)' : ''}</option>
                ))}
            </select>
            <span className="block text-xs text-navy-400 mt-1">
              <b className="text-navy-600">{dispatchCompany.name}</b>{' · '}
              {[dispatchCompany.address, dispatchCompany.city, [dispatchCompany.state, dispatchCompany.pincode].filter(Boolean).join(' - ')]
                .filter(Boolean)
                .join(', ') || 'No address set. Add it in Settings.'}
              {dispatchCompany.gstin ? ` · GSTIN ${dispatchCompany.gstin}` : ''}
            </span>
          </Field>
          <Field label="Reference date">
            <input type="date" className="input" value={header.reference_date} onChange={(e) => setH('reference_date', e.target.value)} />
          </Field>
          <Field label="Place of supply (state)">
            <select className="input" value={header.place_of_supply} onChange={(e) => setH('place_of_supply', e.target.value)}>
              <option value="">Select state</option>
              {INDIAN_STATES.map((s) => (
                <option key={s.code} value={s.name}>{s.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Reason for movement" className="md:col-span-4">
            <input className="input" value={header.reason} onChange={(e) => setH('reason', e.target.value)} />
          </Field>
        </div>
      </section>

      {/* Parties */}
      <section className="card p-5 mb-5">
        <h2 className="text-sm font-semibold text-navy-800 mb-4">Vendor</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <Field label="Vendor" error={errors.partner_id}>
            <PartnerSelect partners={selectablePartners} value={partnerId} onChange={handlePartnerChange} />
          </Field>
          <Field label="Ship to address">
            <select
              className="input"
              value={shipChoice}
              onChange={(e) => handleShipChoice(e.target.value)}
              disabled={!partnerId && shipChoice !== 'saved'}
            >
              <option value="bill">Same as Bill To</option>
              {isEdit && savedShip && <option value="saved">Address saved on this challan</option>}
              {shipOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.ship_to_name || s.city || 'Ship to'}{s.is_default ? ' (default)' : ''}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AddressBlock title="Bill to" address={billTo} />
          <AddressBlock title="Ship to" address={shipTo} />
        </div>
        {(errors.bill_to || errors.ship_to) && (
          <p className="text-xs text-brick mt-2">{errors.bill_to || errors.ship_to}</p>
        )}
      </section>

      {/* Print details (shown on the printed challan) */}
      <section className="card p-5 mb-5">
        <h2 className="text-sm font-semibold text-navy-800 mb-1">Challan print details</h2>
        <p className="text-xs text-navy-400 mb-4">These appear on the printed Delivery Challan.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Purpose">
            <input
              className="input"
              placeholder="For Service"
              value={header.purpose}
              onChange={(e) => setH('purpose', e.target.value)}
            />
          </Field>
          <Field label="No of package">
            <input
              className="input"
              placeholder="2 BOX ROLL"
              value={header.no_of_packages}
              onChange={(e) => setH('no_of_packages', e.target.value)}
            />
          </Field>
          <Field label="Weight (KG)">
            <input
              type="number"
              min="0"
              step="any"
              className="input"
              placeholder="45"
              value={header.weight_kg}
              onChange={(e) => setH('weight_kg', e.target.value)}
            />
          </Field>
          <Field label="Reference name / department">
            <input
              className="input"
              placeholder="Akash Gaurav"
              value={header.reference_name}
              onChange={(e) => setH('reference_name', e.target.value)}
            />
          </Field>
          <Field label="Kind attention">
            <input
              className="input"
              placeholder="Not for Sale"
              value={header.kind_attention}
              onChange={(e) => setH('kind_attention', e.target.value)}
            />
          </Field>
          <Field label="DC type">
            <select className="input" value={header.dc_type} onChange={(e) => setH('dc_type', e.target.value)}>
              <option value="Non-Returnable">Non-Returnable</option>
              <option value="Returnable">Returnable</option>
            </select>
          </Field>
        </div>
      </section>

      {/* Items */}
      <section className="card p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-navy-800">Items</h2>
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1.5 rounded-md border border-navy-300 px-3 py-1.5 text-sm text-navy-700 hover:bg-gold-50"
          >
            <Plus size={14} /> Add item
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1220px]">
            <thead>
              <tr className="text-left text-xs text-navy-500 border-b border-navy-100">
                <th className="pb-2 pr-2 w-8">Sl</th>
                <th className="pb-2 pr-2">Item</th>
                <th className="pb-2 pr-2 w-24">HSN</th>
                <th className="pb-2 pr-2 w-20">Qty</th>
                <th className="pb-2 pr-2 w-24">UOM</th>
                <th className="pb-2 pr-2 w-28">Unit price</th>
                <th className="pb-2 pr-2 w-20">GST %</th>
                <th className="pb-2 pr-2 w-28">Batch no</th>
                <th className="pb-2 pr-2 w-28">Serial no</th>
                <th className="pb-2 pr-2 w-28 text-right">Taxable</th>
                <th className="pb-2 pr-2 w-28 text-right">GST amount</th>
                <th className="pb-2 pr-2 w-28 text-right">Total</th>
                <th className="pb-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const calc = calcRows[idx] || {}
                return (
                  <tr key={r._clientId} className="border-b border-navy-50 align-top">
                    <td className="py-2 pr-2 text-navy-400">{idx + 1}</td>
                    <td className="py-2 pr-2">
                      <ItemSelect items={items} value={r.item_id} onChange={(item) => pickItem(r._clientId, item)} />
                      {(errors[`item_${idx}`]) && <span className="block text-xs text-brick mt-1">Select an item</span>}
                    </td>
                    <td className="py-2 pr-2">
                      <input className="input py-1.5 text-sm" value={r.hsn} onChange={(e) => updateRow(r._clientId, { hsn: e.target.value })} />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className="input py-1.5 text-sm"
                        value={r.quantity}
                        onChange={(e) => updateRow(r._clientId, { quantity: e.target.value })}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <select className="input py-1.5 text-sm" value={r.uom} onChange={(e) => updateRow(r._clientId, { uom: e.target.value })}>
                        {(UOM_OPTIONS.includes(r.uom) ? UOM_OPTIONS : [...UOM_OPTIONS, r.uom]).map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className="input py-1.5 text-sm"
                        value={r.unit_price}
                        onChange={(e) => updateRow(r._clientId, { unit_price: e.target.value })}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <select className="input py-1.5 text-sm" value={Number(r.gst_rate)} onChange={(e) => updateRow(r._clientId, { gst_rate: e.target.value })}>
                        {gstOptions(r.gst_rate).map((g) => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      <input className="input py-1.5 text-sm" value={r.batch_no} onChange={(e) => updateRow(r._clientId, { batch_no: e.target.value })} />
                    </td>
                    <td className="py-2 pr-2">
                      <input className="input py-1.5 text-sm" value={r.serial_no} onChange={(e) => updateRow(r._clientId, { serial_no: e.target.value })} />
                    </td>
                    <td className="py-2 pr-2 text-right text-navy-700">{formatNumber(calc.taxable_value || 0)}</td>
                    <td className="py-2 pr-2 text-right text-navy-700">
                      {formatNumber((calc.cgst || 0) + (calc.sgst || 0) + (calc.igst || 0))}
                    </td>
                    <td className="py-2 pr-2 text-right font-medium text-navy-800">{formatNumber(calc.total_value || 0)}</td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeRow(r._clientId)}
                        className="text-navy-300 hover:text-brick"
                        aria-label={`Remove row ${idx + 1}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {errors.items && <p className="text-xs text-brick mt-2">{errors.items}</p>}

        <div className="mt-5 flex justify-end">
          <dl className="w-full max-w-xs text-sm space-y-1.5">
            <div className="flex justify-between">
              <dt className="text-navy-500">Total quantity</dt>
              <dd className="text-navy-800">{formatNumber(totals.totalQuantity, 3)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-navy-500">Taxable value</dt>
              <dd className="text-navy-800">{formatCurrency(totals.taxableValue)}</dd>
            </div>
            {intra ? (
              <>
                <div className="flex justify-between">
                  <dt className="text-navy-500">CGST</dt>
                  <dd className="text-navy-800">{formatCurrency(totals.cgst)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-navy-500">SGST</dt>
                  <dd className="text-navy-800">{formatCurrency(totals.sgst)}</dd>
                </div>
              </>
            ) : (
              <div className="flex justify-between">
                <dt className="text-navy-500">IGST</dt>
                <dd className="text-navy-800">{formatCurrency(totals.igst)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-navy-100 pt-2 text-base font-semibold">
              <dt className="text-navy-800">Grand total</dt>
              <dd className="text-navy-800">{formatCurrency(totals.grandTotal)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 pt-1">
              <dt className="text-navy-500">Insurance value (INR)</dt>
              <dd>
                <input
                  type="number"
                  min="0"
                  step="any"
                  className="input py-1 text-sm w-32 text-right"
                  placeholder="0"
                  value={header.insurance_value}
                  onChange={(e) => setH('insurance_value', e.target.value)}
                />
              </dd>
            </div>
            <p className="text-[11px] text-navy-400 text-right">
              Printed in the note: &quot;The insurance value is INR &hellip;/-&quot;
            </p>
          </dl>
        </div>
      </section>

      {/* E-Way Bill */}
      <section className="card p-5 mb-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-navy-800 cursor-pointer">
            <input type="checkbox" checked={ewayEnabled} onChange={(e) => setEwayEnabled(e.target.checked)} />
            Add E-Way Bill details
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleDownloadEwayJson}
              className="inline-flex items-center gap-1.5 rounded-md border border-navy-200 bg-white px-4 py-2 text-sm font-medium text-navy-800 hover:bg-navy-50"
            >
              <Download size={15} />
              Download JSON for Portal
            </button>
            <button
              type="button"
              disabled={generatingEway}
              onClick={handleGenerateEway}
              className="inline-flex items-center gap-1.5 rounded-md bg-gold-500 px-4 py-2 text-sm font-medium text-navy-900 hover:bg-gold-400 disabled:opacity-60"
            >
              {generatingEway ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
              {generatingEway ? 'Generating...' : 'Generate E-Way Bill'}
            </button>
          </div>
        </div>
        <p className="text-xs text-navy-400 mt-2">
          Generate calls your connected GSP to create the E-Way Bill automatically. Without a GSP,
          use <strong>Download JSON for Portal</strong>: upload that file on the E-Way Bill portal
          (Generate Bulk), then type the e-way bill number and dates below and save.
        </p>
        <div className="mt-3 flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-xs font-medium text-navy-600 mb-1">Sub type on portal JSON</label>
            <select
              className="input"
              value={portalSubType}
              onChange={(e) => setPortalSubType(e.target.value)}
            >
              <option value="">Automatic (Others / Job Work)</option>
              {SUB_TYPES.map((t) => (
                <option key={t.code} value={t.label}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          {(portalSubType === 'Others' || portalSubType === '') && (
            <div>
              <label className="block text-xs font-medium text-navy-600 mb-1">
                &quot;Specify&quot; text for Others (max 20)
              </label>
              <input
                className="input"
                maxLength={20}
                placeholder={header.purpose || header.document_type || 'Delivery Challan'}
                value={portalSubTypeDesc}
                onChange={(e) => setPortalSubTypeDesc(e.target.value)}
              />
            </div>
          )}
        </div>

        {ewayEnabled && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            <Field label="E-Way Bill number">
              <input className="input" value={eway.eway_bill_number} onChange={(e) => setE('eway_bill_number', e.target.value)} />
            </Field>
            <Field label="E-Way Bill date">
              <input type="date" className="input" value={eway.eway_bill_date} onChange={(e) => setE('eway_bill_date', e.target.value)} />
            </Field>
            <Field label="Valid until">
              <input type="date" className="input" value={eway.valid_until} onChange={(e) => setE('valid_until', e.target.value)} />
            </Field>
            <Field label="Distance (km)">
              <input type="number" min="0" step="any" className="input" value={eway.distance_km} onChange={(e) => setE('distance_km', e.target.value)} />
            </Field>
            <Field label="Transporter ID">
              <input className="input" value={eway.transporter_id} onChange={(e) => setE('transporter_id', e.target.value)} />
            </Field>
            <Field label="Transporter name">
              <input
                className="input"
                placeholder={header.transporter_name}
                value={eway.transporter_name}
                onChange={(e) => setE('transporter_name', e.target.value)}
              />
            </Field>
            <Field label="Vehicle number" error={errors.vehicle_number}>
              <input
                className="input"
                placeholder="KA01AB1234"
                value={eway.vehicle_number}
                onChange={(e) => setE('vehicle_number', e.target.value.toUpperCase())}
              />
            </Field>
            <Field label="Vehicle type">
              <select className="input" value={eway.vehicle_type} onChange={(e) => setE('vehicle_type', e.target.value)}>
                {VEHICLE_TYPES.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Transport mode">
              <select className="input" value={eway.transport_mode} onChange={(e) => setE('transport_mode', e.target.value)}>
                {TRANSPORT_MODES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="E-Way Bill status">
              <select className="input" value={eway.status} onChange={(e) => setE('status', e.target.value)}>
                {EWAY_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
          </div>
        )}
      </section>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 pb-10">
        <button
          type="button"
          disabled={saving}
          onClick={() => handleSave('Generated')}
          className="rounded-md bg-navy-800 px-5 py-2 text-sm font-medium text-white hover:bg-navy-700 disabled:opacity-60"
        >
          {saving ? 'Saving...' : isEdit ? 'Update DC' : 'Create DC'}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => handleSave('Draft')}
          className="rounded-md border border-navy-300 px-5 py-2 text-sm text-navy-700 hover:bg-gold-50 disabled:opacity-60"
        >
          Save as draft
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => navigate('/master-list')}
          className="px-3 py-2 text-sm text-navy-500 hover:text-navy-800"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export default DeliveryChallanForm
