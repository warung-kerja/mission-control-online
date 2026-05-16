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

interface CanonicalProjectSnapshot {
  id: string
  name: string
  owner: string | null
  team: string[]
  status: string | null
  priority: string | null
  current_phase: string | null
  next_step: string | null
  source_root: string | null
  folder_path: string | null
  folder_status: string | null
  registry_status: string | null
  source_updated_at: string | null
  synced_at: string
}

interface ProjectFolderInventory {
  id: string
  name: string
  source_root: string
  folder_path: string
  folder_status: 'active-folder' | 'passive-folder' | 'decommissioned-folder'
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
  agent: string | null
  name: string
  schedule: string
  status: string
  enabled: boolean
  model: string | null
  model_source: string | null
  last_run_at: string | null
  next_run_at: string | null
  duration_ms: number | null
  error: string | null
  synced_at: string
}

interface TokenUsageDailySnapshot {
  id: string
  agent: string
  parent_agent?: string | null
  date: string
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_write_tokens: number
  total_tokens: number
  turns: number
  synced_at: string
}

interface ModelUsageDailySnapshot {
  id: string
  model: string
  date: string
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_write_tokens: number
  total_tokens: number
  turns: number
  synced_at: string
}

interface WorkspaceSignalSnapshot {
  branch: string | null
  head: string | null
  working_tree: string
  commits_24h: number
  commits_7d: number
  latest_commit_at: string | null
  recent_commits: Array<{
    hash: string
    committed_at: string
    author: string
    subject: string
  }>
  file_churn: Array<{
    path: string
    touches: number
  }>
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
  payload?: { model?: unknown; kind?: unknown; message?: unknown }
}

interface RawCronStateFile {
  jobs?: Record<string, {
    state?: RawCronState
  }>
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
const tokenUsageDays = Math.min(Math.max(Number(process.env.TOKEN_USAGE_DAYS ?? 14), 1), 60)
const tokenUsageTimeZone = process.env.TOKEN_USAGE_TIMEZONE ?? 'Australia/Sydney'
const openClawAgentsDir = process.env.OPENCLAW_AGENTS_DIR ?? path.join(os.homedir(), '.openclaw', 'agents')
const openClawCronDir = process.env.OPENCLAW_CRON_DIR ?? path.join(os.homedir(), '.openclaw', 'cron')
const openClawCronTimeoutMs = Math.max(Number(process.env.OPENCLAW_CRON_TIMEOUT_MS ?? 90000), 30000)
const openClawGatewayUrl = process.env.OPENCLAW_GATEWAY_URL?.trim()
const openClawGatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN?.trim()

const projectRegistryPath = path.join(workspaceRoot, '03_Active_Projects/_registry/projects.json')
const activeProjectsRoot = path.join(workspaceRoot, '03_Active_Projects')
const passiveEngineRoot = path.join(workspaceRoot, '01_Passive_Engine')
const teamRosterPath = path.join(workspaceRoot, '06_Agents/_Shared_Memory/AGENTS_ROSTER.md')
const workspaceSignalRepo = process.env.WORKSPACE_SIGNAL_REPO
  ?? process.env.MISSION_CONTROL_LOCAL_REPO
  ?? path.join(workspaceRoot, '03_Active_Projects/Mission Control/mission-control-v2')
const OPENCLAW_BINARY_CANDIDATES = [
  '/home/baro/.npm-global/bin/openclaw',
  '/usr/local/bin/openclaw',
  '/usr/bin/openclaw',
]
const CRON_ADAPTER_STATUS_ID = 'openclaw-cron-adapter'

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function relativeWorkspacePath(filePath: string) {
  return path.relative(workspaceRoot, filePath).replace(/\\/g, '/')
}

function readChildDirectories(root: string) {
  try {
    return fs.readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({ name: entry.name, fullPath: path.join(root, entry.name) }))
      .sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    return []
  }
}

