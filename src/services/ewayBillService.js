import { supabase } from '../lib/supabase'

export async function upsertEwayBill(challanId, ewayData) {
  const { data, error } = await supabase
    .from('eway_bills')
    .upsert({ delivery_challan_id: challanId, ...ewayData }, { onConflict: 'delivery_challan_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getEwayBill(challanId) {
  const { data, error } = await supabase
    .from('eway_bills')
    .select('*')
    .eq('delivery_challan_id', challanId)
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * Calls the `generate-eway-bill` Supabase Edge Function, which in turn calls
 * your GSP's E-Way Bill API using credentials stored as Edge Function
 * secrets (never in the frontend). See supabase/functions/generate-eway-bill.
 *
 * Throws an Error whose message is safe to show the user — the edge
 * function returns a clear "not configured" message until GSP secrets
 * are set up.
 */
export async function generateEwayBillViaApi(payload) {
  const { data, error } = await supabase.functions.invoke('generate-eway-bill', { body: payload })
  if (error) {
    // Supabase wraps non-2xx responses in FunctionsHttpError; try to surface
    // the JSON message the function returned rather than a generic failure.
    let message = error.message || 'E-Way Bill generation failed'
    try {
      const body = await error.context?.json?.()
      if (body?.error) message = body.error
    } catch {
      /* ignore parse failures, fall back to error.message */
    }
    throw new Error(message)
  }
  if (data?.error) throw new Error(data.error)
  return data
}
