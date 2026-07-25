import { useParams, Link as RouterLink } from 'react-router-dom'
import {
  Grid,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  CircularProgress,
  LinearProgress,
  Box,
} from '@mui/material'
import { Stack } from '../components/FlexStack'
import { PageHeader } from '../components/layout/PageHeader'
import { SectionCard } from '../components/common/SectionCard'
import { StatusChip } from '../components/common/StatusChip'
import { useProject } from '../lib/ProjectContext'
import { useExecutionDetail } from '../hooks/useExecutionDetail'
import { formatNumber, formatPercent, formatDuration, formatDateTime } from '../utils/format'

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Paper elevation={0} sx={{ p: 2, textAlign: 'center', borderRadius: 2.5 }}>
      <Typography sx={{ fontSize: '1.4rem', fontWeight: 700 }}>{value}</Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Paper>
  )
}

export default function ExecutionReportPage() {
  const project = useProject()
  const { executionId } = useParams<{ executionId: string }>()
  const { data, loading, error } = useExecutionDetail(project.projectId, executionId ?? '')
  const meta = data?.meta
  const live = data?.live

  return (
    <Stack>
      <PageHeader
        title={`Execution #${executionId}`}
        subtitle={
          meta
            ? `${data?.suiteName ?? 'Default'} · ${meta.branch ?? 'no branch'} · ${meta.date ? formatDateTime(meta.date) : 'unknown date'}`
            : live
              ? `${live.branch ?? 'no branch'} · started ${formatDateTime(live.startedAt)}`
              : undefined
        }
        actions={
          <Button component={RouterLink} to=".." variant="text" size="small">
            ← Executions
          </Button>
        }
      />

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={28} />
        </Box>
      )}
      {!loading && error && !live && <Typography color="text.secondary">This execution wasn't found.</Typography>}
      {!loading && !error && !meta && !live && (
        <Typography color="text.secondary">This execution wasn't found.</Typography>
      )}

      {!loading && !meta && live && (
        <Stack spacing={2.5}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <StatusChip status="running" />
            {live.executedByName && <Chip label={live.executedByName} size="small" variant="outlined" />}
          </Stack>

          <LinearProgress
            variant="determinate"
            value={live.total > 0 ? Math.min(100, ((live.passed + live.failed + live.broken + live.skipped) / live.total) * 100) : 0}
            sx={{ height: 6, borderRadius: 3 }}
          />

          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Stat label="Total" value={formatNumber(live.total)} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Stat label="Completed so far" value={formatNumber(live.passed + live.failed + live.broken + live.skipped)} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Stat label="Passed" value={formatNumber(live.passed)} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Stat label="Failed / Broken" value={`${live.failed} / ${live.broken}`} />
            </Grid>
          </Grid>

          <Typography variant="body2" color="text.secondary">
            This execution is still running - this page updates automatically as new results come in. It'll turn
            into the full report once the run finishes.
          </Typography>
        </Stack>
      )}

      {!loading && meta && (
        <Stack spacing={2.5}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <StatusChip status={meta.status} />
            {(meta.executedByName ?? meta.executedByEmail) && (
              <Chip label={meta.executedByName ?? meta.executedByEmail} size="small" variant="outlined" />
            )}
            {!meta.mergedIntoMainDashboard && (
              <Chip label="Not in main dashboard" size="small" sx={{ fontSize: '0.7rem' }} />
            )}
            {(meta.attempts ?? 1) > 1 && (
              <Chip
                label={`Retried · ${meta.attempts} attempts`}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.7rem' }}
              />
            )}
          </Stack>

          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Stat label="Total" value={formatNumber(meta.total ?? 0)} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Stat label="Pass Rate" value={formatPercent(meta.passRate ?? 0)} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Stat label="Duration" value={formatDuration(meta.duration ?? 0)} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Stat label="Passed / Failed / Broken" value={`${meta.passed ?? 0} / ${meta.failed ?? 0} / ${meta.broken ?? 0}`} />
            </Grid>
          </Grid>

          {data?.tests === null && (
            <Typography variant="body2" color="text.secondary">
              Per-test detail isn't available for this execution - it was ingested before test-level retention
              shipped. Aggregate stats above are still accurate.
            </Typography>
          )}

          {data?.tests && (
            <SectionCard title={`${data.tests.length} tests`} noPadding>
              <TableContainer sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 640 }}>
                  <TableHead>
                    <TableRow>
                      {['Test', 'Feature', 'Status', 'Duration', 'Retries'].map((h) => (
                        <TableCell key={h} sx={{ color: 'text.secondary', fontSize: '0.7rem', fontWeight: 700, letterSpacing: 0.4, border: 'none', pb: 1 }}>
                          {h.toUpperCase()}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.tests.map((t) => (
                      <TableRow key={t.testId}>
                        <TableCell sx={{ fontWeight: 600 }}>{t.name}</TableCell>
                        <TableCell sx={{ color: 'text.secondary' }}>{t.feature}</TableCell>
                        <TableCell>
                          <StatusChip status={t.status} />
                        </TableCell>
                        <TableCell sx={{ color: 'text.secondary' }}>{formatDuration(t.duration)}</TableCell>
                        <TableCell>{t.retries ?? 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </SectionCard>
          )}
        </Stack>
      )}
    </Stack>
  )
}
