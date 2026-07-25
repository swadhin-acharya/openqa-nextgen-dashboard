import { Box, alpha, useTheme } from '@mui/material'
import type { ReactNode } from 'react'
import openQaLogo from '../../assets/logoOpenQA.png'
import { QAPatternPanel } from '../auth/QAPatternPanel'

/**
 * Shared shell for LoginPage/SignupPage: form column on the left (logo +
 * whatever heading/fields the page provides as children), a decorative
 * QA-icon lattice on the right (QAPatternPanel) - hidden below md since it's
 * purely decorative and the form needs the full width on small screens.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  const theme = useTheme()

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          px: { xs: 3, sm: 6 },
          py: 4,
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 400 }}>
          <Box component="img" src={openQaLogo} alt="OpenQA Dashboard" sx={{ height: 40, width: 'auto', display: 'block', mb: 4 }} />
          {children}
        </Box>
      </Box>

      <Box
        sx={{
          flex: { md: 0.8, lg: 1 },
          display: { xs: 'none', md: 'block' },
          position: 'relative',
          overflow: 'hidden',
          background: `linear-gradient(160deg, ${alpha(theme.palette.primary.main, 0.14)}, ${theme.palette.background.paper})`,
          borderLeft: `1px solid ${theme.palette.divider}`,
        }}
      >
        <QAPatternPanel />
      </Box>
    </Box>
  )
}
