import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceRoleClient } from './_lib/db.js'
import { extractBearerToken } from './_lib/pat.js'

type Action = 'add' | 'update-role' | 'remove'
const VALID_ROLES = ['owner', 'member', 'viewer']

/**
 * Org member management - all writes go through here (service-role) rather
 * than direct client RLS policies, because "add an existing user by email"
 * needs to look up a user who isn't a member of this org yet (so doesn't
 * share it with the caller) - profiles' own RLS only lets a member read
 * their own row plus their org-mates', which by definition excludes anyone
 * not yet added. The owner-only check below is what stands in for RLS here.
 */
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

  const { orgId, action, email, userId, role } = (req.body ?? {}) as {
    orgId?: string
    action?: Action
    email?: string
    userId?: string
    role?: string
  }

  if (typeof orgId !== 'string' || !orgId) {
    res.status(400).json({ error: 'orgId is required' })
    return
  }
  if (action !== 'add' && action !== 'update-role' && action !== 'remove') {
    res.status(400).json({ error: 'action must be add, update-role, or remove' })
    return
  }

  const supabase = getServiceRoleClient()

  const { data: userData, error: userError } = await supabase.auth.getUser(sessionToken)
  if (userError || !userData?.user) {
    res.status(401).json({ error: 'Invalid or expired session' })
    return
  }
  const callerId = userData.user.id

  const { data: callerMembership } = await supabase
    .from('org_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', callerId)
    .maybeSingle()

  if (callerMembership?.role !== 'owner') {
    res.status(403).json({ error: 'Only the organization owner can manage members' })
    return
  }

  if (action === 'add') {
    if (typeof email !== 'string' || !email.trim()) {
      res.status(400).json({ error: 'email is required' })
      return
    }
    const targetRole = typeof role === 'string' && VALID_ROLES.includes(role) ? role : 'member'

    const { data: targetProfile } = await supabase.from('profiles').select('id').eq('email', email.trim()).maybeSingle()
    if (!targetProfile) {
      res.status(404).json({ error: `No account found for ${email.trim()} - they need to sign up first` })
      return
    }

    const { error: insertError } = await supabase
      .from('org_members')
      .upsert({ org_id: orgId, user_id: targetProfile.id, role: targetRole }, { onConflict: 'org_id,user_id' })

    if (insertError) {
      res.status(500).json({ error: insertError.message })
      return
    }
    res.status(200).json({ ok: true })
    return
  }

  if (typeof userId !== 'string' || !userId) {
    res.status(400).json({ error: 'userId is required' })
    return
  }

  if (action === 'update-role') {
    if (typeof role !== 'string' || !VALID_ROLES.includes(role)) {
      res.status(400).json({ error: `role must be one of ${VALID_ROLES.join(', ')}` })
      return
    }
    if (userId === callerId && role !== 'owner') {
      res.status(400).json({ error: "Can't demote yourself - have another owner change your role instead" })
      return
    }
    const { error: updateError } = await supabase.from('org_members').update({ role }).eq('org_id', orgId).eq('user_id', userId)
    if (updateError) {
      res.status(500).json({ error: updateError.message })
      return
    }
    res.status(200).json({ ok: true })
    return
  }

  // action === 'remove'
  if (userId === callerId) {
    res.status(400).json({ error: "Can't remove yourself - have another owner remove you instead" })
    return
  }
  const { error: deleteError } = await supabase.from('org_members').delete().eq('org_id', orgId).eq('user_id', userId)
  if (deleteError) {
    res.status(500).json({ error: deleteError.message })
    return
  }
  res.status(200).json({ ok: true })
}
