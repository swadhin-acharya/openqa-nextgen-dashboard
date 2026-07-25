import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { Box, Container, Typography, Button, CircularProgress } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { supabase } from './supabaseClient'

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
 * Resolves the :slug route param to a project (RLS-gated - a non-member
 * querying a real slug gets zero rows, not the project's data, same as
 * supabase/migrations/0001_init.sql's "members can read their projects"
 * policy) and provides it via context so nested pages (Overview, Tokens)
 * don't each re-resolve it. Renders loading/not-found states itself so
 * children can assume a resolved project.
 */
export function ProjectProvider({ children }: { children: ReactNode }) {
  const { slug } = useParams<{ slug: string }>()
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    async function load() {
      setState({ status: 'loading' })

      const { data: project } = await supabase
        .from('projects')
        .select('id, name, slug')
        .eq('slug', slug)
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
  }, [slug])

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
          This project doesn't exist, or you're not a member of it.
        </Typography>
        <Button component={RouterLink} to="/" variant="outlined">
          Back to projects
        </Button>
      </Container>
    )
  }

  return <ProjectContext.Provider value={state.value}>{children}</ProjectContext.Provider>
}
