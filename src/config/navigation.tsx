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
  enabled: boolean
}

export const navItems: NavItem[] = [
  { label: 'Overview', path: '/', icon: GridViewRoundedIcon, enabled: true },
  { label: 'Executions', path: '/executions', icon: PlayCircleOutlineRoundedIcon, enabled: true },
  { label: 'Features', path: '/features', icon: CategoryRoundedIcon, enabled: true },
  { label: 'Tests', path: '/tests', icon: FactCheckRoundedIcon, enabled: true },
  { label: 'Failure Analysis', path: '/failure-analysis', icon: ReportProblemRoundedIcon, enabled: true },
  { label: 'Timeline', path: '/timeline', icon: TimelineRoundedIcon, enabled: true },
  { label: 'Retries', path: '/retries', icon: ReplayRoundedIcon, enabled: true },
  { label: 'Trends', path: '/trends', icon: TrendingUpRoundedIcon, enabled: true },
  { label: 'History', path: '/history', icon: HistoryRoundedIcon, enabled: true },
  // Aliases the Executions list - this product's mental model has no
  // separate "report definition" concept; a report IS an execution's report.
  { label: 'Reports', path: '/executions', icon: DescriptionRoundedIcon, enabled: true },
  { label: 'Environment', path: '/environment', icon: PublicRoundedIcon, enabled: true },
]
