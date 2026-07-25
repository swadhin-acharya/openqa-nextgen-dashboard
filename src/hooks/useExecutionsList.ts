import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { ExecutionMeta, ExecutionsMeta } from '../../api/_lib/history-db.js'

export interface ExecutionListRow extends Omit<ExecutionMeta, 'status'> {
  executionId: string
  suiteName: string
  /** "running" only ever comes from a live_executions row (Phase 10) - it's
   * not a real Allure test status, just a placeholder until the execution's
   * real, final status lands via a completed ingest. */
  status: ExecutionMeta['status'] | 'running'
  isLive?: boolean
}

export interface Suite {
  id: string
  name: string
}

interface FetchState {
  rows: ExecutionListRow[]
  suites: Suite[]
  loading: boolean
  error: string | null
}

interface LiveExecutionRow {
  execution_id: string
  branch: string | null
  executed_by_name: string | null
  started_at: string
  total: number
  passed: number
  failed: number
  broken: number
  skipped: number
}

function liveRowToListRow(row: LiveExecutionRow): ExecutionListRow {
  const finished = row.passed + row.failed + row.broken + row.skipped
  return {
    executionId: row.execution_id,
    status: 'running',
    isLive: true,
    suiteId: null,
    branch: row.branch,
    executedByName: row.executed_by_name,
    executedByEmail: null,
    mergedIntoMainDashboard: false,
    attempts: 1,
    total: row.total,
    passed: row.passed,
    failed: row.failed,
    broken: row.broken,
    skipped: row.skipped,
    unknown: 0,
    passRate: finished > 0 ? Math.round((row.passed / finished) * 10000) / 100 : 0,
    duration: 0,
    date: row.started_at,
    suiteName: 'Default',
  }
}

/**
 * Every recorded execution regardless of branch (executions_meta - see
 * api/_lib/processExecutionForProject.ts), not just the branch-scoped
 * subset in dashboard_data.executions that Overview reads, PLUS any
 * currently in-progress executions (live_executions - Phase 10) shown with
 * a "running" status ahead of the historical rows. A live row disappears
 * from here the moment its real, completed ingest lands (same executionId
 * now present in executions_meta - see clearLiveExecution in
 * api/_lib/liveExecution.ts), so there's no risk of double-listing it.
 */
export function useExecutionsList(projectId: string): FetchState {
  const [state, setState] = useState<FetchState>({ rows: [], suites: [], loading: true, error: null })

  useEffect(() => {
    let cancelled = false
    setState({ rows: [], suites: [], loading: true, error: null })

    async function load() {
      const [
        { data: dashboardRow, error: dashboardError },
        { data: suiteRows, error: suiteError },
        { data: liveRows },
      ] = await Promise.all([
        supabase.from('dashboard_data').select('executions_meta').eq('project_id', projectId).maybeSingle(),
        supabase.from('suites').select('id, name').eq('project_id', projectId),
        supabase
          .from('live_executions')
          .select('execution_id, branch, executed_by_name, started_at, total, passed, failed, broken, skipped')
          .eq('project_id', projectId),
      ])

      if (cancelled) return

      if (dashboardError || suiteError) {
        setState({ rows: [], suites: [], loading: false, error: (dashboardError ?? suiteError)?.message ?? 'Failed to load' })
        return
      }

      const suites = suiteRows ?? []
      const suiteNameById = new Map(suites.map((s) => [s.id, s.name]))
      const meta = (dashboardRow?.executions_meta as ExecutionsMeta | undefined) ?? {}

      const historicalRows: ExecutionListRow[] = Object.entries(meta).map(([executionId, m]) => ({
        executionId,
        ...m,
        suiteName: (m.suiteId && suiteNameById.get(m.suiteId)) || 'Default',
      }))

      const liveOnlyRows = ((liveRows ?? []) as LiveExecutionRow[])
        .filter((r) => !(r.execution_id in meta))
        .map(liveRowToListRow)

      const rows = [
        ...liveOnlyRows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        ...historicalRows.sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime()),
      ]

      setState({ rows, suites, loading: false, error: null })
    }

    load()

    const channel = supabase
      .channel(`executions-list-live-${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_executions', filter: `project_id=eq.${projectId}` },
        () => load(),
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [projectId])

  return state
}
