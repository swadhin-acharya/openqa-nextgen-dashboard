import { Box, CircularProgress, Typography } from '@mui/material'
import { Stack } from '../FlexStack'

export function LoadingState({ label = 'Loading dashboard data…' }: { label?: string }) {
  return (
    <Stack
      component="div"
      alignItems="center"
      justifyContent="center"
      spacing={1.5}
      sx={{ minHeight: 320, width: '100%' }}
    >
      <CircularProgress size={28} thickness={4} />
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
    </Stack>
  )
}

export function ErrorState({ label }: { label: string }) {
  return (
    <Box
      sx={{
        minHeight: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'error.main',
      }}
    >
      <Typography variant="body2">{label}</Typography>
    </Box>
  )
}
