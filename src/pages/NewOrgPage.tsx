import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
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

async function uploadOrgLogo(orgId: string, file: File): Promise<string | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
  const path = `${orgId}/logo.${ext}`
  const { error } = await supabase.storage.from('project-logos').upload(path, file, { upsert: true })
  if (error) return null
  return supabase.storage.from('project-logos').getPublicUrl(path).data.publicUrl
}

export default function NewOrgPage() {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // isAdmin is null while still resolving - only bounce once we know for sure.
  if (isAdmin === false) return <Navigate to="/" replace />

  function handleLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setLogoFile(file)
    setLogoPreview(file ? URL.createObjectURL(file) : null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    const slug = slugify(name)
    if (!slug) {
      setError('Enter an organization name')
      return
    }
    if (!ownerEmail.trim()) {
      setError("Enter the new org owner's email")
      return
    }

    setSubmitting(true)
    setError(null)

    const { data: org, error: rpcError } = await supabase.rpc('create_organization', {
      p_name: name.trim(),
      p_slug: slug,
      p_owner_email: ownerEmail.trim(),
    })

    if (rpcError || !org) {
      setSubmitting(false)
      setError(
        rpcError?.code === '23505'
          ? 'That organization slug is already taken'
          : rpcError?.code === 'P0002'
            ? `No account found for ${ownerEmail.trim()} - they need to sign up first`
            : rpcError?.message ?? 'Failed to create organization',
      )
      return
    }

    if (logoFile) {
      const logoUrl = await uploadOrgLogo(org.id, logoFile)
      if (logoUrl) {
        await supabase.from('organizations').update({ logo_url: logoUrl }).eq('id', org.id)
      }
    }

    setSubmitting(false)
    navigate(`/${org.slug}`)
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
      <Container maxWidth="xs">
        <Paper sx={{ p: 4 }} component="form" onSubmit={handleSubmit}>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
            New organization
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Admin only - projects are created afterwards by the org's owner.
          </Typography>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Organization name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              helperText={name ? `URL: /${slugify(name)}` : ' '}
              required
              fullWidth
              autoFocus
            />
            <TextField
              label="Owner's email"
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              helperText="Must already have an OpenQA account"
              required
              fullWidth
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
              {submitting ? 'Creating…' : 'Create organization'}
            </Button>
          </Stack>
        </Paper>
      </Container>
    </Box>
  )
}
