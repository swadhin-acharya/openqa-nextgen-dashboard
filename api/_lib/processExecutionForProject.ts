import { readAllureResults } from '../../processor/reader.js'
import {
  buildExecutionSummary,
  buildFeatureSummaries,
  buildTestSummaries,
  buildCategorySummaries,
} from '../../processor/normalize.js'
import { mergeExecutionHistory, computeComparison, mergeFailureHistory } from '../../processor/history.js'
import type { DashboardData } from '../../processor/dashboard-data.js'
import type { ExecutionSummary } from '../../processor/models.js'
import {
  loadHistoryFromDb,
  loadFailureHistoryStateFromDb,
  loadExecutionsMetaFromDb,
  loadExecutionTestsFromDb,
  writeDashboardDataToDb,
  writeExecutionsMetaAndTests,
  type ExecutionMeta,
} from './history-db.js'
import { resolveSuiteId } from './suites.js'
import { appendExecutionLog } from './executionLog.js'
import { getServiceRoleClient } from './db.js'

export interface ProcessExecutionForProjectOptions {
  projectId: string
  /** Directory containing *-result.json, environment.properties, etc. */
  allureResultsDir: string
  executionId?: string
  executionName?: string
  executedByEmail?: string | null
  historyLimit?: number
}

export interface ProcessExecutionForProjectResult {
  /** This run's own stats - always present, regardless of branch. */
  execution: ExecutionSummary
  suiteId: string
  branch: string | null
  /** False when this execution's branch != the project's main_branch, so it
   * was recorded but excluded from the shared aggregate (see below). */
  mergedIntoMainDashboard: boolean
}

const DEFAULT_HISTORY_LIMIT = 50
/** executions_meta/execution_tests keep their own recency cap, independent
 * of the vendored aggregate's historyLimit (see trimToRecent below) - a
 * non-main-branch run doesn't touch the aggregate at all, so it can't rely
 * on that trimming to bound growth. */
const META_RETENTION_LIMIT = 50

function trimToRecent<T extends { date: string }>(map: Record<string, T>, limit: number): Record<string, T> {
  return Object.fromEntries(
    Object.entries(map)
      .sort((a, b) => new Date(b[1].date).getTime() - new Date(a[1].date).getTime())
      .slice(0, limit),
  )
}

/**
 * The hosted-SaaS twin of processor/process.ts's processExecution: same call
 * order over the same pure vendored functions, with two things layered on
 * top that the vendored processor knows nothing about (by design - see
 * processor/README.md, it stays byte-identical to the static product):
 *
 * 1. Suite + executor + branch metadata, recorded for every execution via
 *    executions_meta/execution_tests regardless of branch.
 * 2. Branch scoping: only executions on the project's main_branch (or with
 *    no branch at all, for back-compat) merge into the vendored aggregate
 *    that Overview reads. Everything else is still fully recorded (so the
 *    Executions page can show it) but excluded from the shared numbers -
 *    see the plan's "branch-scoped main dashboard" decision.
 */
export async function processExecutionForProject(
  options: ProcessExecutionForProjectOptions,
): Promise<ProcessExecutionForProjectResult> {
  const historyLimit = options.historyLimit ?? DEFAULT_HISTORY_LIMIT

  const raw = readAllureResults(options.allureResultsDir)
  const executionId = options.executionId ?? String(raw.executor?.buildOrder ?? Date.now())
  const execution = buildExecutionSummary(raw, {
    executionId,
    executionName: options.executionName,
  })
  const features = buildFeatureSummaries(raw)
  const tests = buildTestSummaries(raw)
  const categories = buildCategorySummaries(raw)

  // Both already fully parsed by readAllureResults/parsePropertiesFile into
  // raw.environment - buildEnvironmentInfo keeps Branch but drops Suite
  // entirely (see processor/normalize.ts's allowlist), so suite is read
  // from the raw map here rather than from execution.environment.
  const suiteName = raw.environment.suite ?? raw.environment.Suite ?? 'Default'
  const branch = raw.environment.Branch ?? raw.environment.branch ?? null
  const suiteId = await resolveSuiteId(options.projectId, suiteName)

  const supabase = getServiceRoleClient()
  const { data: project } = await supabase
    .from('projects')
    .select('main_branch')
    .eq('id', options.projectId)
    .single()
  const mainBranch = project?.main_branch ?? 'main'
  const mergedIntoMainDashboard = !branch || branch === mainBranch

  const meta: ExecutionMeta = {
    suiteId,
    branch,
    executedByEmail: options.executedByEmail ?? null,
    mergedIntoMainDashboard,
    status: execution.status,
    total: execution.total,
    passed: execution.passed,
    failed: execution.failed,
    broken: execution.broken,
    skipped: execution.skipped,
    unknown: execution.unknown,
    passRate: execution.passRate,
    duration: execution.duration,
    date: execution.startTime,
  }

  const existingMeta = await loadExecutionsMetaFromDb(options.projectId)
  const existingTests = await loadExecutionTestsFromDb(options.projectId)
  const updatedMeta = trimToRecent({ ...existingMeta, [executionId]: meta }, META_RETENTION_LIMIT)
  const updatedTests = Object.fromEntries(
    Object.entries({ ...existingTests, [executionId]: tests }).filter(([id]) => id in updatedMeta),
  )

  if (mergedIntoMainDashboard) {
    const history = await loadHistoryFromDb(options.projectId)
    const mergedHistory = mergeExecutionHistory(history, execution, historyLimit)
    const comparison = computeComparison(mergedHistory.executions)

    const failureState = await loadFailureHistoryStateFromDb(options.projectId)
    const mergedFailureState = mergeFailureHistory(
      failureState,
      tests,
      execution.executionId,
      execution.startTime,
    )

    const data: DashboardData = {
      summary: {
        generatedAt: new Date().toISOString(),
        latestExecutionId: execution.executionId,
        current: execution,
        comparison,
      },
      executions: mergedHistory.executions,
      trends: mergedHistory.trends,
      features,
      tests,
      failures: mergedFailureState.failures,
      categories,
      environment: execution.environment ?? {},
    }

    await writeDashboardDataToDb(
      options.projectId,
      data,
      mergedFailureState.contributions,
      updatedMeta,
      updatedTests,
      raw.environment,
    )
  } else {
    // Non-main branch: record it (meta/tests above) but leave the vendored
    // aggregate - what Overview reads - completely untouched.
    await writeExecutionsMetaAndTests(options.projectId, updatedMeta, updatedTests)
  }

  // Unbounded ledger for the History page - every execution, regardless of
  // branch or the capped retention above (see supabase/migrations/0008_execution_log.sql).
  await appendExecutionLog(options.projectId, executionId, meta)

  return { execution, suiteId, branch, mergedIntoMainDashboard }
}
