import { readAllureResults } from '../../processor/reader.js'
import type { RawAllureData } from '../../processor/reader.js'
import {
  buildExecutionSummary,
  buildFeatureSummaries,
  buildTestSummaries,
  buildCategorySummaries,
} from '../../processor/normalize.js'
import { mergeExecutionHistory, computeComparison, mergeFailureHistory } from '../../processor/history.js'
import type { FailureHistoryState } from '../../processor/history.js'
import type { DashboardData } from '../../processor/dashboard-data.js'
import type { ExecutionSummary } from '../../processor/models.js'
import {
  loadHistoryFromDb,
  loadFailureHistoryStateFromDb,
  loadExecutionsMetaFromDb,
  loadExecutionTestsFromDb,
  loadExecutionRawResultsFromDb,
  writeDashboardDataToDb,
  writeExecutionsMetaAndTests,
  type ExecutionMeta,
} from './history-db.js'
import { resolveSuiteId } from './suites.js'
import { appendExecutionLog } from './executionLog.js'
import { mergeRawResults } from './retryMerge.js'
import { getServiceRoleClient } from './db.js'
import { generateStandaloneReport } from './reportGenerator.js'
import { storeReportArtifact, markReportGenerationFailed } from './reportStorage.js'

export interface ProcessExecutionForProjectOptions {
  projectId: string
  /** Directory containing *-result.json, environment.properties, etc. */
  allureResultsDir: string
  executionId?: string
  executionName?: string
  executedByName?: string | null
  executedByEmail?: string | null
  historyLimit?: number
}

export interface ProcessExecutionForProjectResult {
  /** This run's own stats - always present, regardless of branch. After a
   * retry, this reflects the MERGED final state, not just this attempt. */
  execution: ExecutionSummary
  suiteId: string
  branch: string | null
  /** False when this execution's branch != the project's main_branch, so it
   * was recorded but excluded from the shared aggregate (see below). */
  mergedIntoMainDashboard: boolean
  /** True if executionId matched an already-recorded execution, so this
   * ingest's results were merged in as a retry rather than starting fresh. */
  isRetry: boolean
  attempts: number
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
 * Undoes whatever this executionId previously contributed to failure
 * history, before re-merging its (now-retried) results. Without this, a
 * test that flips from failed to passed via a retry would keep counting as
 * a failure occurrence from this same executionId forever - mergeFailureHistory
 * (processor/history.ts, unchanged/vendored) only ever adds occurrences, it
 * has no notion of a test "un-failing" on a later attempt of the same run.
 * Only ever called for executionIds that are actually being retried.
 */
function retractExecutionFromFailureHistory(state: FailureHistoryState, executionId: string): FailureHistoryState {
  const byTestId = new Map(state.failures.map((f) => [f.testId, { ...f }]))
  const contributions: Record<string, string[]> = {}

  for (const [testId, ids] of Object.entries(state.contributions)) {
    if (!ids.includes(executionId)) {
      contributions[testId] = ids
      continue
    }
    const remaining = ids.filter((id) => id !== executionId)
    if (remaining.length > 0) contributions[testId] = remaining

    const existing = byTestId.get(testId)
    if (existing) {
      existing.occurrences = Math.max(0, existing.occurrences - (ids.length - remaining.length))
      if (existing.occurrences <= 0) byTestId.delete(testId)
    }
  }

  return { failures: [...byTestId.values()], contributions }
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

  // A rerun of the same suite (same executionId as something already
  // recorded) merges test-by-test with the previous attempt - latest
  // attempt wins per test, anything not rerun is carried over unchanged -
  // rather than replacing the whole execution with just whatever subset of
  // tests this particular attempt happened to include. See retryMerge.ts.
  // The merge happens on raw Allure results (not the reduced TestSummary
  // shape) so the vendored build*Summaries functions below run completely
  // unchanged on the merged data - no vendored file needs to know this
  // feature exists.
  const existingRawResults = await loadExecutionRawResultsFromDb(options.projectId)
  const previousAttempt = existingRawResults[executionId]
  const isRetry = previousAttempt !== undefined
  const effectiveRaw: RawAllureData = isRetry
    ? { ...raw, results: mergeRawResults(previousAttempt, raw.results) }
    : raw

  const execution = buildExecutionSummary(effectiveRaw, {
    executionId,
    executionName: options.executionName,
  })
  const features = buildFeatureSummaries(effectiveRaw)
  const tests = buildTestSummaries(effectiveRaw)
  const categories = buildCategorySummaries(effectiveRaw)

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
    .select('name, main_branch')
    .eq('id', options.projectId)
    .single()
  const mainBranch = project?.main_branch ?? 'main'
  const mergedIntoMainDashboard = !branch || branch === mainBranch

  const existingMeta = await loadExecutionsMetaFromDb(options.projectId)
  const existingTests = await loadExecutionTestsFromDb(options.projectId)
  const attemptCount = (existingMeta[executionId]?.attempts ?? 0) + 1

  const meta: ExecutionMeta = {
    suiteId,
    branch,
    executedByName: options.executedByName ?? null,
    executedByEmail: options.executedByEmail ?? null,
    mergedIntoMainDashboard,
    attempts: attemptCount,
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

  const updatedMeta = trimToRecent({ ...existingMeta, [executionId]: meta }, META_RETENTION_LIMIT)
  const updatedTests = Object.fromEntries(
    Object.entries({ ...existingTests, [executionId]: tests }).filter(([id]) => id in updatedMeta),
  )
  const updatedRawResults = Object.fromEntries(
    Object.entries({ ...existingRawResults, [executionId]: effectiveRaw.results }).filter(([id]) => id in updatedMeta),
  )

  if (mergedIntoMainDashboard) {
    const history = await loadHistoryFromDb(options.projectId)
    const mergedHistory = mergeExecutionHistory(history, execution, historyLimit)
    const comparison = computeComparison(mergedHistory.executions)

    let failureState = await loadFailureHistoryStateFromDb(options.projectId)
    if (isRetry) failureState = retractExecutionFromFailureHistory(failureState, executionId)
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
      updatedRawResults,
    )
  } else {
    // Non-main branch: record it (meta/tests above) but leave the vendored
    // aggregate - what Overview reads - completely untouched.
    await writeExecutionsMetaAndTests(options.projectId, updatedMeta, updatedTests, updatedRawResults)
  }

  // Unbounded ledger for the History page - every execution, regardless of
  // branch or the capped retention above (see supabase/migrations/0008_execution_log.sql).
  await appendExecutionLog(options.projectId, executionId, meta)

  // Standalone HTML execution report - generated once, from the same
  // effectiveRaw data the vendored summaries above were built from, so it
  // can never diverge from what the dashboard itself shows. Every
  // execution gets one regardless of branch (it's a per-execution
  // artifact, independent of the branch-scoped aggregate). A generation
  // failure must never fail the ingest itself - see reportStorage.ts.
  try {
    const report = generateStandaloneReport({
      projectName: project?.name ?? 'Project',
      suiteName,
      executionId,
      branch,
      executedByName: options.executedByName ?? null,
      executedByEmail: options.executedByEmail ?? null,
      environment: raw.environment,
      raw: effectiveRaw,
      execution,
      categories,
      allureResultsDir: options.allureResultsDir,
    })
    await storeReportArtifact(options.projectId, executionId, report)
  } catch (err) {
    console.error('Standalone report generation failed', err)
    await markReportGenerationFailed(options.projectId, executionId)
  }

  return { execution, suiteId, branch, mergedIntoMainDashboard, isRetry, attempts: attemptCount }
}
