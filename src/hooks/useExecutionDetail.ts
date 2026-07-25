import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { ExecutionsMeta, ExecutionTestsMap } from '../../api/_lib/history-db.js'
import type { TestSummary } from '../../processor/models.js'

export interface LiveExecutionDetail {
  branch: string | null
  executedByName: string | null
  startedAt: string
  lastSeenAt: string
  total: number
  passed: number
  failed: number
  broken: number
  skipped: number
}

export interface ExecutionDetail {
  executionId: string
  meta: ExecutionsMeta[string] | null
  suiteName: string | null
  /** Null (not empty array) when this execution predates per-test retention
   * (Phase 4) - lets the page distinguish "no tests" from "detail unavailable". */
  tests: TestSummary[] | null
  /** Non-null only while this execution is still running and hasn't landed
   * a completed ingest yet (Phase 10) - meta is null in that case, since
   * there's nothing in executions_meta to find. */
  live: LiveExecutionDetail | null
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
      const [
        { data: dashboardRow, error: dashboardError },
        { data: suiteRows, error: suiteError },
        { data: liveRow },
      ] = await Promise.all([
        supabase
          .from('dashboard_data')
          .select('executions_meta, execution_tests')
          .eq('project_id', projectId)
          .maybeSingle(),
        supabase.from('suites').select('id, name').eq('project_id', projectId),
        supabase
          .from('live_executions')
          .select('branch, executed_by_name, started_at, last_seen_at, total, passed, failed, broken, skipped')
          .eq('project_id', projectId)
          .eq('execution_id', executionId)
          .maybeSingle(),
      ])

      if (cancelled) return

      if (dashboardError || suiteError) {
        setState({ data: null, loading: false, error: (dashboardError ?? suiteError)?.message ?? 'Failed to load' })
        return
      }

      const meta = ((dashboardRow?.executions_meta as ExecutionsMeta | undefined) ?? {})[executionId] ?? null
      const tests = ((dashboardRow?.execution_tests as ExecutionTestsMap | undefined) ?? {})[executionId] ?? null
      const suiteName = meta?.suiteId ? (suiteRows ?? []).find((s) => s.id === meta.suiteId)?.name ?? null : null
      const live: LiveExecutionDetail | null =
        !meta && liveRow
          ? {
              branch: liveRow.branch,
              executedByName: liveRow.executed_by_name,
              startedAt: liveRow.started_at,
              lastSeenAt: liveRow.last_seen_at,
              total: liveRow.total,
              passed: liveRow.passed,
              failed: liveRow.failed,
              broken: liveRow.broken,
              skipped: liveRow.skipped,
            }
          : null

      setState({ data: { executionId, meta, suiteName, tests, live }, loading: false, error: null })
    }

    load()

    // While this execution is still running, keep the page's counts fresh
    // and, once the live row disappears (the real ingest landed and cleared
    // it - see clearLiveExecution), refetch so the completed report renders.
    const channel = supabase
      .channel(`execution-detail-live-${projectId}-${executionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_executions',
          filter: `project_id=eq.${projectId}`,
        },
        () => load(),
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [projectId, executionId])

  return state
}
