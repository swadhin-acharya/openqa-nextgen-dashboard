import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { DashboardData } from '../../processor/dashboard-data.js'

interface FetchState {
  data: DashboardData | null
  loading: boolean
  error: string | null
}

const DASHBOARD_COLUMNS = 'summary, executions, trends, features, tests, failures, categories, environment'

/**
 * Single-query replacement for resideo-nextgen-dashboard's 7 useJsonData
 * hooks (useSummary/useExecutions/useFeatures/useFailures/useCategories/
 * useEnvironment/useTrends) - those each fetch a separate static JSON file
 * because the static product writes one file per field; here everything
 * already lives in one dashboard_data row (RLS-gated, see
 * "members read their project's dashboard data" policy), so one query
 * returns the whole DashboardData shape and callers slice what they need.
 */
export function useProjectDashboardData(projectId: string): FetchState {
  const [state, setState] = useState<FetchState>({ data: null, loading: true, error: null })

  useEffect(() => {
    let cancelled = false
    setState({ data: null, loading: true, error: null })

    supabase
      .from('dashboard_data')
      .select(DASHBOARD_COLUMNS)
      .eq('project_id', projectId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setState({ data: null, loading: false, error: error.message })
          return
        }
        setState({ data: (data as DashboardData | null) ?? null, loading: false, error: null })
      })

    return () => {
      cancelled = true
    }
  }, [projectId])

  return state
}
