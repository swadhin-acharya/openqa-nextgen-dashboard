import { Typography, Box, Button, alpha, useTheme } from '@mui/material'
import { Stack } from '../FlexStack'
import RuleRoundedIcon from '@mui/icons-material/RuleRounded'
import HourglassEmptyRoundedIcon from '@mui/icons-material/HourglassEmptyRounded'
import SearchOffRoundedIcon from '@mui/icons-material/SearchOffRounded'
import PhoneAndroidRoundedIcon from '@mui/icons-material/PhoneAndroidRounded'
import CloudOffRoundedIcon from '@mui/icons-material/CloudOffRounded'
import ReportGmailerrorredRoundedIcon from '@mui/icons-material/ReportGmailerrorredRounded'
import type { SvgIconComponent } from '@mui/icons-material'
import { SectionCard } from '../common/SectionCard'
import { statusColors } from '../../theme/theme'
import type { CategorySummary } from '../../../processor/models.js'

const ICON_MAP: Record<string, SvgIconComponent> = {
  'assertion failure': RuleRoundedIcon,
  timeout: HourglassEmptyRoundedIcon,
  'element not found': SearchOffRoundedIcon,
  'appium failure': PhoneAndroidRoundedIcon,
  'environment failure': CloudOffRoundedIcon,
}

export function CategoriesCard({ categories }: { categories: CategorySummary[] }) {
  const theme = useTheme()

  return (
    <SectionCard
      title="Categories"
      actions={
        <Button size="small" sx={{ color: 'text.secondary', fontSize: '0.75rem', fontWeight: 600 }}>
          View All
        </Button>
      }
    >
      <Stack spacing={0.5}>
        {categories.map((cat) => {
          const Icon = ICON_MAP[cat.name.toLowerCase()] ?? ReportGmailerrorredRoundedIcon
          return (
            <Stack
              key={cat.name}
              component="div"
              direction="row"
              alignItems="center"
              spacing={1.5}
              sx={{
                py: 1,
                px: 0.5,
                borderRadius: 1.5,
                cursor: 'pointer',
                '&:hover': { bgcolor: theme.customTokens.hoverBackground },
              }}
            >
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: 1.25,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: alpha(statusColors.broken, 0.14),
                  color: statusColors.broken,
                  flexShrink: 0,
                }}
              >
                <Icon sx={{ fontSize: 15 }} />
              </Box>
              <Typography variant="body2" sx={{ flex: 1 }}>
                {cat.name}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {cat.count}
              </Typography>
            </Stack>
          )
        })}
      </Stack>
    </SectionCard>
  )
}
