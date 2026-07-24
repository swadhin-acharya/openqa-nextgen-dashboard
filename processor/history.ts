import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type {
  ExecutionSummary,
  RecentExecutionRow,
  TrendPoint,
  TestSummary,
  FailureSummary,
  ComparisonMetric,
} from './models.js'

export interface HistoryState {
  executions: RecentExecutionRow[] // newest first
  trends: TrendPoint[] // oldest first (chart order)
  failures: FailureSummary[]
}

function readJsonIfExists<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T
  } catch {
    // A corrupt/partial history file should never crash the whole pipeline -
    // start fresh rather than fail the build.
    return fallback
  }
}

export function loadHistory(dataDir: string): HistoryState {
  return {
    executions: readJsonIfExists<RecentExecutionRow[]>(join(dataDir, 'executions.json'), []),
    trends: readJsonIfExists<TrendPoint[]>(join(dataDir, 'trends.json'), []),
    failures: readJsonIfExists<FailureSummary[]>(join(dataDir, 'failures.json'), []),
  }
}

/**
 * Merges a newly-processed execution into persisted history, trimming to
 * historyLimit (default 50 per the project brief, section 29/41). Re-running
 * the processor for an executionId that's already present replaces that
 * entry in place rather than duplicating it, so reprocessing the same
 * allure-results directory is idempotent.
 */
export function mergeExecutionHistory(
  history: HistoryState,
  execution: ExecutionSummary,
  historyLimit: number,
): HistoryState {
  const row: RecentExecutionRow = {
    executionId: execution.executionId,
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

  const point: TrendPoint = {
    executionId: execution.executionId,
    date: execution.startTime,
    total: execution.total,
    passed: execution.passed,
    failed: execution.failed,
    broken: execution.broken,
    skipped: execution.skipped,
    passRate: execution.passRate,
    duration: execution.duration,
  }

  const executions = [row, ...history.executions.filter((e) => e.executionId !== execution.executionId)]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, historyLimit)

  const trends = [...history.trends.filter((t) => t.executionId !== execution.executionId), point]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-historyLimit)

  return { ...history, executions, trends }
}

/**
 * Computes "vs previous run" comparison metrics for the KPI cards. Per
 * project brief section 14: "Where comparison data is unavailable, don't
 * invent it" - so `available` is false (and the UI hides the delta) until
 * there are at least two executions in history.
 */
export function computeComparison(executions: RecentExecutionRow[]): SummaryComparison {
  const [current, previous] = executions
  if (!current || !previous) {
    const unavailable: ComparisonMetric = { value: 0, direction: 'flat', available: false }
    return { total: unavailable, passed: unavailable, failed: unavailable, passRate: unavailable, duration: unavailable }
  }

  const percentDelta = (curr: number, prev: number): ComparisonMetric => {
    if (prev === 0) return { value: 0, direction: 'flat', available: false }
    const delta = ((curr - prev) / prev) * 100
    return {
      value: Math.round(Math.abs(delta) * 100) / 100,
      direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
      available: true,
    }
  }

  const pointDelta = (curr: number, prev: number): ComparisonMetric => {
    const delta = curr - prev
    return {
      value: Math.round(Math.abs(delta) * 100) / 100,
      direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
      available: true,
    }
  }

  return {
    total: percentDelta(current.total, previous.total),
    passed: percentDelta(current.passed, previous.passed),
    failed: percentDelta(current.failed, previous.failed),
    passRate: pointDelta(current.passRate, previous.passRate),
    duration: percentDelta(current.duration, previous.duration),
  }
}

export interface SummaryComparison {
  total: ComparisonMetric
  passed: ComparisonMetric
  failed: ComparisonMetric
  passRate: ComparisonMetric
  duration: ComparisonMetric
}

/** Internal bookkeeping so reprocessing the same execution twice (e.g. a
 * re-run CI job) doesn't double-count its failures. Persisted alongside the
 * public failures.json but never itself exposed to the dashboard. */
export interface FailureHistoryState {
  failures: FailureSummary[]
  /** testId -> executionIds that have already contributed to its count. */
  contributions: Record<string, string[]>
}

export function loadFailureHistoryState(dataDir: string): FailureHistoryState {
  const failures = readJsonIfExists<FailureSummary[]>(join(dataDir, 'failures.json'), [])
  const contributions = readJsonIfExists<Record<string, string[]>>(
    join(dataDir, '.failures-contributions.json'),
    {},
  )
  return { failures, contributions }
}

/**
 * Merges this execution's failed/broken tests into the persisted top-failures
 * leaderboard (occurrence counts across history, per project brief section
 * 20 - "Calculate from historical Allure data"). Idempotent: reprocessing the
 * same executionId again will not inflate occurrence counts.
 */
export function mergeFailureHistory(
  state: FailureHistoryState,
  testSummaries: TestSummary[],
  executionId: string,
  executionDate: string,
  limit = 20,
): FailureHistoryState {
  const byTestId = new Map(state.failures.map((f) => [f.testId, { ...f }]))
  const contributions: Record<string, string[]> = Object.fromEntries(
    Object.entries(state.contributions).map(([testId, ids]) => [testId, [...ids]]),
  )

  for (const test of testSummaries) {
    if (test.status !== 'failed' && test.status !== 'broken') continue

    const alreadyContributed = contributions[test.testId]?.includes(executionId) ?? false
    const existing = byTestId.get(test.testId)

    if (existing) {
      existing.lastSeen = executionDate
      if (!alreadyContributed) existing.occurrences += 1
    } else {
      byTestId.set(test.testId, {
        testId: test.testId,
        name: test.name,
        feature: test.feature,
        occurrences: 1,
        lastSeen: executionDate,
      })
    }

    if (!alreadyContributed) {
      contributions[test.testId] = [...(contributions[test.testId] ?? []), executionId]
    }
  }

  const failures = [...byTestId.values()].sort((a, b) => b.occurrences - a.occurrences).slice(0, limit)
  return { failures, contributions }
}
