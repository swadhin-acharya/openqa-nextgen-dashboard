import { Grid } from '@mui/material'
import { Stack } from '../components/FlexStack'
import { PageHeader } from '../components/layout/PageHeader'
import { ResultsTrendChart } from '../components/overview/ResultsTrendChart'
import { DurationTrendChart } from '../components/overview/DurationTrendChart'
import { LoadingState, ErrorState } from '../components/common/LoadingState'
import { useProject } from '../lib/ProjectContext'
import { useProjectDashboardData } from '../hooks/useProjectDashboardData'

export default function ProjectTrendsPage() {
  const project = useProject()
  const { data, loading, error } = useProjectDashboardData(project.projectId)

  return (
    <Stack>
      <PageHeader title="Trends" subtitle="Results and duration over time, from the branch-scoped main dashboard history" />

      {loading && <LoadingState label="Loading trends…" />}
      {!loading && error && <ErrorState label="Unable to load trend data." />}

      {!loading && !error && (
        <Grid container spacing={2.5}>
          <Grid size={12}>
            <ResultsTrendChart data={data?.trends ?? []} />
          </Grid>
          <Grid size={12}>
            <DurationTrendChart data={data?.trends ?? []} />
          </Grid>
        </Grid>
      )}
    </Stack>
  )
}
