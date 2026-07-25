import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { Box, Container, Typography, Button, CircularProgress } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useOrg } from './OrgContext'

export interface ProjectContextValue {
  projectId: string
  name: string
  slug: string
  /** dashboard_data.updated_at for this project, or null if no run has been ingested yet. */
  lastUpdated: string | null
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

export function useProject(): ProjectContextValue {
  const value = useContext(ProjectContext)
  if (!value) throw new Error('useProject() called outside a ProjectProvider')
  return value
}

type LoadState =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'ready'; value: ProjectContextValue }

/**
 * Resolves the :projectSlug route param to a project *within the current
 * org* (see useOrg() - this must render inside an OrgProvider). Membership
 * is org-level only (supabase/migrations/0005_org_project_hierarchy.sql),
 * so is_org_member() already gated access at the OrgProvider level; this
 * only needs to find the project row itself.
 */
export function ProjectProvider({ children }: { children: ReactNode }) {
  const org = useOrg()
  const { projectSlug } = useParams<{ projectSlug: string }>()
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    async function load() {
      setState({ status: 'loading' })

      const { data: project } = await supabase
        .from('projects')
        .select('id, name, slug')
        .eq('org_id', org.orgId)
        .eq('slug', projectSlug)
        .maybeSingle()

      if (cancelled) return
      if (!project) {
        setState({ status: 'not-found' })
        return
      }

      const { data: dashboardRow } = await supabase
        .from('dashboard_data')
        .select('updated_at')
        .eq('project_id', project.id)
        .maybeSingle()

      if (cancelled) return
      setState({
        status: 'ready',
        value: {
          projectId: project.id,
          name: project.name,
          slug: project.slug,
          lastUpdated: dashboardRow?.updated_at ?? null,
        },
      })
    }

    load()
    return () => {
      cancelled = true
    }
  }, [org.orgId, projectSlug])

  if (state.status === 'loading') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (state.status === 'not-found') {
    return (
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
          Not found
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          This project doesn't exist in {org.name}.
        </Typography>
        <Button component={RouterLink} to={`/${org.slug}`} variant="outlined">
          Back to {org.name}
        </Button>
      </Container>
    )
  }

  return <ProjectContext.Provider value={state.value}>{children}</ProjectContext.Provider>
}
