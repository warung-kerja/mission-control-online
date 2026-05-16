import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

interface TokenUsageRow {
  id: string
  agent: string
  parent_agent: string | null
  date: string
  total_tokens: number
  turns: number
  synced_at?: string
}

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue
    let value = match[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    process.env[match[1]] ??= value
  }
}

function extractJson(output: string) {
  const firstBrace = output.indexOf('{')
  if (firstBrace < 0) throw new Error('sync:dry did not return JSON')
  return JSON.parse(output.slice(firstBrace))
}

function summarize(rows: TokenUsageRow[]) {
  const totals = new Map<string, { agent: string; total_tokens: number; turns: number; rows: number }>()
  for (const row of rows) {
    const current = totals.get(row.agent) ?? { agent: row.agent, total_tokens: 0, turns: 0, rows: 0 }
    current.total_tokens += row.total_tokens
    current.turns += row.turns
    current.rows += 1
    totals.set(row.agent, current)
  }
  return [...totals.values()].sort((a, b) => b.total_tokens - a.total_tokens || a.agent.localeCompare(b.agent))
}

function indexRows(rows: TokenUsageRow[]) {
  return new Map(rows.map((row) => [row.id, row]))
}

function bobDiagnostics() {
  const openClawCronDir = process.env.OPENCLAW_CRON_DIR ?? path.join(process.env.HOME ?? '', '.openclaw', 'cron')
  const openClawAgentsDir = process.env.OPENCLAW_AGENTS_DIR ?? path.join(process.env.HOME ?? '', '.openclaw', 'agents')
  const namesPath = path.join(openClawCronDir, 'subagent-names.json')
  const jobsPath = path.join(openClawCronDir, 'jobs.json')
  const names: Record<string, string> = fs.existsSync(namesPath) ? JSON.parse(fs.readFileSync(namesPath, 'utf8')) : {}
  const bobRegistry = Object.entries(names).filter(([, name]) => String(name).toLowerCase() === 'bob')

  const bobSessions: Array<{ parent: string; sessionKey: string; updatedAt: string | null; totalTokens: number }> = []
  if (fs.existsSync(openClawAgentsDir)) {
    for (const parent of fs.readdirSync(openClawAgentsDir)) {
      const sessionsPath = path.join(openClawAgentsDir, parent, 'sessions', 'sessions.json')
      if (!fs.existsSync(sessionsPath)) continue
      const sessions = JSON.parse(fs.readFileSync(sessionsPath, 'utf8')) as Record<string, { updatedAt?: number; totalTokens?: number }>
      for (const [sessionKey, info] of Object.entries(sessions)) {
        const subId = sessionKey.split(':')[3]
        if (names[subId] !== 'bob') continue
        bobSessions.push({
          parent,
          sessionKey,
          updatedAt: info.updatedAt ? new Date(info.updatedAt).toISOString() : null,
          totalTokens: info.totalTokens ?? 0,
        })
      }
    }
  }

  const jobs = fs.existsSync(jobsPath) ? (JSON.parse(fs.readFileSync(jobsPath, 'utf8')).jobs ?? []) : []
  const bobJobs = jobs
    .filter((job: any) => /bob/i.test(`${job.name ?? ''}\n${job.payload?.message ?? ''}`))
    .map((job: any) => ({ id: job.id, name: job.name, enabled: job.enabled !== false, agentId: job.agentId ?? null }))

  return {
    bobRegistryCount: bobRegistry.length,
    bobRegistryIds: bobRegistry.map(([id]) => id),
    bobSessionsCount: bobSessions.length,
    bobSessions,
    bobJobs,
  }
}

async function main() {
  loadEnvFile('.env.local')
  loadEnvFile('.env.sync')

  const dryOutput = execFileSync('npm', ['run', 'sync:dry', '--silent'], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
  const dry = extractJson(dryOutput)
  const localRows = (dry.samples?.tokenUsage ?? []) as TokenUsageRow[]

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing Supabase env. Need SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY or Vite anon key.')

  const client = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await client
    .from('agent_token_usage_daily')
    .select('id, agent, parent_agent, date, total_tokens, turns, synced_at')
    .order('date', { ascending: false })
    .order('agent', { ascending: true })
    .limit(200)
  if (error) throw error

  const supabaseRows = (data ?? []) as TokenUsageRow[]
  const localById = indexRows(localRows)
  const supabaseById = indexRows(supabaseRows)
  const mismatches = []
  for (const [id, local] of localById.entries()) {
    const remote = supabaseById.get(id)
    if (!remote) {
      mismatches.push({ id, issue: 'missing_in_supabase', local })
      continue
    }
    if (local.agent !== remote.agent || local.parent_agent !== remote.parent_agent || local.total_tokens !== remote.total_tokens || local.turns !== remote.turns) {
      mismatches.push({ id, issue: 'value_mismatch', local, remote })
    }
  }
  for (const [id, remote] of supabaseById.entries()) {
    if (!localById.has(id)) mismatches.push({ id, issue: 'extra_in_supabase', remote })
  }

  const badRows = supabaseRows.filter((row) => row.agent === 'main' || row.agent.startsWith('sub:') || String(row.parent_agent ?? '').startsWith('sub:'))

  console.log(JSON.stringify({
    tokenUsageDays: Number(process.env.TOKEN_USAGE_DAYS ?? 14),
    local: {
      rowCount: localRows.length,
      dates: [...new Set(localRows.map((row) => row.date))].sort(),
      totals: summarize(localRows),
    },
    supabase: {
      rowCount: supabaseRows.length,
      dates: [...new Set(supabaseRows.map((row) => row.date))].sort(),
      totals: summarize(supabaseRows),
      badRows,
    },
    comparison: {
      ok: mismatches.length === 0 && badRows.length === 0,
      mismatchCount: mismatches.length,
      mismatches: mismatches.slice(0, 20),
    },
    bob: bobDiagnostics(),
  }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
