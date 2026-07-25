import { Box, Typography, Tooltip, Link as MuiLink, Avatar, IconButton, alpha, useTheme } from '@mui/material'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import { Stack } from '../FlexStack'
import { NavLink, Link as RouterLink } from 'react-router-dom'
import { navItems } from '../../config/navigation'
import { useOrg } from '../../lib/OrgContext'
import { useProject } from '../../lib/ProjectContext'
import { supabase } from '../../lib/supabaseClient'
import { formatDateTime } from '../../utils/format'
import openQaLogo from '../../assets/logoOpenQA.png'

export const SIDEBAR_WIDTH = 248

export function Sidebar() {
  const theme = useTheme()
  const org = useOrg()
  const project = useProject()
  const basePath = `/${org.slug}/${project.slug}`

  return (
    <Box
      component="nav"
      sx={{
        width: SIDEBAR_WIDTH,
        flexShrink: 0,
        height: '100vh',
        position: 'sticky',
        top: 0,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: theme.customTokens.sidebarBackground,
        borderRight: `1px solid ${theme.palette.divider}`,
      }}
    >
      <Box
        component={RouterLink}
        to="/"
        sx={{ display: 'block', px: 2.5, py: 2.75, borderBottom: `1px solid ${theme.palette.divider}`, textDecoration: 'none' }}
      >
        <Box component="img" src={openQaLogo} alt="OpenQA" sx={{ height: 26, display: 'block', mb: 0.5 }} />
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          NextGen Dashboard
        </Typography>
      </Box>

      <Box
        component={RouterLink}
        to={`/${org.slug}`}
        sx={{ display: 'block', textDecoration: 'none', color: 'inherit', borderBottom: `1px solid ${theme.palette.divider}` }}
      >
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', px: 2.5, py: 1.5 }}>
          <Avatar
            src={org.logoUrl ?? undefined}
            variant="rounded"
            sx={{
              width: 28,
              height: 28,
              fontSize: '0.8rem',
              bgcolor: alpha(theme.palette.primary.main, 0.16),
              color: 'primary.light',
              '& .MuiAvatar-img': { objectFit: 'contain' },
            }}
          >
            {org.name.charAt(0).toUpperCase()}
          </Avatar>
          <Typography
            variant="caption"
            noWrap
            sx={{ color: 'primary.light', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}
          >
            {org.name}
          </Typography>
        </Stack>
      </Box>

      <Stack
        direction="row"
        justifyContent="space-between"
        sx={{ alignItems: 'center', px: 2.5, py: 1, borderBottom: `1px solid ${theme.palette.divider}` }}
      >
        <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
          {project.name}
        </Typography>
        {org.role === 'owner' && (
          <Tooltip title="Project settings">
            <IconButton component={RouterLink} to="settings" size="small" sx={{ ml: 1 }}>
              <SettingsOutlinedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      <Stack sx={{ flex: 1, py: 1.5, px: 1.25, gap: 0.25, overflowY: 'auto' }}>
        {navItems.map((item) => {
          const Icon = item.icon
          const href = item.path === '/' ? basePath : `${basePath}${item.path}`
          const content = (
            <Stack
              component="div"
              direction="row"
              alignItems="center"
              spacing={1.5}
              sx={{
                px: 1.5,
                py: 1,
                borderRadius: 2,
                color: item.enabled ? 'text.primary' : 'text.secondary',
                opacity: item.enabled ? 1 : 0.5,
                cursor: item.enabled ? 'pointer' : 'default',
                transition: 'background-color 120ms ease',
                '&.active': {
                  bgcolor: alpha(theme.palette.primary.main, 0.16),
                  color: theme.palette.mode === 'dark' ? '#c7cdff' : theme.palette.primary.dark,
                },
                '&:hover': item.enabled
                  ? { bgcolor: theme.customTokens.hoverBackground }
                  : undefined,
              }}
            >
              <Icon sx={{ fontSize: 19 }} />
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.825rem' }}>
                {item.label}
              </Typography>
            </Stack>
          )

          if (!item.enabled) {
            return (
              <Tooltip key={item.path} title="Coming soon" placement="right">
                <Box>{content}</Box>
              </Tooltip>
            )
          }

          return (
            <NavLink key={item.path} to={href} end style={{ textDecoration: 'none' }}>
              {content}
            </NavLink>
          )
        })}
      </Stack>

      <Box sx={{ px: 2.5, py: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
        <Stack component="div" direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
          <MuiLink component={RouterLink} to={`/${org.slug}`} variant="caption" sx={{ color: 'text.secondary' }}>
            ← {org.name}
          </MuiLink>
          <MuiLink
            component="button"
            variant="caption"
            onClick={() => supabase.auth.signOut()}
            sx={{ color: 'text.secondary' }}
          >
            Log out
          </MuiLink>
        </Stack>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
          {project.lastUpdated ? `Last updated ${formatDateTime(project.lastUpdated)}` : 'No runs ingested yet'}
        </Typography>
      </Box>
    </Box>
  )
}
