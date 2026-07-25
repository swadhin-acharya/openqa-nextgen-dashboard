import { Box, Paper, Typography, alpha, useTheme } from '@mui/material'
import { Stack } from '../FlexStack'
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded'
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded'
import type { SvgIconComponent } from '@mui/icons-material'
import type { ReactNode } from 'react'

interface KpiCardProps {
  label: string
  value: string
  icon: SvgIconComponent
  color: string
  trend?: { value: number; direction: 'up' | 'down' | 'flat'; goodDirection: 'up' | 'down' } | null
  footerText?: ReactNode
}

export function KpiCard({ label, value, icon: Icon, color, trend, footerText }: KpiCardProps) {
  const theme = useTheme()

  let trendNode: ReactNode = null
  if (trend) {
    const isGood = trend.direction === trend.goodDirection
    const trendColor = trend.direction === 'flat' ? theme.palette.text.secondary : isGood ? theme.palette.success.main : theme.palette.error.main
    const ArrowIcon = trend.direction === 'down' ? ArrowDownwardRoundedIcon : ArrowUpwardRoundedIcon
    trendNode = (
      <Stack component="div" direction="row" alignItems="center" spacing={0.4}>
        {trend.direction !== 'flat' && <ArrowIcon sx={{ fontSize: 14, color: trendColor }} />}
        <Typography variant="caption" sx={{ color: trendColor, fontWeight: 700 }}>
          {trend.value.toFixed(2).replace(/\.00$/, '')}%
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          vs previous run
        </Typography>
      </Stack>
    )
  }

  return (
    <Paper
      elevation={0}
      sx={{
        bgcolor: theme.customTokens.cardBackground,
        borderRadius: 2.5,
        px: 2.25,
        py: 2,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: 118,
      }}
    >
      <Stack component="div" direction="row" alignItems="flex-start" justifyContent="space-between">
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', fontWeight: 700, letterSpacing: 0.5 }}
        >
          {label.toUpperCase()}
        </Typography>
        <Box
          sx={{
            width: 30,
            height: 30,
            borderRadius: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: alpha(color, theme.palette.mode === 'dark' ? 0.18 : 0.12),
            color,
          }}
        >
          <Icon sx={{ fontSize: 17 }} />
        </Box>
      </Stack>

      <Stack spacing={0.5} sx={{ mt: 1.5 }}>
        <Typography sx={{ fontSize: '1.7rem', fontWeight: 700, lineHeight: 1.1 }}>{value}</Typography>
        {trendNode}
        {footerText && !trendNode && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {footerText}
          </Typography>
        )}
      </Stack>
    </Paper>
  )
}
