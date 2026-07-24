import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set (see .env.example)')
}

// Anon key is safe to ship in the client bundle - Row-Level Security on each
// table is the actual authorization boundary, not this key's secrecy.
export const supabase = createClient(url, anonKey)
