import { Chip, alpha, useTheme } from '@mui/material'
import { statusColors } from '../../theme/theme'
import type { TestStatus } from '../../../processor/models.js'

const labels: Record<string, string> = {
  passed: 'Passed',
  failed: 'Failed',
  broken: 'Broken',
  skipped: 'Skipped',
  unknown: 'Unknown',
  mixed: 'Mixed',
  running: 'Running',
}

export function StatusChip({
  status,
  size = 'small',
}: {
  status: TestStatus | 'mixed' | 'running'
  size?: 'small' | 'medium'
}) {
  const theme = useTheme()
  // "running" isn't a real Allure test status (Phase 10 live executions) -
  // give it the theme's primary color rather than pretending it maps to
  // one of the pass/fail/broken/skipped palette.
  const color = status === 'running' ? theme.palette.primary.main : statusColors[status as keyof typeof statusColors] ?? theme.palette.text.secondary

  return (
    <Chip
      label={labels[status] ?? status}
      size={size}
      sx={{
        bgcolor: alpha(color, theme.palette.mode === 'dark' ? 0.16 : 0.12),
        color,
        border: `1px solid ${alpha(color, 0.35)}`,
        height: size === 'small' ? 22 : 26,
      }}
    />
  )
}
