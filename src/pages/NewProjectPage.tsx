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

    // Atomic via a SECURITY DEFINER RPC (supabase/migrations/0003_create_project_rpc.sql).
    // Two sequential client-side inserts (projects, then project_members)
    // don't work here: `.select().single()` on the projects insert triggers
    // RETURNING, which Postgres also checks against the SELECT policy - and
    // that policy requires a project_members row that doesn't exist until
    // the second insert. The RPC does both inserts server-side in one call.
    const { data: project, error: rpcError } = await supabase.rpc('create_project', {
      p_name: name.trim(),
      p_slug: slug,
    })

    setSubmitting(false)
    if (rpcError || !project) {
      setError(rpcError?.code === '23505' ? 'That project slug is already taken' : rpcError?.message ?? 'Failed to create project')
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
