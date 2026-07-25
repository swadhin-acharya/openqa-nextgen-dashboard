import { Typography } from '@mui/material'
import { Stack } from '../FlexStack'
import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <Stack
      component="div"
      direction={{ xs: 'column', md: 'row' }}
      alignItems={{ xs: 'flex-start', md: 'center' }}
      justifyContent="space-between"
      spacing={2}
      sx={{ mb: 3 }}
    >
      <Stack>
        <Typography variant="h4" sx={{ fontSize: '1.5rem', fontWeight: 700 }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
            {subtitle}
          </Typography>
        )}
      </Stack>
      {actions && (
        <Stack component="div" direction="row" spacing={1.25} alignItems="center">
          {actions}
        </Stack>
      )}
    </Stack>
  )
}
