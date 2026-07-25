import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  LinearProgress,
  Box,
  Typography,
  alpha,
} from '@mui/material'
import { Stack } from '../components/FlexStack'
import { PageHeader } from '../components/layout/PageHeader'
import { SectionCard } from '../components/common/SectionCard'
import { LoadingState, ErrorState } from '../components/common/LoadingState'
import { useProject } from '../lib/ProjectContext'
import { useProjectDashboardData } from '../hooks/useProjectDashboardData'
import { statusColors } from '../theme/theme'
import { formatNumber, formatPercent } from '../utils/format'

function healthColor(passRate: number) {
  if (passRate >= 90) return statusColors.passed
  if (passRate >= 70) return statusColors.skipped
  return statusColors.failed
}

type SortKey = 'name' | 'total' | 'passRate'

export default function ProjectFeaturesPage() {
  const project = useProject()
  const navigate = useNavigate()
  const { data, loading, error } = useProjectDashboardData(project.projectId)
  const [sortKey, setSortKey] = useState<SortKey>('passRate')
  const [sortAsc, setSortAsc] = useState(true)

  const features = useMemo(() => {
    const list = [...(data?.features ?? [])]
    list.sort((a, b) => {
      const dir = sortAsc ? 1 : -1
      if (sortKey === 'name') return a.name.localeCompare(b.name) * dir
      return (a[sortKey] - b[sortKey]) * dir
    })
    return list
  }, [data?.features, sortKey, sortAsc])

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortAsc((v) => !v)
    else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  return (
    <Stack>
      <PageHeader title="Features" subtitle="Pass rate by feature, from the latest main-branch execution" />

      {loading && <LoadingState label="Loading features…" />}
      {!loading && error && <ErrorState label="Unable to load feature data." />}

      {!loading && !error && features.length === 0 && (
        <Typography color="text.secondary">No features recorded yet.</Typography>
      )}

      {!loading && !error && features.length > 0 && (
        <SectionCard title={`${features.length} features`} noPadding>
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 520 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ border: 'none', pb: 1 }}>
                    <TableSortLabel active={sortKey === 'name'} direction={sortAsc ? 'asc' : 'desc'} onClick={() => handleSort('name')}>
                      <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.4 }}>
                        FEATURE
                      </Typography>
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ border: 'none', pb: 1 }}>
                    <TableSortLabel active={sortKey === 'total'} direction={sortAsc ? 'asc' : 'desc'} onClick={() => handleSort('total')}>
                      <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.4 }}>
                        TESTS
                      </Typography>
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ border: 'none', pb: 1, minWidth: 200 }}>
                    <TableSortLabel active={sortKey === 'passRate'} direction={sortAsc ? 'asc' : 'desc'} onClick={() => handleSort('passRate')}>
                      <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.4 }}>
                        PASS RATE
                      </Typography>
                    </TableSortLabel>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {features.map((f) => {
                  const color = healthColor(f.passRate)
                  return (
                    <TableRow
                      key={f.featureId}
                      hover
                      onClick={() => navigate(`../tests?feature=${encodeURIComponent(f.name)}`)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell sx={{ fontWeight: 700 }}>{f.name}</TableCell>
                      <TableCell>{formatNumber(f.total)}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                          <Box sx={{ flex: 1, maxWidth: 140 }}>
                            <LinearProgress
                              variant="determinate"
                              value={f.passRate}
                              sx={{
                                height: 5,
                                borderRadius: 3,
                                bgcolor: alpha(color, 0.15),
                                '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 },
                              }}
                            />
                          </Box>
                          <Typography variant="body2" sx={{ fontWeight: 700, color }}>
                            {formatPercent(f.passRate, f.passRate % 1 === 0 ? 0 : 1)}
                          </Typography>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </SectionCard>
      )}
    </Stack>
  )
}
