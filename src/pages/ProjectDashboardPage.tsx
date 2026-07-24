import { useEffect, useState } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Button,
  CircularProgress,
  Chip,
} from '@mui/material'
import { Stack } from '../components/FlexStack'
import { supabase } from '../lib/supabaseClient'
import { statusColors } from '../theme'
import type { DashboardData } from '../../processor/dashboard-data'

type LoadState =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'ready'; projectId: string; name: string; data: DashboardData | null }

function StatCard({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <Paper sx={{ p: 2.5, textAlign: 'center' }}>
      <Typography variant="h4" sx={{ fontWeight: 700, color }}>
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Paper>
  )
}

export default function ProjectDashboardPage() {
  const { slug } = useParams<{ slug: string }>()
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    async function load() {
      setState({ status: 'loading' })

      // RLS on public.projects scopes this to projects the caller is a
      // member of - a non-member querying a real slug gets zero rows here,
      // not the project's data (see supabase/migrations/0001_init.sql).
      const { data: project } = await supabase
        .from('projects')
        .select('id, name')
        .eq('slug', slug)
        .maybeSingle()

      if (cancelled) return
      if (!project) {
        setState({ status: 'not-found' })
        return
      }

      const { data: dashboardRow } = await supabase
        .from('dashboard_data')
        .select('summary, executions, trends, features, tests, failures, categories, environment')
        .eq('project_id', project.id)
        .maybeSingle()

      if (cancelled) return
      setState({
        status: 'ready',
        projectId: project.id,
        name: project.name,
        data: (dashboardRow as DashboardData | null) ?? null,
      })
    }

    load()
    return () => {
      cancelled = true
    }
  }, [slug])

  if (state.status === 'loading') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (state.status === 'not-found') {
    return (
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
          Not found
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          This project doesn't exist, or you're not a member of it.
        </Typography>
        <Button component={RouterLink} to="/" variant="outlined">
          Back to projects
        </Button>
      </Container>
    )
  }

  const current = state.data?.summary?.current

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          {state.name}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button component={RouterLink} to={`/${slug}/tokens`} variant="outlined" size="small">
            Tokens
          </Button>
          <Button component={RouterLink} to="/" variant="text" size="small">
            All projects
          </Button>
        </Stack>
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 4 }}>
        /{slug}
      </Typography>

      {!current && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No test runs ingested yet. Generate a token from the Tokens page and POST allure-results to{' '}
            <code>/api/ingest</code>.
          </Typography>
        </Paper>
      )}

      {current && (
        <>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 3 }}>
            <Chip label={`Execution ${current.executionId}`} size="small" />
            <Chip label={current.status} size="small" sx={{ textTransform: 'capitalize' }} />
          </Stack>
          <Grid container spacing={2}>
            <Grid size={4}>
              <StatCard label="Total" value={current.total} />
            </Grid>
            <Grid size={4}>
              <StatCard label="Pass rate" value={`${current.passRate}%`} color={statusColors.passed} />
            </Grid>
            <Grid size={4}>
              <StatCard label="Duration (ms)" value={current.duration} />
            </Grid>
            <Grid size={3}>
              <StatCard label="Passed" value={current.passed} color={statusColors.passed} />
            </Grid>
            <Grid size={3}>
              <StatCard label="Failed" value={current.failed} color={statusColors.failed} />
            </Grid>
            <Grid size={3}>
              <StatCard label="Broken" value={current.broken} color={statusColors.broken} />
            </Grid>
            <Grid size={3}>
              <StatCard label="Skipped" value={current.skipped} color={statusColors.skipped} />
            </Grid>
          </Grid>
        </>
      )}
    </Container>
  )
}
