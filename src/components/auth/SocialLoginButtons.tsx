import { useState } from 'react'
import { Button, Snackbar, alpha, useTheme } from '@mui/material'
import { Stack } from '../FlexStack'
import GoogleIcon from '@mui/icons-material/Google'
import GitHubIcon from '@mui/icons-material/GitHub'
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined'

const PROVIDERS = [
  { key: 'google', label: 'Google', Icon: GoogleIcon },
  { key: 'github', label: 'GitHub', Icon: GitHubIcon },
  { key: 'sso', label: 'SSO', Icon: VerifiedUserOutlinedIcon },
] as const

/**
 * Visual-only placeholders (no OAuth wired up) - clicking one just
 * announces that it's coming soon. Real email/password auth is untouched;
 * these exist purely to match the reference layout's social-login row.
 */
export function SocialLoginButtons() {
  const theme = useTheme()
  const [message, setMessage] = useState<string | null>(null)

  return (
    <>
      <Stack direction="row" spacing={1.25}>
        {PROVIDERS.map(({ key, label, Icon }) => (
          <Button
            key={key}
            fullWidth
            variant="outlined"
            onClick={() => setMessage(`${label} login coming soon`)}
            startIcon={<Icon sx={{ fontSize: 18 }} />}
            sx={{
              borderColor: alpha(theme.palette.text.primary, 0.15),
              color: 'text.secondary',
              py: 1,
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: alpha(theme.palette.primary.main, 0.06),
              },
            }}
          >
            {label}
          </Button>
        ))}
      </Stack>
      <Snackbar
        open={!!message}
        autoHideDuration={2000}
        onClose={() => setMessage(null)}
        message={message}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  )
}
