import { useEffect, useState } from 'react'
import {
  Box,
  Stack,
  Typography,
  Paper,
  Button,
  List,
  ListItem,
  ListItemText,
  Alert,
  CircularProgress,
} from '@mui/material'
import { PageHeader } from '../components/layout/PageHeader'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import { useProject } from '../lib/ProjectContext'

interface TokenRow {
  id: string
  name: string
  token_prefix: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

export default function TokensPage() {
  const project = useProject()
  const { session } = useAuth()
  const [tokens, setTokens] = useState<TokenRow[] | null>(null)
  const [freshToken, setFreshToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  async function refresh() {
    const { data } = await supabase
      .from('personal_access_tokens')
      .select('id, name, token_prefix, created_at, last_used_at, revoked_at')
      .eq('project_id', project.projectId)
      .order('created_at', { ascending: false })
    setTokens(data ?? [])
  }

  useEffect(() => {
    refresh()
  }, [project.projectId])

  async function handleGenerate() {
    if (!session) return
    setGenerating(true)
    setError(null)
    setFreshToken(null)

    const res = await fetch('/api/tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ projectId: project.projectId, name: 'default' }),
    })
    const body = await res.json()
    setGenerating(false)

    if (!res.ok) {
      setError(body.error ?? 'Failed to generate token')
      return
    }

    setFreshToken(body.token)
    refresh()
  }

  return (
    <Stack>
      <PageHeader title="Access tokens" subtitle={`Personal access tokens for ${project.name}`} />

      {freshToken && (
        <Alert severity="success" sx={{ mb: 3, wordBreak: 'break-all' }}>
          Copy this now — it won't be shown again:
          <Box component="code" sx={{ display: 'block', mt: 1, fontWeight: 700 }}>
            {freshToken}
          </Box>
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Button variant="contained" onClick={handleGenerate} disabled={generating} sx={{ mb: 3, alignSelf: 'flex-start' }}>
        {generating ? 'Generating…' : 'Generate token'}
      </Button>

      {tokens === null && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      )}

      {tokens !== null && tokens.length === 0 && (
        <Typography color="text.secondary">No tokens yet.</Typography>
      )}

      {tokens !== null && tokens.length > 0 && (
        <Paper>
          <List disablePadding>
            {tokens.map((t) => (
              <ListItem key={t.id} divider>
                <ListItemText
                  primary={`${t.token_prefix}…${t.revoked_at ? ' (revoked)' : ''}`}
                  secondary={
                    t.last_used_at
                      ? `Last used ${new Date(t.last_used_at).toLocaleString()}`
                      : `Created ${new Date(t.created_at).toLocaleString()} — never used`
                  }
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}
    </Stack>
  )
}
