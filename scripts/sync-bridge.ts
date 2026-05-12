import { createClient } from '@supabase/supabase-js'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

type SupabaseBridgeClient = ReturnType<typeof createClient<any>>

interface CanonicalProjectRegistry {
  projects: Array<{
    id: string
    name: string
    owner?: string
    team?: string[]
    status?: string
    priority?: string
    currentPhase?: string
    nextStep?: string
    updatedAt?: string
  }>
}

interface CanonicalTeamMember {
  id: string
  name: string
  role: string | null
  model: string | null
  agent_group: string | null
  parent_agent: string | null
  synced_at: string
}

interface CronJobSnapshot {
  id: string
  name: string
  schedule: string
  status: string
  enabled: boolean
  last_run_at: string | null
  next_run_at: string | null
  duration_ms: number | null
  error: string | null
  synced_at: string
}

interface TokenUsageDailySnapshot {
  id: string
  agent: string
  date: string
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_write_tokens: number
  total_tokens: number
  turns: number
  synced_at: string
}

interface RawCronState {
  lastRunStatus?: string
  lastStatus?: string
  lastRunAtMs?: number
  nextRunAtMs?: number
  lastDurationMs?: number
  lastError?: string
  error?: string
}

interface RawCronSchedule {
  expr?: string
  kind?: string
  everyMs?: number
}

interface RawCronJob {
  id?: unknown
  name?: unknown
  enabled?: boolean
  schedule?: string | RawCronSchedule
  state?: RawCronState
  tags?: unknown[]
  agentId?: unknown
}

interface ExecFailure {
  message?: string
  stdout?: string | Buffer
  stderr?: string | Buffer
}

function loadLocalEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return
  const raw = fs.readFileSync(filePath, 'utf8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex === -1) continue
    const key = trimmed.slice(0, separatorIndex).trim()
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['\"]|['\"]$/g, '')
    if (key && process.env[key] == null) process.env[key] = value
  }
}

loadLocalEnvFile(path.resolve(process.cwd(), '.env.sync'))

// ---------------------------------------------------------------------------
// Single-instance guard
// ---------------------------------------------------------------------------
const LOCK_FILE = path.join(os.tmpdir(), 'mission-control-online-sync-bridge.pid')

function acquireLock(): boolean {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const raw = fs.readFileSync(LOCK_FILE, 'utf8').trim()
      const prevPid = Number(raw)
      if (Number.isFinite(prevPid)) {
        try {
          process.kill(prevPid, 0)
          console.error(`Another sync bridge is already running (PID ${prevPid}). If it is stale, delete ${LOCK_FILE} and restart.`)
          return false
        } catch {
          // stale lock file
        }
      }
    }
    fs.writeFileSync(LOCK_FILE, String(process.pid))
    return true
  } catch {
    return true
  }
}

function releaseLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE)
  } catch { /* best-effort */ }
}
// ---------------------------------------------------------------------------

const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run')
const once = args.has('--once') || dryRun
const poll = args.has('--poll')

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const workspaceRoot = process.env.WARUNG_KERJA_ROOT ?? '/mnt/d/Warung Kerja 1.0'
const pollSeconds = Number(process.env.SYNC_REQUEST_POLL_SECONDS ?? 30)
const syncIntervalMinutes = Number(process.env.SYNC_INTERVAL_MINUTES ?? 10)
const tokenUsageDays = Math.min(Math.max(Number(process.env.TOKEN_USAGE_DAYS ?? 7), 1), 60)
const tokenUsageTimeZone = process.env.TOKEN_USAGE_TIMEZONE ?? 'Australia/Sydney'
const openClawAgentsDir = process.env.OPENCLAW_AGENTS_DIR ?? path.join(os.homedir(), '.openclaw', 'agents')
const openClawGatewayUrl = process.env.OPENCLAW_GATEWAY_URL?.trim()
const openClawGatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN?.trim()

const projectRegistryPath = path.join(workspaceRoot, '03_Active_Projects/_registry/projects.json')
const teamRosterPath = path.join(workspaceRoot, '06_Agents/_Shared_Memory/AGENTS_ROSTER.md')
const OPENCLAW_BINARY_CANDIDATES = [
  '/home/baro/.npm-global/bin/openclaw',
  '/usr/local/bin/openclaw',
  '/usr/bin/openclaw',
]
const CRON_ADAPTER_STATUS_ID = 'openclaw-cron-adapter'

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function readProjects(syncedAt: string) {
  const raw = fs.readFileSync(projectRegistryPath, 'utf8')
  const registry = JSON.parse(raw) as CanonicalProjectRegistry

  return registry.projects.map((project) => ({
    id: project.id,
    name: project.name,
    owner: project.owner ?? null,
    team: project.team ?? [],
    status: project.status ?? null,
    priority: project.priority ?? null,
    current_phase: project.currentPhase ?? null,
    next_step: project.nextStep ?? null,
    source_updated_at: project.updatedAt ?? null,
    synced_at: syncedAt,
  }))
}

