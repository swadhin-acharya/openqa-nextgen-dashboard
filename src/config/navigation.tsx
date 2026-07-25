import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded'
import PlayCircleOutlineRoundedIcon from '@mui/icons-material/PlayCircleOutlineRounded'
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded'
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded'
import ReportProblemRoundedIcon from '@mui/icons-material/ReportProblemRounded'
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded'
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded'
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded'
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded'
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded'
import PublicRoundedIcon from '@mui/icons-material/PublicRounded'
import type { SvgIconComponent } from '@mui/icons-material'

export interface NavItem {
  label: string
  path: string
  icon: SvgIconComponent
  /** Only Overview is implemented in Milestone 1; others are shown but disabled. */
  enabled: boolean
}

export const navItems: NavItem[] = [
  { label: 'Overview', path: '/', icon: GridViewRoundedIcon, enabled: true },
  { label: 'Executions', path: '/executions', icon: PlayCircleOutlineRoundedIcon, enabled: false },
  { label: 'Features', path: '/features', icon: CategoryRoundedIcon, enabled: false },
  { label: 'Tests', path: '/tests', icon: FactCheckRoundedIcon, enabled: false },
  { label: 'Failure Analysis', path: '/failure-analysis', icon: ReportProblemRoundedIcon, enabled: false },
  { label: 'Timeline', path: '/timeline', icon: TimelineRoundedIcon, enabled: false },
  { label: 'Retries', path: '/retries', icon: ReplayRoundedIcon, enabled: false },
  { label: 'Trends', path: '/trends', icon: TrendingUpRoundedIcon, enabled: false },
  { label: 'History', path: '/history', icon: HistoryRoundedIcon, enabled: false },
  { label: 'Reports', path: '/reports', icon: DescriptionRoundedIcon, enabled: false },
  { label: 'Environment', path: '/environment', icon: PublicRoundedIcon, enabled: false },
]
