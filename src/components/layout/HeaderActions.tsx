import { useState } from 'react'
import { Button, MenuItem, Select, Tooltip, Snackbar, IconButton, Typography } from '@mui/material'
import CompareArrowsRoundedIcon from '@mui/icons-material/CompareArrowsRounded'
import IosShareRoundedIcon from '@mui/icons-material/IosShareRounded'
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded'
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded'
import ClearRoundedIcon from '@mui/icons-material/ClearRounded'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import dayjs, { type Dayjs } from 'dayjs'
import { Stack } from '../FlexStack'
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

export interface DateRange {
  from: string
  to: string
}

function toDayjs(value: string): Dayjs | null {
  return value ? dayjs(value, 'YYYY-MM-DD') : null
}

function toDateKey(value: Dayjs | null): string {
  return value?.isValid() ? value.format('YYYY-MM-DD') : ''
}

const datePickerSlotProps = {
  textField: {
    size: 'small' as const,
    sx: { width: 150, '& .MuiInputBase-input': { fontSize: '0.78rem', py: 0.7 } },
  },
}

/**
 * Header customization control: lets the viewer scope Results Trend,
 * Duration Trend, and Recent Executions down to a from/to window instead of
 * always showing the full "last N runs" set. A real calendar popup
 * (MUI X DatePicker), not a native <input type="date"> - the value shape
 * exposed to callers is still plain YYYY-MM-DD, always local time (the
 * caller compares against each execution's LOCAL calendar date, not the raw
 * UTC ISO string, so the filter matches what formatDate() displays).
 * KPI cards deliberately keep showing the single latest run regardless of
 * this filter - only the historical views scope to the range.
 */
export function DateRangeFilter({ value, onChange }: { value: DateRange; onChange: (range: DateRange) => void }) {
  const hasFilter = !!value.from || !!value.to
  const from = toDayjs(value.from)
  const to = toDayjs(value.to)

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
        <DatePicker
          label="From"
          value={from}
          onChange={(newValue) => onChange({ ...value, from: toDateKey(newValue) })}
          maxDate={to ?? undefined}
          slotProps={datePickerSlotProps}
        />
        <Typography variant="caption" color="text.secondary">
          to
        </Typography>
        <DatePicker
          label="To"
          value={to}
          onChange={(newValue) => onChange({ ...value, to: toDateKey(newValue) })}
          minDate={from ?? undefined}
          slotProps={datePickerSlotProps}
        />
        {hasFilter && (
          <Tooltip title="Clear date filter">
            <IconButton size="small" onClick={() => onChange({ from: '', to: '' })} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
              <ClearRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    </LocalizationProvider>
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
