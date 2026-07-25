import { useNavigate } from 'react-router-dom'
import { Box, Typography, Chip, alpha, useTheme } from '@mui/material'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Stack } from '../components/FlexStack'
import { PageHeader } from '../components/layout/PageHeader'
import { SectionCard } from '../components/common/SectionCard'
import { LoadingState, ErrorState } from '../components/common/LoadingState'
import { useProject } from '../lib/ProjectContext'
import { useProjectDashboardData } from '../hooks/useProjectDashboardData'
import { statusColors } from '../theme/theme'
import { formatDateShort, formatDate } from '../utils/format'

export default function ProjectFailureAnalysisPage() {
  const project = useProject()
  const navigate = useNavigate()
  const { data, loading, error } = useProjectDashboardData(project.projectId)
  const theme = useTheme()

  const categories = data?.categories ?? []
  const failures = data?.failures ?? []
  const trends = (data?.trends ?? []).map((t) => ({ ...t, defective: t.failed + t.broken }))

  return (
    <Stack>
      <PageHeader title="Failure Analysis" subtitle="Failing tests and categories, from the branch-scoped main dashboard history" />

      {loading && <LoadingState label="Loading failure data…" />}
      {!loading && error && <ErrorState label="Unable to load failure data." />}

      {!loading && !error && (
        <Stack spacing={2.5}>
          <SectionCard title="Failed + Broken Over Time">
            <Box sx={{ width: '100%', height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="defectiveGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={statusColors.failed} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={statusColors.failed} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={theme.customTokens.chartGrid} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDateShort}
                    tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                    axisLine={{ stroke: theme.palette.divider }}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 11, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip
                    contentStyle={{ background: theme.customTokens.cardBackground, border: `1px solid ${theme.palette.divider}`, borderRadius: 8, fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="defective" name="Failed + Broken" stroke={statusColors.failed} fill="url(#defectiveGradient)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </SectionCard>

          <SectionCard title={`${categories.length} categories`}>
            {categories.length === 0 && <Typography color="text.secondary">No categorized failures.</Typography>}
            <Stack spacing={1}>
              {categories.map((c) => (
                <Stack key={c.name} direction="row" spacing={1.5} sx={{ alignItems: 'center', py: 0.75 }}>
                  <Typography variant="body2" sx={{ flex: 1, fontWeight: 600 }}>
                    {c.name}
                  </Typography>
                  <Chip label={c.count} size="small" sx={{ bgcolor: alpha(statusColors.broken, 0.16), color: statusColors.broken, fontWeight: 700 }} />
                </Stack>
              ))}
            </Stack>
          </SectionCard>

          <SectionCard title={`${failures.length} failing tests`} noPadding>
            {failures.length === 0 ? (
              <Typography color="text.secondary" sx={{ p: 2.5 }}>
                No failures recorded.
              </Typography>
            ) : (
              <Stack sx={{ px: 2.5, pb: 2 }} spacing={0.5}>
                {failures.map((f) => (
                  <Stack
                    key={f.testId}
                    direction="row"
                    spacing={1.5}
                    sx={{ alignItems: 'center', py: 1, borderRadius: 1.5, cursor: 'pointer', '&:hover': { bgcolor: theme.customTokens.hoverBackground } }}
                    onClick={() => navigate(`../tests?feature=${encodeURIComponent(f.feature)}`)}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                        {f.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {f.feature} · last seen {formatDate(f.lastSeen)}
                      </Typography>
                    </Box>
                    <Chip label={`${f.occurrences}×`} size="small" sx={{ bgcolor: alpha(statusColors.failed, 0.16), color: statusColors.failed, fontWeight: 700 }} />
                  </Stack>
                ))}
              </Stack>
            )}
          </SectionCard>
        </Stack>
      )}
    </Stack>
  )
}
