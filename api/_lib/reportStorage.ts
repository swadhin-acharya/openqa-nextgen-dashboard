import { getServiceRoleClient } from './db.js'
import type { GeneratedReport } from './reportGenerator.js'

/**
 * Stores the generated standalone HTML in the private execution-reports
 * bucket and records its metadata. Report generation/storage failures must
 * never fail the execution ingest itself (see processExecutionForProject.ts,
 * which wraps this in try/catch) - the execution result and the report's
 * own availability are separate concerns.
 */
export async function storeReportArtifact(projectId: string, executionId: string, report: GeneratedReport): Promise<void> {
  const supabase = getServiceRoleClient()
  const path = `${projectId}/${executionId}.html`

  const { error: uploadError } = await supabase.storage
    .from('execution-reports')
    .upload(path, Buffer.from(report.html, 'utf8'), { contentType: 'text/html; charset=utf-8', upsert: true })
  if (uploadError) throw new Error(`storeReportArtifact upload: ${uploadError.message}`)

  const { error } = await supabase.from('report_artifacts').upsert(
    {
      project_id: projectId,
      execution_id: executionId,
      file_name: report.fileName,
      size_bytes: report.sizeBytes,
      checksum: report.checksum,
      storage_path: path,
      status: 'AVAILABLE',
      generated_at: new Date().toISOString(),
    },
    { onConflict: 'project_id,execution_id' },
  )
  if (error) throw new Error(`storeReportArtifact metadata: ${error.message}`)
}

export async function markReportGenerationFailed(projectId: string, executionId: string): Promise<void> {
  const supabase = getServiceRoleClient()
  await supabase.from('report_artifacts').upsert(
    {
      project_id: projectId,
      execution_id: executionId,
      file_name: '',
      size_bytes: 0,
      checksum: '',
      storage_path: '',
      status: 'GENERATION_FAILED',
      generated_at: new Date().toISOString(),
    },
    { onConflict: 'project_id,execution_id' },
  )
}
