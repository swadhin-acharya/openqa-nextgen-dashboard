import { useEffect, useState } from 'react'
import { Link as RouterLink, Navigate } from 'react-router-dom'
import { Box, Container, Typography, Button, Paper, Grid, Avatar, CircularProgress, alpha, useTheme } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import { Stack } from '../components/FlexStack'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'

interface OrgRow {
  id: string
  slug: string
  name: string
  logo_url: string | null
  projectCount: number
}

function OrgCard({ org }: { org: OrgRow }) {
  const theme = useTheme()

  return (
    <Paper
      component={RouterLink}
      to={`/${org.slug}`}
      elevation={0}
      sx={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        p: 2.5,
        borderRadius: 2.5,
        height: '100%',
        transition: 'border-color 120ms ease',
        '&:hover': { borderColor: 'primary.main' },
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
        <Avatar
          src={org.logo_url ?? undefined}
          variant="rounded"
          sx={{ width: 44, height: 44, bgcolor: alpha(theme.palette.primary.main, 0.16), color: 'primary.light', fontWeight: 700 }}
        >
          {org.name.charAt(0).toUpperCase()}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700 }} noWrap>
            {org.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            /{org.slug}
          </Typography>
        </Box>
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {org.projectCount} {org.projectCount === 1 ? 'project' : 'projects'}
      </Typography>
    </Paper>
  )
}

function NewOrgCard() {
  return (
    <Paper
      component={RouterLink}
      to="/orgs/new"
      elevation={0}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textDecoration: 'none',
        color: 'text.secondary',
        p: 2.5,
        height: '100%',
        minHeight: 128,
        borderRadius: 2.5,
        borderStyle: 'dashed',
        bgcolor: 'transparent',
        '&:hover': { borderColor: 'primary.main', color: 'primary.light' },
      }}
    >
      <AddRoundedIcon sx={{ fontSize: 28, mb: 0.5 }} />
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        New organization
      </Typography>
    </Paper>
  )
}

export default function HomePage() {
  const { isAdmin } = useAuth()
  const [orgs, setOrgs] = useState<OrgRow[] | null>(null)

  useEffect(() => {
    async function load() {
      // RLS on public.organizations already scopes this to orgs the caller
      // is a member of (see supabase/migrations/0005_org_project_hierarchy.sql).
      const { data: rows } = await supabase
        .from('organizations')
        .select('id, slug, name, logo_url')
        .order('created_at', { ascending: false })

      if (!rows || rows.length === 0) {
        setOrgs([])
        return
      }

      const { data: projects } = await supabase
        .from('projects')
        .select('org_id')
        .in(
          'org_id',
          rows.map((r) => r.id),
        )

      const countByOrgId = new Map<string, number>()
      for (const p of projects ?? []) {
        countByOrgId.set(p.org_id, (countByOrgId.get(p.org_id) ?? 0) + 1)
      }

      setOrgs(rows.map((r) => ({ ...r, projectCount: countByOrgId.get(r.id) ?? 0 })))
    }

    load()
  }, [])

  // Skip the org-selection screen entirely when there's only one
  // organization to pick from - go straight to it (which itself skips down
  // into its one project if there's only one, see OrgHomePage.tsx).
  if (orgs !== null && orgs.length === 1) {
    return <Navigate to={`/${orgs[0].slug}`} replace />
  }

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Stack direction="row" justifyContent="space-between" sx={{ alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Your organizations
        </Typography>
        <Button variant="outlined" size="small" onClick={() => supabase.auth.signOut()}>
          Log out
        </Button>
      </Stack>

      {orgs === null && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      )}

      {orgs !== null && orgs.length === 0 && !isAdmin && (
        <Typography color="text.secondary">
          No organizations yet - ask an admin to add you to one.
        </Typography>
      )}

      {orgs !== null && (
        <Grid container spacing={2.5}>
          {orgs.map((o) => (
            <Grid key={o.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <OrgCard org={o} />
            </Grid>
          ))}
          {isAdmin && (
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <NewOrgCard />
            </Grid>
          )}
        </Grid>
      )}
    </Container>
  )
}
