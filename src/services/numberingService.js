import { supabase } from '../lib/supabase'

/**
 * Reserves the next Delivery Challan number for the given financial year
 * via the `next_dc_number` Postgres function, which uses an atomic
 * UPDATE ... ON CONFLICT so concurrent users never collide.
 * Format: DC-2026-0001
 */
export async function getNextDcNumber(date = new Date()) {
  const year = String(date.getFullYear())
  const { data, error } = await supabase.rpc('next_dc_number', { p_year: year })
  if (error) throw error
  return data
}
