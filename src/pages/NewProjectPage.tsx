import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Container, Paper, TextField, Button, Typography, Alert, Stack, Avatar } from '@mui/material'
import UploadRoundedIcon from '@mui/icons-material/UploadRounded'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Uploads to project-logos/<project_id>/logo.<ext> and returns its public URL. */
async function uploadProjectLogo(projectId: string, file: File): Promise<string | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
  const path = `${projectId}/logo.${ext}`
  const { error } = await supabase.storage.from('project-logos').upload(path, file, { upsert: true })
  if (error) return null
  return supabase.storage.from('project-logos').getPublicUrl(path).data.publicUrl
}

export default function NewProjectPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function handleLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setLogoFile(file)
    setLogoPreview(file ? URL.createObjectURL(file) : null)
  }

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

    if (rpcError || !project) {
      setSubmitting(false)
      setError(rpcError?.code === '23505' ? 'That project slug is already taken' : rpcError?.message ?? 'Failed to create project')
      return
    }

    // Logo upload is best-effort - a failure here shouldn't block navigating
    // into the project that was already successfully created.
    if (logoFile) {
      const logoUrl = await uploadProjectLogo(project.id, logoFile)
      if (logoUrl) {
        await supabase.from('projects').update({ logo_url: logoUrl }).eq('id', project.id)
      }
    }

    setSubmitting(false)
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

            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <Avatar src={logoPreview ?? undefined} variant="rounded" sx={{ width: 48, height: 48 }} />
              <Button
                component="label"
                variant="outlined"
                size="small"
                startIcon={<UploadRoundedIcon sx={{ fontSize: 16 }} />}
              >
                {logoFile ? 'Change logo' : 'Add logo (optional)'}
                <input type="file" accept="image/*" hidden onChange={handleLogoChange} />
              </Button>
            </Stack>

            <Button type="submit" variant="contained" disabled={submitting} fullWidth>
              {submitting ? 'Creating…' : 'Create project'}
            </Button>
          </Stack>
        </Paper>
      </Container>
    </Box>
  )
}
