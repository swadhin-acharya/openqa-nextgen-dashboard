import { Box, Paper, Typography, useTheme } from '@mui/material'
import { Stack } from '../FlexStack'
import type { ReactNode } from 'react'

interface SectionCardProps {
  title: string
  actions?: ReactNode
  children: ReactNode
  sx?: object
  noPadding?: boolean
}

export function SectionCard({ title, actions, children, sx, noPadding }: SectionCardProps) {
  const theme = useTheme()

  return (
    <Paper
      elevation={0}
      sx={{
        bgcolor: theme.customTokens.cardBackground,
        borderRadius: 2.5,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        ...sx,
      }}
    >
      <Stack
        component="div"
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 2.5, pt: 2.25, pb: actions ? 1.5 : 2 }}
      >
        <Typography variant="h6">{title}</Typography>
        {actions}
      </Stack>
      <Box sx={{ px: noPadding ? 0 : 2.5, pb: noPadding ? 0 : 2.5, flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
        {children}
      </Box>
    </Paper>
  )
}
