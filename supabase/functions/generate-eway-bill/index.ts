// Supabase Edge Function: generate-eway-bill
//
// Generates a real e-way bill through your GSP (GST Suvidha Provider).
// Currently implemented for Masters India (GSP_NAME=mastersindia), following
// https://docs.mastersindia.co/gst-eway-bill-api  (auth + ewayBillsGenerate).
//
// This runs on Supabase's server, so your GSP credentials never reach the
// browser — they live only as Edge Function secrets.
//
// --------------------------------------------------------------------
// SETUP (once):
// --------------------------------------------------------------------
// 1. Set the secrets (run in the project folder, after `supabase login`
//    and `supabase link`):
//
//      supabase secrets set \
//        GSP_NAME=mastersindia \
//        GSP_API_BASE_URL=https://clientbasic.mastersindia.co \
//        GSP_CLIENT_ID=<client id from your GSP> \
//        GSP_CLIENT_SECRET=<client secret from your GSP> \
//        GSP_EWB_USERNAME=<username of your GSP API account> \
//        GSP_EWB_PASSWORD=<password of your GSP API account> \
//        GSP_COMPANY_GSTIN=29AANCM7396P1Z5 \
//        GSP_COMPANY_CITY=<your city, e.g. Bengaluru>
//
// 2. Deploy:
//      supabase functions deploy generate-eway-bill
//
// Keep JWT verification ON (the default) so only logged-in app users can
// call this function.
// --------------------------------------------------------------------

// @ts-ignore - Deno remote import, resolved at deploy time on Supabase
import { serve } from 'https://deno.land/std@0.203.0/http/server.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>

class ValidationError extends Error {}

const env = (key: string): string =>
  // @ts-ignore - Deno global, available at runtime on Supabase
  (globalThis.Deno?.env?.get(key) as string | undefined)?.trim() || ''

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
  })
}

const REQUIRED_SECRETS = [
  'GSP_NAME',
  'GSP_CLIENT_ID',
  'GSP_CLIENT_SECRET',
  'GSP_EWB_USERNAME',
  'GSP_EWB_PASSWORD',
  'GSP_COMPANY_GSTIN'
]

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  let payload: Json
  try {
    payload = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid request body' }, 400)
  }

  const missing = REQUIRED_SECRETS.filter((k) => !env(k))
  if (missing.length) {
    return jsonResponse(
      {
        error:
          'E-Way Bill API is not connected yet. Ask an admin to add these Supabase Edge Function ' +
          `secrets and redeploy: ${missing.join(', ')}. Until then, enter the E-Way Bill details manually.`
      },
      501
    )
  }

  try {
    const result = await callGspApi(payload)
    return jsonResponse(result, 200)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'E-Way Bill generation failed'
    return jsonResponse({ error: message }, err instanceof ValidationError ? 400 : 502)
  }
})

// ---------------------------------------------------------------------
// GSP dispatch
// ---------------------------------------------------------------------

/**
 * Returns the shape the app reads:
 *   { eway_bill_number, eway_bill_date, valid_until }   (dates as YYYY-MM-DD)
 */
async function callGspApi(payload: Json) {
  const gsp = env('GSP_NAME').toLowerCase()
  if (gsp === 'mastersindia') return generateViaMastersIndia(payload)
  throw new Error(
    `GSP "${env('GSP_NAME')}" is not supported yet. Supported: mastersindia. ` +
      'Add another adapter in callGspApi() for your GSP.'
  )
}

// ---------------------------------------------------------------------
// Masters India adapter
// ---------------------------------------------------------------------

let cachedToken: { value: string; expiresAt: number } | null = null

function baseUrl() {
  return (env('GSP_API_BASE_URL') || 'https://clientbasic.mastersindia.co').replace(/\/+$/, '')
}

