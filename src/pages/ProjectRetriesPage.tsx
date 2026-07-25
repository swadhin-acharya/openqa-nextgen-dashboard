import { useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { Stack } from '../components/FlexStack'
import { PageHeader } from '../components/layout/PageHeader'
import { SectionCard } from '../components/common/SectionCard'
import { StatusChip } from '../components/common/StatusChip'
import { LoadingState, ErrorState } from '../components/common/LoadingState'
import { useProject } from '../lib/ProjectContext'
import { useProjectDashboardData } from '../hooks/useProjectDashboardData'
import { formatDuration } from '../utils/format'

export default function ProjectRetriesPage() {
  const project = useProject()
  const { data, loading, error } = useProjectDashboardData(project.projectId)

  const flaky = useMemo(
    () => (data?.tests ?? []).filter((t) => (t.retries ?? 0) > 0).sort((a, b) => (b.retries ?? 0) - (a.retries ?? 0)),
    [data?.tests],
  )

  return (
    <Stack>
      <PageHeader title="Retries" subtitle="Tests that needed more than one attempt in the latest main-branch execution" />

      {loading && <LoadingState label="Loading retry data…" />}
      {!loading && error && <ErrorState label="Unable to load retry data." />}

      {!loading && !error && flaky.length === 0 && (
        <Typography color="text.secondary">No test needed a retry in the latest execution.</Typography>
      )}

      {!loading && !error && flaky.length > 0 && (
        <SectionCard title={`${flaky.length} tests with retries`} noPadding>
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 560 }}>
              <TableHead>
                <TableRow>
                  {['Test', 'Feature', 'Final Status', 'Duration', 'Retries'].map((h) => (
                    <TableCell key={h} sx={{ color: 'text.secondary', fontSize: '0.7rem', fontWeight: 700, letterSpacing: 0.4, border: 'none', pb: 1 }}>
                      {h.toUpperCase()}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {flaky.map((t) => (
                  <TableRow key={t.testId}>
                    <TableCell sx={{ fontWeight: 600 }}>{t.name}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{t.feature}</TableCell>
                    <TableCell>
                      <StatusChip status={t.status} />
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{formatDuration(t.duration)}</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{t.retries}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </SectionCard>
      )}
    </Stack>
  )
}