function folderInventoryEntry(name: string, fullPath: string, sourceRoot: string, folderStatus: ProjectFolderInventory['folder_status']): ProjectFolderInventory {
  return {
    id: slug(name),
    name,
    source_root: sourceRoot,
    folder_path: relativeWorkspacePath(fullPath),
    folder_status: folderStatus,
  }
}

function readProjectFolderInventory(): ProjectFolderInventory[] {
  const activeFolders = readChildDirectories(activeProjectsRoot)
    .filter((folder) => folder.name !== '_registry')
    .map((folder) => folderInventoryEntry(folder.name, folder.fullPath, '03_Active_Projects', 'active-folder'))

  const passiveFolders = readChildDirectories(passiveEngineRoot)
    .filter((folder) => !/^[_\W]*archive/i.test(folder.name))
    .map((folder) => folderInventoryEntry(folder.name, folder.fullPath, '01_Passive_Engine', 'passive-folder'))

  const passiveArchiveRoot = path.join(passiveEngineRoot, '_Archive')
  const decommissionedFolders = readChildDirectories(passiveArchiveRoot)
    .map((folder) => folderInventoryEntry(folder.name, folder.fullPath, '01_Passive_Engine/_Archive', 'decommissioned-folder'))

  return [...activeFolders, ...passiveFolders, ...decommissionedFolders]
}

function resolveProjectFolder(projectName: string, folders: ProjectFolderInventory[]) {
  const projectSlug = slug(projectName)
  return folders.find((folder) => folder.id === projectSlug)
    ?? folders.find((folder) => projectSlug.includes(folder.id) || folder.id.includes(projectSlug))
    ?? null
}

