import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Paper, Typography, Button, Alert, Snackbar, Divider, alpha, useTheme } from '@mui/material'
import MailOutlineRoundedIcon from '@mui/icons-material/MailOutlineRounded'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import { Stack } from '../components/FlexStack'
import { AuthLayout } from '../components/layout/AuthLayout'
import { AuthInput } from '../components/auth/AuthInput'
import { SocialLoginButtons } from '../components/auth/SocialLoginButtons'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'

export default function LoginPage() {
  const theme = useTheme()
  const { session } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [resetMessage, setResetMessage] = useState<string | null>(null)

  if (session) return <Navigate to="/" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setSubmitting(false)
    if (error) setError(error.message)
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      setResetMessage('Enter your email above first, then click "Forgot Password?"')
      return
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim())
    setResetMessage(error ? error.message : 'Password reset email sent - check your inbox.')
  }

  return (
    <AuthLayout>
      <Typography
        variant="caption"
        sx={{ color: 'primary.light', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}
      >
        Welcome Back
      </Typography>
      <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5 }}>
        Hello!
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Sign in to your account
      </Typography>

      <Paper elevation={0} sx={{ p: 3.5, borderRadius: 3 }} component="form" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          <AuthInput
            label="Email"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
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
            autoComplete="current-password"
            startIcon={<LockOutlinedIcon sx={{ fontSize: 19, color: 'text.secondary' }} />}
          />

          <Typography
            component="button"
            type="button"
            onClick={handleForgotPassword}
            variant="body2"
            sx={{
              alignSelf: 'flex-end',
              color: 'primary.light',
              bgcolor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              p: 0,
              mt: -1,
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            Forgot Password?
          </Typography>

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
            {submitting ? 'Logging in…' : 'Login'}
          </Button>

          <Divider sx={{ color: 'text.secondary', fontSize: '0.75rem', '&::before, &::after': { borderColor: alpha(theme.palette.text.primary, 0.12) } }}>
            or continue with
          </Divider>

          <SocialLoginButtons />

          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
            Don't have an account? <Link to="/signup">Sign Up</Link>
          </Typography>
        </Stack>
      </Paper>

      <Snackbar
        open={!!resetMessage}
        autoHideDuration={3000}
        onClose={() => setResetMessage(null)}
        message={resetMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </AuthLayout>
  )
}
