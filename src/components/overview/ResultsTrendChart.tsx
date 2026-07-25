import { useMemo, useState } from 'react'
import { Box, Typography, useTheme } from '@mui/material'
import { Stack } from '../FlexStack'
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { SectionCard } from '../common/SectionCard'
import { RangeSelect } from './RangeSelect'
import { statusColors, chartPalette } from '../../theme/theme'
import { formatDateShort } from '../../utils/format'
import type { TrendPoint } from '../../../processor/models.js'

const RANGE_OPTIONS = [
  { value: '10', label: 'Last 10 Runs' },
  { value: '20', label: 'Last 20 Runs' },
  { value: '50', label: 'Last 50 Runs' },
]

function TrendTooltip({ active, payload, label }: any) {
  const theme = useTheme()
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  return (
    <Box
      sx={{
        bgcolor: theme.customTokens.cardBackground,
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 1.5,
        px: 1.5,
        py: 1,
      }}
    >
      <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
        {formatDateShort(label)} · #{row?.executionId}
      </Typography>
      {payload.map((entry: any) => (
        <Stack key={entry.dataKey} component="div" direction="row" justifyContent="space-between" spacing={2}>
          <Typography variant="caption" sx={{ color: entry.color }}>
            {entry.name}
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            {entry.dataKey === 'passRate' ? `${entry.value}%` : entry.value}
          </Typography>
        </Stack>
      ))}
    </Box>
  )
}

export function ResultsTrendChart({ data }: { data: TrendPoint[] }) {
  const theme = useTheme()
  const [range, setRange] = useState('20')

  const sliced = useMemo(() => data.slice(-Number(range)), [data, range])

  return (
    <SectionCard
      title="Results Trend"
      actions={<RangeSelect value={range} onChange={setRange} options={RANGE_OPTIONS} />}
    >
      <Box sx={{ width: '100%', height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={sliced} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="passedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={statusColors.passed} stopOpacity={0.35} />
                <stop offset="95%" stopColor={statusColors.passed} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={theme.customTokens.chartGrid} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateShort}
              tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
              axisLine={{ stroke: theme.palette.divider }}
              tickLine={false}
            />
            <YAxis
              yAxisId="count"
              tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <YAxis
              yAxisId="rate"
              orientation="right"
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
              tickFormatter={(v) => `${v}%`}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <Tooltip content={<TrendTooltip />} />
            <Legend
              iconType="circle"
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              formatter={(value) => <span style={{ color: theme.palette.text.secondary }}>{value}</span>}
            />
            <Area
              yAxisId="count"
              type="monotone"
              dataKey="passed"
              name="Passed"
              stroke={statusColors.passed}
              fill="url(#passedGradient)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="count"
              type="monotone"
              dataKey="failed"
              name="Failed"
              stroke={statusColors.failed}
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="count"
              type="monotone"
              dataKey="skipped"
              name="Skipped"
              stroke={statusColors.skipped}
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="rate"
              type="monotone"
              dataKey="passRate"
              name="Pass Rate"
              stroke={chartPalette.passRate}
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </Box>
    </SectionCard>
  )
}
