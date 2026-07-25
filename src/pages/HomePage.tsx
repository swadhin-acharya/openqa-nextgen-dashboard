import { useEffect, useState } from 'react'
import { Link as RouterLink, Navigate } from 'react-router-dom'
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  Grid,
  Avatar,
  CircularProgress,
  alpha,
  useTheme,
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import { Stack } from '../components/FlexStack'
import { supabase } from '../lib/supabaseClient'
import { statusColors } from '../theme/theme'
import { formatPercent, formatDateTime } from '../utils/format'
import type { SummaryData } from '../../processor/models.js'

interface ProjectRow {
  id: string
  slug: string
  name: string
  logo_url: string | null
  summary: SummaryData | null
  lastUpdated: string | null
}

function passRateColor(passRate: number) {
  if (passRate >= 90) return statusColors.passed
  if (passRate >= 70) return statusColors.skipped
  return statusColors.failed
}

function ProjectCard({ project }: { project: ProjectRow }) {
  const theme = useTheme()
  const current = project.summary?.current

  return (
    <Paper
      component={RouterLink}
      to={`/${project.slug}`}
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
          src={project.logo_url ?? undefined}
          variant="rounded"
          sx={{ width: 44, height: 44, bgcolor: alpha(theme.palette.primary.main, 0.16), color: 'primary.light', fontWeight: 700 }}
        >
          {project.name.charAt(0).toUpperCase()}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700 }} noWrap>
            {project.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            /{project.slug}
          </Typography>
        </Box>
      </Stack>

      {current ? (
        <Stack direction="row" justifyContent="space-between" sx={{ alignItems: 'baseline' }}>
          <Typography sx={{ fontWeight: 700, color: passRateColor(current.passRate) }}>
            {formatPercent(current.passRate)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {project.lastUpdated ? formatDateTime(project.lastUpdated) : null}
          </Typography>
        </Stack>
      ) : (
        <Typography variant="caption" color="text.secondary">
          No runs ingested yet
        </Typography>
      )}
    </Paper>
  )
}

function NewProjectCard() {
  return (
    <Paper
      component={RouterLink}
      to="/projects/new"
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
        New project
      </Typography>
    </Paper>
  )
}

export default function HomePage() {
  const [projects, setProjects] = useState<ProjectRow[] | null>(null)

  useEffect(() => {
    async function load() {
      // RLS on public.projects already scopes this to the caller's own
      // projects (see supabase/migrations/0001_init.sql).
      const { data: rows } = await supabase
        .from('projects')
        .select('id, slug, name, logo_url')
        .order('created_at', { ascending: false })

      if (!rows || rows.length === 0) {
        setProjects([])
        return
      }

      const { data: dashboards } = await supabase
        .from('dashboard_data')
        .select('project_id, summary, updated_at')
        .in(
          'project_id',
          rows.map((r) => r.id),
        )

      const byProjectId = new Map((dashboards ?? []).map((d) => [d.project_id, d]))
      setProjects(
        rows.map((r) => ({
          ...r,
          summary: (byProjectId.get(r.id)?.summary as SummaryData | undefined) ?? null,
          lastUpdated: byProjectId.get(r.id)?.updated_at ?? null,
        })),
      )
    }

    load()
  }, [])

  // Skip the project-selection screen entirely when there's only one
  // project to pick from - go straight to its dashboard.
  if (projects !== null && projects.length === 1) {
    return <Navigate to={`/${projects[0].slug}`} replace />
  }

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Stack direction="row" justifyContent="space-between" sx={{ alignItems: 'center', mb: 3 }}>
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

      {projects !== null && (
        <Grid container spacing={2.5}>
          {projects.map((p) => (
            <Grid key={p.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <ProjectCard project={p} />
            </Grid>
          ))}
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <NewProjectCard />
          </Grid>
        </Grid>
      )}
    </Container>
  )
}
