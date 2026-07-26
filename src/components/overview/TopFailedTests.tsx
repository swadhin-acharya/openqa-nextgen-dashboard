import { Box, Typography, Chip, Button, alpha, useTheme } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { Stack } from '../FlexStack'
import { SectionCard } from '../common/SectionCard'
import { statusColors } from '../../theme/theme'
import type { FailureSummary } from '../../../processor/models.js'

export function TopFailedTests({ failures }: { failures: FailureSummary[] }) {
  const theme = useTheme()
  const navigate = useNavigate()
  const maxOccurrences = Math.max(...failures.map((f) => f.occurrences), 1)

  return (
    <SectionCard
      title="Top Failed Tests"
      actions={
        <Button size="small" onClick={() => navigate('failure-analysis')} sx={{ color: 'text.secondary', fontSize: '0.75rem', fontWeight: 600 }}>
          View All
        </Button>
      }
    >
      <Stack spacing={1.5}>
        {failures.map((f) => (
          <Stack
            key={f.testId}
            component="div"
            direction="row"
            alignItems="center"
            spacing={1.5}
            onClick={() => navigate('failure-analysis')}
            sx={{
              p: 1,
              borderRadius: 1.5,
              cursor: 'pointer',
              '&:hover': { bgcolor: theme.customTokens.hoverBackground },
            }}
          >
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: statusColors.failed, flexShrink: 0 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                {f.name}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                {f.feature}
              </Typography>
              <Box
                sx={{
                  mt: 0.5,
                  height: 3,
                  borderRadius: 2,
                  bgcolor: alpha(statusColors.failed, 0.15),
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    height: '100%',
                    width: `${(f.occurrences / maxOccurrences) * 100}%`,
                    bgcolor: statusColors.failed,
                  }}
                />
              </Box>
            </Box>
            <Chip
              label={f.occurrences}
              size="small"
              sx={{
                bgcolor: alpha(statusColors.failed, 0.16),
                color: statusColors.failed,
                fontWeight: 700,
                minWidth: 30,
              }}
            />
          </Stack>
        ))}
      </Stack>
    </SectionCard>
  )
}