function parseTeamRoster(raw: string, syncedAt: string): CanonicalTeamMember[] {
  const members: CanonicalTeamMember[] = []
  const lines = raw.split('\n')
  let currentGroup = 'independent'
  let currentParent: string | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (/^independent/i.test(trimmed)) {
      currentGroup = 'independent'
      currentParent = null
      continue
    }
    if (/^ecosystem/i.test(trimmed)) {
      currentGroup = 'ecosystem'
      currentParent = null
      continue
    }

    const subagentHeader = trimmed.match(/^(.+?)['']s\s+Subagents?:/i)
    if (subagentHeader) {
      currentGroup = 'subagent'
      currentParent = subagentHeader[1].trim()
      continue
    }

    const memberMatch = trimmed.match(/^-\s+(.+?):\s+(.+?)\s+\((.+?)\)(?:\s*-\s*(\S+))?$/)
    if (!memberMatch) continue

    const name = memberMatch[1].trim()
    members.push({
      id: slug(`${currentGroup}-${currentParent ?? 'root'}-${name}`),
      name,
      role: memberMatch[2].trim(),
      model: memberMatch[3].trim(),
      agent_group: currentGroup,
      parent_agent: currentParent,
      synced_at: syncedAt,
    })
  }

  return members
}

function readTeam(syncedAt: string) {
  return parseTeamRoster(fs.readFileSync(teamRosterPath, 'utf8'), syncedAt)
}

function readSourceHealth(syncedAt: string) {
  const sources = [
    { id: 'project-registry', label: 'Project registry', source_type: 'json', filePath: projectRegistryPath },
    { id: 'team-roster', label: 'Agent roster', source_type: 'markdown', filePath: teamRosterPath },
  ]

  return sources.map((source) => {
    try {
      const stat = fs.statSync(source.filePath)
      return {
        id: source.id,
        label: source.label,
        source_type: source.source_type,
        exists: true,
        readable: true,
        modified_at: stat.mtime.toISOString(),
        age_hours: Math.max(0, Math.round((Date.now() - stat.mtimeMs) / 36_000) / 100),
        status: 'healthy',
        error: null,
        synced_at: syncedAt,
      }
    } catch (error) {
      return {
        id: source.id,
        label: source.label,
        source_type: source.source_type,
        exists: false,
        readable: false,
        modified_at: null,
        age_hours: null,
        status: 'missing',
        error: error instanceof Error ? error.message : String(error),
        synced_at: syncedAt,
      }
    }
  })
}

