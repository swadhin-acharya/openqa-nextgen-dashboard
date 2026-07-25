import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Paper, TextField, Button, Typography, Alert, Stack } from '@mui/material'
import { AuthLayout } from '../components/layout/AuthLayout'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'

export default function SignupPage() {
  const { session } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setInfo(null)
    const { data, error } = await supabase.auth.signUp({ email, password })
    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    // With email confirmation disabled (demo setting), signUp already
    // returns a session and AuthProvider's listener will pick it up and
    // redirect via the `session` check above. If confirmation is enabled,
    // there's no session yet - tell the user to check their inbox.
    if (!data.session) {
      setInfo('Check your email to confirm your account, then log in.')
    }
  }

  return (
    <AuthLayout>
      <Paper elevation={0} sx={{ p: 4, width: 360 }} component="form" onSubmit={handleSubmit}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
          Create your account
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Start hosting your team's automation results
        </Typography>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          {info && <Alert severity="info">{info}</Alert>}
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            fullWidth
            autoFocus
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            fullWidth
            helperText="At least 6 characters"
          />
          <Button type="submit" variant="contained" disabled={submitting} fullWidth size="large">
            {submitting ? 'Creating account…' : 'Sign up'}
          </Button>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
            Already have an account? <Link to="/login">Log in</Link>
          </Typography>
        </Stack>
      </Paper>
    </AuthLayout>
  )
}
