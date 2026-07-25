import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { getFeatureLabel } from '../../processor/reader.js'
import type { RawAllureData, AllureResult } from '../../processor/reader.js'
import type { ExecutionSummary, CategorySummary } from '../../processor/models.js'

// Screenshots/logs are embedded as base64/text directly in the report -
// exactly what makes it work with zero server dependency (see the feature's
// "one HTML file" requirement) - but that means size has to be bounded.
// Data is never silently dropped past these caps; a clear truncation note
// is shown instead (see buildAttachmentModel below).
const MAX_SCREENSHOT_BYTES = 3 * 1024 * 1024
const MAX_TEXT_ATTACHMENT_BYTES = 2 * 1024 * 1024

/**
 * Duplicated from processor/normalize.ts's (non-exported) extractExceptionClass
 * rather than exporting it there - keeps the vendored file byte-identical to
 * the static product's own copy (see processor/README.md), since this report
 * generator is SaaS-only and has no equivalent in the static build-time tool.
 */
function extractExceptionClass(trace?: string): string | null {
  if (!trace) return null
  const match = trace.match(/([\w.$]+(?:Exception|Error))/)
  return match ? match[1].split('.').pop() ?? match[1] : null
}

function label(result: AllureResult, name: string): string | undefined {
  return result.labels?.find((l) => l.name === name)?.value
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${(ms / 1000).toFixed(1)}s`
}

function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export interface ReportGenerationInput {
  projectName: string
  suiteName: string
  executionId: string
  branch: string | null
  executedByName: string | null
  executedByEmail: string | null
  environment: Record<string, string>
  /** Merged/effective raw results - same data the vendored build*Summaries
   * functions consumed for this execution, so the report can never diverge
   * from what the dashboard itself shows (see the feature's "one source of
   * truth" requirement). */
  raw: RawAllureData
  execution: ExecutionSummary
  categories: CategorySummary[]
  /** Directory the tarball was extracted to - attachment `source` files
   * (screenshots, logs) live here alongside the *-result.json files. */
  allureResultsDir: string
}

export interface GeneratedReport {
  html: string
  fileName: string
  sizeBytes: number
  checksum: string
}

interface AttachmentModel {
  name: string
  kind: 'screenshot' | 'log' | 'json' | 'xml' | 'unsupported'
  dataUrl?: string
  text?: string
  truncated?: boolean
}

interface StepModel {
  name: string
  status: string
  duration: string
  expected?: string
  actual?: string
}

interface ScenarioModel {
  id: string
  name: string
  feature: string
  status: string
  duration: string
  story?: string
  severity?: string
  owner?: string
  params?: Record<string, string>
  steps: StepModel[]
  skipReason?: string
  failure?: { category: string; message: string; trace: string }
  attachments: AttachmentModel[]
}

interface FeatureModel {
  name: string
  total: number
  passed: number
  failed: number
  broken: number
  skipped: number
}

interface ReportModel {
  execution: {
    id: string
    project: string
    suite: string
    branch: string | null
    executedByName: string | null
    date: string
    duration: string
    status: string
  }
  summary: { total: number; passed: number; failed: number; broken: number; skipped: number; passRate: number }
  failureCategories: { name: string; count: number }[]
  environment: { section: string; values: Record<string, string> }[]
  features: FeatureModel[]
  scenarios: ScenarioModel[]
}

function readAttachment(dir: string, source: string): Buffer | null {
  const p = join(dir, source)
  if (!existsSync(p)) return null
  try {
    return readFileSync(p)
  } catch {
    return null
  }
}

function buildAttachment(dir: string, att: { name: string; type: string; source: string }): AttachmentModel {
  const buf = readAttachment(dir, att.source)
  if (!buf) return { name: att.name, kind: 'unsupported' }

  if (att.type.startsWith('image/')) {
    if (buf.length > MAX_SCREENSHOT_BYTES) {
      return { name: att.name, kind: 'screenshot', truncated: true }
    }
    return { name: att.name, kind: 'screenshot', dataUrl: `data:${att.type};base64,${buf.toString('base64')}` }
  }

  if (att.type.includes('json')) {
    const text = buf.subarray(0, MAX_TEXT_ATTACHMENT_BYTES).toString('utf8')
    return { name: att.name, kind: 'json', text, truncated: buf.length > MAX_TEXT_ATTACHMENT_BYTES }
  }

  if (att.type.includes('xml')) {
    const text = buf.subarray(0, MAX_TEXT_ATTACHMENT_BYTES).toString('utf8')
    return { name: att.name, kind: 'xml', text, truncated: buf.length > MAX_TEXT_ATTACHMENT_BYTES }
  }

  if (att.type.startsWith('text/')) {
    const text = buf.subarray(0, MAX_TEXT_ATTACHMENT_BYTES).toString('utf8')
    return { name: att.name, kind: 'log', text, truncated: buf.length > MAX_TEXT_ATTACHMENT_BYTES }
  }

  return { name: att.name, kind: 'unsupported' }
}

export function buildReportModel(input: ReportGenerationInput): ReportModel {
  const { raw, execution } = input

  const featureMap = new Map<string, FeatureModel>()
  const scenarios: ScenarioModel[] = raw.results.map((result) => {
    const feature = getFeatureLabel(result)
    const status = result.status.toUpperCase()
    const durationMs = (result.stop ?? 0) - (result.start ?? 0)

    const f = featureMap.get(feature) ?? { name: feature, total: 0, passed: 0, failed: 0, broken: 0, skipped: 0 }
    f.total += 1
    if (status === 'PASSED') f.passed += 1
    else if (status === 'FAILED') f.failed += 1
    else if (status === 'BROKEN') f.broken += 1
    else if (status === 'SKIPPED') f.skipped += 1
    featureMap.set(feature, f)

    const steps: StepModel[] = (result.steps ?? []).map((s) => ({
      name: s.name,
      status: s.status.toUpperCase(),
      duration: formatDuration((s.stop ?? 0) - (s.start ?? 0)),
      expected: s.statusDetails?.message,
      actual: s.statusDetails?.trace ? s.statusDetails.trace.split('\n')[0] : undefined,
    }))

    const params: Record<string, string> = {}
    const rawParams = (result as unknown as { parameters?: { name: string; value: string }[] }).parameters
    for (const p of rawParams ?? []) params[p.name] = p.value

    const failure =
      status === 'FAILED' || status === 'BROKEN'
        ? {
            category: extractExceptionClass(result.statusDetails?.trace) ?? 'Other',
            message: result.statusDetails?.message ?? 'No failure message captured.',
            trace: result.statusDetails?.trace ?? 'No stack trace captured.',
          }
        : undefined

    return {
      id: result.uuid,
      name: result.name,
      feature,
      status,
      duration: formatDuration(durationMs),
      story: label(result, 'story'),
      severity: label(result, 'severity'),
      owner: input.executedByName ?? undefined,
      params: Object.keys(params).length ? params : undefined,
      steps,
      skipReason: status === 'SKIPPED' ? result.statusDetails?.message ?? 'No reason captured.' : undefined,
      failure,
      attachments: (result.attachments ?? []).map((a) => buildAttachment(input.allureResultsDir, a)),
    }
  })

  const environment: { section: string; values: Record<string, string> }[] = [
    {
      section: 'Execution',
      values: {
        Project: input.projectName,
        Suite: input.suiteName,
        'Execution ID': `#${input.executionId}`,
        ...(input.branch ? { Branch: input.branch } : {}),
        ...(input.executedByName ? { 'Triggered By': input.executedByName } : {}),
      },
    },
  ]
  if (Object.keys(input.environment).length > 0) {
    environment.push({ section: 'Environment Properties', values: input.environment })
  }

  return {
    execution: {
      id: input.executionId,
      project: input.projectName,
      suite: input.suiteName,
      branch: input.branch,
      executedByName: input.executedByName,
      date: execution.startTime,
      duration: formatDuration(execution.duration),
      status: execution.status.toUpperCase(),
    },
    summary: {
      total: execution.total,
      passed: execution.passed,
      failed: execution.failed,
      broken: execution.broken,
      skipped: execution.skipped,
      passRate: execution.passRate,
    },
    failureCategories: input.categories.map((c) => ({ name: c.name, count: c.count })),
    environment,
    features: [...featureMap.values()],
    scenarios,
  }
}

