import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

function loadEnvFile(filePath: string) {
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

loadEnvFile(path.resolve(process.cwd(), '.env.local'))
loadEnvFile(path.resolve(process.cwd(), '.env.sync'))

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
  throw new Error('Missing Supabase env. Need SUPABASE_URL/VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SERVICE_ROLE_KEY.')
}

const service = createClient<any>(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const anon = createClient<any>(supabaseUrl, publishableKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function countRows(table: string) {
  const { count, error } = await service.from(table).select('*', { count: 'exact', head: true })
  if (error) throw new Error(`${table} service count failed: ${error.message}`)
  return count ?? 0
}

async function main() {
  const counts = {
    canonical_projects: await countRows('canonical_projects'),
    canonical_team_members: await countRows('canonical_team_members'),
    source_health_snapshots: await countRows('source_health_snapshots'),
    sync_runs: await countRows('sync_runs'),
  }

  const anonRead = await anon.from('canonical_projects').select('id').limit(1)
  if (anonRead.error) {
    throw new Error(`anon read check errored unexpectedly: ${anonRead.error.message}`)
  }

  const anonInsert = await anon.from('sync_requests').insert({ requested_by: '00000000-0000-0000-0000-000000000000' })
  const anonInsertBlocked = Boolean(anonInsert.error)

  console.log(JSON.stringify({
    ok: true,
    serviceRoleCounts: counts,
    rlsChecks: {
      anonProjectRowsVisible: anonRead.data?.length ?? 0,
      anonSyncRequestInsertBlocked: anonInsertBlocked,
      anonSyncRequestInsertError: anonInsert.error?.message ?? null,
    },
    expected: {
      anonProjectRowsVisible: 0,
      anonSyncRequestInsertBlocked: true,
    },
  }, null, 2))

  if ((anonRead.data?.length ?? 0) !== 0) {
    throw new Error('RLS check failed: anonymous client can read project rows.')
  }
  if (!anonInsertBlocked) {
    throw new Error('RLS check failed: anonymous client inserted a sync request.')
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
