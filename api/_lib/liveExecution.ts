import { readAllureResults } from '../../processor/reader.js'
import { buildExecutionSummary } from '../../processor/normalize.js'
import type { ExecutionSummary } from '../../processor/models.js'
import { resolveSuiteId } from './suites.js'
import { getServiceRoleClient } from './db.js'

export interface LiveSnapshotOptions {
  projectId: string
  allureResultsDir: string
  executionId: string
  executedByUserId?: string | null
  executedByName?: string | null
}

export interface LiveSnapshotResult {
  execution: ExecutionSummary
  suiteId: string
  branch: string | null
}

/**
 * Upserts a partial-run snapshot into live_executions. Reuses the same
 * pure reader/normalize functions as processExecutionForProject, but never
 * touches dashboard_data/executions_meta/execution_log - this is Phase 10's
 * whole point, an in-progress run must be invisible to the historical
 * record until the run's final (non-inProgress) ingest lands.
 */
export async function upsertLiveExecution(options: LiveSnapshotOptions): Promise<LiveSnapshotResult> {
  const raw = readAllureResults(options.allureResultsDir)
  const execution = buildExecutionSummary(raw, { executionId: options.executionId })

  const suiteName = raw.environment.suite ?? raw.environment.Suite ?? 'Default'
  const branch = raw.environment.Branch ?? raw.environment.branch ?? null
  const suiteId = await resolveSuiteId(options.projectId, suiteName)

  const supabase = getServiceRoleClient()
  const now = new Date().toISOString()

  // Preserve the original started_at across repeated polls of the same run
  // - upsert() below would otherwise reset it to `now` on every poll since
  // it's part of the row payload, not a DB-side default applied only on insert.
  const { data: existing } = await supabase
    .from('live_executions')
    .select('started_at')
    .eq('project_id', options.projectId)
    .eq('execution_id', options.executionId)
    .maybeSingle()

  await supabase.from('live_executions').upsert(
    {
      project_id: options.projectId,
      execution_id: options.executionId,
      suite_id: suiteId,
      branch,
      executed_by_user_id: options.executedByUserId ?? null,
      executed_by_name: options.executedByName ?? null,
      started_at: existing?.started_at ?? now,
      last_seen_at: now,
      total: execution.total,
      passed: execution.passed,
      failed: execution.failed,
      broken: execution.broken,
      skipped: execution.skipped,
    },
    { onConflict: 'project_id,execution_id' },
  )

  return { execution, suiteId, branch }
}

export async function clearLiveExecution(projectId: string, executionId: string): Promise<void> {
  await getServiceRoleClient()
    .from('live_executions')
    .delete()
    .eq('project_id', projectId)
    .eq('execution_id', executionId)
}
