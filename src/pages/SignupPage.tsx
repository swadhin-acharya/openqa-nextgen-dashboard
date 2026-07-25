import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Paper, Typography, Button, Alert, Divider, Checkbox, FormControlLabel, alpha, useTheme } from '@mui/material'
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded'
import MailOutlineRoundedIcon from '@mui/icons-material/MailOutlineRounded'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import { Stack } from '../components/FlexStack'
import { AuthLayout } from '../components/layout/AuthLayout'
import { AuthInput } from '../components/auth/AuthInput'
import { SocialLoginButtons } from '../components/auth/SocialLoginButtons'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'

export default function SignupPage() {
  const theme = useTheme()
  const { session } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)

    if (password !== confirmPassword) {
      setError("Passwords don't match")
      return
    }
    if (!agreed) {
      setError('Please agree to the Terms of Service and Privacy Policy')
      return
    }

    setSubmitting(true)
    // options.data lands in auth.users.raw_user_meta_data, which
    // handle_new_user() (see supabase/migrations/0009_rbac_and_profile_name.sql)
    // reads to populate profiles.name.
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name: name.trim() } } })
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
      <Typography
        variant="caption"
        sx={{ color: 'primary.light', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}
      >
        Create Account
      </Typography>
      <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5 }}>
        Hello!
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Create your account
      </Typography>

      <Paper elevation={0} sx={{ p: 3.5, borderRadius: 3 }} component="form" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          {info && <Alert severity="info">{info}</Alert>}
          <AuthInput
            label="Full Name"
            placeholder="Enter your full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            autoComplete="name"
            startIcon={<PersonOutlineRoundedIcon sx={{ fontSize: 19, color: 'text.secondary' }} />}
          />
          <AuthInput
            label="Email"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            startIcon={<MailOutlineRoundedIcon sx={{ fontSize: 19, color: 'text.secondary' }} />}
          />
          <AuthInput
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            isPassword
            autoComplete="new-password"
            helperText="At least 6 characters"
            startIcon={<LockOutlinedIcon sx={{ fontSize: 19, color: 'text.secondary' }} />}
          />
          <AuthInput
            label="Confirm Password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            isPassword
            autoComplete="new-password"
            startIcon={<LockOutlinedIcon sx={{ fontSize: 19, color: 'text.secondary' }} />}
          />

          <FormControlLabel
            control={<Checkbox checked={agreed} onChange={(e) => setAgreed(e.target.checked)} size="small" />}
            label={
              <Typography variant="body2" color="text.secondary">
                I agree to the Terms of Service and Privacy Policy
              </Typography>
            }
          />

          <Button
            type="submit"
            variant="contained"
            disabled={submitting}
            fullWidth
            size="large"
            sx={{
              py: 1.25,
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
            }}
          >
            {submitting ? 'Creating account…' : 'Create Account'}
          </Button>

          <Divider sx={{ color: 'text.secondary', fontSize: '0.75rem', '&::before, &::after': { borderColor: alpha(theme.palette.text.primary, 0.12) } }}>
            or sign up with
          </Divider>

          <SocialLoginButtons />

          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
            Already have an account? <Link to="/login">Login</Link>
          </Typography>
        </Stack>
      </Paper>
    </AuthLayout>
  )
}
