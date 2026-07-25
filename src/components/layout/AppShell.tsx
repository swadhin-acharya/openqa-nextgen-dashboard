import { Box } from '@mui/material'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function AppShell() {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Sidebar />
      <Box
        component="main"
        sx={{
          flex: 1,
          minWidth: 0,
          px: { xs: 2, md: 3.5 },
          py: 3,
          maxWidth: 1920,
        }}
      >
        <Outlet />
      </Box>
    </Box>
  )
}
