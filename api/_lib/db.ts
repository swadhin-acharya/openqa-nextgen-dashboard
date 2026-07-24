import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

/**
 * Service-role client for server-side API routes only - never import this
 * from src/. Its key bypasses Row-Level Security, so every query built on
 * top of it (api/ingest.ts, api/tokens.ts) is responsible for doing its own
 * authorization check (PAT hash lookup, or a Supabase user JWT verification)
 * before touching a row scoped to a project or user.
 */
export function getServiceRoleClient(): SupabaseClient {
  if (client) return client

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  }

  client = createClient(url, key, { auth: { persistSession: false } })
  return client
}
