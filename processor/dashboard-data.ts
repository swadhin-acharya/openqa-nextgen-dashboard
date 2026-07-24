import type {
  SummaryData,
  RecentExecutionRow,
  TrendPoint,
  FeatureSummary,
  TestSummary,
  FailureSummary,
  CategorySummary,
  EnvironmentInfo,
} from './models'

export interface DashboardData {
  summary: SummaryData
  executions: RecentExecutionRow[]
  trends: TrendPoint[]
  features: FeatureSummary[]
  tests: TestSummary[]
  failures: FailureSummary[]
  categories: CategorySummary[]
  environment: EnvironmentInfo
}
