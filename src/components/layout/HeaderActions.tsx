import { useState } from 'react'
import { Button, MenuItem, Select, Tooltip, Snackbar, IconButton } from '@mui/material'
import CompareArrowsRoundedIcon from '@mui/icons-material/CompareArrowsRounded'
import IosShareRoundedIcon from '@mui/icons-material/IosShareRounded'
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded'
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded'
import { useThemeMode } from '../../theme/ThemeModeContext'

export function ThemeToggleButton() {
  const { mode, toggleMode } = useThemeMode()
  return (
    <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
      <IconButton
        onClick={toggleMode}
        size="small"
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}
      >
        {mode === 'dark' ? <LightModeRoundedIcon sx={{ fontSize: 18 }} /> : <DarkModeRoundedIcon sx={{ fontSize: 18 }} />}
      </IconButton>
    </Tooltip>
  )
}

export function LatestRunSelect({ executionId }: { executionId: string }) {
  return (
    <Select
      size="small"
      value={executionId}
      sx={{ fontSize: '0.8rem', height: 34, minWidth: 130 }}
    >
      <MenuItem value={executionId} sx={{ fontSize: '0.85rem' }}>
        Latest Run · #{executionId}
      </MenuItem>
    </Select>
  )
}

export function CompareButton() {
  return (
    <Tooltip title="Coming soon">
      <span>
        <Button
          disabled
          size="small"
          startIcon={<CompareArrowsRoundedIcon sx={{ fontSize: 16 }} />}
          sx={{ borderRadius: 1.5, border: '1px solid', borderColor: 'divider', color: 'text.secondary', px: 1.5 }}
        >
          Compare
        </Button>
      </span>
    </Tooltip>
  )
}

export function ShareButton() {
  const [open, setOpen] = useState(false)

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
    } catch {
      // Clipboard API may be unavailable (e.g. insecure context) — fail silently.
    }
    setOpen(true)
  }

  return (
    <>
      <Button
        variant="contained"
        size="small"
        onClick={handleShare}
        startIcon={<IosShareRoundedIcon sx={{ fontSize: 16 }} />}
        sx={{ borderRadius: 1.5, px: 1.75 }}
      >
        Share Report
      </Button>
      <Snackbar
        open={open}
        autoHideDuration={2500}
        onClose={() => setOpen(false)}
        message="Link copied to clipboard"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  )
}
