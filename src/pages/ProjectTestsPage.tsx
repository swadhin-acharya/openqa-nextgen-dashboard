import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Select,
  MenuItem,
  TextField,
  Typography,
  type SelectChangeEvent,
} from '@mui/material'
import { Stack } from '../components/FlexStack'
import { PageHeader } from '../components/layout/PageHeader'
import { SectionCard } from '../components/common/SectionCard'
import { StatusChip } from '../components/common/StatusChip'
import { LoadingState, ErrorState } from '../components/common/LoadingState'
import { useProject } from '../lib/ProjectContext'
import { useProjectDashboardData } from '../hooks/useProjectDashboardData'
import { formatDuration } from '../utils/format'

const ALL = '__all__'

export default function ProjectTestsPage() {
  const project = useProject()
  const { data, loading, error } = useProjectDashboardData(project.projectId)
  const [searchParams, setSearchParams] = useSearchParams()

  const featureFilter = searchParams.get('feature') ?? ALL
  const [statusFilter, setStatusFilter] = useState(ALL)
  const [severityFilter, setSeverityFilter] = useState(ALL)
  const [search, setSearch] = useState('')

  const tests = data?.tests ?? []
  const features = useMemo(() => [...new Set(tests.map((t) => t.feature))].sort(), [tests])
  const severities = useMemo(
    () => [...new Set(tests.map((t) => t.severity).filter((s): s is string => !!s))].sort(),
    [tests],
  )

  const filtered = tests.filter((t) => {
    if (featureFilter !== ALL && t.feature !== featureFilter) return false
    if (statusFilter !== ALL && t.status !== statusFilter) return false
    if (severityFilter !== ALL && t.severity !== severityFilter) return false
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <Stack>
      <PageHeader title="Tests" subtitle="Every test from the latest main-branch execution" />

      {loading && <LoadingState label="Loading tests…" />}
      {!loading && error && <ErrorState label="Unable to load test data." />}

      {!loading && !error && (
        <>
          <Stack direction="row" spacing={1.5} sx={{ mb: 2.5, flexWrap: 'wrap' }}>
            <TextField size="small" placeholder="Search tests…" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 200 }} />
            <Select
              size="small"
              value={featureFilter}
              onChange={(e: SelectChangeEvent) => setSearchParams(e.target.value === ALL ? {} : { feature: e.target.value })}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value={ALL}>All features</MenuItem>
              {features.map((f) => (
                <MenuItem key={f} value={f}>
                  {f}
                </MenuItem>
              ))}
            </Select>
            <Select size="small" value={statusFilter} onChange={(e: SelectChangeEvent) => setStatusFilter(e.target.value)} sx={{ minWidth: 140 }}>
              <MenuItem value={ALL}>All statuses</MenuItem>
              {['passed', 'failed', 'broken', 'skipped', 'unknown'].map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </Select>
            {severities.length > 0 && (
              <Select size="small" value={severityFilter} onChange={(e: SelectChangeEvent) => setSeverityFilter(e.target.value)} sx={{ minWidth: 140 }}>
                <MenuItem value={ALL}>All severities</MenuItem>
                {severities.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </Select>
            )}
          </Stack>

          {filtered.length === 0 && <Typography color="text.secondary">No tests match these filters.</Typography>}

          {filtered.length > 0 && (
            <SectionCard title={`${filtered.length} of ${tests.length} tests`} noPadding>
              <TableContainer sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 640 }}>
                  <TableHead>
                    <TableRow>
                      {['Test', 'Feature', 'Status', 'Severity', 'Duration', 'Retries'].map((h) => (
                        <TableCell key={h} sx={{ color: 'text.secondary', fontSize: '0.7rem', fontWeight: 700, letterSpacing: 0.4, border: 'none', pb: 1 }}>
                          {h.toUpperCase()}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filtered.map((t) => (
                      <TableRow key={t.testId}>
                        <TableCell sx={{ fontWeight: 600 }}>{t.name}</TableCell>
                        <TableCell sx={{ color: 'text.secondary' }}>{t.feature}</TableCell>
                        <TableCell>
                          <StatusChip status={t.status} />
                        </TableCell>
                        <TableCell sx={{ color: 'text.secondary' }}>{t.severity ?? '—'}</TableCell>
                        <TableCell sx={{ color: 'text.secondary' }}>{formatDuration(t.duration)}</TableCell>
                        <TableCell>{t.retries ?? 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </SectionCard>
          )}
        </>
      )}
    </Stack>
  )
}
