import { useEffect, useState } from 'react'
import { Grid, Typography, Box, CircularProgress } from '@mui/material'
import { Stack } from '../components/FlexStack'
import { PageHeader } from '../components/layout/PageHeader'
import { SectionCard } from '../components/common/SectionCard'
import { useProject } from '../lib/ProjectContext'
import { supabase } from '../lib/supabaseClient'

interface EnvState {
  raw: Record<string, string> | null
  loading: boolean
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <Stack spacing={0.25}>
      <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 0.3 }}>
        {label.toUpperCase()}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
        {value}
      </Typography>
    </Stack>
  )
}

export default function ProjectEnvironmentPage() {
  const project = useProject()
  const [state, setState] = useState<EnvState>({ raw: null, loading: true })

  useEffect(() => {
    supabase
      .from('dashboard_data')
      .select('raw_environment')
      .eq('project_id', project.projectId)
      .maybeSingle()
      .then(({ data }) => {
        setState({ raw: (data?.raw_environment as Record<string, string> | undefined) ?? {}, loading: false })
      })
  }, [project.projectId])

  const entries = Object.entries(state.raw ?? {}).sort(([a], [b]) => a.localeCompare(b))

  return (
    <Stack>
      <PageHeader title="Environment" subtitle="All environment.properties from the latest main-branch execution" />

      {state.loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={28} />
        </Box>
      )}

      {!state.loading && entries.length === 0 && (
        <Typography color="text.secondary">No environment data recorded yet.</Typography>
      )}

      {!state.loading && entries.length > 0 && (
        <SectionCard title="Properties">
          <Grid container spacing={2.5}>
            {entries.map(([key, value]) => (
              <Grid key={key} size={{ xs: 12, sm: 6, md: 4 }}>
                <Field label={key} value={value} />
              </Grid>
            ))}
          </Grid>
        </SectionCard>
      )}
    </Stack>
  )
}