async function getMastersIndiaToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value

  const res = await fetch(`${baseUrl()}/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: env('GSP_EWB_USERNAME'),
      password: env('GSP_EWB_PASSWORD'),
      client_id: env('GSP_CLIENT_ID'),
      client_secret: env('GSP_CLIENT_SECRET'),
      grant_type: 'password'
    })
  })
  const data: Json = await res.json().catch(() => ({}))
  if (!res.ok || !data.access_token) {
    throw new Error(
      `GSP login failed: ${data.error_description || data.error || res.status}. ` +
        'Check GSP_CLIENT_ID / GSP_CLIENT_SECRET / GSP_EWB_USERNAME / GSP_EWB_PASSWORD.'
    )
  }
  const ttlMs = (Number(data.expires_in) || 3600) * 1000
  cachedToken = { value: data.access_token, expiresAt: Date.now() + ttlMs - 60_000 }
  return cachedToken.value
}

async function generateViaMastersIndia(payload: Json) {
  const token = await getMastersIndiaToken()
  const body = buildMastersIndiaPayload(payload, token)

  const res = await fetch(`${baseUrl()}/ewayBillsGenerate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `JWT ${token}` },
    body: JSON.stringify(body)
  })
  const data: Json = await res.json().catch(() => ({}))

  // Token may have been revoked/expired earlier than expected — drop it so the next call re-logs in.
  if (res.status === 401 || res.status === 403) cachedToken = null

  const results: Json = data.results || {}
  const message: Json | string = results.message

  if (typeof message === 'object' && message && !message.error && message.ewayBillNo) {
    return {
      eway_bill_number: String(message.ewayBillNo),
      eway_bill_date: gspDateToIso(message.ewayBillDate),
      valid_until: gspDateToIso(message.validUpto),
      print_url: message.url || null
    }
  }

  const reason =
    typeof message === 'string'
      ? message
      : (message && (message.errorMessage || message.error_message || message.alert)) ||
        results.status ||
        data.error ||
        `HTTP ${res.status}`
  throw new Error(`GSP could not generate the E-Way Bill: ${reason}`)
}

// ---------------------------------------------------------------------
// Payload mapping: app payload -> Masters India "ewayBillsGenerate"
// ---------------------------------------------------------------------

// App UOM -> NIC unit quantity code
const UOM_MAP: Record<string, string> = {
  NOS: 'NOS', PCS: 'PCS', KG: 'KGS', GM: 'GMS', LTR: 'LTR', ML: 'MLT', MTR: 'MTR',
  BOX: 'BOX', BAG: 'BAG', SET: 'SET', PAIR: 'PRS', ROLL: 'ROL', SQM: 'SQM', DOZ: 'DOZ'
}

