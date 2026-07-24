import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceRoleClient } from './_lib/db.js'
import { extractBearerToken, generatePat } from './_lib/pat.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const sessionToken = extractBearerToken(req.headers.authorization)
  if (!sessionToken) {
    res.status(401).json({ error: 'Missing Authorization: Bearer <session token> header' })
    return
  }

  const { projectId, name } = req.body ?? {}
  if (typeof projectId !== 'string' || !projectId) {
    res.status(400).json({ error: 'projectId is required' })
    return
  }

  const supabase = getServiceRoleClient()

  // Verify the caller's Supabase session JWT (proves who they are) - this is
  // a distinct check from the PAT flow in api/ingest.ts, which has no user
  // session at all and authenticates purely via the token hash lookup.
  const { data: userData, error: userError } = await supabase.auth.getUser(sessionToken)
  if (userError || !userData?.user) {
    res.status(401).json({ error: 'Invalid or expired session' })
    return
  }
  const userId = userData.user.id

  const { data: membership, error: membershipError } = await supabase
    .from('project_members')
    .select('user_id')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle()

  if (membershipError) {
    res.status(500).json({ error: membershipError.message })
    return
  }
  if (!membership) {
    res.status(403).json({ error: 'Not a member of this project' })
    return
  }

  const pat = generatePat()
  const { error: insertError } = await supabase.from('personal_access_tokens').insert({
    project_id: projectId,
    user_id: userId,
    name: typeof name === 'string' && name ? name : 'default',
    token_prefix: pat.prefix,
    token_hash: pat.hash,
  })

  if (insertError) {
    res.status(500).json({ error: insertError.message })
    return
  }

  // The only time the raw value is ever returned - it is not recoverable
  // after this response, only token_prefix is kept for display.
  res.status(200).json({ token: pat.raw })
}
