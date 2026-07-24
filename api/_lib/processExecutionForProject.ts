import { readAllureResults } from '../../processor/reader.js'
import {
  buildExecutionSummary,
  buildFeatureSummaries,
  buildTestSummaries,
  buildCategorySummaries,
} from '../../processor/normalize.js'
import { mergeExecutionHistory, computeComparison, mergeFailureHistory } from '../../processor/history.js'
import type { DashboardData } from '../../processor/dashboard-data.js'
import { loadHistoryFromDb, loadFailureHistoryStateFromDb, writeDashboardDataToDb } from './history-db.js'

export interface ProcessExecutionForProjectOptions {
  projectId: string
  /** Directory containing *-result.json, environment.properties, etc. */
  allureResultsDir: string
  executionId?: string
  executionName?: string
  historyLimit?: number
}

const DEFAULT_HISTORY_LIMIT = 50

/**
 * The hosted-SaaS twin of processor/process.ts's processExecution: same call
 * order over the same pure functions, with only the load/write boundary
 * swapped from local JSON files (dataDir) to the project's Postgres
 * dashboard_data row. Keeping this call order identical is what guarantees
 * the numbers match the static product for the same allure-results input -
 * see processor/README.md and CLAUDE.md's "Allure is the single source of
 * truth, never build a competing result calculation" rule.
 */
export async function processExecutionForProject(
  options: ProcessExecutionForProjectOptions,
): Promise<DashboardData> {
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

  await writeDashboardDataToDb(options.projectId, data, mergedFailureState.contributions)

  return data
}
