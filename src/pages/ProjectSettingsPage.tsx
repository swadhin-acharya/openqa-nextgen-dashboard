import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Navigate, Link as RouterLink } from 'react-router-dom'
import { Container, Paper, TextField, Button, Typography, Alert, Avatar } from '@mui/material'
import UploadRoundedIcon from '@mui/icons-material/UploadRounded'
import { Stack } from '../components/FlexStack'
import { supabase } from '../lib/supabaseClient'
import { useOrg } from '../lib/OrgContext'
import { useProject } from '../lib/ProjectContext'

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function uploadProjectLogo(projectId: string, file: File): Promise<string | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
  const path = `${projectId}/logo.${ext}`
  const { error } = await supabase.storage.from('project-logos').upload(path, file, { upsert: true })
  if (error) return null
  return supabase.storage.from('project-logos').getPublicUrl(path).data.publicUrl
}

export default function ProjectSettingsPage() {
  const org = useOrg()
  const project = useProject()
  const [name, setName] = useState(project.name)
  const [slug, setSlug] = useState(project.slug)
  const [mainBranch, setMainBranch] = useState(project.mainBranch)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(project.logoUrl)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Owner-gated, same as NewProjectPage - membership is org-level only, so
  // "owner" here means owner of the whole org, not just this one project.
  if (org.role !== 'owner') return <Navigate to={`/${org.slug}/${project.slug}`} replace />

  function handleLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setLogoFile(file)
    setLogoPreview(file ? URL.createObjectURL(file) : project.logoUrl)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    const newSlug = slugify(slug)
    if (!newSlug) {
      setError('Enter a project name')
      return
    }
    if (!mainBranch.trim()) {
      setError('Enter a main branch name')
      return
    }

    setSubmitting(true)
    setError(null)

    const { error: updateError } = await supabase
      .from('projects')
      .update({ name: name.trim(), slug: newSlug, main_branch: mainBranch.trim() })
      .eq('id', project.projectId)

    if (updateError) {
      setSubmitting(false)
      setError(updateError.code === '23505' ? 'That slug is already taken in this org' : updateError.message)
      return
    }

    if (logoFile) {
      const logoUrl = await uploadProjectLogo(project.projectId, logoFile)
      if (logoUrl) await supabase.from('projects').update({ logo_url: logoUrl }).eq('id', project.projectId)
    }

    setSubmitting(false)
    // Same reasoning as OrgSettingsPage - a full navigation guarantees every
    // cached consumer (Sidebar, ProjectContext) reloads with fresh values.
    window.location.href = `/${org.slug}/${newSlug}/settings`
  }

  return (
    <Container maxWidth="xs" sx={{ py: 6 }}>
      <Stack direction="row" justifyContent="space-between" sx={{ alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Project settings
        </Typography>
        <Button component={RouterLink} to={`/${org.slug}/${project.slug}`} variant="text" size="small">
          ← Back
        </Button>
      </Stack>

      <Paper sx={{ p: 4 }} component="form" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            fullWidth
            autoFocus
          />
          <TextField
            label="Slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            helperText={`URL: /${org.slug}/${slugify(slug)} - changing this breaks any existing bookmarked links`}
            required
            fullWidth
          />
          <TextField
            label="Main branch"
            value={mainBranch}
            onChange={(e) => setMainBranch(e.target.value)}
            helperText="Only executions on this branch (or with no branch set) merge into the shared Overview dashboard"
            required
            fullWidth
          />

          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Avatar
              src={logoPreview ?? undefined}
              variant="rounded"
              sx={{ width: 48, height: 48, bgcolor: 'background.default', '& .MuiAvatar-img': { objectFit: 'contain' } }}
            >
              {project.name.charAt(0).toUpperCase()}
            </Avatar>
            <Button component="label" variant="outlined" size="small" startIcon={<UploadRoundedIcon sx={{ fontSize: 16 }} />}>
              Change logo
              <input type="file" accept="image/*" hidden onChange={handleLogoChange} />
            </Button>
          </Stack>

          <Button type="submit" variant="contained" disabled={submitting} fullWidth>
            {submitting ? 'Saving…' : 'Save changes'}
          </Button>
        </Stack>
      </Paper>
    </Container>
  )
}
