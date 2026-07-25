import { useMemo, useState } from 'react'
import { Grid, Stack, Typography, Button } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { PageHeader } from '../components/layout/PageHeader'
import {
  ThemeToggleButton,
  LatestRunSelect,
  CompareButton,
  ShareButton,
  DateRangeFilter,
  type DateRange,
} from '../components/layout/HeaderActions'
import { KpiCardsRow } from '../components/overview/KpiCardsRow'
import { ResultsTrendChart } from '../components/overview/ResultsTrendChart'
import { ResultsDistributionChart } from '../components/overview/ResultsDistributionChart'
import { DurationTrendChart } from '../components/overview/DurationTrendChart'
import { RecentExecutionsTable } from '../components/overview/RecentExecutionsTable'
import { TopFailedTests } from '../components/overview/TopFailedTests'
import { CategoriesCard } from '../components/overview/CategoriesCard'
import { EnvironmentCard } from '../components/overview/EnvironmentCard'
import { FeatureHealthGrid } from '../components/overview/FeatureHealthGrid'
import { LoadingState, ErrorState } from '../components/common/LoadingState'
import { useProject } from '../lib/ProjectContext'
import { useProjectDashboardData } from '../hooks/useProjectDashboardData'
import { isWithinDateRange } from '../utils/format'

const EMPTY_RANGE: DateRange = { from: '', to: '' }

export default function ProjectOverviewPage() {
  const project = useProject()
  const { data, loading, error } = useProjectDashboardData(project.projectId)
  const summary = data?.summary
  const current = summary?.current
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_RANGE)

  // KPI cards intentionally keep showing the single latest run regardless of
  // this filter - only the historical trend/list views scope to the range
  // (see DateRangeFilter's doc comment in HeaderActions.tsx).
  const filteredTrends = useMemo(
    () => (data?.trends ?? []).filter((t) => isWithinDateRange(t.date, dateRange)),
    [data?.trends, dateRange],
  )
  const filteredExecutions = useMemo(
    () => (data?.executions ?? []).filter((e) => isWithinDateRange(e.date, dateRange)),
    [data?.executions, dateRange],
  )

  return (
    <Stack>
      <PageHeader
        title="Overview"
        subtitle="Summary of latest automation execution"
        actions={
          <>
            <DateRangeFilter value={dateRange} onChange={setDateRange} />
            {summary && <LatestRunSelect executionId={summary.latestExecutionId} />}
            <CompareButton />
            <ShareButton />
            <ThemeToggleButton />
          </>
        }
      />

      {loading && <LoadingState label="Loading latest automation execution…" />}
      {!loading && error && <ErrorState label="Unable to load dashboard data. Check that the project's ingestion has run." />}

      {!loading && !error && !current && (
        <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
          <Typography color="text.secondary">
            No test runs ingested yet. Generate a token from the Tokens page and POST allure-results to{' '}
            <code>/api/ingest</code>.
          </Typography>
          <Button component={RouterLink} to="tokens" variant="outlined" size="small">
            Go to Tokens
          </Button>
        </Stack>
      )}

      {!loading && !error && current && summary && (
        <Stack spacing={2.5}>
          <KpiCardsRow summary={summary} />

          {(dateRange.from || dateRange.to) && filteredTrends.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No executions fall within the selected date range - trend charts and Recent Executions below are empty.
              KPI cards above still reflect the latest run regardless of this filter.
            </Typography>
          )}

          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, lg: 4.5 }}>
              <ResultsTrendChart data={filteredTrends} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
              <ResultsDistributionChart current={current} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3.5 }}>
              <DurationTrendChart data={filteredTrends} />
            </Grid>
          </Grid>

          <Grid container spacing={2.5} sx={{ alignItems: 'stretch' }}>
            <Grid size={{ xs: 12, lg: 5 }}>
              <RecentExecutionsTable executions={filteredExecutions} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3.5 }}>
              <TopFailedTests failures={data?.failures ?? []} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3.5 }}>
              <Stack component="div" spacing={2.5}>
                <CategoriesCard categories={data?.categories ?? []} />
                <EnvironmentCard environment={data?.environment ?? null} />
              </Stack>
            </Grid>
          </Grid>

          <FeatureHealthGrid features={data?.features ?? []} />
        </Stack>
      )}
    </Stack>
  )
}
