import { Grid } from '@mui/material'
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import CancelRoundedIcon from '@mui/icons-material/CancelRounded'
import BuildRoundedIcon from '@mui/icons-material/BuildRounded'
import SkipNextRoundedIcon from '@mui/icons-material/SkipNextRounded'
import ShowChartRoundedIcon from '@mui/icons-material/ShowChartRounded'
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded'
import { KpiCard } from './KpiCard'
import { statusColors, chartPalette } from '../../theme/theme'
import { formatNumber, formatPercent, formatDuration } from '../../utils/format'
import type { SummaryData } from '../../../processor/models.js'

export function KpiCardsRow({ summary }: { summary: SummaryData }) {
  const { current, comparison } = summary

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, sm: 6, md: 12 / 7 }}>
        <KpiCard
          label="Total Tests"
          value={formatNumber(current.total)}
          icon={AssessmentRoundedIcon}
          color={chartPalette.duration}
          trend={
            comparison.total.available
              ? { value: comparison.total.value, direction: comparison.total.direction, goodDirection: 'up' }
              : null
          }
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 12 / 7 }}>
        <KpiCard
          label="Passed"
          value={formatNumber(current.passed)}
          icon={CheckCircleRoundedIcon}
          color={statusColors.passed}
          footerText={`${formatPercent((current.passed / current.total) * 100)} of total`}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 12 / 7 }}>
        <KpiCard
          label="Failed"
          value={formatNumber(current.failed)}
          icon={CancelRoundedIcon}
          color={statusColors.failed}
          footerText={`${formatPercent((current.failed / current.total) * 100)} of total`}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 12 / 7 }}>
        <KpiCard
          label="Broken"
          value={formatNumber(current.broken)}
          icon={BuildRoundedIcon}
          color={statusColors.broken}
          footerText={`${formatPercent((current.broken / current.total) * 100)} of total`}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 12 / 7 }}>
        <KpiCard
          label="Skipped"
          value={formatNumber(current.skipped)}
          icon={SkipNextRoundedIcon}
          color={statusColors.skipped}
          footerText={`${formatPercent((current.skipped / current.total) * 100)} of total`}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 12 / 7 }}>
        <KpiCard
          label="Pass Rate"
          value={formatPercent(current.passRate)}
          icon={ShowChartRoundedIcon}
          color={chartPalette.accent}
          trend={
            comparison.passRate.available
              ? { value: comparison.passRate.value, direction: comparison.passRate.direction, goodDirection: 'up' }
              : null
          }
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 12 / 7 }}>
        <KpiCard
          label="Duration"
          value={formatDuration(current.duration)}
          icon={AccessTimeRoundedIcon}
          color={chartPalette.duration}
          trend={
            comparison.duration.available
              ? { value: comparison.duration.value, direction: comparison.duration.direction, goodDirection: 'down' }
              : null
          }
        />
      </Grid>
    </Grid>
  )
}
