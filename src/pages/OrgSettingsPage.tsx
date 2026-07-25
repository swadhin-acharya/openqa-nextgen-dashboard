import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Navigate, Link as RouterLink } from 'react-router-dom'
import { Container, Paper, TextField, Button, Typography, Alert, Avatar } from '@mui/material'
import UploadRoundedIcon from '@mui/icons-material/UploadRounded'
import { Stack } from '../components/FlexStack'
import { supabase } from '../lib/supabaseClient'
import { useOrg } from '../lib/OrgContext'

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function uploadOrgLogo(orgId: string, file: File): Promise<string | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
  const path = `${orgId}/logo.${ext}`
  const { error } = await supabase.storage.from('project-logos').upload(path, file, { upsert: true })
  if (error) return null
  return supabase.storage.from('project-logos').getPublicUrl(path).data.publicUrl
}

export default function OrgSettingsPage() {
  const org = useOrg()
  const [name, setName] = useState(org.name)
  const [slug, setSlug] = useState(org.slug)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(org.logoUrl)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Owner-gated, same as OrgMembersPage - only an org's owner should be
  // able to rename it or change its slug (which changes every URL under it).
  if (org.role !== 'owner') return <Navigate to={`/${org.slug}`} replace />

  function handleLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setLogoFile(file)
    setLogoPreview(file ? URL.createObjectURL(file) : org.logoUrl)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    const newSlug = slugify(slug)
    if (!newSlug) {
      setError('Enter an organization name')
      return
    }

    setSubmitting(true)
    setError(null)

    const { error: updateError } = await supabase
      .from('organizations')
      .update({ name: name.trim(), slug: newSlug })
      .eq('id', org.orgId)

    if (updateError) {
      setSubmitting(false)
      setError(updateError.code === '23505' ? 'That slug is already taken' : updateError.message)
      return
    }

    if (logoFile) {
      const logoUrl = await uploadOrgLogo(org.orgId, logoFile)
      if (logoUrl) await supabase.from('organizations').update({ logo_url: logoUrl }).eq('id', org.orgId)
    }

    setSubmitting(false)
    // org/project data is cached in context, keyed off the URL slug params -
    // a full navigation (rather than in-place state update) is the simplest
    // way to guarantee every consumer (Sidebar, OrgHomePage, etc.) reloads
    // with the new values, especially when the slug itself just changed.
    window.location.href = `/${newSlug}/settings`
  }

  return (
    <Container maxWidth="xs" sx={{ py: 6 }}>
      <Stack direction="row" justifyContent="space-between" sx={{ alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Org settings
        </Typography>
        <Button component={RouterLink} to={`/${org.slug}`} variant="text" size="small">
          ← Back
        </Button>
      </Stack>

      <Paper sx={{ p: 4 }} component="form" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Organization name"
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
            helperText={`URL: /${slugify(slug)} - changing this breaks any existing bookmarked links`}
            required
            fullWidth
          />

          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Avatar
              src={logoPreview ?? undefined}
              variant="rounded"
              sx={{ width: 48, height: 48, bgcolor: 'background.default', '& .MuiAvatar-img': { objectFit: 'contain' } }}
            >
              {org.name.charAt(0).toUpperCase()}
            </Avatar>
            <Button component="label" variant="outlined" size="small" startIcon={<UploadRoundedIcon sx={{ fontSize: 16 }} />}>
              {logoFile ? 'Change logo' : 'Change logo'}
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