const clean = (v: unknown, max = 120) =>
  String(v ?? '')
    .replace(/["'\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)

const num = (v: unknown) => Math.round((Number(v) || 0) * 100) / 100

const pin = (v: unknown) => Number(String(v ?? '').replace(/\D/g, '')) || 0

const stateName = (v: unknown) => clean(v, 50).toUpperCase()

// 'YYYY-MM-DD' (or ISO timestamp) -> 'DD/MM/YYYY'
function isoToGspDate(v: unknown): string {
  const m = String(v ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) throw new ValidationError('Challan date is missing or invalid.')
  return `${m[3]}/${m[2]}/${m[1]}`
}

// '06/11/2018 11:59:00 PM' -> '2018-11-06'
function gspDateToIso(v: unknown): string | null {
  const m = String(v ?? '').match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

function buildMastersIndiaPayload(p: Json, token: string): Json {
  const company: Json = p.company || {}
  const billTo: Json = p.bill_to || {}
  const shipTo: Json = p.ship_to && (p.ship_to.address_line1 || p.ship_to.pin_code) ? p.ship_to : billTo
  const totals: Json = p.totals || {}
  const items: Json[] = Array.isArray(p.items) ? p.items : []

  // ----- validation (fail early with a message the user can act on) -----
  if (!items.length) throw new ValidationError('Add at least one item before generating an E-Way Bill.')
  if (pin(company.pincode) < 100000) throw new ValidationError('Company pincode is missing. Set it in Settings.')
  if (!company.address) throw new ValidationError('Company address is missing. Set it in Settings.')
  if (pin(shipTo.pin_code) < 100000) throw new ValidationError('Ship To pincode is missing or invalid.')
  if (!shipTo.state && !billTo.state) throw new ValidationError('Ship To state is missing.')
  items.forEach((r, i) => {
    if (!String(r.hsn || '').trim()) throw new ValidationError(`HSN code is missing for item ${i + 1}.`)
    if (!(Number(r.quantity) > 0)) throw new ValidationError(`Quantity must be greater than 0 for item ${i + 1}.`)
  })

  const intra = !(num(totals.igst) > 0)

  const docType = String(p.document_type || 'Delivery Challan')
  const isJobWork = docType === 'Job Work'

  const companyState = stateName(company.state || 'Karnataka')
  const billState = stateName(billTo.state) || companyState
  const shipState = stateName(shipTo.state) || billState

  const toGstin = String(billTo.gstin || '').trim().toUpperCase() || 'URP'
  const distance = Math.max(0, Math.round(Number(p.distance_km) || 0)) // 0 = portal auto-calculates from pincodes

  return {
    access_token: token,
    userGstin: env('GSP_COMPANY_GSTIN'),
    supply_type: 'outward',
    sub_supply_type: isJobWork ? 'Job Work' : 'Others',
    sub_supply_description: isJobWork ? '' : clean(docType, 20),
    document_type: 'Delivery Challan',
    document_number: clean(p.dc_number, 16),
    document_date: isoToGspDate(p.dc_date),

    gstin_of_consignor: env('GSP_COMPANY_GSTIN'),
    legal_name_of_consignor: clean(company.name, 100),
    address1_of_consignor: clean(company.address),
    address2_of_consignor: '',
    place_of_consignor: clean(env('GSP_COMPANY_CITY') || company.city || company.state, 50),
    pincode_of_consignor: pin(company.pincode),
    state_of_consignor: companyState,
    actual_from_state_name: companyState,

    gstin_of_consignee: toGstin,
    legal_name_of_consignee: clean(shipTo.name || billTo.name, 100),
    address1_of_consignee: clean(shipTo.address_line1),
    address2_of_consignee: clean(shipTo.address_line2),
    place_of_consignee: clean(shipTo.city || shipTo.district || shipState, 50),
    pincode_of_consignee: pin(shipTo.pin_code),
    state_of_supply: billState,
    actual_to_state_name: shipState,

    transaction_type: 1,
    other_value: 0,
    total_invoice_value: num(totals.grandTotal),
    taxable_amount: num(totals.taxableValue),
    cgst_amount: num(totals.cgst),
    sgst_amount: num(totals.sgst),
    igst_amount: num(totals.igst),
    cess_amount: 0,
    cess_nonadvol_value: 0,

    transporter_id: clean(p.transporter_id, 15).toUpperCase(),
    transporter_name: clean(p.transporter_name, 100),
    transporter_document_number: '',
    transporter_document_date: '',
    transportation_mode: String(p.transport_mode || 'Road').toLowerCase(),
    transportation_distance: String(distance),
    vehicle_number: String(p.vehicle_number || '').toUpperCase().replace(/[^A-Z0-9]/g, ''),
    vehicle_type: String(p.vehicle_type || '').startsWith('Over') ? 'Over Dimensional Cargo' : 'Regular',

    generate_status: 1,
    data_source: 'erp',
    user_ref: clean(p.dc_number, 40),

    itemList: items.map((r) => {
      const rate = Number(r.gst_rate) || 0
      return {
        product_name: clean(r.item_name || r.description || r.item_code, 100),
        product_description: clean(r.description || r.item_name, 100),
        hsn_code: String(r.hsn).replace(/\D/g, ''),
        quantity: Number(r.quantity),
        unit_of_product: UOM_MAP[String(r.uom || 'NOS').toUpperCase()] || 'OTH',
        cgst_rate: intra ? rate / 2 : 0,
        sgst_rate: intra ? rate / 2 : 0,
        igst_rate: intra ? 0 : rate,
        cess_rate: 0,
        cessNonAdvol: 0,
        taxable_amount: num(r.taxable_value)
      }
    })
  }
}
