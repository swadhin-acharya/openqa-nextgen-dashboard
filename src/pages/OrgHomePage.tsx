import { useEffect, useState } from 'react'
import { Link as RouterLink, Navigate } from 'react-router-dom'
import { Box, Container, Typography, Button, Paper, Grid, CircularProgress } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import { Stack } from '../components/FlexStack'
import { supabase } from '../lib/supabaseClient'
import { useOrg } from '../lib/OrgContext'
import { statusColors } from '../theme/theme'
import { formatPercent, formatDateTime } from '../utils/format'
import type { SummaryData } from '../../processor/models.js'

interface ProjectRow {
  id: string
  slug: string
  name: string
  summary: SummaryData | null
  lastUpdated: string | null
}

function passRateColor(passRate: number) {
  if (passRate >= 90) return statusColors.passed
  if (passRate >= 70) return statusColors.skipped
  return statusColors.failed
}

function ProjectCard({ orgSlug, project }: { orgSlug: string; project: ProjectRow }) {
  const current = project.summary?.current

  return (
    <Paper
      component={RouterLink}
      to={`/${orgSlug}/${project.slug}`}
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
      <Typography sx={{ fontWeight: 700, mb: 0.25 }} noWrap>
        {project.name}
      </Typography>
      <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', mb: 2 }}>
        /{orgSlug}/{project.slug}
      </Typography>

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
      to="projects/new"
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

export default function OrgHomePage() {
  const org = useOrg()
  const [projects, setProjects] = useState<ProjectRow[] | null>(null)

  useEffect(() => {
    async function load() {
      const { data: rows } = await supabase
        .from('projects')
        .select('id, slug, name')
        .eq('org_id', org.orgId)
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
  }, [org.orgId])

  // Skip straight into the one project when there's only one - but not for
  // this org's owner, who needs to be able to reach "New project" here.
  if (projects !== null && projects.length === 1 && org.role !== 'owner') {
    return <Navigate to={`/${org.slug}/${projects[0].slug}`} replace />
  }

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Stack direction="row" justifyContent="space-between" sx={{ alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          {org.name}
        </Typography>
        {org.role === 'owner' && (
          <Button component={RouterLink} to="members" variant="outlined" size="small">
            Members
          </Button>
        )}
      </Stack>

      {projects === null && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      )}

      {projects !== null && projects.length === 0 && org.role !== 'owner' && (
        <Typography color="text.secondary">No projects yet.</Typography>
      )}

      {projects !== null && (
        <Grid container spacing={2.5}>
          {projects.map((p) => (
            <Grid key={p.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <ProjectCard orgSlug={org.slug} project={p} />
            </Grid>
          ))}
          {org.role === 'owner' && (
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <NewProjectCard />
            </Grid>
          )}
        </Grid>
      )}

      <Button component={RouterLink} to="/" variant="text" size="small" sx={{ mt: 3, color: 'text.secondary' }}>
        ← All organizations
      </Button>
    </Container>
  )
}
