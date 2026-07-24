import type { RawAllureData, AllureResult } from './reader.js'
import { getFeatureLabel, getSeverityLabel } from './reader.js'
import type {
  ExecutionSummary,
  FeatureSummary,
  TestSummary,
  CategorySummary,
  EnvironmentInfo,
  ExecutorInfo,
  StatusCounts,
  TestStatus,
} from './models.js'

const EMPTY_COUNTS: StatusCounts = { total: 0, passed: 0, failed: 0, broken: 0, skipped: 0, unknown: 0 }

function isKnownStatus(status: string): status is TestStatus {
  return status === 'passed' || status === 'failed' || status === 'broken' || status === 'skipped' || status === 'unknown'
}

function normalizeStatus(status: string): TestStatus {
  return isKnownStatus(status) ? status : 'unknown'
}

export function tallyStatuses(results: { status: string }[]): StatusCounts {
  const counts = { ...EMPTY_COUNTS }
  for (const r of results) {
    const status = normalizeStatus(r.status)
    counts[status] += 1
    counts.total += 1
  }
  return counts
}

export function passRateOf(counts: StatusCounts): number {
  if (counts.total === 0) return 0
  return Math.round((counts.passed / counts.total) * 10000) / 100
}

/**
 * Collapses a set of Allure results into an overall execution status.
 * "mixed" only appears if, for some reason, the caller passes zero results
 * (never happens in practice - a real run always has at least one result).
 */
function overallStatus(counts: StatusCounts): TestStatus | 'mixed' {
  if (counts.total === 0) return 'mixed'
  if (counts.failed > 0) return 'failed'
  if (counts.broken > 0) return 'broken'
  if (counts.skipped > 0 && counts.passed === counts.total - counts.skipped) return 'passed'
  if (counts.passed === counts.total) return 'passed'
  return 'mixed'
}

/**
 * Deduplicates results that share a historyId, keeping only the
 * chronologically last attempt as "the" result and counting the rest as
 * retries. This is how Allure represents reruns of the same scenario
 * within a single execution (see the sample project's rerun notes).
 */
function collapseRetries(results: AllureResult[]): { finalResults: AllureResult[]; retriesByHistoryId: Map<string, number> } {
  const byHistoryId = new Map<string, AllureResult[]>()
  const noHistoryId: AllureResult[] = []

  for (const result of results) {
    if (!result.historyId) {
      noHistoryId.push(result)
      continue
    }
    const bucket = byHistoryId.get(result.historyId) ?? []
    bucket.push(result)
    byHistoryId.set(result.historyId, bucket)
  }

  const finalResults: AllureResult[] = [...noHistoryId]
  const retriesByHistoryId = new Map<string, number>()

  for (const [historyId, attempts] of byHistoryId) {
    const sorted = [...attempts].sort((a, b) => (a.stop ?? 0) - (b.stop ?? 0))
    finalResults.push(sorted[sorted.length - 1])
    retriesByHistoryId.set(historyId, sorted.length - 1)
  }

  return { finalResults, retriesByHistoryId }
}

export interface BuildExecutionOptions {
  executionId: string
  executionName?: string
}

export function buildExecutionSummary(raw: RawAllureData, options: BuildExecutionOptions): ExecutionSummary {
  const { finalResults } = collapseRetries(raw.results)
  const counts = tallyStatuses(finalResults)

  const starts = finalResults.map((r) => r.start).filter((n): n is number => typeof n === 'number')
  const stops = finalResults.map((r) => r.stop).filter((n): n is number => typeof n === 'number')
  const startMs = starts.length ? Math.min(...starts) : Date.now()
  const stopMs = stops.length ? Math.max(...stops) : startMs

  return {
    executionId: options.executionId,
    executionName: options.executionName ?? `Execution #${options.executionId}`,
    status: overallStatus(counts),
    startTime: new Date(startMs).toISOString(),
    endTime: new Date(stopMs).toISOString(),
    duration: Math.max(0, stopMs - startMs),
    passRate: passRateOf(counts),
    environment: buildEnvironmentInfo(raw.environment),
    executor: buildExecutorInfo(raw.executor),
    ...counts,
  }
}

export function buildEnvironmentInfo(env: Record<string, string>): EnvironmentInfo | undefined {
  if (Object.keys(env).length === 0) return undefined
  return {
    os: env.OS,
    java: env.Java,
    platform: env.Platform,
    browser: env.Browser,
    framework: env.Framework,
    branch: env.Branch,
    build: env.Build,
    machine: env.Machine,
  }
}

