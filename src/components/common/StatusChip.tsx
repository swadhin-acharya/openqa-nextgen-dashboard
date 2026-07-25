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
}

export function StatusChip({ status, size = 'small' }: { status: TestStatus | 'mixed'; size?: 'small' | 'medium' }) {
  const theme = useTheme()
  const color = statusColors[status as keyof typeof statusColors] ?? theme.palette.text.secondary

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