export function generateStandaloneReport(input: ReportGenerationInput): GeneratedReport {
  const model = buildReportModel(input)
  const html = renderReportHtml(model)
  const sizeBytes = Buffer.byteLength(html, 'utf8')
  const checksum = createHash('sha256').update(html).digest('hex')
  const fileName = `${slugify(input.projectName)}-${input.executionId}-report.html`
  return { html, fileName, sizeBytes, checksum }
}

function renderReportHtml(model: ReportModel): string {
  const modelJson = JSON.stringify(model).replace(/</g, '\\u003c')
  return REPORT_TEMPLATE.replace('__REPORT_MODEL_JSON__', modelJson).replace(
    '__TITLE__',
    `Execution #${model.execution.id} · ${model.execution.project} · OpenQA Report`,
  )
}

/**
 * The CSS/rendering engine below is the production version of
 * sample-reports/sample-openqa-report.html, approved as the visual design -
 * same tokens, same components, same interactivity (filters, search,
 * lightbox, log viewer, JSON/XML viewers, dark/light toggle, print CSS).
 * The only structural difference: it renders from a REPORT_MODEL injected
 * by the server (see renderReportHtml above) instead of hardcoded sample
 * data, and there is no synthetic filler-test generation - every scenario
 * shown is a real, ingested test result.
 */
