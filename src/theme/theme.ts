import { createTheme, alpha, type PaletteMode } from '@mui/material/styles'

// Semantic status colors used consistently across the entire dashboard.
export const statusColors = {
  passed: '#2ecc8f',
  failed: '#f2495c',
  broken: '#ff9f43',
  skipped: '#f4c542',
  unknown: '#8b93a7',
}

export const chartPalette = {
  passRate: '#7c8cff',
  duration: '#5aa9ff',
  accent: '#635bff',
}

const darkBackground = '#0c101a'
const darkPaper = '#131826'
const darkPaperElevated = '#171d2e'
const darkBorder = 'rgba(255,255,255,0.08)'

const lightBackground = '#f4f6fb'
const lightPaper = '#ffffff'
const lightPaperElevated = '#ffffff'
const lightBorder = 'rgba(15,20,30,0.08)'

export function getDesignTokens(mode: PaletteMode) {
  const isDark = mode === 'dark'

  return {
    palette: {
      mode,
      primary: {
        main: '#5b6cf9',
        light: '#8590ff',
        dark: '#3f4bd1',
        contrastText: '#ffffff',
      },
      secondary: {
        main: chartPalette.accent,
      },
      success: { main: statusColors.passed },
      error: { main: statusColors.failed },
      warning: { main: statusColors.broken },
      info: { main: chartPalette.duration },
      background: {
        default: isDark ? darkBackground : lightBackground,
        paper: isDark ? darkPaper : lightPaper,
      },
      divider: isDark ? darkBorder : lightBorder,
      text: {
        primary: isDark ? '#eef1f8' : '#12151f',
        secondary: isDark ? '#8b93a7' : '#5c6478',
      },
    },
    shape: {
      borderRadius: 10,
    },
    typography: {
      fontFamily: [
        'Inter',
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
        'Helvetica',
        'Arial',
        'sans-serif',
      ].join(','),
      h1: { fontWeight: 700 },
      h2: { fontWeight: 700 },
      h3: { fontWeight: 700 },
      h4: { fontWeight: 700 },
      h5: { fontWeight: 700, fontSize: '1.05rem' },
      h6: { fontWeight: 600, fontSize: '0.95rem' },
      subtitle1: { fontSize: '0.875rem' },
      subtitle2: { fontSize: '0.8rem', fontWeight: 600 },
      body2: { fontSize: '0.8125rem' },
      caption: { fontSize: '0.7rem' },
      button: { textTransform: 'none' as const, fontWeight: 600 },
    },
    customTokens: {
      cardBackground: isDark ? darkPaperElevated : lightPaperElevated,
      sidebarBackground: isDark ? '#0a0d16' : '#ffffff',
      hoverBackground: isDark ? alpha('#ffffff', 0.04) : alpha('#12151f', 0.04),
      chartGrid: isDark ? alpha('#ffffff', 0.06) : alpha('#12151f', 0.08),
    },
  }
}

export function buildTheme(mode: PaletteMode) {
  const tokens = getDesignTokens(mode)
  const isDark = mode === 'dark'

  return createTheme({
    palette: tokens.palette as any,
    shape: tokens.shape,
    typography: tokens.typography,
    shadows: Array(25).fill('none') as any,
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            scrollbarColor: isDark ? '#2a3142 #0c101a' : '#c8ccd6 #f4f6fb',
          },
          '*::-webkit-scrollbar': {
            width: 8,
            height: 8,
          },
          '*::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '*::-webkit-scrollbar-thumb': {
            background: isDark ? '#2a3142' : '#c8ccd6',
            borderRadius: 8,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,20,30,0.08)'}`,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 600,
            fontSize: '0.7rem',
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,20,30,0.06)',
          },
        },
      },
    },
    customTokens: tokens.customTokens,
  } as any)
}

declare module '@mui/material/styles' {
  interface Theme {
    customTokens: {
      cardBackground: string
      sidebarBackground: string
      hoverBackground: string
      chartGrid: string
    }
  }
  interface ThemeOptions {
    customTokens?: {
      cardBackground: string
      sidebarBackground: string
      hoverBackground: string
      chartGrid: string
    }
  }
}
