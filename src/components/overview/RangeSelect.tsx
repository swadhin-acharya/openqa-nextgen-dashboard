import { MenuItem, Select, type SelectChangeEvent } from '@mui/material'

interface RangeSelectProps {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}

export function RangeSelect({ value, onChange, options }: RangeSelectProps) {
  return (
    <Select
      size="small"
      value={value}
      onChange={(e: SelectChangeEvent) => onChange(e.target.value)}
      sx={{
        fontSize: '0.75rem',
        height: 30,
        '& .MuiSelect-select': { py: 0.5, px: 1.25 },
      }}
    >
      {options.map((opt) => (
        <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: '0.8rem' }}>
          {opt.label}
        </MenuItem>
      ))}
    </Select>
  )
}
