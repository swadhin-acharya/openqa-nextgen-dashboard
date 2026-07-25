import { Box, Typography, useTheme } from '@mui/material'
import { Stack } from '../FlexStack'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { SectionCard } from '../common/SectionCard'
import { statusColors } from '../../theme/theme'
import { formatNumber, formatPercent } from '../../utils/format'
import type { ExecutionSummary } from '../../../processor/models.js'

interface Slice {
  key: string
  label: string
  value: number
  color: string
}

export function ResultsDistributionChart({ current }: { current: ExecutionSummary }) {
  const theme = useTheme()

  // Only include statuses that are actually present in the data — never
  // fabricate a slice for a status with zero occurrences.
  const slices: Slice[] = [
    { key: 'passed', label: 'Passed', value: current.passed, color: statusColors.passed },
    { key: 'failed', label: 'Failed', value: current.failed, color: statusColors.failed },
    { key: 'skipped', label: 'Skipped', value: current.skipped, color: statusColors.skipped },
    { key: 'broken', label: 'Broken', value: current.broken, color: statusColors.broken },
    { key: 'unknown', label: 'Unknown', value: current.unknown, color: statusColors.unknown },
  ].filter((s) => s.value > 0)

  return (
    <SectionCard title="Results Distribution">
      <Stack component="div" direction="row" alignItems="center" spacing={2} sx={{ height: '100%', minWidth: 0, overflow: 'hidden' }}>
        <Box sx={{ position: 'relative', width: 152, height: 152, flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="label"
                innerRadius={48}
                outerRadius={70}
                paddingAngle={2}
                stroke="none"
              >
                {slices.map((s) => (
                  <Cell key={s.key} fill={s.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [formatNumber(Number(value ?? 0)), String(name)]}
                contentStyle={{
                  background: theme.customTokens.cardBackground,
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <Typography sx={{ fontSize: '1.35rem', fontWeight: 700, lineHeight: 1 }}>
              {formatNumber(current.total)}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', letterSpacing: 0.5 }}>
              TOTAL
            </Typography>
          </Box>
        </Box>

        <Stack spacing={1.15} sx={{ flex: 1, minWidth: 0 }}>
          {slices.map((s) => (
            <Stack
              key={s.key}
              component="div"
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{ minWidth: 0 }}
            >
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s.color, flexShrink: 0 }} />
              <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0, color: 'text.secondary' }}>
                {s.label}
              </Typography>
              <Typography
                variant="body2"
                noWrap
                sx={{ fontWeight: 700, flexShrink: 0, minWidth: 26, textAlign: 'right' }}
              >
                {formatNumber(s.value)}
              </Typography>
              <Typography
                variant="caption"
                noWrap
                sx={{ color: 'text.secondary', flexShrink: 0, minWidth: 46, textAlign: 'right' }}
              >
                {formatPercent((s.value / current.total) * 100)}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Stack>
    </SectionCard>
  )
}
