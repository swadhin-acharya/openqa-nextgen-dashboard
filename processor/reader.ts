import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { TestStatus } from './models.js'

export interface AllureLabel {
  name: string
  value: string
}

export interface AllureStatusDetails {
  known?: boolean
  muted?: boolean
  flaky?: boolean
  message?: string
  trace?: string
}

export interface AllureStep {
  name: string
  status: TestStatus
  start?: number
  stop?: number
  steps?: AllureStep[]
  statusDetails?: AllureStatusDetails
  attachments?: { name: string; type: string; source: string }[]
}

export interface AllureResult {
  uuid: string
  historyId?: string
  testCaseId?: string
  fullName?: string
  name: string
  status: TestStatus
  stage?: string
  start?: number
  stop?: number
  labels?: AllureLabel[]
  statusDetails?: AllureStatusDetails
  steps?: AllureStep[]
  attachments?: { name: string; type: string; source: string }[]
}

export interface AllureExecutor {
  name?: string
  type?: string
  buildName?: string
  buildOrder?: number
  buildUrl?: string
}

export interface AllureCategory {
  name: string
  matchedStatuses?: TestStatus[]
  messageRegex?: string
  traceRegex?: string
}

export interface RawAllureData {
  /** Absolute path this data was read from - useful for error messages. */
  sourceDir: string
  results: AllureResult[]
  environment: Record<string, string>
  executor: AllureExecutor | null
  categories: AllureCategory[]
}

function label(result: AllureResult, name: string): string | undefined {
  return result.labels?.find((l) => l.name === name)?.value
}

export function getFeatureLabel(result: AllureResult): string {
  return label(result, 'feature') ?? label(result, 'suite') ?? 'Uncategorized'
}

export function getSeverityLabel(result: AllureResult): string | undefined {
  return label(result, 'severity')
}

function parsePropertiesFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {}
  const content = readFileSync(path, 'utf-8')
  const props: Record<string, string> = {}
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#') || line.startsWith('!')) continue
    const separatorIndex = line.search(/[:=]/)
    if (separatorIndex === -1) continue
    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1).trim()
    props[key] = value
  }
  return props
}

/**
 * Reads a raw allure-results directory (the output of any Allure adapter -
 * TestNG, JUnit, Cucumber, etc.) into an in-memory structure. This is the
 * ONLY place that touches the Allure file format directly; everything
 * downstream works with these typed structures.
 */
export function readAllureResults(dir: string): RawAllureData {
  if (!existsSync(dir)) {
    throw new Error(`allure-results directory not found: ${dir}`)
  }

  const files = readdirSync(dir)

  const results: AllureResult[] = files
    .filter((f: string) => f.endsWith('-result.json'))
    .map((f: string) => JSON.parse(readFileSync(join(dir, f), 'utf-8')) as AllureResult)
    // Container/hook-only fixtures aside, a valid Allure test result always
    // has a name and status - guard against stray/malformed files.
    .filter((r: AllureResult) => typeof r.name === 'string' && typeof r.status === 'string')

  const environment = parsePropertiesFile(join(dir, 'environment.properties'))

  const executorPath = join(dir, 'executor.json')
  const executor = existsSync(executorPath)
    ? (JSON.parse(readFileSync(executorPath, 'utf-8')) as AllureExecutor)
    : null

  const categoriesPath = join(dir, 'categories.json')
  const categories = existsSync(categoriesPath)
    ? (JSON.parse(readFileSync(categoriesPath, 'utf-8')) as AllureCategory[])
    : []

  return { sourceDir: dir, results, environment, executor, categories }
}
