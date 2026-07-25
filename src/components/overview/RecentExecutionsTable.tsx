import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  LinearProgress,
  Box,
  Button,
  Stack,
  alpha,
  useTheme,
} from '@mui/material'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import { SectionCard } from '../common/SectionCard'
import { StatusChip } from '../common/StatusChip'
import { statusColors } from '../../theme/theme'
import { formatNumber, formatPercent, formatDuration, formatDate } from '../../utils/format'
import type { RecentExecutionRow } from '../../../processor/models.js'

export function RecentExecutionsTable({ executions }: { executions: RecentExecutionRow[] }) {
  const theme = useTheme()

  return (
    <SectionCard title="Recent Executions" noPadding>
      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 520 }}>
          <TableHead>
            <TableRow>
              {['Execution', 'Status', 'Tests', 'Pass Rate', 'Duration', 'Date'].map((h) => (
                <TableCell
                  key={h}
                  sx={{ color: 'text.secondary', fontSize: '0.7rem', fontWeight: 700, letterSpacing: 0.4, border: 'none', pb: 1 }}
                >
                  {h.toUpperCase()}
                </TableCell>
              ))}
              <TableCell sx={{ border: 'none' }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {executions.map((row) => (
              <TableRow
                key={row.executionId}
                sx={{
                  cursor: 'pointer',
                  '&:hover': { bgcolor: theme.customTokens.hoverBackground },
                }}
              >
                <TableCell sx={{ fontWeight: 700 }}>#{row.executionId}</TableCell>
                <TableCell>
                  <StatusChip status={row.status} />
                </TableCell>
                <TableCell>{formatNumber(row.total)}</TableCell>
                <TableCell>
                  <Stack spacing={0.5} sx={{ minWidth: 88 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {formatPercent(row.passRate)}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={row.passRate}
                      sx={{
                        height: 4,
                        borderRadius: 2,
                        bgcolor: alpha(statusColors.failed, 0.2),
                        '& .MuiLinearProgress-bar': {
                          bgcolor: row.passRate >= 90 ? statusColors.passed : row.passRate >= 75 ? statusColors.skipped : statusColors.failed,
                        },
                      }}
                    />
                  </Stack>
                </TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{formatDuration(row.duration)}</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{formatDate(row.date)}</TableCell>
                <TableCell sx={{ width: 32 }}>
                  <ChevronRightRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Box sx={{ px: 2.5, py: 1.75, borderTop: `1px solid ${theme.palette.divider}` }}>
        <Button
          fullWidth
          size="small"
          sx={{ color: 'text.secondary', fontWeight: 600, justifyContent: 'center' }}
        >
          View All Executions
        </Button>
      </Box>
    </SectionCard>
  )
}
