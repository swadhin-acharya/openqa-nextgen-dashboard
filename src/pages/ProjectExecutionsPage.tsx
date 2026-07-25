import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Chip,
  Tooltip,
  CircularProgress,
  Box,
  type SelectChangeEvent,
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import { Stack } from '../components/FlexStack'
import { PageHeader } from '../components/layout/PageHeader'
import { SectionCard } from '../components/common/SectionCard'
import { StatusChip } from '../components/common/StatusChip'
import { useProject } from '../lib/ProjectContext'
import { useExecutionsList } from '../hooks/useExecutionsList'
import { supabase } from '../lib/supabaseClient'
import { formatNumber, formatPercent, formatDuration, formatDateTime } from '../utils/format'

const ALL = '__all__'

export default function ProjectExecutionsPage() {
  const project = useProject()
  const navigate = useNavigate()
  const { rows, suites, loading, error } = useExecutionsList(project.projectId)

  const [suiteFilter, setSuiteFilter] = useState(ALL)
  const [executorFilter, setExecutorFilter] = useState(ALL)
  const [branchFilter, setBranchFilter] = useState(ALL)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newSuiteName, setNewSuiteName] = useState('')
  const [creatingSuite, setCreatingSuite] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const executorName = (r: (typeof rows)[number]) => r.executedByName ?? r.executedByEmail

  const executors = useMemo(
    () => [...new Set(rows.map(executorName).filter((e): e is string => !!e))].sort(),
    [rows],
  )
  const branches = useMemo(() => [...new Set(rows.map((r) => r.branch).filter((b): b is string => !!b))].sort(), [rows])

  const filteredRows = rows.filter((r) => {
    if (suiteFilter !== ALL && r.suiteName !== suiteFilter) return false
    if (executorFilter !== ALL && executorName(r) !== executorFilter) return false
    if (branchFilter !== ALL && r.branch !== branchFilter) return false
    return true
  })

  async function handleCreateSuite() {
    if (!newSuiteName.trim()) return
    setCreatingSuite(true)
    await supabase.from('suites').insert({ project_id: project.projectId, name: newSuiteName.trim() })
    setCreatingSuite(false)
    setNewSuiteName('')
    setDialogOpen(false)
    setRefreshKey((k) => k + 1)
  }

  return (
    <Stack key={refreshKey}>
      <PageHeader
        title="Executions"
        subtitle="Every recorded execution, including runs excluded from the main dashboard"
        actions={
          <Button size="small" startIcon={<AddRoundedIcon sx={{ fontSize: 16 }} />} onClick={() => setDialogOpen(true)}>
            New suite
          </Button>
        }
      />

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={28} />
        </Box>
      )}
      {!loading && error && <Typography color="error.main">{error}</Typography>}

      {!loading && !error && (
        <>
          <Stack direction="row" spacing={1.5} sx={{ mb: 2.5 }}>
            <Select size="small" value={suiteFilter} onChange={(e: SelectChangeEvent) => setSuiteFilter(e.target.value)} sx={{ minWidth: 160 }}>
              <MenuItem value={ALL}>All suites</MenuItem>
              {suites.map((s) => (
                <MenuItem key={s.id} value={s.name}>
                  {s.name}
                </MenuItem>
              ))}
            </Select>
            <Select
              size="small"
              value={executorFilter}
              onChange={(e: SelectChangeEvent) => setExecutorFilter(e.target.value)}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value={ALL}>All executors</MenuItem>
              {executors.map((e) => (
                <MenuItem key={e} value={e}>
                  {e}
                </MenuItem>
              ))}
            </Select>
            <Select size="small" value={branchFilter} onChange={(e: SelectChangeEvent) => setBranchFilter(e.target.value)} sx={{ minWidth: 160 }}>
              <MenuItem value={ALL}>All branches</MenuItem>
              {branches.map((b) => (
                <MenuItem key={b} value={b}>
                  {b}
                </MenuItem>
              ))}
            </Select>
          </Stack>

          <SectionCard title={`${filteredRows.length} execution${filteredRows.length === 1 ? '' : 's'}`} noPadding>
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 760 }}>
                <TableHead>
                  <TableRow>
                    {['Execution', 'Status', 'Suite', 'Branch', 'Executor', 'Tests', 'Pass Rate', 'Duration', 'Date', ''].map((h) => (
                      <TableCell key={h} sx={{ color: 'text.secondary', fontSize: '0.7rem', fontWeight: 700, letterSpacing: 0.4, border: 'none', pb: 1 }}>
                        {h.toUpperCase()}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredRows.map((row) => (
                    <TableRow
                      key={row.executionId}
                      hover
                      onClick={() => navigate(row.executionId)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell sx={{ fontWeight: 700 }}>#{row.executionId}</TableCell>
                      <TableCell>
                        <StatusChip status={row.status} />
                      </TableCell>
                      <TableCell>{row.suiteName}</TableCell>
                      <TableCell>{row.branch ?? '—'}</TableCell>
                      <TableCell>{executorName(row) ?? '—'}</TableCell>
                      <TableCell>{formatNumber(row.total ?? 0)}</TableCell>
                      <TableCell>{formatPercent(row.passRate ?? 0)}</TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>{formatDuration(row.duration ?? 0)}</TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>{row.date ? formatDateTime(row.date) : '—'}</TableCell>
                      <TableCell>
                        {!row.mergedIntoMainDashboard && (
                          <Tooltip title={`Excluded from the main dashboard (branch "${row.branch}" isn't this project's main branch)`}>
                            <Chip label="not main" size="small" sx={{ fontSize: '0.65rem' }} />
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </SectionCard>
        </>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>New suite</DialogTitle>
        <DialogContent>
          <TextField
            label="Suite name"
            value={newSuiteName}
            onChange={(e) => setNewSuiteName(e.target.value)}
            fullWidth
            autoFocus
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={creatingSuite || !newSuiteName.trim()} onClick={handleCreateSuite}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
