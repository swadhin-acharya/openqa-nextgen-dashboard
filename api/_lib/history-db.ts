import type { HistoryState, FailureHistoryState } from '../../processor/history.js'
import type { DashboardData } from '../../processor/dashboard-data.js'
import type { TestSummary, RecentExecutionRow } from '../../processor/models.js'
import type { AllureResult } from '../../processor/reader.js'
import { getServiceRoleClient } from './db.js'

/**
 * Mirrors RecentExecutionRow's stats (total/passed/failed/.../duration/date)
 * so the Executions page has a full summary for EVERY execution, not just
 * the ones that made it into the vendored aggregate's `executions` array
 * (which only ever holds main-branch runs - see
 * processExecutionForProject.ts).
 */
export interface ExecutionMeta extends Omit<RecentExecutionRow, 'executionId'> {
  suiteId: string | null
  branch: string | null
  /** Display identity for "executor" - name is what's shown in the UI,
   * email is kept alongside for uniqueness/filtering. */
  executedByName: string | null
  executedByEmail: string | null
  mergedIntoMainDashboard: boolean
  /** How many times this executionId has been (re-)ingested. >1 means later
   * attempts were merged in as retries - see retryMerge.ts. */
  attempts: number
}

export type ExecutionsMeta = Record<string, ExecutionMeta>
export type ExecutionTestsMap = Record<string, TestSummary[]>
/** Full-fidelity Allure results per executionId (unlike execution_tests'
 * reduced TestSummary shape) - kept so a later retry ingest for the same
 * executionId can be merged with the vendored functions unchanged. Trimmed
 * to the same executionIds as execution_tests, not kept forever. */
export type ExecutionRawResultsMap = Record<string, AllureResult[]>

/**
 * Postgres-backed replacement for processor/history.ts's loadHistory(dataDir)
 * and loadFailureHistoryState(dataDir), which read local JSON files. Reads
 * from the single dashboard_data row for the project (absent row == no
 * executions yet, same as the file-based fallback returning empty arrays).
 */
export async function loadHistoryFromDb(projectId: string): Promise<HistoryState> {
  const supabase = getServiceRoleClient()
  const { data, error } = await supabase
    .from('dashboard_data')
    .select('executions, trends, failures')
    .eq('project_id', projectId)
    .maybeSingle()

  if (error) throw new Error(`loadHistoryFromDb: ${error.message}`)

  return {
    executions: data?.executions ?? [],
    trends: data?.trends ?? [],
    failures: data?.failures ?? [],
  }
}

export async function loadFailureHistoryStateFromDb(projectId: string): Promise<FailureHistoryState> {
  const supabase = getServiceRoleClient()
  const { data, error } = await supabase
    .from('dashboard_data')
    .select('failures, failure_contributions')
    .eq('project_id', projectId)
    .maybeSingle()

  if (error) throw new Error(`loadFailureHistoryStateFromDb: ${error.message}`)

  return {
    failures: data?.failures ?? [],
    contributions: data?.failure_contributions ?? {},
  }
}

/**
 * executions_meta/execution_tests are maintained for EVERY execution
 * regardless of branch (unlike the vendored aggregate, which only ever
 * reflects main-branch runs) - this is what lets the Executions page show
 * everything while Overview stays branch-scoped. See
 * api/_lib/processExecutionForProject.ts for the branch-scoping logic.
 */
export async function loadExecutionsMetaFromDb(projectId: string): Promise<ExecutionsMeta> {
  const supabase = getServiceRoleClient()
  const { data, error } = await supabase
    .from('dashboard_data')
    .select('executions_meta')
    .eq('project_id', projectId)
    .maybeSingle()

  if (error) throw new Error(`loadExecutionsMetaFromDb: ${error.message}`)
  return (data?.executions_meta as ExecutionsMeta | undefined) ?? {}
}

export async function loadExecutionTestsFromDb(projectId: string): Promise<ExecutionTestsMap> {
  const supabase = getServiceRoleClient()
  const { data, error } = await supabase
    .from('dashboard_data')
    .select('execution_tests')
    .eq('project_id', projectId)
    .maybeSingle()

  if (error) throw new Error(`loadExecutionTestsFromDb: ${error.message}`)
  return (data?.execution_tests as ExecutionTestsMap | undefined) ?? {}
}

export async function loadExecutionRawResultsFromDb(projectId: string): Promise<ExecutionRawResultsMap> {
  const supabase = getServiceRoleClient()
  const { data, error } = await supabase
    .from('dashboard_data')
    .select('execution_raw_results')
    .eq('project_id', projectId)
    .maybeSingle()

  if (error) throw new Error(`loadExecutionRawResultsFromDb: ${error.message}`)
  return (data?.execution_raw_results as ExecutionRawResultsMap | undefined) ?? {}
}

/**
 * Full write for a main-branch ingest - the vendored aggregate (summary/
 * executions/trends/features/tests/failures/categories/environment) plus
 * executions_meta/execution_tests, all in one upsert.
 */
export async function writeDashboardDataToDb(
  projectId: string,
  data: DashboardData,
  contributions: Record<string, string[]>,
  executionsMeta: ExecutionsMeta,
  executionTests: ExecutionTestsMap,
  rawEnvironment: Record<string, string>,
  executionRawResults: ExecutionRawResultsMap,
): Promise<void> {
  const supabase = getServiceRoleClient()
  const { error } = await supabase.from('dashboard_data').upsert({
    project_id: projectId,
    summary: data.summary,
    executions: data.executions,
    trends: data.trends,
    features: data.features,
    tests: data.tests,
    failures: data.failures,
    categories: data.categories,
    environment: data.environment,
    raw_environment: rawEnvironment,
    failure_contributions: contributions,
    executions_meta: executionsMeta,
    execution_tests: executionTests,
    execution_raw_results: executionRawResults,
    updated_at: new Date().toISOString(),
  })

  if (error) throw new Error(`writeDashboardDataToDb: ${error.message}`)
}

/**
 * Partial write for a non-main-branch ingest - only executions_meta/
 * execution_tests change; the vendored aggregate columns are left exactly
 * as they are (Postgres upsert only touches columns present in the
 * payload, and the table's own column defaults cover a project's very
 * first ingest happening to be on a non-main branch).
 */
export async function writeExecutionsMetaAndTests(
  projectId: string,
  executionsMeta: ExecutionsMeta,
  executionTests: ExecutionTestsMap,
  executionRawResults: ExecutionRawResultsMap,
): Promise<void> {
  const supabase = getServiceRoleClient()
  const { error } = await supabase.from('dashboard_data').upsert({
    project_id: projectId,
    executions_meta: executionsMeta,
    execution_tests: executionTests,
    execution_raw_results: executionRawResults,
    updated_at: new Date().toISOString(),
  })

  if (error) throw new Error(`writeExecutionsMetaAndTests: ${error.message}`)
}