function findOpenClawBinary(): string | null {
  for (const candidate of OPENCLAW_BINARY_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

function formatCronSchedule(schedule: RawCronJob['schedule']) {
  if (!schedule) return '-'
  if (typeof schedule === 'string') return schedule
  if (schedule.expr) return schedule.expr
  if (schedule.kind === 'every' && schedule.everyMs) {
    const hours = schedule.everyMs / 3_600_000
    return Number.isInteger(hours) ? `every ${hours}h` : `every ${schedule.everyMs}ms`
  }
  return '-'
}

function normalizeCronStatus(rawStatus: string | undefined, enabled: boolean) {
  if (!enabled) return 'disabled'
  if (rawStatus === 'ok') return 'success'
  if (rawStatus === 'error') return 'failure'
  return rawStatus || 'pending'
}

function normalizeCronJob(raw: RawCronJob, syncedAt: string): CronJobSnapshot {
  const state = raw.state || {}
  const enabled = raw.enabled !== false

  return {
    id: String(raw.id || raw.name || 'unknown-cron-job'),
    name: String(raw.name || 'Unnamed cron job'),
    schedule: formatCronSchedule(raw.schedule),
    status: normalizeCronStatus(state.lastRunStatus || state.lastStatus, enabled),
    enabled,
    last_run_at: state.lastRunAtMs ? new Date(state.lastRunAtMs).toISOString() : null,
    next_run_at: state.nextRunAtMs ? new Date(state.nextRunAtMs).toISOString() : null,
    duration_ms: state.lastDurationMs != null ? Number(state.lastDurationMs) : null,
    error: state.lastError || state.error || null,
    synced_at: syncedAt,
  }
}

function cronAdapterStatus(status: 'success' | 'failure', syncedAt: string, error: string | null): CronJobSnapshot {
  return {
    id: CRON_ADAPTER_STATUS_ID,
    name: 'OpenClaw cron adapter',
    schedule: 'bridge check',
    status,
    enabled: status === 'success',
    last_run_at: syncedAt,
    next_run_at: null,
    duration_ms: null,
    error,
    synced_at: syncedAt,
  }
}

function errorMessage(error: unknown) {
  const failure = error as ExecFailure
  const stderr = typeof failure.stderr === 'string' ? failure.stderr.trim() : ''
  const raw = stderr || failure.message || 'unknown error'
  return raw
    .replace(/--token\s+\S+/gi, '--token [redacted]')
    .replace(/--password\s+\S+/gi, '--password [redacted]')
    .slice(0, 700)
}

function readCronJobs(syncedAt: string): CronJobSnapshot[] {
  if (!openClawGatewayUrl) {
    return [cronAdapterStatus('failure', syncedAt, 'OPENCLAW_GATEWAY_URL is not set in .env.sync.')]
  }

  const binary = findOpenClawBinary()
  if (!binary) {
    return [cronAdapterStatus('failure', syncedAt, 'OpenClaw CLI binary was not found on this host.')]
  }

  const wsUrl = openClawGatewayUrl.replace(/^http/, 'ws')
  const args = [
    'cron',
    'list',
    '--all',
    '--json',
    '--timeout',
    '30000',
    '--url',
    wsUrl,
    ...(openClawGatewayToken ? ['--token', openClawGatewayToken] : []),
  ]

  try {
    const stdout = execFileSync(binary, args, {
      encoding: 'utf8',
      timeout: 40_000,
      maxBuffer: 5 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const payload = JSON.parse(stdout) as { jobs?: RawCronJob[] }
    const jobs = Array.isArray(payload.jobs) ? payload.jobs.map((job) => normalizeCronJob(job, syncedAt)) : []
    return jobs.length > 0 ? jobs : [cronAdapterStatus('success', syncedAt, null)]
  } catch (error) {
    return [cronAdapterStatus('failure', syncedAt, `Failed to fetch cron jobs via CLI: ${errorMessage(error)}`)]
  }
}

function formatDateInZone(date: Date, timeZone = tokenUsageTimeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${lookup.year}-${lookup.month}-${lookup.day}`
}

function buildDateWindow(days: number) {
  const dates: string[] = []
  const seen = new Set<string>()

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    const key = formatDateInZone(date)
    if (!seen.has(key)) {
      seen.add(key)
      dates.push(key)
    }
  }

  return dates
}

function addTokenUsageEntry(usage: Map<string, Map<string, TokenUsageDailySnapshot>>, agent: string, date: string, syncedAt: string) {
  const agentUsage = usage.get(agent) ?? new Map<string, TokenUsageDailySnapshot>()
  const entry = agentUsage.get(date) ?? {
    id: `${agent}:${date}`,
    agent,
    date,
    input_tokens: 0,
    output_tokens: 0,
    cache_read_tokens: 0,
    cache_write_tokens: 0,
    total_tokens: 0,
    turns: 0,
    synced_at: syncedAt,
  }
  usage.set(agent, agentUsage)
  agentUsage.set(date, entry)
  return entry
}

function readTokenUsage(syncedAt: string): TokenUsageDailySnapshot[] {
  const dates = buildDateWindow(tokenUsageDays)
  const allowedDates = new Set(dates)
  const usageByAgent = new Map<string, Map<string, TokenUsageDailySnapshot>>()

  let agentDirs: string[] = []
  try {
    agentDirs = fs.readdirSync(openClawAgentsDir)
  } catch {
    return []
  }

  for (const agentId of agentDirs) {
    const sessionsDir = path.join(openClawAgentsDir, agentId, 'sessions')
    let files: string[] = []
    try {
      files = fs.readdirSync(sessionsDir)
    } catch {
      continue
    }

    for (const file of files) {
      if (!file.endsWith('.jsonl') || file.endsWith('.trajectory.jsonl')) continue

      let body = ''
      try {
        body = fs.readFileSync(path.join(sessionsDir, file), 'utf8')
      } catch {
        continue
      }

      for (const line of body.split('\n')) {
        if (!line.includes('"usage"')) continue

        try {
          const record = JSON.parse(line)
          const message = record?.message
          const usage = message?.usage
          if (!usage) continue

          const rawTimestamp = message.timestamp ?? record.timestamp
          const timestamp = typeof rawTimestamp === 'number' ? new Date(rawTimestamp) : new Date(String(rawTimestamp))
          if (Number.isNaN(timestamp.getTime())) continue

          const date = formatDateInZone(timestamp)
          if (!allowedDates.has(date)) continue

          const entry = addTokenUsageEntry(usageByAgent, agentId, date, syncedAt)
          const input = Number(usage.input ?? usage.inputTokens ?? 0)
          const output = Number(usage.output ?? usage.outputTokens ?? 0)
          const cacheRead = Number(usage.cacheRead ?? usage.cache_read ?? 0)
          const cacheWrite = Number(usage.cacheWrite ?? usage.cache_write ?? 0)
          const totalTokens = Number(usage.totalTokens ?? usage.total ?? (input + output + cacheRead + cacheWrite))

          entry.input_tokens += Number.isFinite(input) ? input : 0
          entry.output_tokens += Number.isFinite(output) ? output : 0
          entry.cache_read_tokens += Number.isFinite(cacheRead) ? cacheRead : 0
          entry.cache_write_tokens += Number.isFinite(cacheWrite) ? cacheWrite : 0
          entry.total_tokens += Number.isFinite(totalTokens) ? totalTokens : 0
          entry.turns += 1
        } catch {
          // Ignore malformed historical log lines.
        }
      }
    }
  }

  return [...usageByAgent.values()]
    .flatMap((agentUsage) => [...agentUsage.values()])
    .filter((entry) => entry.turns > 0 || entry.total_tokens > 0)
}

async function createSyncRun(client: SupabaseBridgeClient, trigger: 'scheduled' | 'manual' | 'dry_run') {
  const { data, error } = await client
    .from('sync_runs')
    .insert({ status: 'running', trigger, source_host: os.hostname(), started_at: new Date().toISOString() })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

async function finishSyncRun(client: SupabaseBridgeClient, id: string, status: 'success' | 'failed', summary: Record<string, unknown>, error?: unknown) {
  await client.from('sync_runs').update({
    status,
    finished_at: new Date().toISOString(),
    summary,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
  }).eq('id', id)
}

async function runSync(trigger: 'scheduled' | 'manual' | 'dry_run' = dryRun ? 'dry_run' : 'scheduled') {
  const syncedAt = new Date().toISOString()
  const projects = readProjects(syncedAt)
  const team = readTeam(syncedAt)
  const sourceHealth = readSourceHealth(syncedAt)
  const cronJobs = readCronJobs(syncedAt)
  const tokenUsage = readTokenUsage(syncedAt)
  const summary = { projects: projects.length, teamMembers: team.length, sourceHealth: sourceHealth.length, cronJobs: cronJobs.length, tokenUsageRows: tokenUsage.length, syncedAt }

  if (dryRun || trigger === 'dry_run') {
    console.log(JSON.stringify({ dryRun: true, summary, samples: { projects: projects.slice(0, 2), team: team.slice(0, 2), sourceHealth, cronJobs: cronJobs.slice(0, 3), tokenUsage: tokenUsage.slice(0, 5) } }, null, 2))
    return
  }

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add them to local sync bridge environment.')
  }

  const client = createClient<any>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const syncRunId = await createSyncRun(client, trigger)
  try {
    const writes = await Promise.all([
      client.from('canonical_projects').upsert(projects),
      client.from('canonical_team_members').upsert(team),
      client.from('source_health_snapshots').upsert(sourceHealth),
      client.from('cron_job_snapshots').upsert(cronJobs),
      client.from('agent_token_usage_daily').upsert(tokenUsage),
    ])

    const failed = writes.find((result) => result.error)
    if (failed?.error) throw failed.error

    await finishSyncRun(client, syncRunId, 'success', summary)
    console.log(`Sync complete: ${JSON.stringify(summary)}`)
  } catch (error) {
    await finishSyncRun(client, syncRunId, 'failed', summary, error)
    throw error
  }
}

async function processPendingRequests() {
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  const client = createClient<any>(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await client
    .from('sync_requests')
    .select('id')
    .eq('status', 'pending')
    .order('requested_at', { ascending: true })
    .limit(1)

  if (error) throw error
  const request = data?.[0]
  if (!request) return

  await client.from('sync_requests').update({ status: 'running', started_at: new Date().toISOString(), handled_by: os.hostname() }).eq('id', request.id)
  try {
    await runSync('manual')
    await client.from('sync_requests').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', request.id)
  } catch (error) {
    await client.from('sync_requests').update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    }).eq('id', request.id)
    throw error
  }
}

async function main() {
  if (once) {
    await runSync(dryRun ? 'dry_run' : 'scheduled')
    return
  }

  if (!poll) {
    await runSync('scheduled')
    return
  }

  console.log(`Mission Control Online sync bridge polling every ${pollSeconds}s and syncing every ${syncIntervalMinutes}m.`)
  let lastScheduledSync = 0
  
  process.on('SIGINT', releaseLock)
  process.on('SIGTERM', releaseLock)
  
  while (true) {
    await processPendingRequests()
    if (Date.now() - lastScheduledSync >= syncIntervalMinutes * 60_000) {
      await runSync('scheduled')
      lastScheduledSync = Date.now()
    }
    await new Promise((resolve) => setTimeout(resolve, pollSeconds * 1000))
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
}).finally(releaseLock)
