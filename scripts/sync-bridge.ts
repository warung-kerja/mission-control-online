import { createClient } from '@supabase/supabase-js'
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

const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run')
const once = args.has('--once') || dryRun
const poll = args.has('--poll')

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const workspaceRoot = process.env.WARUNG_KERJA_ROOT ?? '/mnt/d/Warung Kerja 1.0'
const pollSeconds = Number(process.env.SYNC_REQUEST_POLL_SECONDS ?? 30)
const syncIntervalMinutes = Number(process.env.SYNC_INTERVAL_MINUTES ?? 10)

const projectRegistryPath = path.join(workspaceRoot, '03_Active_Projects/_registry/projects.json')
const teamRosterPath = path.join(workspaceRoot, '06_Agents/_Shared_Memory/AGENTS_ROSTER.md')

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
  const summary = { projects: projects.length, teamMembers: team.length, sourceHealth: sourceHealth.length, syncedAt }

  if (dryRun || trigger === 'dry_run') {
    console.log(JSON.stringify({ dryRun: true, summary, samples: { projects: projects.slice(0, 2), team: team.slice(0, 2), sourceHealth } }, null, 2))
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
})
