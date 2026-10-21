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

// ---- Sign-In panel texts (small heading, title, subtitle) ------------------------------------
// Shape: { eyebrow, title, subtitle }. Stored in the same table; only an admin can change it.

const TEXT_KEY = 'login_panel_text'
const TEXT_CACHE = 'dc-login-text-cache'

export const DEFAULT_LOGIN_TEXT = {
  eyebrow: 'DELIVERY CHALLAN & E-WAY BILL',
  title: 'Sign In',
  subtitle: 'Enter your details to access your dashboard.'
}

const validText = (v) => v && typeof v === 'object' && ['eyebrow', 'title', 'subtitle'].every((k) => typeof v[k] === 'string')

export function readCachedLoginText() {
  try {
    const v = JSON.parse(localStorage.getItem(TEXT_CACHE) || 'null')
    return validText(v) ? { ...DEFAULT_LOGIN_TEXT, ...v } : null
  } catch {
    return null
  }
}

export async function fetchLoginText() {
  try {
    const { data, error } = await supabase.from('app_settings').select('value').eq('key', TEXT_KEY).maybeSingle()
    if (error || !validText(data?.value)) return null
    try { localStorage.setItem(TEXT_CACHE, JSON.stringify(data.value)) } catch { /* ignore */ }
    return { ...DEFAULT_LOGIN_TEXT, ...data.value }
  } catch {
    return null
  }
}

export async function saveLoginText(value) {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: TEXT_KEY, value, updated_at: new Date().toISOString() })
  if (error) throw error
  try { localStorage.setItem(TEXT_CACHE, JSON.stringify(value)) } catch { /* ignore */ }
}
