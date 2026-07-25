import { Box, alpha, useTheme } from '@mui/material'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import HighlightOffRoundedIcon from '@mui/icons-material/HighlightOffRounded'
import BugReportOutlinedIcon from '@mui/icons-material/BugReportOutlined'
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined'
import ChecklistOutlinedIcon from '@mui/icons-material/ChecklistOutlined'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import CodeRoundedIcon from '@mui/icons-material/CodeRounded'
import PhoneIphoneOutlinedIcon from '@mui/icons-material/PhoneIphoneOutlined'
import LanguageOutlinedIcon from '@mui/icons-material/LanguageOutlined'
import ApiOutlinedIcon from '@mui/icons-material/ApiOutlined'
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined'
import PieChartOutlineOutlinedIcon from '@mui/icons-material/PieChartOutlineOutlined'
import type { SvgIconComponent } from '@mui/icons-material'

const ICONS: SvgIconComponent[] = [
  CheckCircleOutlineRoundedIcon,
  BugReportOutlinedIcon,
  ScienceOutlinedIcon,
  CodeRoundedIcon,
  ChecklistOutlinedIcon,
  HighlightOffRoundedIcon,
  LanguageOutlinedIcon,
  SettingsOutlinedIcon,
  ApiOutlinedIcon,
  PhoneIphoneOutlinedIcon,
  BarChartOutlinedIcon,
  PieChartOutlineOutlinedIcon,
]

const COLUMNS = 5
const ROWS = 7
const CELL = 84

/**
 * Decorative QA/automation icon lattice for the auth screens' right-hand
 * panel - line-art inspired by the reference layout's food-icon grid, swapped
 * for testing-themed icons. Deterministic layout (no Math.random()) so it
 * doesn't reshuffle on re-render/hydration; every 4th cell renders a small
 * dot/cross accent instead of an icon for visual variety, and alternating
 * rows offset horizontally like the reference's brick pattern.
 */
export function QAPatternPanel() {
  const theme = useTheme()
  const iconColor = alpha(theme.palette.primary.light, 0.4)
  const accentColor = alpha(theme.palette.primary.light, 0.25)

  const cells = []
  let iconCursor = 0
  for (let row = 0; row < ROWS; row++) {
    const rowOffset = row % 2 === 0 ? 0 : CELL / 2
    for (let col = 0; col < COLUMNS; col++) {
      const key = `${row}-${col}`
      const isAccent = (row * COLUMNS + col) % 4 === 3
      if (isAccent) {
        const accentKind = (row + col) % 3
        cells.push(
          <Box
            key={key}
            sx={{
              position: 'absolute',
              top: row * CELL + CELL / 2,
              left: col * CELL + CELL / 2 + rowOffset,
              transform: 'translate(-50%, -50%)',
              width: accentKind === 0 ? 6 : 14,
              height: accentKind === 0 ? 6 : accentKind === 1 ? 2 : 14,
              borderRadius: accentKind === 0 ? '50%' : accentKind === 1 ? 1 : 0,
              bgcolor: accentKind === 1 ? accentColor : 'transparent',
              border: accentKind === 2 ? `2px solid ${accentColor}` : 'none',
              ...(accentKind === 0 && { bgcolor: accentColor }),
              rotate: accentKind === 1 ? '45deg' : '0deg',
            }}
          />,
        )
        continue
      }
      const Icon = ICONS[iconCursor % ICONS.length]
      iconCursor += 1
      cells.push(
        <Icon
          key={key}
          sx={{
            position: 'absolute',
            top: row * CELL + CELL / 2,
            left: col * CELL + CELL / 2 + rowOffset,
            transform: 'translate(-50%, -50%)',
            fontSize: 30,
            color: iconColor,
          }}
        />,
      )
    }
  }

  return (
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        // Fade the lattice out near the edges so it reads as a background
        // texture rather than a hard-clipped grid.
        maskImage: 'radial-gradient(ellipse at center, black 55%, transparent 95%)',
        WebkitMaskImage: 'radial-gradient(ellipse at center, black 55%, transparent 95%)',
      }}
    >
      <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: `translate(-50%, -50%)`, width: COLUMNS * CELL + CELL, height: ROWS * CELL }}>
        {cells}
      </Box>
    </Box>
  )
}
