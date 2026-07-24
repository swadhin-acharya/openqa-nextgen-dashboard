/**
 * Canonical data model produced by the processor.
 *
 * This intentionally mirrors ../../src/types/models.ts field-for-field.
 * The two are not import-linked because the frontend tsconfig (DOM lib,
 * bundler resolution) and this processor's tsconfig (plain Node, NodeNext
 * resolution) don't compose cleanly as one `tsc` project. Duplication is a
 * conscious tradeoff for now - if the two ever drift, the frontend simply
 * won't render fields the processor produces (a loud, easy-to-spot bug, not
 * a silent one). A future cleanup could hoist both into a shared package.
 */

export type TestStatus = 'passed' | 'failed' | 'broken' | 'skipped' | 'unknown'

export interface StatusCounts {
  total: number
  passed: number
  failed: number
  broken: number
  skipped: number
  unknown: number
}

export interface ComparisonMetric {
  value: number
  direction: 'up' | 'down' | 'flat'
  available: boolean
}

export interface DeviceInfo {
  deviceId?: string
  brand?: string
  model?: string
  androidVersion?: string
}

export interface EnvironmentInfo {
  os?: string
  java?: string
  platform?: string
  browser?: string
  framework?: string
  branch?: string
  build?: string
  machine?: string
  device?: DeviceInfo
}

export interface ExecutorInfo {
  name?: string
  type?: string
  buildName?: string
  buildOrder?: number
  branch?: string
  url?: string
}

export interface ExecutionSummary extends StatusCounts {
  executionId: string
  executionName: string
  status: TestStatus | 'mixed'
  startTime: string
  endTime: string
  duration: number
  passRate: number
  environment?: EnvironmentInfo
  executor?: ExecutorInfo
}

export interface SummaryData {
  generatedAt: string
  latestExecutionId: string
  current: ExecutionSummary
  comparison: {
    passed: ComparisonMetric
    failed: ComparisonMetric
    passRate: ComparisonMetric
    duration: ComparisonMetric
    total: ComparisonMetric
  }
}

export interface RecentExecutionRow extends StatusCounts {
  executionId: string
  status: TestStatus | 'mixed'
  passRate: number
  duration: number
  date: string
}

export interface TrendPoint {
  executionId: string
  date: string
  total: number
  passed: number
  failed: number
  broken: number
  skipped: number
  passRate: number
  duration: number
}

export interface FeatureSummary extends StatusCounts {
  featureId: string
  name: string
  passRate: number
}

export interface TestSummary extends StatusCounts {
  testId: string
  name: string
  feature: string
  status: TestStatus
  duration: number
  severity?: string
  historyId?: string
  retries?: number
}

export interface FailureSummary {
  testId: string
  name: string
  feature: string
  occurrences: number
  lastSeen: string
}

export interface CategorySummary {
  name: string
  count: number
  matchedStatuses?: TestStatus[]
}
