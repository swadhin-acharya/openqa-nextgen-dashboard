import { Box, Typography, Stack, alpha, useTheme } from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import type { ReactNode } from 'react'
import openQaLogo from '../../assets/logoOpenQA.png'

const PITCH_POINTS = [
  'Hosted Allure analytics - no build pipeline to maintain',
  'Per-member access tokens, scoped to a project',
  'One dashboard your whole team can share',
]

/**
 * Shared branded chrome for LoginPage/SignupPage - a left panel with the
 * wordmark and pitch, form content on the right. Uses theme tokens (not
 * hardcoded colors) so it respects the light/dark toggle, which persists
 * across sessions via ThemeModeContext even before the user logs in.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  const theme = useTheme()

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Box
        sx={{
          flex: 1,
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'center',
          px: 8,
          background: `linear-gradient(160deg, ${alpha(theme.palette.primary.main, 0.16)}, ${theme.palette.background.default})`,
          borderRight: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box component="img" src={openQaLogo} alt="OpenQA" sx={{ height: 56, display: 'block', mb: 1 }} />
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
          NextGen Dashboard
        </Typography>
        <Stack spacing={1.5} sx={{ maxWidth: 380 }}>
          {PITCH_POINTS.map((point) => (
            <Stack key={point} direction="row" spacing={1.25} sx={{ alignItems: 'flex-start' }}>
              <CheckCircleRoundedIcon sx={{ fontSize: 18, color: 'success.main', mt: 0.25 }} />
              <Typography color="text.secondary">{point}</Typography>
            </Stack>
          ))}
        </Stack>
      </Box>
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3 }}>
        {children}
      </Box>
    </Box>
  )
}
