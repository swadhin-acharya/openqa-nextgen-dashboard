import { useNavigate } from 'react-router-dom'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Typography,
  Box,
  CircularProgress,
} from '@mui/material'
import { Stack } from '../components/FlexStack'
import { PageHeader } from '../components/layout/PageHeader'
import { SectionCard } from '../components/common/SectionCard'
import { StatusChip } from '../components/common/StatusChip'
import { LoadingState, ErrorState } from '../components/common/LoadingState'
import { useProject } from '../lib/ProjectContext'
import { useExecutionLog } from '../hooks/useExecutionLog'
import { formatNumber, formatPercent, formatDuration, formatDateTime } from '../utils/format'

export default function ProjectHistoryPage() {
  const project = useProject()
  const navigate = useNavigate()
  const { rows, loading, loadingMore, hasMore, error, loadMore } = useExecutionLog(project.projectId)

  return (
    <Stack>
      <PageHeader title="History" subtitle="The complete execution ledger, never trimmed - unlike Executions' recent window" />

      {loading && <LoadingState label="Loading history…" />}
      {!loading && error && <ErrorState label="Unable to load history." />}

      {!loading && !error && rows.length === 0 && <Typography color="text.secondary">No executions recorded yet.</Typography>}

      {!loading && !error && rows.length > 0 && (
        <>
          <SectionCard title={`${rows.length}${hasMore ? '+' : ''} executions`} noPadding>
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 640 }}>
                <TableHead>
                  <TableRow>
                    {['Execution', 'Status', 'Tests', 'Pass Rate', 'Duration', 'Date'].map((h) => (
                      <TableCell key={h} sx={{ color: 'text.secondary', fontSize: '0.7rem', fontWeight: 700, letterSpacing: 0.4, border: 'none', pb: 1 }}>
                        {h.toUpperCase()}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.executionId} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`../executions/${row.executionId}`)}>
                      <TableCell sx={{ fontWeight: 700 }}>#{row.executionId}</TableCell>
                      <TableCell>
                        <StatusChip status={row.summary.status} />
                      </TableCell>
                      <TableCell>{formatNumber(row.summary.total ?? 0)}</TableCell>
                      <TableCell>{formatPercent(row.summary.passRate ?? 0)}</TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>{formatDuration(row.summary.duration ?? 0)}</TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>{formatDateTime(row.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </SectionCard>

          {hasMore && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2.5 }}>
              <Button variant="outlined" size="small" disabled={loadingMore} onClick={loadMore}>
                {loadingMore ? <CircularProgress size={16} /> : 'Load more'}
              </Button>
            </Box>
          )}
        </>
      )}
    </Stack>
  )
}
