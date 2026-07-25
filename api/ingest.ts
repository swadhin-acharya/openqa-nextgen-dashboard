import type { VercelRequest, VercelResponse } from '@vercel/node'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as tar from 'tar'
import { getServiceRoleClient } from './_lib/db.js'
import { extractBearerToken, hashPat } from './_lib/pat.js'
import { processExecutionForProject } from './_lib/processExecutionForProject.js'
import { upsertLiveExecution, clearLiveExecution } from './_lib/liveExecution.js'

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
    .select('id, project_id, user_id')
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

  // Attribute this execution to whichever member's PAT pushed it ("executor"
  // in the Executions page's filters, distinct from Allure's own CI executor
  // concept). Executor is identified by name (profiles.name), with email
  // kept alongside for uniqueness/filtering. Best-effort - a lookup failure
  // shouldn't fail the ingest.
  const { data: executorProfile } = await supabase
    .from('profiles')
    .select('name, email')
    .eq('id', patRow.user_id)
    .maybeSingle()
  const executedByName = executorProfile?.name ?? null
  const executedByEmail = executorProfile?.email ?? null

  // Phase 10: a run-in-progress polls this same endpoint every ~15-30s with
  // inProgress: true and a client-chosen executionId that stays constant
  // across the whole run (including the final, non-inProgress call) - that
  // shared id is how the completion call knows which live_executions row to
  // clear. Omitting executionId entirely just behaves exactly as before
  // Phase 10 (no live row, no clearing, id defaults inside
  // processExecutionForProject) - live visibility is opt-in per caller.
  const inProgress = req.body?.inProgress === true
  const executionId = typeof req.body?.executionId === 'string' ? req.body.executionId : undefined

  let tmpDir: string | null = null
  try {
    const archive = req.body?.archive
    if (typeof archive !== 'string' || archive.length === 0) {
      res.status(400).json({ error: 'Expected JSON body { archive: "<base64 gzip tarball of allure-results>" }' })
      return
    }
    if (inProgress && !executionId) {
      res.status(400).json({ error: 'inProgress: true requires an executionId so repeated polls target the same run' })
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

    // macOS's tar can silently include AppleDouble metadata sidecar files
    // (e.g. "._abc-result.json" alongside "abc-result.json") when archiving
    // from a filesystem with extended attributes. Their name also matches
    // the "*-result.json" suffix reader.ts filters on, but their content is
    // binary AppleDouble data, not JSON - traced a real ingest failure to
    // exactly this. Building the tarball with COPYFILE_DISABLE=1 prevents
    // macOS from creating them in the first place, but stripping them here
    // too means the API doesn't depend on every client remembering that.
    for (const f of readdirSync(allureResultsDir)) {
      if (f.startsWith('._')) unlinkSync(join(allureResultsDir, f))
    }

    if (inProgress) {
      // Never touches dashboard_data/executions_meta/execution_log - see
      // liveExecution.ts and the migration's header comment for why this
      // has to be a completely separate write path.
      const snapshot = await upsertLiveExecution({
        projectId: patRow.project_id,
        allureResultsDir,
        executionId: executionId!,
        executedByUserId: patRow.user_id,
        executedByName,
      })
      res.status(200).json({
        live: true,
        executionId: executionId!,
        total: snapshot.execution.total,
        passed: snapshot.execution.passed,
        failed: snapshot.execution.failed,
        broken: snapshot.execution.broken,
        skipped: snapshot.execution.skipped,
        branch: snapshot.branch,
      })
      return
    }

    const result = await processExecutionForProject({
      projectId: patRow.project_id,
      allureResultsDir,
      executionId,
      executedByName,
      executedByEmail,
    })

    // The run is complete - if this execution had a live row (from earlier
    // inProgress polls sharing the same executionId), clear it now that the
    // real historical record has landed. A no-op if there wasn't one.
    if (executionId) {
      await clearLiveExecution(patRow.project_id, executionId)
    }

    const current = result.execution
    res.status(200).json({
      executionId: current.executionId,
      total: current.total,
      passed: current.passed,
      failed: current.failed,
      broken: current.broken,
      skipped: current.skipped,
      passRate: current.passRate,
      branch: result.branch,
      mergedIntoMainDashboard: result.mergedIntoMainDashboard,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    res.status(400).json({ error: message })
  } finally {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true })
  }
}
