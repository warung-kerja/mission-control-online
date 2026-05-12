export type SyncStatus = 'running' | 'success' | 'failed'
export type SyncTrigger = 'scheduled' | 'manual' | 'dry_run'
export type SyncRequestStatus = 'pending' | 'running' | 'completed' | 'failed' | 'expired'

export interface CanonicalProject {
  id: string
  name: string
  owner: string | null
  team: string[] | null
  status: string | null
  priority: string | null
  current_phase: string | null
  next_step: string | null
  source_updated_at: string | null
  synced_at: string
}

export interface CanonicalTeamMember {
  id: string
  name: string
  role: string | null
  model: string | null
  agent_group: string | null
  parent_agent: string | null
  synced_at: string
}

export interface SyncRun {
  id: string
  started_at: string
  finished_at: string | null
  status: SyncStatus
  trigger: SyncTrigger
  source_host: string | null
  summary: Record<string, unknown> | null
  error: string | null
}

export interface SyncRequest {
  id: string
  requested_by: string | null
  requested_at: string
  status: SyncRequestStatus
  started_at: string | null
  completed_at: string | null
  handled_by: string | null
  error: string | null
}
