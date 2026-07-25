import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Box, Container, Paper, TextField, Button, Typography, Alert, Stack } from '@mui/material'
import { supabase } from '../lib/supabaseClient'
import { useOrg } from '../lib/OrgContext'

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function NewProjectPage() {
  const org = useOrg()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Membership is org-level only - only that org's owner can create projects
  // inside it (supabase/migrations/0005_org_project_hierarchy.sql).
  if (org.role !== 'owner') return <Navigate to={`/${org.slug}`} replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    const slug = slugify(name)
    if (!slug) {
      setError('Enter a project name')
      return
    }

    setSubmitting(true)
    setError(null)

    const { data: project, error: rpcError } = await supabase.rpc('create_project', {
      p_org_id: org.orgId,
      p_name: name.trim(),
      p_slug: slug,
    })

    setSubmitting(false)
    if (rpcError || !project) {
      setError(
        rpcError?.code === '23505' ? 'That project slug is already taken in this organization' : rpcError?.message ?? 'Failed to create project',
      )
      return
    }

    navigate(`/${org.slug}/${project.slug}`)
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
      <Container maxWidth="xs">
        <Paper sx={{ p: 4 }} component="form" onSubmit={handleSubmit}>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
            New project
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Inside {org.name}
          </Typography>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Project name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              helperText={name ? `URL: /${org.slug}/${slugify(name)}` : ' '}
              required
              fullWidth
              autoFocus
            />
            <Button type="submit" variant="contained" disabled={submitting} fullWidth>
              {submitting ? 'Creating…' : 'Create project'}
            </Button>
          </Stack>
        </Paper>
      </Container>
    </Box>
  )
}