export function buildExecutorInfo(executor: RawAllureData['executor']): ExecutorInfo | undefined {
  if (!executor) return undefined
  return {
    name: executor.name,
    type: executor.type,
    buildName: executor.buildName,
    buildOrder: executor.buildOrder,
    url: executor.buildUrl,
  }
}

export function buildFeatureSummaries(raw: RawAllureData): FeatureSummary[] {
  const { finalResults } = collapseRetries(raw.results)
  const byFeature = new Map<string, AllureResult[]>()

  for (const result of finalResults) {
    const feature = getFeatureLabel(result)
    const bucket = byFeature.get(feature) ?? []
    bucket.push(result)
    byFeature.set(feature, bucket)
  }

  return [...byFeature.entries()]
    .map(([name, results]) => {
      const counts = tallyStatuses(results)
      return {
        featureId: slugify(name),
        name,
        passRate: passRateOf(counts),
        ...counts,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function buildTestSummaries(raw: RawAllureData): TestSummary[] {
  const { finalResults, retriesByHistoryId } = collapseRetries(raw.results)

  return finalResults.map((result) => ({
    testId: result.historyId ?? result.uuid,
    name: result.name,
    feature: getFeatureLabel(result),
    status: normalizeStatus(result.status),
    duration: (result.stop ?? 0) - (result.start ?? 0),
    severity: getSeverityLabel(result),
    historyId: result.historyId,
    retries: result.historyId ? retriesByHistoryId.get(result.historyId) ?? 0 : 0,
    total: 1,
    passed: result.status === 'passed' ? 1 : 0,
    failed: result.status === 'failed' ? 1 : 0,
    broken: result.status === 'broken' ? 1 : 0,
    skipped: result.status === 'skipped' ? 1 : 0,
    unknown: isKnownStatus(result.status) ? 0 : 1,
  }))
}

function extractExceptionClass(trace?: string): string | null {
  if (!trace) return null
  const match = trace.match(/([\w.$]+(?:Exception|Error))/)
  return match ? match[1].split('.').pop() ?? match[1] : null
}

/**
 * Categorizes failed/broken results. If the project ships a categories.json
 * (custom Resideo rules, see project brief section 21), those regex rules
 * are used. Otherwise falls back to grouping by the thrown exception's
 * class name, which is always derivable from Allure's statusDetails.trace
 * and never fabricated.
 */
export function buildCategorySummaries(raw: RawAllureData): CategorySummary[] {
  const { finalResults } = collapseRetries(raw.results)
  const defective = finalResults.filter((r) => r.status === 'failed' || r.status === 'broken' || r.status === 'unknown')

  if (raw.categories.length > 0) {
    const counts = new Map<string, { count: number; matchedStatuses: Set<TestStatus> }>()
    for (const rule of raw.categories) {
      counts.set(rule.name, { count: 0, matchedStatuses: new Set(rule.matchedStatuses ?? []) })
    }

    for (const result of defective) {
      const trace = result.statusDetails?.trace ?? ''
      const message = result.statusDetails?.message ?? ''
      for (const rule of raw.categories) {
        const statusOk = !rule.matchedStatuses || rule.matchedStatuses.includes(normalizeStatus(result.status))
        if (!statusOk) continue
        const traceOk = !rule.traceRegex || new RegExp(rule.traceRegex).test(trace)
        const messageOk = !rule.messageRegex || new RegExp(rule.messageRegex).test(message)
        if (traceOk && messageOk) {
          const entry = counts.get(rule.name)!
          entry.count += 1
          break // first matching rule wins, mirroring Allure's own category matching
        }
      }
    }

    return [...counts.entries()]
      .filter(([, v]) => v.count > 0)
      .map(([name, v]) => ({ name, count: v.count, matchedStatuses: [...v.matchedStatuses] }))
      .sort((a, b) => b.count - a.count)
  }

  // Fallback: group by exception class name.
  const byException = new Map<string, number>()
  for (const result of defective) {
    const exceptionName = extractExceptionClass(result.statusDetails?.trace) ?? 'Unknown Failure'
    byException.set(exceptionName, (byException.get(exceptionName) ?? 0) + 1)
  }
  return [...byException.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}
