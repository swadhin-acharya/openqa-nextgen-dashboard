import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { ExecutionMeta } from '../../api/_lib/history-db.js'

export interface ExecutionLogRow {
  executionId: string
  summary: ExecutionMeta
  createdAt: string
}

const PAGE_SIZE = 25

interface FetchState {
  rows: ExecutionLogRow[]
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  error: string | null
}

/**
 * Paginated - execution_log is an unbounded, append-only ledger (unlike
 * dashboard_data.executions_meta, which is capped - see
 * api/_lib/processExecutionForProject.ts), so History fetches a page at a
 * time rather than everything at once.
 */
export function useExecutionLog(projectId: string) {
  const [state, setState] = useState<FetchState>({ rows: [], loading: true, loadingMore: false, hasMore: true, error: null })

  useEffect(() => {
    let cancelled = false
    setState({ rows: [], loading: true, loadingMore: false, hasMore: true, error: null })

    supabase
      .from('execution_log')
      .select('execution_id, summary, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .range(0, PAGE_SIZE - 1)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setState({ rows: [], loading: false, loadingMore: false, hasMore: false, error: error.message })
          return
        }
        const rows = (data ?? []).map((r) => ({ executionId: r.execution_id, summary: r.summary as ExecutionMeta, createdAt: r.created_at }))
        setState({ rows, loading: false, loadingMore: false, hasMore: rows.length === PAGE_SIZE, error: null })
      })

    return () => {
      cancelled = true
    }
  }, [projectId])

  async function loadMore() {
    setState((s) => ({ ...s, loadingMore: true }))
    const { data, error } = await supabase
      .from('execution_log')
      .select('execution_id, summary, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .range(state.rows.length, state.rows.length + PAGE_SIZE - 1)

    if (error) {
      setState((s) => ({ ...s, loadingMore: false, error: error.message }))
      return
    }
    const newRows = (data ?? []).map((r) => ({ executionId: r.execution_id, summary: r.summary as ExecutionMeta, createdAt: r.created_at }))
    setState((s) => ({ rows: [...s.rows, ...newRows], loading: false, loadingMore: false, hasMore: newRows.length === PAGE_SIZE, error: null }))
  }

  return { ...state, loadMore }
}
