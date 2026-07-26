import { Grid, Paper, Typography, LinearProgress, alpha, useTheme, Button } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { Stack } from '../FlexStack'
import { statusColors } from '../../theme/theme'
import { formatPercent } from '../../utils/format'
import type { FeatureSummary } from '../../../processor/models.js'

function healthColor(passRate: number) {
  if (passRate >= 90) return statusColors.passed
  if (passRate >= 70) return statusColors.skipped
  return statusColors.failed
}

export function FeatureHealthGrid({ features }: { features: FeatureSummary[] }) {
  const theme = useTheme()
  const navigate = useNavigate()

  return (
    <Paper
      elevation={0}
      sx={{ bgcolor: theme.customTokens.cardBackground, borderRadius: 2.5, p: 2.5 }}
    >
      <Stack component="div" direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h6">Feature Health</Typography>
        <Button size="small" onClick={() => navigate('features')} sx={{ color: 'text.secondary', fontSize: '0.75rem', fontWeight: 600 }}>
          View All Features
        </Button>
      </Stack>
      <Grid container spacing={2}>
        {features.map((feature) => {
          const color = healthColor(feature.passRate)
          return (
            <Grid key={feature.featureId} size={{ xs: 12, sm: 6, md: 4, lg: 3, xl: 12 / 6 }}>
              <Paper
                elevation={0}
                onClick={() => navigate(`tests?feature=${encodeURIComponent(feature.name)}`)}
                sx={{
                  bgcolor: theme.palette.mode === 'dark' ? alpha('#ffffff', 0.02) : alpha('#12151f', 0.02),
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 2,
                  p: 1.75,
                  cursor: 'pointer',
                  height: '100%',
                  '&:hover': { borderColor: alpha(color, 0.5) },
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                  {feature.name}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {feature.total} Tests
                </Typography>
                <Stack component="div" direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1.25, mb: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color }}>
                    {formatPercent(feature.passRate, feature.passRate % 1 === 0 ? 0 : 1)}
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={feature.passRate}
                  sx={{
                    height: 5,
                    borderRadius: 3,
                    bgcolor: alpha(color, 0.15),
                    '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 },
                  }}
                />
              </Paper>
            </Grid>
          )
        })}
      </Grid>
    </Paper>
  )
}
