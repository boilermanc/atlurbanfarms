import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Final fallback when both localStorage and sessionStorage throw on access
// (Safari Private Browsing, some ITP configurations). Lives for the page
// lifetime only; the session won't survive a reload, but the SDK won't crash.
const memoryStore = new Map()

const storageAdapter = {
  getItem(key) {
    try {
      const v = window.localStorage.getItem(key)
      if (v !== null) return v
    } catch {}
    try {
      const v = window.sessionStorage.getItem(key)
      if (v !== null) return v
    } catch {}
    return memoryStore.has(key) ? memoryStore.get(key) : null
  },
  setItem(key, value) {
    try {
      window.localStorage.setItem(key, value)
      return
    } catch {}
    try {
      window.sessionStorage.setItem(key, value)
      return
    } catch {}
    memoryStore.set(key, value)
  },
  removeItem(key) {
    try { window.localStorage.removeItem(key) } catch {}
    try { window.sessionStorage.removeItem(key) } catch {}
    memoryStore.delete(key)
  },
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'sb-povudgtvzggnxwgtjexa-auth-token',
    storage: storageAdapter,
  },
})
