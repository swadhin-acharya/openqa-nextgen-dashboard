import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { ExecutionsMeta, ExecutionTestsMap } from '../../api/_lib/history-db.js'
import type { TestSummary } from '../../processor/models.js'

export interface ExecutionDetail {
  executionId: string
  meta: ExecutionsMeta[string] | null
  suiteName: string | null
  /** Null (not empty array) when this execution predates per-test retention
   * (Phase 4) - lets the page distinguish "no tests" from "detail unavailable". */
  tests: TestSummary[] | null
}

interface FetchState {
  data: ExecutionDetail | null
  loading: boolean
  error: string | null
}

export function useExecutionDetail(projectId: string, executionId: string): FetchState {
  const [state, setState] = useState<FetchState>({ data: null, loading: true, error: null })

  useEffect(() => {
    let cancelled = false
    setState({ data: null, loading: true, error: null })

    async function load() {
      const [{ data: dashboardRow, error: dashboardError }, { data: suiteRows, error: suiteError }] = await Promise.all([
        supabase
          .from('dashboard_data')
          .select('executions_meta, execution_tests')
          .eq('project_id', projectId)
          .maybeSingle(),
        supabase.from('suites').select('id, name').eq('project_id', projectId),
      ])

      if (cancelled) return

      if (dashboardError || suiteError) {
        setState({ data: null, loading: false, error: (dashboardError ?? suiteError)?.message ?? 'Failed to load' })
        return
      }

      const meta = ((dashboardRow?.executions_meta as ExecutionsMeta | undefined) ?? {})[executionId] ?? null
      const tests = ((dashboardRow?.execution_tests as ExecutionTestsMap | undefined) ?? {})[executionId] ?? null
      const suiteName = meta?.suiteId ? (suiteRows ?? []).find((s) => s.id === meta.suiteId)?.name ?? null : null

      setState({ data: { executionId, meta, suiteName, tests }, loading: false, error: null })
    }

    load()
    return () => {
      cancelled = true
    }
  }, [projectId, executionId])

  return state
}
