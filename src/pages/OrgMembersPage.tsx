import { useEffect, useState } from 'react'
import { Navigate, Link as RouterLink } from 'react-router-dom'
import {
  Container,
  Typography,
  Paper,
  TextField,
  Button,
  Select,
  MenuItem,
  Alert,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Box,
  type SelectChangeEvent,
} from '@mui/material'
import { Stack } from '../components/FlexStack'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import { useOrg } from '../lib/OrgContext'

interface MemberRow {
  userId: string
  role: string
  name: string
  email: string
}

const ROLES = ['owner', 'member', 'viewer']

export default function OrgMembersPage() {
  const org = useOrg()
  const { session } = useAuth()
  const [members, setMembers] = useState<MemberRow[] | null>(null)
  const [email, setEmail] = useState('')
  const [newRole, setNewRole] = useState('member')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function refresh() {
    const { data: memberships } = await supabase.from('org_members').select('user_id, role').eq('org_id', org.orgId)
    if (!memberships || memberships.length === 0) {
      setMembers([])
      return
    }
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, email')
      .in(
        'id',
        memberships.map((m) => m.user_id),
      )
    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]))
    setMembers(
      memberships.map((m) => ({
        userId: m.user_id,
        role: m.role,
        name: profileById.get(m.user_id)?.name ?? 'Unknown',
        email: profileById.get(m.user_id)?.email ?? '',
      })),
    )
  }

  useEffect(() => {
    refresh()
  }, [org.orgId])

  if (org.role !== 'owner') return <Navigate to={`/${org.slug}`} replace />

  async function callMembersApi(body: Record<string, unknown>) {
    if (!session) return
    setBusy(true)
    setError(null)
    const res = await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ orgId: org.orgId, ...body }),
    })
    const responseBody = await res.json()
    setBusy(false)
    if (!res.ok) {
      setError(responseBody.error ?? 'Something went wrong')
      return
    }
    await refresh()
  }

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Stack direction="row" justifyContent="space-between" sx={{ alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          {org.name} members
        </Typography>
        <Button component={RouterLink} to={`/${org.slug}`} variant="text" size="small">
          ← Back
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2.5, mb: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
          Add an existing member
        </Typography>
        <Stack direction="row" spacing={1.5}>
          <TextField size="small" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} sx={{ flex: 1 }} />
          <Select size="small" value={newRole} onChange={(e: SelectChangeEvent) => setNewRole(e.target.value)}>
            {ROLES.map((r) => (
              <MenuItem key={r} value={r}>
                {r}
              </MenuItem>
            ))}
          </Select>
          <Button
            variant="contained"
            disabled={busy || !email.trim()}
            onClick={async () => {
              await callMembersApi({ action: 'add', email: email.trim(), role: newRole })
              setEmail('')
            }}
          >
            Add
          </Button>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          They must already have an OpenQA account.
        </Typography>
      </Paper>

      {members === null && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      )}

      {members !== null && (
        <Paper>
          <List disablePadding>
            {members.map((m) => (
              <ListItem
                key={m.userId}
                divider
                secondaryAction={
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Select
                      size="small"
                      value={m.role}
                      disabled={busy || m.userId === session?.user.id}
                      onChange={(e: SelectChangeEvent) => callMembersApi({ action: 'update-role', userId: m.userId, role: e.target.value })}
                      sx={{ minWidth: 100 }}
                    >
                      {ROLES.map((r) => (
                        <MenuItem key={r} value={r}>
                          {r}
                        </MenuItem>
                      ))}
                    </Select>
                    <Button
                      size="small"
                      color="error"
                      disabled={busy || m.userId === session?.user.id}
                      onClick={() => callMembersApi({ action: 'remove', userId: m.userId })}
                    >
                      Remove
                    </Button>
                  </Stack>
                }
              >
                <ListItemText primary={m.name} secondary={m.email} />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}
    </Container>
  )
}
