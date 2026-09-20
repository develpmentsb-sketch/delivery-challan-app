import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    'Supabase env vars are missing. Copy .env.example to .env and fill in ' +
    'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (the anon/public key only).'
  )
}

// IMPORTANT: only the anon/public key is ever used in the frontend.
// The service-role key must never be shipped to the browser - keep it
// on a server / Supabase Edge Function if you ever need elevated access
// (for example, to call a future GST/E-Way Bill government API).
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
})
