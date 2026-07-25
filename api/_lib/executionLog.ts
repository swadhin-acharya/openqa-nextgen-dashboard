import { getServiceRoleClient } from './db.js'
import type { ExecutionMeta } from './history-db.js'

/**
 * Append (or update, if re-ingesting the same executionId - keeps this
 * idempotent the same way the vendored history merge is) to the unbounded
 * execution_log, regardless of branch or whether this execution made it
 * into the capped aggregate. See supabase/migrations/0008_execution_log.sql.
 */
export async function appendExecutionLog(projectId: string, executionId: string, summary: ExecutionMeta): Promise<void> {
  const supabase = getServiceRoleClient()
  const { error } = await supabase
    .from('execution_log')
    .upsert({ project_id: projectId, execution_id: executionId, summary }, { onConflict: 'project_id,execution_id' })

  if (error) throw new Error(`appendExecutionLog: ${error.message}`)
}
