import { useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Box,
  Container,
  Typography,
  Button,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  CircularProgress,
} from '@mui/material'
import { Stack } from '../components/FlexStack'
import { supabase } from '../lib/supabaseClient'

interface ProjectRow {
  id: string
  slug: string
  name: string
}

export default function HomePage() {
  const [projects, setProjects] = useState<ProjectRow[] | null>(null)

  useEffect(() => {
    // RLS on public.projects already scopes this to the caller's own
    // projects (see supabase/migrations/0001_init.sql) - no explicit
    // member_id filter needed here.
    supabase
      .from('projects')
      .select('id, slug, name')
      .order('created_at', { ascending: false })
      .then(({ data }) => setProjects(data ?? []))
  }, [])

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Your projects
        </Typography>
        <Button variant="outlined" size="small" onClick={() => supabase.auth.signOut()}>
          Log out
        </Button>
      </Stack>

      {projects === null && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      )}

      {projects !== null && projects.length === 0 && (
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          No projects yet.
        </Typography>
      )}

      {projects !== null && projects.length > 0 && (
        <Paper sx={{ mb: 3 }}>
          <List disablePadding>
            {projects.map((p) => (
              <ListItemButton key={p.id} component={RouterLink} to={`/${p.slug}`}>
                <ListItemText primary={p.name} secondary={`/${p.slug}`} />
              </ListItemButton>
            ))}
          </List>
        </Paper>
      )}

      <Button variant="contained" component={RouterLink} to="/projects/new">
        New project
      </Button>
    </Container>
  )
}