function readProjects(syncedAt: string): CanonicalProjectSnapshot[] {
  const raw = fs.readFileSync(projectRegistryPath, 'utf8')
  const registry = JSON.parse(raw) as CanonicalProjectRegistry
  const folders = readProjectFolderInventory()
  const usedFolderIds = new Set<string>()

  const registeredProjects = registry.projects.map((project) => {
    const folder = resolveProjectFolder(project.name, folders)
    if (folder) usedFolderIds.add(folder.id)

    return {
      id: project.id,
      name: project.name,
      owner: project.owner ?? null,
      team: project.team ?? [],
      status: project.status ?? null,
      priority: project.priority ?? null,
      current_phase: project.currentPhase ?? null,
      next_step: project.nextStep ?? null,
      source_root: folder?.source_root ?? null,
      folder_path: folder?.folder_path ?? null,
      folder_status: folder?.folder_status ?? null,
      registry_status: folder ? 'registered' : 'registered-missing-folder',
      source_updated_at: project.updatedAt ?? null,
      synced_at: syncedAt,
    }
  })

  const folderOnlyProjects = folders
    .filter((folder) => !usedFolderIds.has(folder.id))
    .map((folder) => ({
      id: `folder-${folder.source_root}-${folder.id}`,
      name: folder.name.replace(/[_-]+/g, ' '),
      owner: null,
      team: [],
      status: folder.folder_status === 'decommissioned-folder' ? 'decommissioned' : folder.folder_status === 'passive-folder' ? 'passive' : 'unregistered',
      priority: null,
      current_phase: folder.folder_status === 'active-folder' ? 'Found in active project folders but not registered yet.' : 'Found in passive/decommissioned workspace folders.',
      next_step: folder.folder_status === 'active-folder' ? 'Decide whether this should be promoted into the canonical registry.' : 'Review whether this is reference material, parked work, or decommissioned.',
      source_root: folder.source_root,
      folder_path: folder.folder_path,
      folder_status: folder.folder_status,
      registry_status: 'folder-only',
      source_updated_at: null,
      synced_at: syncedAt,
    }))

  return [...registeredProjects, ...folderOnlyProjects]
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
    { id: 'active-projects-root', label: 'Active Projects root', source_type: 'directory', filePath: activeProjectsRoot },
    { id: 'passive-engine-root', label: 'Passive Engine root', source_type: 'directory', filePath: passiveEngineRoot },
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

function sanitizeCronError(value: string | undefined | null) {
  if (!value) return null
  return value
    .replace(/`[^`]{80,}`/g, '[detail redacted]')
    .replace(/\s+/g, ' ')
    .slice(0, 280)
}

function readOpenClawConfig(): Record<string, unknown> | null {
  const candidates = [
    path.join(os.homedir(), '.openclaw', 'openclaw.json'),
    '/home/baro/.openclaw/openclaw.json',
  ]

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return JSON.parse(fs.readFileSync(candidate, 'utf8')) as Record<string, unknown>
    } catch { /* best-effort */ }
  }

  return null
}

function extractPrimaryModel(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') return value.trim() || null
  if (typeof value === 'object' && value !== null) {
    const primary = (value as { primary?: unknown }).primary
    if (typeof primary === 'string') return primary.trim() || null
  }
  return null
}

function buildAgentModelMap(): { agentModels: Map<string, string>; defaultModel: string | null } {
  const config = readOpenClawConfig()
  const agentModels = new Map<string, string>()
  if (!config) return { agentModels, defaultModel: null }

  const agents = config.agents as { defaults?: { model?: unknown }; list?: Array<{ id?: unknown; model?: unknown }> } | undefined
  const defaultModel = extractPrimaryModel(agents?.defaults?.model)

  for (const agent of agents?.list ?? []) {
    const id = normalizeAgentId(String(agent.id ?? ''))
    const model = extractPrimaryModel(agent.model)
    if (id && model) agentModels.set(id, model)
  }

  return { agentModels, defaultModel }
}

function resolveCronModel(raw: RawCronJob, normalizedAgent: string, agentModels: Map<string, string>, defaultModel: string | null): { model: string | null; source: string | null } {
  const explicitModel = extractPrimaryModel(raw.payload?.model)
  if (explicitModel) return { model: explicitModel, source: 'job' }

  const agentModel = agentModels.get(normalizedAgent)
  if (agentModel) return { model: agentModel, source: 'agent' }

  if (defaultModel) return { model: defaultModel, source: 'default' }
  return { model: null, source: null }
}

function normalizeCronJob(raw: RawCronJob, syncedAt: string, modelContext = buildAgentModelMap()): CronJobSnapshot {
  const state = raw.state || {}
  const enabled = raw.enabled !== false
  const agent = normalizeAgentId(String(raw.agentId ?? ''))
  const model = resolveCronModel(raw, agent, modelContext.agentModels, modelContext.defaultModel)

  return {
    id: String(raw.id || raw.name || 'unknown-cron-job'),
    agent,
    name: String(raw.name || 'Unnamed cron job'),
    schedule: formatCronSchedule(raw.schedule),
    status: normalizeCronStatus(state.lastRunStatus || state.lastStatus, enabled),
    enabled,
    model: model.model,
    model_source: model.source,
    last_run_at: state.lastRunAtMs ? new Date(state.lastRunAtMs).toISOString() : null,
    next_run_at: state.nextRunAtMs ? new Date(state.nextRunAtMs).toISOString() : null,
    duration_ms: state.lastDurationMs != null ? Number(state.lastDurationMs) : null,
    error: sanitizeCronError(state.lastError || state.error),
    synced_at: syncedAt,
  }
}

function cronAdapterStatus(status: 'success' | 'failure', syncedAt: string, error: string | null): CronJobSnapshot {
  return {
    id: CRON_ADAPTER_STATUS_ID,
    agent: null,
    name: 'OpenClaw cron adapter',
    schedule: 'bridge check',
    status,
    enabled: status === 'success',
    model: null,
    model_source: null,
    last_run_at: syncedAt,
    next_run_at: null,
    duration_ms: null,
    error,
    synced_at: syncedAt,
  }
}

function readCronJobsFromFiles(syncedAt: string): CronJobSnapshot[] {
  const jobsPath = path.join(openClawCronDir, 'jobs.json')
  const statePath = path.join(openClawCronDir, 'jobs-state.json')
  const jobsPayload = JSON.parse(fs.readFileSync(jobsPath, 'utf8')) as { jobs?: RawCronJob[] }
  const statePayload = JSON.parse(fs.readFileSync(statePath, 'utf8')) as RawCronStateFile
  const rawJobs = Array.isArray(jobsPayload.jobs) ? jobsPayload.jobs : []

  const modelContext = buildAgentModelMap()

  return rawJobs.map((job) => {
    const id = String(job.id || job.name || 'unknown-cron-job')
    const state = statePayload.jobs?.[id]?.state ?? job.state ?? {}
    return normalizeCronJob({ ...job, state }, syncedAt, modelContext)
  })
}

function errorMessage(error: unknown) {
  const failure = error as ExecFailure
  const stderr = typeof failure.stderr === 'string' ? failure.stderr.trim() : ''
  const raw = stderr || failure.message || 'unknown error'
  if (/gateway closed/i.test(raw)) {
    return 'OpenClaw gateway is reachable, but it closed the cron CLI connection before returning jobs. Check the Gateway Access token/auth settings and that cron access is enabled.'
  }
  const actionable = raw
    .split('\n')
    .map((line) => line.trim())
    .find((line) => /^(Error|Fix):/i.test(line) || /gateway.*credential|token.*missing|unauthori[sz]ed/i.test(line))

  return (actionable || raw)
    .replace(/--token\s+\S+/gi, '--token [redacted]')
    .replace(/--password\s+\S+/gi, '--password [redacted]')
    .slice(0, 280)
}

function readCronJobs(syncedAt: string): CronJobSnapshot[] {
  try {
    const fileJobs = readCronJobsFromFiles(syncedAt)
    if (fileJobs.length > 0) return fileJobs
  } catch {
    // Fall back to the CLI when local cron files are unavailable.
  }

  if (!openClawGatewayUrl) {
    return [cronAdapterStatus('failure', syncedAt, 'OPENCLAW_GATEWAY_URL is not set in .env.sync.')]
  }

  if (!openClawGatewayToken) {
    return [cronAdapterStatus('failure', syncedAt, 'OPENCLAW_GATEWAY_TOKEN is not set in local .env.sync, so live cron jobs cannot be fetched yet.')]
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
    String(openClawCronTimeoutMs),
    '--url',
    wsUrl,
    ...(openClawGatewayToken ? ['--token', openClawGatewayToken] : []),
  ]

  try {
    const stdout = execFileSync(binary, args, {
      encoding: 'utf8',
      timeout: openClawCronTimeoutMs + 15_000,
      maxBuffer: 5 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const payload = JSON.parse(stdout) as { jobs?: RawCronJob[] }
    const modelContext = buildAgentModelMap()
    const jobs = Array.isArray(payload.jobs) ? payload.jobs.map((job) => normalizeCronJob(job, syncedAt, modelContext)) : []
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

function parseAgentFromSessionKey(sessionKey: string): string | null {
  const parts = sessionKey.split(':')
  if (parts[0] === 'agent' && parts.length >= 2) return parts[1]
  return null
}

function normalizeParentAgent(agent: string, parentAgent: string) {
  return agent === parentAgent ? null : parentAgent
}

function addTokenUsageEntry(
  usage: Map<string, Map<string, TokenUsageDailySnapshot>>,
  agent: string,
  date: string,
  syncedAt: string,
  parentAgent: string | null,
) {
  const agentUsage = usage.get(agent) ?? new Map<string, TokenUsageDailySnapshot>()
  let entry = agentUsage.get(date)

  if (!entry) {
    entry = {
      id: `${agent}:${date}`,
      agent,
      parent_agent: parentAgent,
      date,
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      total_tokens: 0,
      turns: 0,
      synced_at: syncedAt,
    }
  } else if (entry.parent_agent !== parentAgent) {
    // The current table is unique by agent/date. If the same named agent appears
    // under more than one parent in a day, keep the row valid and avoid implying
    // a single parent that is no longer true.
    entry.parent_agent = null
  }

  usage.set(agent, agentUsage)
  agentUsage.set(date, entry)
  return entry
}

function applyUsageToEntry(entry: { input_tokens: number; output_tokens: number; cache_read_tokens: number; cache_write_tokens: number; total_tokens: number; turns: number }, usage: Record<string, unknown>) {
  const input = Number(usage.input ?? usage.inputTokens ?? 0)
  const output = Number(usage.output ?? usage.outputTokens ?? 0)
  const cacheRead = Number(usage.cacheRead ?? usage.cache_read ?? 0)
  const cacheWrite = Number(usage.cacheWrite ?? usage.cache_write ?? 0)
  const totalTokens = Number(usage.totalTokens ?? usage.total ?? (input + output + cacheRead + cacheWrite))

  const safeInput = Number.isFinite(input) ? input : 0
  const safeOutput = Number.isFinite(output) ? output : 0
  const safeCacheRead = Number.isFinite(cacheRead) ? cacheRead : 0
  const safeCacheWrite = Number.isFinite(cacheWrite) ? cacheWrite : 0
  const safeTotalTokens = Number.isFinite(totalTokens) ? totalTokens : 0

  if (safeInput <= 0 && safeOutput <= 0 && safeCacheRead <= 0 && safeCacheWrite <= 0 && safeTotalTokens <= 0) return

  entry.input_tokens += safeInput
  entry.output_tokens += safeOutput
  entry.cache_read_tokens += safeCacheRead
  entry.cache_write_tokens += safeCacheWrite
  entry.total_tokens += safeTotalTokens
  entry.turns += 1
}

function readFirstLines(filePath: string, maxLines: number) {
  const fd = fs.openSync(filePath, 'r')
  const buffer = Buffer.alloc(64 * 1024)
  let body = ''

  try {
    while (body.split('\n').length <= maxLines) {
      const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null)
      if (bytesRead <= 0) break
      body += buffer.toString('utf8', 0, bytesRead)
      if (body.length > 2 * 1024 * 1024) break
    }
  } finally {
    fs.closeSync(fd)
  }

  return body.split('\n').slice(0, maxLines)
}

// ---------------------------------------------------------------------------
// Token report: reads per-turn usage from flat session .jsonl files and uses
// sessions.json only as the attribution index from sessionId → sessionKey.
// ---------------------------------------------------------------------------

interface SessionsJsonSession {
  sessionId?: string
  updatedAt?: number
  totalTokens?: number
  inputTokens?: number
  outputTokens?: number
  sessionFile?: string
}

type SessionsJson = Record<string, SessionsJsonSession>

interface CronJobDef {
  id?: unknown
  agentId?: unknown
  name?: unknown
  enabled?: boolean
  payload?: { message?: unknown }
}

const AGENT_NAME_ALIASES: Record<string, string> = {
  main: 'baro',
  'soba-1': 'soba',
}

const KNOWN_AGENT_IDS = ['haji', 'soba', 'soba-1', 'lin', 'bob', 'jen', 'noona', 'obey', 'baro']

function normalizeAgentId(agent: string | null | undefined) {
  const key = String(agent ?? '').trim().toLowerCase()
  if (!key) return ''
  return AGENT_NAME_ALIASES[key] ?? key
}

function normalizeModelName(model: string) {
  // Strip provider prefix for display, keep model name
  // e.g. "openai-codex/gpt-5.5" -> "gpt-5.5"
  //      "ollama/deepseek-v4-pro:cloud" -> "deepseek-v4-pro:cloud"
  const trimmed = model.trim()
  const slashIdx = trimmed.indexOf('/')
  return slashIdx >= 0 ? trimmed.slice(slashIdx + 1) : trimmed
}

function inferCronAgent(job: CronJobDef) {
  const configuredAgent = normalizeAgentId(String(job.agentId ?? ''))
  const name = String(job.name ?? '').toLowerCase()
  const message = String(job.payload?.message ?? '').toLowerCase()
  const searchable = `${name}\n${message}`

  for (const agent of KNOWN_AGENT_IDS) {
    const normalized = normalizeAgentId(agent)
    const escaped = agent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(searchable)) return normalized
  }

  return configuredAgent
}

function buildCronAgentMap(): Map<string, string> {
  const map = new Map<string, string>()
  try {
    const raw = fs.readFileSync(path.join(openClawCronDir, 'jobs.json'), 'utf8')
    const data = JSON.parse(raw) as { jobs?: CronJobDef[] }
    for (const job of data.jobs ?? []) {
      const jid = String(job.id ?? '')
      const agentId = inferCronAgent(job)
      if (jid && agentId) map.set(jid, agentId)
    }
  } catch { /* best-effort */ }
  return map
}

function buildSubagentNameMap(): Map<string, string> {
  const map = new Map<string, string>()
  try {
    const raw = fs.readFileSync(path.join(openClawCronDir, 'subagent-names.json'), 'utf8')
    const data = JSON.parse(raw) as Record<string, string>
    for (const [uuid, name] of Object.entries(data)) {
      const normalized = normalizeAgentId(name)
      if (uuid && normalized) map.set(uuid, normalized)
    }
  } catch { /* best-effort */ }
  return map
}

function parseSessionAgent(
  sessionKey: string,
  parentAgentDir: string,
  cronAgentMap: Map<string, string>,
  subagentNameMap: Map<string, string>,
): { agent: string; parent: string | null } {
  const parts = sessionKey.split(':')
  // Format: agent:<parentDir>:<kind>[:<subId>]

  const parentAgent = normalizeAgentId(parentAgentDir)
  const kind = parts[2] ?? 'unknown'
  const subId = parts[3] ?? null

  if (kind === 'cron' && subId) {
    const cronAgent = normalizeAgentId(cronAgentMap.get(subId))
    if (cronAgent && cronAgent !== parentAgent) {
      return { agent: cronAgent, parent: parentAgent }
    }
    return { agent: parentAgent, parent: null }
  }

  if (kind === 'subagent' && subId) {
    // Look up the human-readable name from subagent-names.json. If the
    // historical sub-agent was never named, roll it into the parent agent
    // rather than exposing raw UUID fragments in the dashboard legend.
    const resolved = normalizeAgentId(subagentNameMap.get(subId))
    if (resolved) {
      return { agent: resolved, parent: resolved === parentAgent ? null : parentAgent }
    }
    return { agent: parentAgent, parent: null }
  }

  return { agent: parentAgent, parent: null }
}

function addModelUsageEntry(
  usage: Map<string, Map<string, ModelUsageDailySnapshot>>,
  model: string,
  date: string,
  syncedAt: string,
) {
  const modelUsage = usage.get(model) ?? new Map<string, ModelUsageDailySnapshot>()
  let entry = modelUsage.get(date)

  if (!entry) {
    entry = {
      id: `${model}:${date}`,
      model,
      date,
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      total_tokens: 0,
      turns: 0,
      synced_at: syncedAt,
    }
  }

  usage.set(model, modelUsage)
  modelUsage.set(date, entry)
  return entry
}

function readTokenUsage(syncedAt: string): { agentUsage: TokenUsageDailySnapshot[]; modelUsage: ModelUsageDailySnapshot[] } {
  const dates = buildDateWindow(tokenUsageDays)
  const allowedDates = new Set(dates)
  const cronAgentMap = buildCronAgentMap()
  const subagentNameMap = buildSubagentNameMap()
  const usageByAgent = new Map<string, Map<string, TokenUsageDailySnapshot>>()
  const usageByModel = new Map<string, Map<string, ModelUsageDailySnapshot>>()

  let agentDirs: string[] = []
  try {
    agentDirs = fs.readdirSync(openClawAgentsDir)
  } catch {
    return { agentUsage: [], modelUsage: [] }
  }

  for (const parentAgent of agentDirs) {
    const sessionsDir = path.join(openClawAgentsDir, parentAgent, 'sessions')
    const sessionsJsonPath = path.join(sessionsDir, 'sessions.json')
    let sessionsJson: SessionsJson = {}
    try {
      sessionsJson = JSON.parse(fs.readFileSync(sessionsJsonPath, 'utf8')) as SessionsJson
    } catch {
      continue
    }

    const sessionKeyById = new Map<string, string>()
    for (const [sessionKey, sessionInfo] of Object.entries(sessionsJson)) {
      if (sessionInfo.sessionId) sessionKeyById.set(sessionInfo.sessionId, sessionKey)
      if (sessionInfo.sessionFile) sessionKeyById.set(path.basename(sessionInfo.sessionFile, '.jsonl'), sessionKey)
    }

    let files: string[] = []
    try {
      files = fs.readdirSync(sessionsDir)
    } catch {
      continue
    }

    for (const file of files) {
      if (!file.endsWith('.jsonl') || file.endsWith('.trajectory.jsonl')) continue
      const sessionId = path.basename(file, '.jsonl')
      const sessionKey = sessionKeyById.get(sessionId) ?? `agent:${parentAgent}:main`
      const { agent, parent: parsedParent } = parseSessionAgent(sessionKey, parentAgent, cronAgentMap, subagentNameMap)
      const filePath = path.join(sessionsDir, file)

      let lines: string[] = []
      try {
        lines = fs.readFileSync(filePath, 'utf8').split('\n')
      } catch {
        continue
      }

      for (const line of lines) {
        if (!line.includes('"usage"')) continue
        try {
          const record = JSON.parse(line)
          const usage = record?.message?.usage ?? record?.usage
          if (!usage) continue

          const rawTs = record?.message?.timestamp ?? record?.timestamp ?? record?.ts
          const ts = typeof rawTs === 'number' ? new Date(rawTs) : new Date(String(rawTs))
          if (Number.isNaN(ts.getTime())) continue

          const date = formatDateInZone(ts)
          if (!allowedDates.has(date)) continue

          applyUsageToEntry(addTokenUsageEntry(usageByAgent, agent, date, syncedAt, parsedParent), usage)

          const model = String(record?.message?.model ?? record?.model ?? '').trim()
          if (model) {
            applyUsageToEntry(addModelUsageEntry(usageByModel, normalizeModelName(model), date, syncedAt), usage)
          }
        } catch {
          // skip malformed lines
        }
      }
    }
  }

  return {
    agentUsage: [...usageByAgent.values()]
      .flatMap((agentUsage) => [...agentUsage.values()])
      .filter((entry) => entry.turns > 0 || entry.total_tokens > 0),
    modelUsage: [...usageByModel.values()]
      .flatMap((modelUsage) => [...modelUsage.values()])
      .filter((entry) => entry.turns > 0 || entry.total_tokens > 0),
  }
}

function runWorkspaceGit(args: string[]) {
  return execFileSync('git', ['-C', workspaceSignalRepo, ...args], {
    encoding: 'utf8',
    timeout: 15_000,
    maxBuffer: 2 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function safeWorkspaceGit(args: string[]) {
  try {
    return runWorkspaceGit(args)
  } catch {
    return null
  }
}

function parseGitCount(value: string | null) {
  const count = Number(value ?? 0)
  return Number.isFinite(count) ? count : 0
}

function parseRecentCommits(raw: string | null): WorkspaceSignalSnapshot['recent_commits'] {
  if (!raw) return []
  return raw
    .split('\n')
    .map((line) => {
      const [hash, epoch, author, subject] = line.split('\x1f')
      const timestamp = Number(epoch) * 1000
      if (!hash || !Number.isFinite(timestamp)) return null
      return {
        hash,
        committed_at: new Date(timestamp).toISOString(),
        author: author || 'unknown',
        subject: subject || '(no subject)',
      }
    })
    .filter((commit): commit is WorkspaceSignalSnapshot['recent_commits'][number] => Boolean(commit))
}

function parseFileChurn(raw: string | null): WorkspaceSignalSnapshot['file_churn'] {
  if (!raw) return []
  const counts = new Map<string, number>()
  for (const line of raw.split('\n')) {
    const filePath = line.trim()
    if (!filePath) continue
    counts.set(filePath, (counts.get(filePath) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 12)
    .map(([filePath, touches]) => ({ path: filePath, touches }))
}

function readWorkspaceSignals(syncedAt: string): WorkspaceSignalSnapshot {
  const branch = safeWorkspaceGit(['branch', '--show-current'])
  const head = safeWorkspaceGit(['rev-parse', '--short', 'HEAD'])
  const status = safeWorkspaceGit(['status', '--porcelain'])
  const commits24h = parseGitCount(safeWorkspaceGit(['rev-list', '--count', '--since=24.hours', 'HEAD']))
  const commits7d = parseGitCount(safeWorkspaceGit(['rev-list', '--count', '--since=7.days', 'HEAD']))
  const latestCommitEpoch = safeWorkspaceGit(['log', '-1', '--pretty=format:%ct'])
  const latestCommitAt = latestCommitEpoch ? new Date(Number(latestCommitEpoch) * 1000).toISOString() : null
  const recentCommits = parseRecentCommits(safeWorkspaceGit(['log', '-8', '--pretty=format:%h%x1f%ct%x1f%an%x1f%s']))
  const fileChurn = parseFileChurn(safeWorkspaceGit(['log', '--since=7.days', '--name-only', '--pretty=format:']))

  return {
    branch,
    head,
    working_tree: status == null ? 'unknown' : status.length === 0 ? 'clean' : 'dirty',
    commits_24h: commits24h,
    commits_7d: commits7d,
    latest_commit_at: latestCommitAt,
    recent_commits: recentCommits,
    file_churn: fileChurn,
    synced_at: syncedAt,
  }
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
  const { agentUsage: tokenUsage, modelUsage } = readTokenUsage(syncedAt)
  const workspaceSignals = readWorkspaceSignals(syncedAt)
  const summary = {
    projects: projects.length,
    teamMembers: team.length,
    sourceHealth: sourceHealth.length,
    cronJobs: cronJobs.length,
    tokenUsageRows: tokenUsage.length,
    modelUsageRows: modelUsage.length,
    workspaceSignals: workspaceSignals.head ? 1 : 0,
    syncedAt,
  }

  if (dryRun || trigger === 'dry_run') {
    console.log(JSON.stringify({ dryRun: true, summary, samples: { projects: projects.slice(0, 2), team: team.slice(0, 2), sourceHealth, cronJobs: cronJobs.slice(0, 3), tokenUsage, modelUsage: modelUsage.slice(0, 5), workspaceSignals } }, null, 2))
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
    const deleteTokenUsage = await client
      .from('agent_token_usage_daily')
      .delete()
      .not('id', 'is', null)
    if (deleteTokenUsage.error) throw deleteTokenUsage.error

    const deleteModelUsage = await client
      .from('model_token_usage_daily')
      .delete()
      .not('id', 'is', null)
    if (deleteModelUsage.error) throw deleteModelUsage.error

    const writes = await Promise.all([
      client.from('canonical_projects').upsert(projects),
      client.from('canonical_team_members').upsert(team),
      client.from('source_health_snapshots').upsert(sourceHealth),
      client.from('cron_job_snapshots').upsert(cronJobs),
      tokenUsage.length > 0
        ? client.from('agent_token_usage_daily').upsert(tokenUsage)
        : Promise.resolve({ error: null }),
      modelUsage.length > 0
        ? client.from('model_token_usage_daily').upsert(modelUsage)
        : Promise.resolve({ error: null }),
      client.from('workspace_signal_snapshots').insert(workspaceSignals),
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
