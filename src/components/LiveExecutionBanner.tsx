import { useEffect, useState } from 'react'
import { Box, Chip, LinearProgress, Paper, Typography } from '@mui/material'
import { Stack } from './FlexStack'
import { supabase } from '../lib/supabaseClient'
import { useProject } from '../lib/ProjectContext'
import { statusColors } from '../theme/theme'

interface LiveExecutionRow {
  execution_id: string
  branch: string | null
  executed_by_name: string | null
  started_at: string
  last_seen_at: string
  total: number
  passed: number
  failed: number
  broken: number
  skipped: number
}

// A run whose last poll is older than this is treated as abandoned (crashed
// CI job, forgotten wrapper script, etc.) rather than kept forever - there's
// no server-side cleanup job for this free-tier deploy, so staleness is
// judged purely on the client. ~3x the documented 15-30s polling cadence.
const STALE_AFTER_MS = 90_000

function isStale(row: LiveExecutionRow): boolean {
  return Date.now() - new Date(row.last_seen_at).getTime() > STALE_AFTER_MS
}

function elapsed(startedAt: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

/**
 * Phase 10: a banner per in-progress run, fed by Supabase Realtime on
 * live_executions (see supabase/migrations/0012_live_executions.sql). This
 * table is populated only by callers that opt in to the inProgress polling
 * protocol (api/ingest.ts) - most projects will simply never have rows here,
 * and the banner renders nothing in that case.
 */
export function LiveExecutionBanner() {
  const project = useProject()
  const [rows, setRows] = useState<LiveExecutionRow[]>([])
  const [, forceTick] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function loadInitial() {
      const { data } = await supabase
        .from('live_executions')
        .select('execution_id, branch, executed_by_name, started_at, last_seen_at, total, passed, failed, broken, skipped')
        .eq('project_id', project.projectId)
      if (!cancelled && data) setRows(data as LiveExecutionRow[])
    }
    loadInitial()

    const channel = supabase
      .channel(`live-executions-${project.projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_executions', filter: `project_id=eq.${project.projectId}` },
        (payload) => {
          setRows((prev) => {
            if (payload.eventType === 'DELETE') {
              const oldId = (payload.old as { execution_id?: string }).execution_id
              return prev.filter((r) => r.execution_id !== oldId)
            }
            const next = payload.new as LiveExecutionRow
            const withoutExisting = prev.filter((r) => r.execution_id !== next.execution_id)
            return [...withoutExisting, next]
          })
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [project.projectId])

  // Re-render every 5s purely to keep the elapsed-time readout and
  // staleness check current - Realtime events alone don't fire on a timer.
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 5000)
    return () => clearInterval(id)
  }, [])

  const active = rows.filter((r) => !isStale(r))
  if (active.length === 0) return null

  return (
    <Stack spacing={1.5} sx={{ mb: 3 }}>
      {active.map((row) => {
        const finished = row.passed + row.failed + row.broken + row.skipped
        const progress = row.total > 0 ? Math.min(100, (finished / row.total) * 100) : 0
        return (
          <Paper
            key={row.execution_id}
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2.5,
              borderColor: 'primary.main',
              bgcolor: 'rgba(99, 102, 241, 0.08)',
            }}
          >
            <Stack direction="row" justifyContent="space-between" sx={{ alignItems: 'center', mb: 1 }}>
              <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: 'primary.main',
                    animation: 'pulse 1.4s ease-in-out infinite',
                    '@keyframes pulse': {
                      '0%, 100%': { opacity: 1 },
                      '50%': { opacity: 0.35 },
                    },
                  }}
                />
                <Typography sx={{ fontWeight: 700 }}>Execution in progress</Typography>
                {row.branch && <Chip label={row.branch} size="small" variant="outlined" />}
                {row.executed_by_name && (
                  <Typography variant="caption" color="text.secondary">
                    by {row.executed_by_name}
                  </Typography>
                )}
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {elapsed(row.started_at)} elapsed
              </Typography>
            </Stack>

            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{ height: 6, borderRadius: 3, mb: 1 }}
            />

            <Stack direction="row" spacing={2}>
              <Typography variant="caption" color="text.secondary">
                {finished} / {row.total || '?'} tests
              </Typography>
              {row.passed > 0 && (
                <Typography variant="caption" sx={{ color: statusColors.passed }}>
                  {row.passed} passed
                </Typography>
              )}
              {row.failed > 0 && (
                <Typography variant="caption" sx={{ color: statusColors.failed }}>
                  {row.failed} failed
                </Typography>
              )}
              {row.broken > 0 && (
                <Typography variant="caption" sx={{ color: statusColors.broken }}>
                  {row.broken} broken
                </Typography>
              )}
              {row.skipped > 0 && (
                <Typography variant="caption" sx={{ color: statusColors.skipped }}>
                  {row.skipped} skipped
                </Typography>
              )}
            </Stack>
          </Paper>
        )
      })}
    </Stack>
  )
}
