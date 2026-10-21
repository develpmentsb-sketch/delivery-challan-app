import { supabase } from '../lib/supabase'

// The saved Sign-In panel layout lives in the app_settings table, so every visitor sees the same
// layout, and only an admin can change it (enforced by the database, see supabase/add_app_settings.sql).
// Shape: { fx, fy, w, h }  ->  fx / fy = position as a fraction of the page, w / h = size in pixels.

const KEY = 'login_panel_layout'
const CACHE = 'dc-login-layout-cache'

const valid = (v) => v && ['fx', 'fy', 'w', 'h'].every((k) => Number.isFinite(v[k]))

function cache(v) {
  try { localStorage.setItem(CACHE, JSON.stringify(v)) } catch { /* ignore */ }
}

// Last layout this browser saw: lets the page paint in the right place before the network answers.
export function readCachedLoginLayout() {
  try {
    const v = JSON.parse(localStorage.getItem(CACHE) || 'null')
    return valid(v) ? v : null
  } catch {
    return null
  }
}

export async function fetchLoginLayout() {
  try {
    const { data, error } = await supabase.from('app_settings').select('value').eq('key', KEY).maybeSingle()
    if (error || !valid(data?.value)) return null
    cache(data.value)
    return data.value
  } catch {
    return null
  }
}

export async function saveLoginLayout(value) {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: KEY, value, updated_at: new Date().toISOString() })
  if (error) throw error
  cache(value)
}
