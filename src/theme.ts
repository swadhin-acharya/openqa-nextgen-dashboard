import { createTheme } from '@mui/material/styles'

// Same palette family as resideo-nextgen-dashboard/src/theme/theme.ts, kept
// dark-only here since this demo has no light/dark toggle yet.
export const statusColors = {
  passed: '#2ecc8f',
  failed: '#f2495c',
  broken: '#ff9f43',
  skipped: '#f4c542',
  unknown: '#8b93a7',
}

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#5b6cf9', light: '#8590ff', dark: '#3f4bd1', contrastText: '#ffffff' },
    secondary: { main: '#635bff' },
    success: { main: statusColors.passed },
    error: { main: statusColors.failed },
    warning: { main: statusColors.broken },
    background: { default: '#0c101a', paper: '#131826' },
    divider: 'rgba(255,255,255,0.08)',
    text: { primary: '#eef1f8', secondary: '#8b93a7' },
  },
  shape: { borderRadius: 10 },
})
