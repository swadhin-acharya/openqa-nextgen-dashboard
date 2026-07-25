import { getServiceRoleClient } from './db.js'

/**
 * Upsert-by-name: returns the existing suite's id if (project_id, name)
 * already exists (see supabase/migrations/0006_suites_executor_branch.sql's
 * unique constraint), otherwise creates it. This is how ingestion
 * auto-creates a suite the first time it sees a new name, while the portal
 * can also pre-create suites manually - both paths land in the same table.
 */
export async function resolveSuiteId(projectId: string, suiteName: string): Promise<string> {
  const supabase = getServiceRoleClient()
  const { data, error } = await supabase
    .from('suites')
    .upsert({ project_id: projectId, name: suiteName }, { onConflict: 'project_id,name' })
    .select('id')
    .single()

  if (error) throw new Error(`resolveSuiteId: ${error.message}`)
  return data.id
}
