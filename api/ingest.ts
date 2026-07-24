import type { VercelRequest, VercelResponse } from '@vercel/node'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as tar from 'tar'
import { getServiceRoleClient } from './_lib/db.js'
import { extractBearerToken, hashPat } from './_lib/pat.js'
import { processExecutionForProject } from './_lib/processExecutionForProject.js'

// Body is JSON { archive: "<base64 gzip tarball>" }, not a raw binary POST
// body. Vercel's Node runtime does its own body handling ahead of the
// handler for non-JSON content types, and empirically (confirmed by
// deploying and testing, not documented) it mangles arbitrary binary
// payloads - a plain-text body round-trips fine but a real gzip tarball
// came out corrupted before reaching this code. application/json is the
// one content type Vercel's runtime reliably parses as-is, and base64
// round-trips perfectly through JSON string encoding, so wrapping the
// archive that way sidesteps the raw-binary-body ambiguity entirely.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const token = extractBearerToken(req.headers.authorization)
  if (!token) {
    res.status(401).json({ error: 'Missing Authorization: Bearer <PAT> header' })
    return
  }

  const supabase = getServiceRoleClient()
  const tokenHash = hashPat(token)
  const { data: patRow, error: patError } = await supabase
    .from('personal_access_tokens')
    .select('id, project_id')
    .eq('token_hash', tokenHash)
    .is('revoked_at', null)
    .maybeSingle()

  if (patError || !patRow) {
    res.status(401).json({ error: 'Invalid or revoked token' })
    return
  }

  // Fire-and-forget - a stale last_used_at should never fail an ingest.
  void supabase
    .from('personal_access_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', patRow.id)

  let tmpDir: string | null = null
  try {
    const archive = req.body?.archive
    if (typeof archive !== 'string' || archive.length === 0) {
      res.status(400).json({ error: 'Expected JSON body { archive: "<base64 gzip tarball of allure-results>" }' })
      return
    }
    const body = Buffer.from(archive, 'base64')

    // Vercel container filesystems can be reused across warm invocations -
    // the finally block below always removes this before returning.
    tmpDir = mkdtempSync(join(tmpdir(), 'openqa-ingest-'))
    const tarballPath = join(tmpDir, 'upload.tar.gz')
    const allureResultsDir = join(tmpDir, 'allure-results')
    writeFileSync(tarballPath, body)
    mkdirSync(allureResultsDir, { recursive: true })
    await tar.x({ file: tarballPath, cwd: allureResultsDir })

    const data = await processExecutionForProject({
      projectId: patRow.project_id,
      allureResultsDir,
    })

    const current = data.summary.current
    res.status(200).json({
      executionId: current.executionId,
      total: current.total,
      passed: current.passed,
      failed: current.failed,
      broken: current.broken,
      skipped: current.skipped,
      passRate: current.passRate,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    res.status(400).json({ error: message })
  } finally {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true })
  }
}