const REPORT_TEMPLATE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>__TITLE__</title>
<style>
:root{
  --bg:#f4f6fb; --surface:#ffffff; --surface-2:#eef1f8; --border:#e1e5ef;
  --text:#12151f; --text-muted:#5c6478; --text-faint:#8b93a0;
  --accent:#5b6cf9; --accent-dark:#3f4bd1; --accent-soft:rgba(91,108,249,.10);
  --pass:#178a56; --pass-fill:#2ecc8f; --fail:#d3273e; --fail-fill:#f2495c;
  --broken:#b5590a; --broken-fill:#ff9f43; --skip:#93650a; --skip-fill:#f4c542;
  --code-bg:#0e1320; --code-text:#d7e0f5;
  --shadow:0 1px 2px rgba(15,20,30,.04), 0 8px 24px rgba(15,20,30,.06);
  --radius:14px; --radius-sm:9px; color-scheme:light;
}
@media (prefers-color-scheme: dark){
  :root{
    --bg:#0b0e17; --surface:#131826; --surface-2:#171d2e; --border:rgba(255,255,255,.09);
    --text:#eef1f8; --text-muted:#9aa2b8; --text-faint:#6b7385;
    --accent:#8590ff; --accent-dark:#aab3ff; --accent-soft:rgba(133,144,255,.14);
    --pass:#2ecc8f; --pass-fill:#2ecc8f; --fail:#f2495c; --fail-fill:#f2495c;
    --broken:#ff9f43; --broken-fill:#ff9f43; --skip:#f4c542; --skip-fill:#f4c542;
    --code-bg:#0a0d16; --code-text:#cfd8ef;
    --shadow:0 1px 2px rgba(0,0,0,.3), 0 8px 28px rgba(0,0,0,.4); color-scheme:dark;
  }
}
:root[data-theme="dark"]{
  --bg:#0b0e17; --surface:#131826; --surface-2:#171d2e; --border:rgba(255,255,255,.09);
  --text:#eef1f8; --text-muted:#9aa2b8; --text-faint:#6b7385;
  --accent:#8590ff; --accent-dark:#aab3ff; --accent-soft:rgba(133,144,255,.14);
  --pass:#2ecc8f; --pass-fill:#2ecc8f; --fail:#f2495c; --fail-fill:#f2495c;
  --broken:#ff9f43; --broken-fill:#ff9f43; --skip:#f4c542; --skip-fill:#f4c542;
  --code-bg:#0a0d16; --code-text:#cfd8ef;
  --shadow:0 1px 2px rgba(0,0,0,.3), 0 8px 28px rgba(0,0,0,.4); color-scheme:dark;
}
:root[data-theme="light"]{
  --bg:#f4f6fb; --surface:#ffffff; --surface-2:#eef1f8; --border:#e1e5ef;
  --text:#12151f; --text-muted:#5c6478; --text-faint:#8b93a0;
  --accent:#5b6cf9; --accent-dark:#3f4bd1; --accent-soft:rgba(91,108,249,.10);
  --pass:#178a56; --pass-fill:#2ecc8f; --fail:#d3273e; --fail-fill:#f2495c;
  --broken:#b5590a; --broken-fill:#ff9f43; --skip:#93650a; --skip-fill:#f4c542;
  --code-bg:#0e1320; --code-text:#d7e0f5;
  --shadow:0 1px 2px rgba(15,20,30,.04), 0 8px 24px rgba(15,20,30,.06); color-scheme:light;
}
*{box-sizing:border-box} html,body{margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased}
h1,h2,h3,h4{margin:0;text-wrap:balance;font-weight:700} .tnum{font-variant-numeric:tabular-nums}
.eyebrow{font-size:10.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--text-faint)}
a{color:var(--accent)} button{font-family:inherit} ::selection{background:var(--accent-soft)}
.wrap{max-width:1320px;margin:0 auto;padding:0 28px}
@media (max-width:720px){.wrap{padding:0 16px}}
.topbar{position:sticky;top:0;z-index:50;background:color-mix(in srgb, var(--surface) 92%, transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--border)}
.topbar-inner{display:flex;align-items:center;gap:22px;padding:12px 28px;max-width:1320px;margin:0 auto}
.brand{display:flex;align-items:baseline;gap:8px;font-weight:800;font-size:15px;white-space:nowrap}
.brand b{color:var(--accent)} .brand .divider{width:1px;height:14px;background:var(--border)}
.brand .kind{color:var(--text-muted);font-weight:600;font-size:12px;letter-spacing:.04em;text-transform:uppercase}
.topnav{display:flex;gap:2px;flex:1;overflow-x:auto}
.topnav a{color:var(--text-muted);text-decoration:none;font-size:12.5px;font-weight:600;padding:7px 11px;border-radius:7px;white-space:nowrap;transition:background .12s,color .12s}
.topnav a:hover{background:var(--surface-2);color:var(--text)}
.topbar-actions{display:flex;align-items:center;gap:8px}
.btn{display:inline-flex;align-items:center;gap:6px;cursor:pointer;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:12.5px;font-weight:600;padding:7px 12px;border-radius:8px;transition:border-color .12s,background .12s}
.btn:hover{border-color:var(--accent)} .btn:focus-visible,a:focus-visible,[tabindex]:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.btn.icon{padding:7px 8px}
@media print{.topbar,.no-print{display:none !important} body{background:#fff;color:#111} .card{box-shadow:none !important;border:1px solid #ddd !important;break-inside:avoid} a{color:inherit;text-decoration:none}}
.hero{padding:28px 0 8px}
.hero-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow);padding:24px 26px;display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap}
.hero-left .eyebrow{margin-bottom:6px} .hero h1{font-size:23px}
.hero .meta-line{color:var(--text-muted);font-size:13px;margin-top:8px;display:flex;gap:14px;flex-wrap:wrap}
.hero .meta-line span{display:inline-flex;align-items:center;gap:6px} .hero .meta-line .dot{width:3px;height:3px;border-radius:50%;background:var(--text-faint)}
.hero-right{display:flex;flex-direction:column;align-items:flex-end;justify-content:center;gap:10px}
.status-pill{font-size:12.5px;font-weight:800;letter-spacing:.03em;padding:7px 16px;border-radius:999px;text-transform:uppercase}
.status-pill.FAILED,.status-pill.BROKEN{background:color-mix(in srgb, var(--fail-fill) 16%, transparent);color:var(--fail);border:1px solid color-mix(in srgb, var(--fail-fill) 40%, transparent)}
.status-pill.PASSED{background:color-mix(in srgb, var(--pass-fill) 16%, transparent);color:var(--pass);border:1px solid color-mix(in srgb, var(--pass-fill) 40%, transparent)}
.kpi-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin:18px 0}
@media (max-width:980px){.kpi-grid{grid-template-columns:repeat(3,1fr)}} @media (max-width:600px){.kpi-grid{grid-template-columns:repeat(2,1fr)}}
.kpi{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:14px 16px;box-shadow:var(--shadow)}
.kpi .eyebrow{margin-bottom:6px} .kpi b{display:block;font-size:24px;font-weight:800}
.kpi.pass b{color:var(--pass)} .kpi.fail b{color:var(--fail)} .kpi.broken b{color:var(--broken)} .kpi.skip b{color:var(--skip)}
section.block{margin:30px 0;scroll-margin-top:70px}
.section-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:14px}
.section-head h2{font-size:16px} .section-head .hint{color:var(--text-faint);font-size:12px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow);padding:20px}
.two-col{display:grid;grid-template-columns:1.35fr .95fr;gap:16px} @media (max-width:980px){.two-col{grid-template-columns:1fr}}
.donut-wrap{display:flex;align-items:center;gap:22px;flex-wrap:wrap;justify-content:center}
.legend{display:grid;gap:9px} .legend-row{display:flex;align-items:center;gap:9px;font-size:13px}
.legend-row .sw{width:10px;height:10px;border-radius:3px} .legend-row b{margin-left:auto;padding-left:14px;font-weight:700}
.legend-row .pct{color:var(--text-muted);width:48px;text-align:right}
.fa-row{display:grid;grid-template-columns:150px 1fr 30px;align-items:center;gap:10px;margin:9px 0;font-size:13px}
.fa-row .fa-bar{height:9px;border-radius:5px;background:var(--surface-2);overflow:hidden} .fa-row .fa-bar i{display:block;height:100%;background:var(--accent);border-radius:5px}
.fa-row.clickable{cursor:pointer} .fa-row.clickable:hover .fa-name{color:var(--accent)}
.fail-item{border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:10px;overflow:hidden;background:var(--surface)}
.fail-item summary{list-style:none;cursor:pointer;padding:13px 16px;display:flex;align-items:center;gap:12px}
.fail-item summary::-webkit-details-marker{display:none}
.fail-item .chev{transition:transform .15s;color:var(--text-faint);flex-shrink:0} .fail-item[open] .chev{transform:rotate(90deg)}
.status-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}
.status-dot.FAILED,.status-dot.BROKEN{background:var(--fail-fill)} .status-dot.BROKEN{background:var(--broken-fill)}
.status-dot.PASSED{background:var(--pass-fill)} .status-dot.SKIPPED{background:var(--skip-fill)}
.fail-item .ftitle{font-weight:700;flex:1} .fail-item .fcat{color:var(--text-muted);font-size:12.5px}
.fail-item .fdur{color:var(--text-faint);font-size:12.5px;font-variant-numeric:tabular-nums}
.fail-item .body{padding:0 16px 18px;border-top:1px solid var(--border)}
table.feature-table{width:100%;border-collapse:collapse}
table.feature-table th{text-align:left;font-size:10.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--text-faint);font-weight:700;padding:0 10px 10px}
table.feature-table td{padding:11px 10px;border-top:1px solid var(--border);font-size:13px;vertical-align:middle}
table.feature-table tr.feature-row{cursor:pointer} table.feature-table tr.feature-row:hover td{background:var(--surface-2)}
.health-bar{width:84px;height:6px;border-radius:4px;background:var(--surface-2);display:inline-block;margin-right:8px;vertical-align:middle;overflow:hidden}
.health-bar i{display:block;height:100%;border-radius:4px}
.feature-detail-row td{padding:0;border-top:none} .feature-detail{padding:4px 10px 16px 30px;display:none} .feature-detail.open{display:block}
.mini-test{display:flex;align-items:center;gap:9px;padding:6px 0;font-size:12.8px;border-bottom:1px dashed var(--border)}
.mini-test:last-child{border-bottom:none} .mini-test .name{flex:1} .mini-test .dur{color:var(--text-faint);font-variant-numeric:tabular-nums}
.filter-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:14px}
.chip{border:1px solid var(--border);background:var(--surface);color:var(--text-muted);font-size:12.5px;font-weight:700;padding:6px 13px;border-radius:999px;cursor:pointer;transition:.12s}
.chip.active{background:var(--accent);border-color:var(--accent);color:#fff} .chip:hover:not(.active){border-color:var(--accent)}
.filter-bar select,.filter-bar input[type="search"]{border:1px solid var(--border);background:var(--surface);color:var(--text);border-radius:8px;padding:7px 11px;font-size:12.8px;font-family:inherit}
.filter-bar input[type="search"]{min-width:220px;flex:1} .count-badge{color:var(--text-faint);font-size:12px}
.test-row{border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:8px;background:var(--surface)}
.test-row summary{list-style:none;cursor:pointer;padding:11px 14px;display:flex;align-items:center;gap:11px}
.test-row summary::-webkit-details-marker{display:none}
.test-row .name{flex:1;font-weight:600;font-size:13px} .test-row .feat{color:var(--text-muted);font-size:12px;padding:2px 8px;background:var(--surface-2);border-radius:6px}
.test-row .dur{color:var(--text-faint);font-size:12px;width:52px;text-align:right;font-variant-numeric:tabular-nums}
.test-row .chev{color:var(--text-faint);transition:transform .15s} .test-row[open] .chev{transform:rotate(90deg)}
.test-row .body{padding:2px 16px 16px 39px;border-top:1px solid var(--border)} .hidden{display:none !important}
.sd-meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:14px;margin:14px 0}
.sd-meta div .eyebrow{margin-bottom:3px} .sd-meta div b{font-size:13px}
.steps{list-style:none;margin:10px 0;padding:0} .steps li{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px dashed var(--border);font-size:13px}
.steps li:last-child{border-bottom:none} .steps li .sname{flex:1} .steps li .sdur{color:var(--text-faint);font-size:12px;font-variant-numeric:tabular-nums}
.step-fail-detail{margin:6px 0 10px 19px;padding:10px 14px;background:var(--surface-2);border-left:3px solid var(--fail-fill);border-radius:6px;font-size:12.8px}
.step-fail-detail div{margin:3px 0} .step-fail-detail b{color:var(--text-muted);font-weight:700;margin-right:6px}
.failure-box{background:color-mix(in srgb, var(--fail-fill) 8%, var(--surface));border:1px solid color-mix(in srgb, var(--fail-fill) 30%, var(--border));border-radius:var(--radius-sm);padding:14px 16px;margin:14px 0}
.failure-box .eyebrow{color:var(--fail)} .failure-box h4{font-size:13.5px;margin:4px 0 8px} .failure-box p{margin:4px 0;font-size:13px}
.trace-wrap{position:relative;margin-top:8px}
pre.code{background:var(--code-bg);color:var(--code-text);padding:14px 16px;border-radius:9px;overflow:auto;font:12px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre;max-height:260px;margin:0}
.trace-wrap.collapsed pre.code{max-height:64px}
.trace-fade{position:absolute;left:0;right:0;bottom:34px;height:34px;background:linear-gradient(transparent, var(--code-bg));pointer-events:none;border-radius:0 0 9px 9px}
.trace-wrap:not(.collapsed) .trace-fade{display:none} .code-actions{display:flex;gap:8px;margin-top:8px} .copy-btn{font-size:11.5px;padding:5px 10px}
.attach-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:14px 0 10px}
.attach-tab{border:1px solid var(--border);background:var(--surface);color:var(--text-muted);font-size:12px;font-weight:700;padding:6px 12px;border-radius:7px;cursor:pointer}
.attach-tab.active{background:var(--accent-soft);border-color:var(--accent);color:var(--accent)}
.attach-pane{display:none} .attach-pane.active{display:block}
.log-toolbar{display:flex;gap:8px;align-items:center;margin-bottom:8px} .log-toolbar input[type="search"]{flex:1}
.log-lines{background:var(--code-bg);color:var(--code-text);border-radius:9px;padding:12px 0;max-height:320px;overflow:auto;font:12px/1.7 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.log-line{padding:1px 16px;white-space:pre} .log-line.hit{background:rgba(255,213,0,.18)} .log-line.hide{display:none}
.nowrap-toggle .log-lines.nowrap .log-line{white-space:nowrap}
.shot-frame{border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden;cursor:zoom-in;max-width:640px}
.shot-frame img{display:block;width:100%} .shot-caption{display:flex;justify-content:space-between;font-size:11.5px;color:var(--text-faint);margin-top:6px}
.env-groups{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
@media (max-width:900px){.env-groups{grid-template-columns:repeat(2,1fr)}} @media (max-width:600px){.env-groups{grid-template-columns:1fr}}
.env-group h4{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-faint);margin-bottom:9px;padding-bottom:8px;border-bottom:1px solid var(--border)}
.env-kv{display:flex;justify-content:space-between;gap:10px;padding:5px 0;font-size:12.8px} .env-kv span{color:var(--text-muted)} .env-kv b{font-weight:600;text-align:right}
.lightbox{position:fixed;inset:0;background:rgba(6,8,14,.88);display:none;align-items:center;justify-content:center;z-index:200;padding:40px}
.lightbox.open{display:flex} .lightbox img{max-width:100%;max-height:100%;border-radius:8px;box-shadow:0 20px 60px rgba(0,0,0,.5);transition:transform .18s}
.lightbox-bar{position:absolute;top:18px;left:0;right:0;display:flex;justify-content:space-between;align-items:center;padding:0 26px;color:#e8ebf5;font-size:13px}
.lightbox-btn{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);color:#fff;width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center}
.lightbox-nav{position:absolute;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);color:#fff;width:42px;height:42px;border-radius:50%;cursor:pointer;font-size:18px}
.lightbox-nav.prev{left:20px} .lightbox-nav.next{right:20px}
footer{padding:40px 0 60px;text-align:center;color:var(--text-faint);font-size:12px} footer b{color:var(--text-muted)}
.truncate-note{font-size:11.5px;color:var(--broken);background:color-mix(in srgb, var(--broken-fill) 12%, transparent);border:1px solid color-mix(in srgb, var(--broken-fill) 35%, transparent);padding:6px 10px;border-radius:7px;margin-bottom:8px;display:inline-block}
</style>
</head>
<body>
<div class="topbar no-print">
  <div class="topbar-inner">
    <div class="brand"><span>Open<b>QA</b></span><span class="divider"></span><span class="kind">Execution Report</span></div>
    <nav class="topnav"><a href="#summary">Summary</a><a href="#failures">Failures</a><a href="#features">Features</a><a href="#tests">Tests</a><a href="#environment">Environment</a></nav>
    <div class="topbar-actions">
      <button class="btn" id="expandAllBtn">Expand all</button>
      <button class="btn" id="collapseAllBtn">Collapse all</button>
      <button class="btn icon" id="themeToggle" aria-label="Toggle dark mode" title="Toggle dark mode">🌙</button>
    </div>
  </div>
</div>
<div class="wrap">
  <section class="hero">
    <div class="hero-card">
      <div class="hero-left">
        <div class="eyebrow" id="heroEyebrow"></div>
        <h1 id="heroTitle"></h1>
        <div class="meta-line" id="heroMeta"></div>
      </div>
      <div class="hero-right"><span class="status-pill" id="heroStatus"></span></div>
    </div>
  </section>
  <section class="kpi-grid" id="summary"></section>
  <section class="block">
    <div class="two-col">
      <div class="card">
        <div class="section-head"><h2>Result distribution</h2></div>
        <div class="donut-wrap">
          <svg width="176" height="176" viewBox="0 0 176 176" role="img" aria-label="Result distribution donut chart">
            <g transform="rotate(-90 88 88)" id="donutArcs"></g>
            <circle cx="88" cy="88" r="52" fill="var(--surface)"></circle>
            <text x="88" y="83" text-anchor="middle" font-size="26" font-weight="800" fill="var(--text)" font-family="inherit" id="donutTotal"></text>
            <text x="88" y="101" text-anchor="middle" font-size="10.5" letter-spacing="1" fill="var(--text-faint)" font-family="inherit">TOTAL</text>
          </svg>
          <div class="legend" id="donutLegend"></div>
        </div>
      </div>
      <div class="card">
        <div class="section-head"><h2>Failure analysis</h2><span class="hint">click to filter failures</span></div>
        <div id="failureAnalysis"></div>
      </div>
    </div>
  </section>
  <section class="block" id="failures">
    <div class="section-head"><h2>Failed &amp; broken tests</h2><span class="hint" id="failuresHint"></span></div>
    <div id="failedList"></div>
  </section>
  <section class="block" id="features">
    <div class="section-head"><h2>Feature summary</h2><span class="hint">click a row to see its scenarios</span></div>
    <div class="card" style="padding:8px 20px 16px">
      <table class="feature-table">
        <thead><tr><th>Feature</th><th>Total</th><th>Pass</th><th>Fail</th><th>Broken</th><th>Skip</th><th>Health</th></tr></thead>
        <tbody id="featureTableBody"></tbody>
      </table>
    </div>
  </section>
  <section class="block" id="tests">
    <div class="section-head"><h2>All tests</h2><span class="count-badge" id="testCount"></span></div>
    <div class="card">
      <div class="filter-bar">
        <button class="chip active" data-status="all">All</button>
        <button class="chip" data-status="PASSED">Passed</button>
        <button class="chip" data-status="FAILED">Failed</button>
        <button class="chip" data-status="BROKEN">Broken</button>
        <button class="chip" data-status="SKIPPED">Skipped</button>
        <select id="featureFilter"><option value="all">All features</option></select>
        <input type="search" id="testSearch" placeholder="Search scenarios…" />
      </div>
      <div id="testList"></div>
    </div>
  </section>
  <section class="block" id="environment">
    <div class="section-head"><h2>Environment &amp; execution context</h2></div>
    <div class="card"><div class="env-groups" id="envGroups"></div></div>
  </section>
  <footer id="reportFooter"></footer>
</div>
<div class="lightbox no-print" id="lightbox">
  <div class="lightbox-bar"><span id="lightboxCaption"></span><button class="lightbox-btn" id="lightboxClose" aria-label="Close">✕</button></div>
  <button class="lightbox-nav prev" id="lightboxPrev" aria-label="Previous screenshot">‹</button>
  <img id="lightboxImg" alt="" />
  <button class="lightbox-nav next" id="lightboxNext" aria-label="Next screenshot">›</button>
</div>
<script id="reportModelData" type="application/json">__REPORT_MODEL_JSON__</script>
<script>
"use strict";
const REPORT = JSON.parse(document.getElementById("reportModelData").textContent);
const ALL_TESTS = REPORT.scenarios;

function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}

(function renderHero(){
  document.getElementById("heroEyebrow").textContent = REPORT.execution.project + " · " + REPORT.execution.suite;
  document.getElementById("heroTitle").textContent = "Execution #" + REPORT.execution.id;
  const meta = [new Date(REPORT.execution.date).toLocaleString(), "Duration " + REPORT.execution.duration];
  if(REPORT.execution.branch) meta.push("Branch " + REPORT.execution.branch);
  if(REPORT.execution.executedByName) meta.push("By " + REPORT.execution.executedByName);
  document.getElementById("heroMeta").innerHTML = meta.map(esc).join('<span class="dot"></span>');
  const pill = document.getElementById("heroStatus");
  pill.textContent = REPORT.execution.status;
  pill.className = "status-pill " + REPORT.execution.status;
  document.title = "Execution #" + REPORT.execution.id + " · " + REPORT.execution.project + " · OpenQA Report";
})();

(function renderKpis(){
  const s = REPORT.summary;
  const cards = [
    ["Total","",s.total], ["Passed","pass",s.passed], ["Failed","fail",s.failed],
    ["Broken","broken",s.broken], ["Skipped","skip",s.skipped], ["Pass rate","",s.passRate.toFixed(1)+"%"],
  ];
  document.getElementById("summary").innerHTML = cards.map(([label,cls,val])=>
    '<div class="kpi '+cls+'"><div class="eyebrow">'+esc(label)+'</div><b class="tnum">'+esc(val)+'</b></div>'
  ).join("");
})();

(function renderDonut(){
  const s = REPORT.summary;
  const segs = [["passed","var(--pass-fill)"],["failed","var(--fail-fill)"],["broken","var(--broken-fill)"],["skipped","var(--skip-fill)"]];
  const r=70,cx=88,cy=88,circ=2*Math.PI*r; let offset=0;
  const g = document.getElementById("donutArcs");
  segs.forEach(([key,color])=>{
    const v = s[key]; if(!v) return;
    const len = circ*(v/s.total);
    const c = document.createElementNS("http://www.w3.org/2000/svg","circle");
    c.setAttribute("cx",cx); c.setAttribute("cy",cy); c.setAttribute("r",r); c.setAttribute("fill","none");
    c.setAttribute("stroke",color); c.setAttribute("stroke-width","22");
    c.setAttribute("stroke-dasharray", len+" "+(circ-len)); c.setAttribute("stroke-dashoffset", -offset);
    g.appendChild(c); offset += len;
  });
  document.getElementById("donutTotal").textContent = s.total;
  document.getElementById("donutLegend").innerHTML = [
    ["Passed","pass-fill",s.passed],["Failed","fail-fill",s.failed],["Broken","broken-fill",s.broken],["Skipped","skip-fill",s.skipped],
  ].map(([name,cls,v])=>{
    const pct = s.total ? (v/s.total*100).toFixed(1) : "0.0";
    return '<div class="legend-row"><span class="sw" style="background:var(--'+cls+')"></span>'+name+'<b class="tnum">'+v+'</b><span class="pct tnum">'+pct+'%</span></div>';
  }).join("");
})();

(function renderFailureAnalysis(){
  const el = document.getElementById("failureAnalysis");
  if(!REPORT.failureCategories.length){ el.innerHTML = '<p style="color:var(--text-faint);font-size:13px">No failures in this execution.</p>'; return; }
  const max = Math.max(...REPORT.failureCategories.map(c=>c.count));
  el.innerHTML = REPORT.failureCategories.map(c=>
    '<div class="fa-row clickable" data-cat="'+esc(c.name)+'"><span class="fa-name">'+esc(c.name)+'</span><span class="fa-bar"><i style="width:'+(c.count/max*100).toFixed(0)+'%"></i></span><b class="tnum">'+c.count+'</b></div>'
  ).join("");
  el.querySelectorAll(".fa-row").forEach(row=>{
    row.addEventListener("click", ()=>{
      document.getElementById("testSearch").value = "";
      setStatusFilter("all"); document.getElementById("featureFilter").value = "all";
      window.__categoryFilter = row.dataset.cat; renderTestList();
      document.getElementById("tests").scrollIntoView({behavior:"smooth"});
    });
  });
})();

(function renderFailedList(){
  const rows = ALL_TESTS.filter(t=>t.status==="FAILED"||t.status==="BROKEN");
  document.getElementById("failuresHint").textContent = rows.length + " of " + ALL_TESTS.length + " need attention" + (rows.length ? " — investigate these first" : "");
  document.getElementById("failedList").innerHTML = rows.map(t=>
    '<details class="fail-item" data-testid="'+esc(t.id)+'"><summary>'+
    '<svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'+
    '<span class="status-dot '+t.status+'"></span><span class="ftitle">'+esc(t.name)+'</span>'+
    '<span class="fcat">'+esc(t.feature)+(t.failure?" · "+esc(t.failure.category):"")+'</span>'+
    '<span class="fdur tnum">'+esc(t.duration)+'</span></summary><div class="body">'+renderScenarioDetail(t)+'</div></details>'
  ).join("");
  wireDynamicContent(document.getElementById("failedList"));
})();

(function renderFeatureTable(){
  const body = document.getElementById("featureTableBody");
  body.innerHTML = REPORT.features.map((f,i)=>{
    const pct = f.total ? (f.passed/f.total*100) : 0;
    const color = pct>=90 ? "var(--pass-fill)" : pct>=70 ? "var(--skip-fill)" : "var(--fail-fill)";
    return '<tr class="feature-row" data-idx="'+i+'"><td><b>'+esc(f.name)+'</b></td><td class="tnum">'+f.total+'</td>'+
      '<td class="tnum" style="color:var(--pass)">'+f.passed+'</td><td class="tnum" style="color:var(--fail)">'+f.failed+'</td>'+
      '<td class="tnum" style="color:var(--broken)">'+f.broken+'</td><td class="tnum" style="color:var(--skip)">'+f.skipped+'</td>'+
      '<td><span class="health-bar"><i style="width:'+pct.toFixed(0)+'%;background:'+color+'"></i></span><span class="tnum">'+pct.toFixed(1)+'%</span></td></tr>'+
      '<tr class="feature-detail-row"><td colspan="7"><div class="feature-detail" id="feat-detail-'+i+'"></div></td></tr>';
  }).join("");
  body.querySelectorAll(".feature-row").forEach(row=>{
    row.addEventListener("click", ()=>{
      const idx = row.dataset.idx, detail = document.getElementById("feat-detail-"+idx), f = REPORT.features[idx];
      if(!detail.classList.contains("open")){
        detail.innerHTML = ALL_TESTS.filter(t=>t.feature===f.name).map(t=>
          '<div class="mini-test"><span class="status-dot '+t.status+'"></span><span class="name">'+esc(t.name)+'</span><span class="dur tnum">'+esc(t.duration)+'</span></div>'
        ).join("");
      }
      detail.classList.toggle("open");
    });
  });
})();

function renderScenarioDetail(t){
  let html = '<div class="sd-meta"><div><div class="eyebrow">Status</div><b>'+esc(t.status)+'</b></div>'+
    '<div><div class="eyebrow">Duration</div><b class="tnum">'+esc(t.duration)+'</b></div>'+
    '<div><div class="eyebrow">Feature</div><b>'+esc(t.feature)+'</b></div>'+
    '<div><div class="eyebrow">Story</div><b>'+esc(t.story||"—")+'</b></div>'+
    '<div><div class="eyebrow">Severity</div><b>'+esc(t.severity||"—")+'</b></div>'+
    '<div><div class="eyebrow">Owner</div><b>'+esc(t.owner||"—")+'</b></div></div>';

  if(t.params && Object.keys(t.params).length){
    html += '<div class="eyebrow" style="margin-bottom:6px">Parameters</div><div style="font-size:12.8px;color:var(--text-muted);margin-bottom:12px">'+
      Object.entries(t.params).map(([k,v])=>esc(k)+' = <b style="color:var(--text)">'+esc(v)+'</b>').join(" &nbsp;·&nbsp; ")+'</div>';
  }

  if(t.status==="SKIPPED"){
    html += '<div class="failure-box" style="border-color:color-mix(in srgb, var(--skip-fill) 35%, var(--border));background:color-mix(in srgb, var(--skip-fill) 8%, var(--surface))">'+
      '<div class="eyebrow" style="color:var(--skip)">Skip reason</div><p>'+esc(t.skipReason||"No reason provided.")+'</p></div>';
    return html;
  }

  if(t.steps && t.steps.length){
    html += '<div class="eyebrow" style="margin:14px 0 4px">Steps</div><ul class="steps">'+t.steps.map(s=>{
      const icon = s.status==="PASSED"?"✓":s.status==="SKIPPED"?"○":(s.status==="BROKEN"?"⚠":"✕");
      const color = s.status==="PASSED"?"var(--pass)":s.status==="SKIPPED"?"var(--text-faint)":(s.status==="BROKEN"?"var(--broken)":"var(--fail)");
      let extra = "";
      if(s.expected || s.actual) extra = '<div class="step-fail-detail"><div><b>Message</b>'+esc(s.expected||"—")+'</div><div><b>Trace</b>'+esc(s.actual||"—")+'</div></div>';
      return '<li><span style="color:'+color+';width:16px;text-align:center">'+icon+'</span><span class="sname">'+esc(s.name)+'</span><span class="sdur">'+esc(s.duration)+'</span></li>'+extra;
    }).join("")+'</ul>';
  }

  if(t.failure){
    const traceId = "trace-"+t.id;
    html += '<div class="failure-box"><div class="eyebrow">Failure details</div><h4>'+esc(t.failure.category)+'</h4><p>'+esc(t.failure.message)+'</p>'+
      '<div class="eyebrow" style="margin:10px 0 4px">Stack trace</div>'+
      '<div class="trace-wrap collapsed" id="'+traceId+'"><pre class="code">'+esc(t.failure.trace)+'</pre><div class="trace-fade"></div></div>'+
      '<div class="code-actions"><button class="btn copy-btn" data-toggle-trace="'+traceId+'">Expand trace</button>'+
      '<button class="btn copy-btn" data-copy-trace="'+traceId+'">Copy stack trace</button></div></div>';
  }

  if(t.attachments && t.attachments.length){
    const uid = "att-"+t.id;
    html += '<div class="eyebrow" style="margin:16px 0 4px">Attachments</div><div class="attach-tabs" data-uid="'+uid+'">'+
      t.attachments.map((a,i)=>'<button class="attach-tab '+(i===0?"active":"")+'" data-tab="'+i+'">'+esc(a.name)+'</button>').join("")+'</div>';
    t.attachments.forEach((a,i)=>{
      html += '<div class="attach-pane '+(i===0?"active":"")+'" data-uid="'+uid+'" data-pane="'+i+'">';
      if(a.kind==="screenshot" && a.dataUrl){
        html += '<div class="shot-frame" data-lightbox-src="'+a.dataUrl+'" data-lightbox-caption="'+esc(a.name)+'"><img src="'+a.dataUrl+'" alt="'+esc(a.name)+'" /></div>'+
          '<div class="shot-caption"><span>'+esc(a.name)+'</span></div>';
      } else if(a.kind==="screenshot" && a.truncated){
        html += '<div class="truncate-note">Screenshot omitted from this report - exceeds the embedded size limit.</div>';
      } else if(a.kind==="log"){
        const logId = uid+"-log-"+i;
        html += '<div class="log-toolbar"><input type="search" placeholder="Search logs…" data-log-search="'+logId+'" />'+
          '<button class="btn copy-btn" data-log-wrap="'+logId+'">Wrap</button><button class="btn copy-btn" data-log-copy="'+logId+'">Copy</button></div>'+
          (a.truncated ? '<div class="truncate-note">Log truncated in this report - exceeds the embedded size limit.</div>' : '')+
          '<div class="log-lines" id="'+logId+'">'+esc(a.text||"").split("\\n").map(l=>'<div class="log-line">'+l+'</div>').join("")+'</div>';
      } else if(a.kind==="json"){
        const boxId = uid+"-json-"+i;
        let pretty = a.text||"";
        try{ pretty = JSON.stringify(JSON.parse(a.text||"{}"), null, 2); }catch(e){}
        html += '<div class="code-actions" style="margin-bottom:8px"><button class="btn copy-btn" data-copy-box="'+boxId+'">Copy JSON</button></div>'+
          '<pre class="code" id="'+boxId+'">'+esc(pretty)+'</pre>';
      } else if(a.kind==="xml"){
        const boxId = uid+"-xml-"+i;
        html += '<div class="code-actions" style="margin-bottom:8px"><button class="btn copy-btn" data-copy-box="'+boxId+'">Copy XML</button></div>'+
          '<pre class="code" id="'+boxId+'">'+esc(a.text||"")+'</pre>';
      } else {
        html += '<p style="color:var(--text-faint);font-size:12.8px">'+esc(a.name)+' — preview not available for this attachment type.</p>';
      }
      html += '</div>';
    });
  }
  return html;
}

function wireDynamicContent(root){
  root.querySelectorAll("[data-toggle-trace]").forEach(btn=>btn.addEventListener("click",()=>{
    const wrap = document.getElementById(btn.dataset.toggleTrace); wrap.classList.toggle("collapsed");
    btn.textContent = wrap.classList.contains("collapsed") ? "Expand trace" : "Collapse trace";
  }));
  root.querySelectorAll("[data-copy-trace]").forEach(btn=>btn.addEventListener("click",()=>{
    copyText(document.getElementById(btn.dataset.copyTrace).querySelector("pre").textContent, btn);
  }));
  root.querySelectorAll("[data-copy-box]").forEach(btn=>btn.addEventListener("click",()=>{
    copyText(document.getElementById(btn.dataset.copyBox).textContent, btn);
  }));
  root.querySelectorAll(".attach-tabs").forEach(tabbar=>{
    const uid = tabbar.dataset.uid;
    tabbar.querySelectorAll(".attach-tab").forEach(tab=>{
      tab.addEventListener("click", ()=>{
        tabbar.querySelectorAll(".attach-tab").forEach(x=>x.classList.remove("active")); tab.classList.add("active");
        root.querySelectorAll('.attach-pane[data-uid="'+uid+'"]').forEach(p=>p.classList.toggle("active", p.dataset.pane===tab.dataset.tab));
      });
    });
  });
  root.querySelectorAll("[data-log-search]").forEach(input=>input.addEventListener("input",()=>{
    const box = document.getElementById(input.dataset.logSearch); const q = input.value.toLowerCase();
    box.querySelectorAll(".log-line").forEach(line=>{
      const match = !q || line.textContent.toLowerCase().includes(q);
      line.classList.toggle("hide", !match); line.classList.toggle("hit", !!q && match);
    });
  }));
  root.querySelectorAll("[data-log-wrap]").forEach(btn=>btn.addEventListener("click",()=>document.getElementById(btn.dataset.logWrap).classList.toggle("nowrap")));
  root.querySelectorAll("[data-log-copy]").forEach(btn=>btn.addEventListener("click",()=>copyText(document.getElementById(btn.dataset.logCopy).innerText, btn)));
  root.querySelectorAll("[data-lightbox-src]").forEach(frame=>frame.addEventListener("click",()=>openLightbox(frame.dataset.lightboxSrc, frame.dataset.lightboxCaption)));
}

function copyText(text, btn){
  const done = ()=>{ const o=btn.textContent; btn.textContent="Copied ✓"; setTimeout(()=>btn.textContent=o,1400); };
  if(navigator.clipboard && window.isSecureContext){ navigator.clipboard.writeText(text).then(done).catch(done); }
  else { const ta=document.createElement("textarea"); ta.value=text; document.body.appendChild(ta); ta.select(); try{document.execCommand("copy")}catch(e){} document.body.removeChild(ta); done(); }
}

let lightboxShots=[], lightboxIdx=0;
function collectShots(){ lightboxShots = Array.from(document.querySelectorAll("[data-lightbox-src]")).map(f=>({src:f.dataset.lightboxSrc,caption:f.dataset.lightboxCaption})); }
function openLightbox(src, caption){ collectShots(); lightboxIdx = Math.max(0, lightboxShots.findIndex(s=>s.src===src)); showLightbox(); }
function showLightbox(){ const shot=lightboxShots[lightboxIdx]; document.getElementById("lightboxImg").src=shot.src; document.getElementById("lightboxCaption").textContent = shot.caption+" ("+(lightboxIdx+1)+" of "+lightboxShots.length+")"; document.getElementById("lightbox").classList.add("open"); }
document.getElementById("lightboxClose").addEventListener("click",()=>document.getElementById("lightbox").classList.remove("open"));
document.getElementById("lightbox").addEventListener("click",(e)=>{ if(e.target.id==="lightbox") document.getElementById("lightbox").classList.remove("open"); });
document.getElementById("lightboxPrev").addEventListener("click",()=>{ lightboxIdx=(lightboxIdx-1+lightboxShots.length)%lightboxShots.length; showLightbox(); });
document.getElementById("lightboxNext").addEventListener("click",()=>{ lightboxIdx=(lightboxIdx+1)%lightboxShots.length; showLightbox(); });
document.getElementById("lightboxImg").addEventListener("click",(e)=>{ e.currentTarget.style.transform = e.currentTarget.style.transform ? "" : "scale(1.6)"; });
document.addEventListener("keydown",(e)=>{
  if(!document.getElementById("lightbox").classList.contains("open")) return;
  if(e.key==="Escape") document.getElementById("lightbox").classList.remove("open");
  if(e.key==="ArrowLeft") document.getElementById("lightboxPrev").click();
  if(e.key==="ArrowRight") document.getElementById("lightboxNext").click();
});

let currentStatusFilter = "all";
function setStatusFilter(s){ currentStatusFilter = s; document.querySelectorAll(".chip[data-status]").forEach(c=>c.classList.toggle("active", c.dataset.status===s)); }
(function populateFeatureFilter(){
  const sel = document.getElementById("featureFilter");
  REPORT.features.forEach(f=>{ const opt=document.createElement("option"); opt.value=f.name; opt.textContent=f.name; sel.appendChild(opt); });
})();

function renderTestList(){
  const q = document.getElementById("testSearch").value.trim().toLowerCase();
  const featureVal = document.getElementById("featureFilter").value;
  const catFilter = window.__categoryFilter;
  const rows = ALL_TESTS.filter(t=>{
    if(currentStatusFilter!=="all" && t.status!==currentStatusFilter) return false;
    if(featureVal!=="all" && t.feature!==featureVal) return false;
    if(catFilter && (!t.failure || t.failure.category!==catFilter)) return false;
    if(q && !(t.name.toLowerCase().includes(q) || t.feature.toLowerCase().includes(q))) return false;
    return true;
  });
  document.getElementById("testCount").textContent = rows.length+" of "+ALL_TESTS.length+" tests";
  const list = document.getElementById("testList");
  list.innerHTML = rows.map(t=>
    '<details class="test-row" data-testid="'+esc(t.id)+'"><summary>'+
    '<svg class="chev" width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'+
    '<span class="status-dot '+t.status+'"></span><span class="name">'+esc(t.name)+'</span><span class="feat">'+esc(t.feature)+'</span>'+
    '<span class="dur tnum">'+esc(t.duration)+'</span></summary><div class="body"></div></details>'
  ).join("");
  list.querySelectorAll(".test-row").forEach(row=>{
    row.addEventListener("toggle", ()=>{
      if(row.open && !row.dataset.rendered){
        const t = ALL_TESTS.find(x=>x.id===row.dataset.testid);
        const body = row.querySelector(".body"); body.innerHTML = renderScenarioDetail(t); wireDynamicContent(body);
        row.dataset.rendered = "1";
      }
    });
  });
}
document.querySelectorAll(".chip[data-status]").forEach(chip=>chip.addEventListener("click",()=>{ window.__categoryFilter=null; setStatusFilter(chip.dataset.status); renderTestList(); }));
document.getElementById("featureFilter").addEventListener("change",()=>{ window.__categoryFilter=null; renderTestList(); });
document.getElementById("testSearch").addEventListener("input", renderTestList);
renderTestList();

(function renderEnvironment(){
  document.getElementById("envGroups").innerHTML = REPORT.environment.map(g=>
    '<div class="env-group"><h4>'+esc(g.section)+'</h4>'+
    Object.entries(g.values).map(([k,v])=>'<div class="env-kv"><span>'+esc(k)+'</span><b>'+esc(v)+'</b></div>').join("")+'</div>'
  ).join("");
})();

document.getElementById("expandAllBtn").addEventListener("click",()=>{
  document.querySelectorAll("details").forEach(d=>{ d.open=true; d.dispatchEvent(new Event("toggle")); });
  document.querySelectorAll(".feature-row").forEach((row,i)=>{ const d=document.getElementById("feat-detail-"+i); if(!d.classList.contains("open")) row.click(); });
});
document.getElementById("collapseAllBtn").addEventListener("click",()=>{
  document.querySelectorAll("details").forEach(d=>d.open=false);
  document.querySelectorAll(".feature-detail.open").forEach(d=>d.classList.remove("open"));
});

(function themeInit(){
  let saved=null; try{ saved=localStorage.getItem("openqa-report-theme"); }catch(e){}
  if(saved) document.documentElement.setAttribute("data-theme", saved);
  updateThemeIcon();
})();
function updateThemeIcon(){
  const attr = document.documentElement.getAttribute("data-theme");
  const isDark = attr ? attr==="dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.getElementById("themeToggle").textContent = isDark ? "☀️" : "🌙";
}
document.getElementById("themeToggle").addEventListener("click",()=>{
  const current = document.documentElement.getAttribute("data-theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark":"light");
  const next = current==="dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try{ localStorage.setItem("openqa-report-theme", next); }catch(e){}
  updateThemeIcon();
});

(function renderFooter(){
  document.getElementById("reportFooter").innerHTML =
    '<div><b>OpenQA Dashboard</b> · Standalone Execution Report</div>'+
    '<div style="margin-top:4px">Execution #'+esc(REPORT.execution.id)+' · '+esc(REPORT.execution.project)+'</div>';
})();
</script>
</body>
</html>`
