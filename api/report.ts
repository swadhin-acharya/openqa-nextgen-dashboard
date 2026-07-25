import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceRoleClient } from './_lib/db.js'
import { extractBearerToken } from './_lib/pat.js'

/**
 * Serves a stored standalone execution report. All reads go through here
 * (service-role, bypasses RLS) rather than a client-facing storage policy -
 * report content can include screenshots/logs/stack traces, so access has
 * to be validated against the SAME org/project membership check as
 * everything else, not a guessable storage path (see the feature's
 * security requirement).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const sessionToken = extractBearerToken(req.headers.authorization)
  if (!sessionToken) {
    res.status(401).json({ error: 'Missing Authorization: Bearer <session token> header' })
    return
  }

  const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined
  const executionId = typeof req.query.executionId === 'string' ? req.query.executionId : undefined
  const download = req.query.download === 'true'

  if (!projectId || !executionId) {
    res.status(400).json({ error: 'projectId and executionId are required' })
    return
  }

  const supabase = getServiceRoleClient()

  const { data: userData, error: userError } = await supabase.auth.getUser(sessionToken)
  if (userError || !userData?.user) {
    res.status(401).json({ error: 'Invalid or expired session' })
    return
  }

  const { data: project } = await supabase.from('projects').select('org_id').eq('id', projectId).maybeSingle()
  if (!project) {
    res.status(404).json({ error: 'Project not found' })
    return
  }
  const { data: membership } = await supabase
    .from('org_members')
    .select('role')
    .eq('org_id', project.org_id)
    .eq('user_id', userData.user.id)
    .maybeSingle()
  if (!membership) {
    res.status(403).json({ error: "You don't have access to this project" })
    return
  }

  const { data: artifact } = await supabase
    .from('report_artifacts')
    .select('storage_path, file_name, status')
    .eq('project_id', projectId)
    .eq('execution_id', executionId)
    .maybeSingle()

  if (!artifact || artifact.status !== 'AVAILABLE') {
    res.status(404).json({ error: artifact?.status === 'GENERATION_FAILED' ? 'Report generation failed for this execution' : 'No report available for this execution' })
    return
  }

  const { data: file, error: downloadError } = await supabase.storage.from('execution-reports').download(artifact.storage_path)
  if (downloadError || !file) {
    res.status(500).json({ error: downloadError?.message ?? 'Failed to load report' })
    return
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  if (download) {
    res.setHeader('Content-Disposition', `attachment; filename="${artifact.file_name}"`)
  }
  res.status(200).send(buffer)
}
