import type { HistoryState, FailureHistoryState } from '../../processor/history.js'
import type { DashboardData } from '../../processor/dashboard-data.js'
import { getServiceRoleClient } from './db.js'

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
 * Postgres-backed replacement for writer.ts's writeDashboardData +
 * writeInternalState combined - one upsert covering both the
 * dashboard-visible fields and the internal failure-contributions bookkeeping.
 */
export async function writeDashboardDataToDb(
  projectId: string,
  data: DashboardData,
  contributions: Record<string, string[]>,
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
    failure_contributions: contributions,
    updated_at: new Date().toISOString(),
  })

  if (error) throw new Error(`writeDashboardDataToDb: ${error.message}`)
}
