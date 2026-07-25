import { useNavigate } from 'react-router-dom'
import { Box, Typography, useTheme } from '@mui/material'
import { Stack } from '../components/FlexStack'
import { PageHeader } from '../components/layout/PageHeader'
import { StatusChip } from '../components/common/StatusChip'
import { LoadingState, ErrorState } from '../components/common/LoadingState'
import { useProject } from '../lib/ProjectContext'
import { useExecutionsList } from '../hooks/useExecutionsList'
import { statusColors } from '../theme/theme'
import { formatDateTime, formatDuration } from '../utils/format'

/**
 * v1 scope: a simple chronological strip, not a full Gantt/overlap
 * visualization - that's a real design project of its own, deliberately
 * trimmed rather than attempted and half-done.
 */
export default function ProjectTimelinePage() {
  const project = useProject()
  const navigate = useNavigate()
  const theme = useTheme()
  const { rows, loading, error } = useExecutionsList(project.projectId)

  return (
    <Stack>
      <PageHeader title="Timeline" subtitle="Every recorded execution, chronologically" />

      {loading && <LoadingState label="Loading timeline…" />}
      {!loading && error && <ErrorState label="Unable to load timeline data." />}

      {!loading && !error && rows.length === 0 && <Typography color="text.secondary">No executions recorded yet.</Typography>}

      {!loading && !error && rows.length > 0 && (
        <Stack sx={{ position: 'relative', pl: 3 }}>
          <Box sx={{ position: 'absolute', left: 5, top: 6, bottom: 6, width: '2px', bgcolor: theme.palette.divider }} />
          {rows.map((row) => (
            <Stack
              key={row.executionId}
              direction="row"
              spacing={2}
              sx={{ alignItems: 'flex-start', position: 'relative', pb: 2.5, cursor: 'pointer' }}
              onClick={() => navigate(`../executions/${row.executionId}`)}
            >
              <Box
                sx={{
                  position: 'absolute',
                  left: -23,
                  top: 4,
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  bgcolor: statusColors[row.status as keyof typeof statusColors] ?? statusColors.unknown,
                  border: `2px solid ${theme.palette.background.default}`,
                }}
              />
              <Box
                sx={{
                  flex: 1,
                  p: 1.75,
                  borderRadius: 2,
                  bgcolor: theme.customTokens.cardBackground,
                  '&:hover': { bgcolor: theme.customTokens.hoverBackground },
                }}
              >
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 0.5 }}>
                  <Typography sx={{ fontWeight: 700 }}>#{row.executionId}</Typography>
                  <StatusChip status={row.status} />
                  {!row.mergedIntoMainDashboard && (
                    <Typography variant="caption" color="text.secondary">
                      (not in main dashboard)
                    </Typography>
                  )}
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {formatDateTime(row.date)} · {row.suiteName} · {row.branch ?? 'no branch'} · {row.executedByName ?? row.executedByEmail ?? 'unknown'} ·{' '}
                  {formatDuration(row.duration)}
                </Typography>
              </Box>
            </Stack>
          ))}
        </Stack>
      )}
    </Stack>
  )
}
