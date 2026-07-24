import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Container, Paper, TextField, Button, Typography, Alert, Stack } from '@mui/material'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function NewProjectPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!session) return

    const slug = slugify(name)
    if (!slug) {
      setError('Enter a project name')
      return
    }

    setSubmitting(true)
    setError(null)

    // Two sequential inserts from the browser, each permitted by RLS
    // (projects.insert checks owner_id = auth.uid(); project_members.insert
    // checks user_id = auth.uid()). Not wrapped in a DB transaction for this
    // demo - a Postgres RPC function would be the hardening step later.
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({ name: name.trim(), slug, owner_id: session.user.id })
      .select('id, slug')
      .single()

    if (projectError || !project) {
      setSubmitting(false)
      setError(projectError?.code === '23505' ? 'That project slug is already taken' : projectError?.message ?? 'Failed to create project')
      return
    }

    const { error: memberError } = await supabase
      .from('project_members')
      .insert({ project_id: project.id, user_id: session.user.id, role: 'owner' })

    setSubmitting(false)
    if (memberError) {
      setError(memberError.message)
      return
    }

    navigate(`/${project.slug}`)
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
      <Container maxWidth="xs">
        <Paper sx={{ p: 4 }} component="form" onSubmit={handleSubmit}>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
            New project
          </Typography>
          <Stack spacing={2} sx={{ mt: 2 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Project name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              helperText={name ? `URL: /${slugify(name)}` : ' '}
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
