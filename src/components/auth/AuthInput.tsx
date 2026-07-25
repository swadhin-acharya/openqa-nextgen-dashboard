import { useState } from 'react'
import { TextField, InputAdornment, IconButton, type TextFieldProps } from '@mui/material'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'

export interface AuthInputProps extends Omit<TextFieldProps, 'variant'> {
  startIcon?: React.ReactNode
  /** Renders a show/hide toggle and swaps the field's type between
   * "password" and "text" - only meaningful when type="password". */
  isPassword?: boolean
}

export function AuthInput({ startIcon, isPassword, type, ...rest }: AuthInputProps) {
  const [visible, setVisible] = useState(false)

  return (
    <TextField
      {...rest}
      type={isPassword ? (visible ? 'text' : 'password') : type}
      fullWidth
      slotProps={{
        input: {
          startAdornment: startIcon ? <InputAdornment position="start">{startIcon}</InputAdornment> : undefined,
          endAdornment: isPassword ? (
            <InputAdornment position="end">
              <IconButton
                onClick={() => setVisible((v) => !v)}
                edge="end"
                size="small"
                aria-label={visible ? 'Hide password' : 'Show password'}
              >
                {visible ? <VisibilityOffOutlinedIcon sx={{ fontSize: 19 }} /> : <VisibilityOutlinedIcon sx={{ fontSize: 19 }} />}
              </IconButton>
            </InputAdornment>
          ) : undefined,
        },
      }}
      sx={{
        '& .MuiOutlinedInput-root': {
          height: 48,
          transition: 'border-color 150ms ease, box-shadow 150ms ease',
        },
        ...rest.sx,
      }}
    />
  )
}
