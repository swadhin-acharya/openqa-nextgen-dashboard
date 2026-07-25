import type { AllureResult } from '../../processor/reader.js'

/** historyId is Allure's own stable cross-run test identity; fullName/name
 * are fallbacks for results that somehow lack it (older Allure adapters). */
function resultKey(r: AllureResult): string {
  return r.historyId ?? r.fullName ?? r.name
}

/**
 * Merges a previous attempt's raw Allure results with a new attempt's, by
 * test identity - the new attempt's result for a given test wins (latest
 * attempt is authoritative, same semantics as Allure's own same-execution
 * retry collapsing in processor/normalize.ts's collapseRetries), any test
 * from the previous attempt that wasn't part of this rerun is carried over
 * unchanged, and any genuinely new test is appended.
 *
 * This is what makes a *partial* rerun (e.g. re-running only the tests that
 * failed last time) produce a complete, correct final picture instead of
 * silently dropping every test that wasn't rerun.
 */
export function mergeRawResults(previous: AllureResult[], current: AllureResult[]): AllureResult[] {
  const byKey = new Map(previous.map((r) => [resultKey(r), r] as const))
  for (const r of current) byKey.set(resultKey(r), r)
  return [...byKey.values()]
}
