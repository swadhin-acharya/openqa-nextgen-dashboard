import { useEffect, useState } from 'react'
import {
  Box,
  Stack,
  Typography,
  Paper,
  Button,
  TextField,
  IconButton,
  Snackbar,
  List,
  ListItem,
  ListItemText,
  Alert,
  CircularProgress,
  Tooltip,
} from '@mui/material'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import { Stack as FlexStack } from '../components/FlexStack'
import { PageHeader } from '../components/layout/PageHeader'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import { useOrg } from '../lib/OrgContext'
import { useProject } from '../lib/ProjectContext'

interface TokenRow {
  id: string
  user_id: string
  name: string
  token_prefix: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
  ownerName: string
}

export default function TokensPage() {
  const org = useOrg()
  const project = useProject()
  const { session } = useAuth()
  const [tokens, setTokens] = useState<TokenRow[] | null>(null)
  const [freshToken, setFreshToken] = useState<string | null>(null)
  const [newTokenName, setNewTokenName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [busyTokenId, setBusyTokenId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function refresh() {
    // RLS: viewers/members see only their own tokens; owners see everyone's
    // (see supabase/migrations/0011_owner_sees_all_tokens.sql).
    const { data } = await supabase
      .from('personal_access_tokens')
      .select('id, user_id, name, token_prefix, created_at, last_used_at, revoked_at')
      .eq('project_id', project.projectId)
      .order('created_at', { ascending: false })

    if (!data || data.length === 0) {
      setTokens([])
      return
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name')
      .in(
        'id',
        [...new Set(data.map((t) => t.user_id))],
      )
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]))
    setTokens(data.map((t) => ({ ...t, ownerName: nameById.get(t.user_id) ?? 'Unknown' })))
  }

  useEffect(() => {
    refresh()
  }, [project.projectId])

  // Shared by both the "Generate token" button and regenerate - a
  // regenerated token is just a fresh row with the same name, immediately
  // surfaced through the same one-time reveal.
  async function generate(name: string): Promise<boolean> {
    if (!session) return false
    const res = await fetch('/api/tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ projectId: project.projectId, name }),
    })
    const body = await res.json()
    if (!res.ok) {
      setError(body.error ?? 'Failed to generate token')
      return false
    }
    setFreshToken(body.token)
    return true
  }

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    setFreshToken(null)
    await generate(newTokenName.trim() || 'New token')
    setNewTokenName('')
    setGenerating(false)
    refresh()
  }

  async function handleRevoke(tokenId: string) {
    setError(null)
    setBusyTokenId(tokenId)
    const { error: revokeError } = await supabase
      .from('personal_access_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', tokenId)
    setBusyTokenId(null)
    if (revokeError) {
      setError(revokeError.message)
      return
    }
    refresh()
  }

  async function handleRegenerate(tokenId: string, name: string) {
    setError(null)
    setFreshToken(null)
    setBusyTokenId(tokenId)
    const { error: revokeError } = await supabase
      .from('personal_access_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', tokenId)
    if (revokeError) {
      setBusyTokenId(null)
      setError(revokeError.message)
      return
    }
    await generate(name)
    setBusyTokenId(null)
    refresh()
  }

  async function handleDelete(tokenId: string) {
    setError(null)
    setBusyTokenId(tokenId)
    const { error: deleteError } = await supabase
      .from('personal_access_tokens')
      .delete()
      .eq('id', tokenId)
    setBusyTokenId(null)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    refresh()
  }

  async function handleCopy() {
    if (!freshToken) return
    await navigator.clipboard.writeText(freshToken)
    setCopied(true)
  }

  const canGenerate = org.role !== 'viewer'

  return (
    <Stack>
      <PageHeader title="Access tokens" subtitle={`Personal access tokens for ${project.name}`} />

      {freshToken && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Copy this now — it won't be shown again:
          <FlexStack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
            <Box component="code" sx={{ fontWeight: 700, wordBreak: 'break-all', flexGrow: 1 }}>
              {freshToken}
            </Box>
            <Tooltip title="Copy to clipboard">
              <IconButton size="small" onClick={handleCopy}>
                <ContentCopyRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </FlexStack>
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Snackbar
        open={copied}
        autoHideDuration={2000}
        onClose={() => setCopied(false)}
        message={
          <FlexStack direction="row" alignItems="center" spacing={1}>
            <CheckRoundedIcon fontSize="small" />
            <span>Copied to clipboard</span>
          </FlexStack>
        }
      />

      {canGenerate ? (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 3 }}>
          <TextField
            size="small"
            label="Token name"
            placeholder="e.g. CI, my-laptop"
            value={newTokenName}
            onChange={(e) => setNewTokenName(e.target.value)}
            sx={{ maxWidth: 280 }}
          />
          <Button variant="contained" onClick={handleGenerate} disabled={generating} sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}>
            {generating ? 'Generating…' : 'Generate token'}
          </Button>
        </Stack>
      ) : (
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Viewers can't generate tokens - ask an owner or member.
        </Typography>
      )}

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
            {tokens.map((t) => {
              const canManage = t.user_id === session?.user.id || org.role === 'owner'
              const isBusy = busyTokenId === t.id
              return (
                <ListItem
                  key={t.id}
                  divider
                  secondaryAction={
                    canManage && (
                      <Stack direction="row" spacing={1}>
                        {!t.revoked_at && (
                          <>
                            <Button size="small" onClick={() => handleRegenerate(t.id, t.name)} disabled={isBusy}>
                              Regenerate
                            </Button>
                            <Button size="small" color="error" onClick={() => handleRevoke(t.id)} disabled={isBusy}>
                              Revoke
                            </Button>
                          </>
                        )}
                        {t.revoked_at && (
                          <Button size="small" color="error" onClick={() => handleDelete(t.id)} disabled={isBusy}>
                            Delete
                          </Button>
                        )}
                      </Stack>
                    )
                  }
                >
                  <ListItemText
                    primary={`${t.name} · ${t.token_prefix}…${t.revoked_at ? ' (revoked)' : ''}${t.user_id !== session?.user.id ? ` · ${t.ownerName}` : ''}`}
                    secondary={
                      t.last_used_at
                        ? `Last used ${new Date(t.last_used_at).toLocaleString()}`
                        : `Created ${new Date(t.created_at).toLocaleString()} — never used`
                    }
                  />
                </ListItem>
              )
            })}
          </List>
        </Paper>
      )}
    </Stack>
  )
}
