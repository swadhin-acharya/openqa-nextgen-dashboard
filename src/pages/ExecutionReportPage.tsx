import { useState } from 'react'
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
  Snackbar,
} from '@mui/material'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import { Stack } from '../components/FlexStack'
import { PageHeader } from '../components/layout/PageHeader'
import { SectionCard } from '../components/common/SectionCard'
import { StatusChip } from '../components/common/StatusChip'
import { useProject } from '../lib/ProjectContext'
import { useAuth } from '../lib/AuthContext'
import { useExecutionDetail } from '../hooks/useExecutionDetail'
import { formatNumber, formatPercent, formatDuration, formatDateTime } from '../utils/format'

async function fetchReportBlob(projectId: string, executionId: string, accessToken: string, download: boolean): Promise<Blob> {
  const res = await fetch(`/api/report?projectId=${projectId}&executionId=${executionId}${download ? '&download=true' : ''}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? 'Report not available')
  }
  return res.blob()
}

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
  const { session } = useAuth()
  const { executionId } = useParams<{ executionId: string }>()
  const { data, loading, error } = useExecutionDetail(project.projectId, executionId ?? '')
  const meta = data?.meta
  const live = data?.live
  const [reportError, setReportError] = useState<string | null>(null)
  const [reportBusy, setReportBusy] = useState<'view' | 'download' | null>(null)

  async function handleViewReport() {
    if (!session || !executionId) return
    // Open the tab synchronously, inside the click handler, before the
    // await below - browsers only treat window.open() as a real user
    // gesture (not a blocked popup) when it happens synchronously in the
    // same event handler that triggered it. Opening it after the fetch
    // resolves gets silently blocked with no console error.
    const newTab = window.open('', '_blank')
    setReportBusy('view')
    setReportError(null)
    try {
      const blob = await fetchReportBlob(project.projectId, executionId, session.access_token, false)
      if (newTab) newTab.location.href = URL.createObjectURL(blob)
    } catch (err) {
      newTab?.close()
      setReportError(err instanceof Error ? err.message : 'Report not available')
    } finally {
      setReportBusy(null)
    }
  }

  async function handleDownloadReport() {
    if (!session || !executionId) return
    setReportBusy('download')
    setReportError(null)
    try {
      const blob = await fetchReportBlob(project.projectId, executionId, session.access_token, true)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${project.slug}-${executionId}-report.html`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Report not available')
    } finally {
      setReportBusy(null)
    }
  }

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
          <>
            {meta && (
              <>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<DescriptionOutlinedIcon sx={{ fontSize: 16 }} />}
                  disabled={reportBusy !== null}
                  onClick={handleViewReport}
                >
                  {reportBusy === 'view' ? 'Opening…' : 'View Report'}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<DownloadRoundedIcon sx={{ fontSize: 16 }} />}
                  disabled={reportBusy !== null}
                  onClick={handleDownloadReport}
                >
                  {reportBusy === 'download' ? 'Downloading…' : 'Download HTML'}
                </Button>
              </>
            )}
            <Button component={RouterLink} to=".." variant="text" size="small">
              ← Executions
            </Button>
          </>
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

      <Snackbar
        open={!!reportError}
        autoHideDuration={3500}
        onClose={() => setReportError(null)}
        message={reportError}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Stack>
  )
}
