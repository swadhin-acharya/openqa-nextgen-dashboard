import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { Box, Container, Typography, Button, CircularProgress } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'

export interface OrgContextValue {
  orgId: string
  name: string
  slug: string
  logoUrl: string | null
  /** The caller's own org_members.role - 'owner' | 'member' | 'viewer'. */
  role: string
}

const OrgContext = createContext<OrgContextValue | null>(null)

export function useOrg(): OrgContextValue {
  const value = useContext(OrgContext)
  if (!value) throw new Error('useOrg() called outside an OrgProvider')
  return value
}

type LoadState =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'ready'; value: OrgContextValue }

/**
 * Resolves the :orgSlug route param to an organization (RLS-gated via
 * is_org_member() - see supabase/migrations/0005_org_project_hierarchy.sql -
 * a non-member querying a real slug gets zero rows, not the org's data) and
 * provides it via context so nested project routes don't each re-resolve
 * it. Renders loading/not-found states itself so children can assume a
 * resolved org.
 */
export function OrgProvider({ children }: { children: ReactNode }) {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const { session } = useAuth()
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    async function load() {
      setState({ status: 'loading' })

      const { data: org } = await supabase
        .from('organizations')
        .select('id, name, slug, logo_url')
        .eq('slug', orgSlug)
        .maybeSingle()

      if (cancelled) return
      if (!org || !session) {
        setState({ status: 'not-found' })
        return
      }

      const { data: membership } = await supabase
        .from('org_members')
        .select('role')
        .eq('org_id', org.id)
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (cancelled) return
      setState({
        status: 'ready',
        value: {
          orgId: org.id,
          name: org.name,
          slug: org.slug,
          logoUrl: org.logo_url,
          role: membership?.role ?? 'viewer',
        },
      })
    }

    load()
    return () => {
      cancelled = true
    }
  }, [orgSlug, session])

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
          This organization doesn't exist, or you're not a member of it.
        </Typography>
        <Button component={RouterLink} to="/" variant="outlined">
          Back to organizations
        </Button>
      </Container>
    )
  }

  return <OrgContext.Provider value={state.value}>{children}</OrgContext.Provider>
}
