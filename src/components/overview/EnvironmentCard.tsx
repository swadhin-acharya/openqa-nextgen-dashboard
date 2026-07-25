import { Grid, Stack, Typography } from '@mui/material'
import { SectionCard } from '../common/SectionCard'
import type { EnvironmentInfo } from '../../../processor/models.js'

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <Stack spacing={0.25}>
      <Typography variant="caption" sx={{ color: 'text.secondary', letterSpacing: 0.3 }}>
        {label.toUpperCase()}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {value && value.length > 0 ? value : 'N/A'}
      </Typography>
    </Stack>
  )
}

export function EnvironmentCard({ environment }: { environment: EnvironmentInfo | null }) {
  const env = environment ?? {}

  return (
    <SectionCard title="Environment">
      <Grid container spacing={2}>
        <Grid size={6}>
          <Field label="OS" value={env.os} />
        </Grid>
        <Grid size={6}>
          <Field label="Java" value={env.java} />
        </Grid>
        <Grid size={6}>
          <Field label="Platform" value={env.platform} />
        </Grid>
        <Grid size={6}>
          <Field label="Framework" value={env.framework} />
        </Grid>
        <Grid size={6}>
          <Field label="Branch" value={env.branch} />
        </Grid>
        <Grid size={6}>
          <Field label="Build" value={env.build} />
        </Grid>
      </Grid>
    </SectionCard>
  )
}
