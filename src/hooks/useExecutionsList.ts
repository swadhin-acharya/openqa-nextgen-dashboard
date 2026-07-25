import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { ExecutionMeta, ExecutionsMeta } from '../../api/_lib/history-db.js'

export interface ExecutionListRow extends ExecutionMeta {
  executionId: string
  suiteName: string
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

/**
 * Every recorded execution regardless of branch (executions_meta - see
 * api/_lib/processExecutionForProject.ts), not just the branch-scoped
 * subset in dashboard_data.executions that Overview reads. This is what
 * lets the Executions page show everything while Overview stays
 * branch-scoped to the project's main_branch.
 */
export function useExecutionsList(projectId: string): FetchState {
  const [state, setState] = useState<FetchState>({ rows: [], suites: [], loading: true, error: null })

  useEffect(() => {
    let cancelled = false
    setState({ rows: [], suites: [], loading: true, error: null })

    async function load() {
      const [{ data: dashboardRow, error: dashboardError }, { data: suiteRows, error: suiteError }] = await Promise.all([
        supabase.from('dashboard_data').select('executions_meta').eq('project_id', projectId).maybeSingle(),
        supabase.from('suites').select('id, name').eq('project_id', projectId),
      ])

      if (cancelled) return

      if (dashboardError || suiteError) {
        setState({ rows: [], suites: [], loading: false, error: (dashboardError ?? suiteError)?.message ?? 'Failed to load' })
        return
      }

      const suites = suiteRows ?? []
      const suiteNameById = new Map(suites.map((s) => [s.id, s.name]))
      const meta = (dashboardRow?.executions_meta as ExecutionsMeta | undefined) ?? {}

      const rows = Object.entries(meta)
        .map(([executionId, m]) => ({
          executionId,
          ...m,
          suiteName: (m.suiteId && suiteNameById.get(m.suiteId)) || 'Default',
        }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

      setState({ rows, suites, loading: false, error: null })
    }

    load()
    return () => {
      cancelled = true
    }
  }, [projectId])

  return state
}
