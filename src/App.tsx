import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { allowedEmail, supabase } from './lib/supabase'
import type { AgentTokenUsageDaily, CanonicalProject, CanonicalTeamMember, CronJobSnapshot, SourceHealthSnapshot, SyncRequest, SyncRun, WorkspaceSignalSnapshot } from './types/supabase'
import './styles.css'

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

interface DashboardData {
  projects: CanonicalProject[]
  teamMembers: CanonicalTeamMember[]
  syncRuns: SyncRun[]
  syncRequests: SyncRequest[]
  sourceHealth: SourceHealthSnapshot[]
  cronJobs: CronJobSnapshot[]
  tokenUsage: AgentTokenUsageDaily[]
  workspaceSignal: WorkspaceSignalSnapshot | null
}

const emptyDashboard: DashboardData = {
  projects: [],
  teamMembers: [],
  syncRuns: [],
  syncRequests: [],
  sourceHealth: [],
  cronJobs: [],
  tokenUsage: [],
  workspaceSignal: null,
}

function parseDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(value: string | null | undefined) {
  const date = parseDate(value)
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatRelative(value: string | null | undefined) {
  const date = parseDate(value)
  if (!date) return 'never'
  const diffMs = Date.now() - date.getTime()
  const minutes = Math.max(0, Math.round(diffMs / 60_000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function getLatestSuccessfulSync(syncRuns: SyncRun[]) {
  return syncRuns.find((run) => run.status === 'success') ?? null
}

function hasActiveSyncRequest(syncRequests: SyncRequest[]) {
  return syncRequests.some((request) => request.status === 'pending' || request.status === 'running')
}

function LoginScreen() {
  const [email, setEmail] = useState(allowedEmail)
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setMessage('')

    const normalizedEmail = email.trim().toLowerCase()
    if (normalizedEmail !== allowedEmail.toLowerCase()) {
      setStatus('error')
      setMessage(`Access is restricted to ${allowedEmail}.`)
      return
    }

    setStatus('sending')
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: window.location.origin,
      },
    })

    if (error) {
      setStatus('error')
      setMessage(error.message)
      return
    }

    setStatus('sent')
    setMessage('Magic link sent. Open it on this device to enter Mission Control Online.')
  }

  return (
    <main className="loginShell">
      <section className="loginCard">
        <p className="eyebrow">private mirror</p>
        <h1>Mission Control Online</h1>
        <p className="muted">Read-only cloud access for Raz's Mission Control snapshots. Local V3 stays untouched.</p>
        <form onSubmit={handleSubmit} className="loginForm">
          <label htmlFor="email">Allowed email</label>
          <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <button type="submit" disabled={status === 'sending'}>
            {status === 'sending' ? 'Sending link…' : 'Send magic link'}
          </button>
        </form>
        {message && <p className={status === 'error' ? 'errorText' : 'successText'}>{message}</p>}
      </section>
    </main>
  )
}

function SyncPanel({ data, user, onRefreshRequested, requestState }: {
  data: DashboardData
  user: User
  onRefreshRequested: () => Promise<void>
  requestState: 'idle' | 'requesting' | 'requested' | 'error'
}) {
  const latestSuccess = getLatestSuccessfulSync(data.syncRuns)
  const latestRun = data.syncRuns[0] ?? null
  const latestRequest = data.syncRequests[0] ?? null
  const latestSyncDate = parseDate(latestSuccess?.finished_at ?? latestSuccess?.started_at)
  const isStale = latestSyncDate ? Date.now() - latestSyncDate.getTime() > 15 * 60_000 : true
  const activeRequest = hasActiveSyncRequest(data.syncRequests)
  const buttonDisabled = requestState === 'requesting' || activeRequest

  return (
    <section className="heroPanel">
      <div>
        <p className="eyebrow">control room</p>
        <h1>Mission Control Online</h1>
        <p className="muted maxLine">Private read-only mirror powered by Supabase snapshots from the local OpenClaw workspace.</p>
      </div>
      <div className="syncCard">
        <div className="syncHeader">
          <span className={isStale ? 'statusDot warning' : 'statusDot ok'} />
          <div>
            <strong>{isStale ? 'Data needs refresh' : 'Snapshot fresh'}</strong>
            <p>{latestSuccess ? `Last synced ${formatRelative(latestSuccess.finished_at ?? latestSuccess.started_at)}` : 'No successful sync yet'}</p>
          </div>
        </div>
        <dl>
          <div><dt>Signed in</dt><dd>{user.email}</dd></div>
          <div><dt>Latest run</dt><dd>{latestRun ? latestRun.status : 'none'}</dd></div>
          <div><dt>Manual request</dt><dd>{latestRequest ? latestRequest.status : 'none'}</dd></div>
        </dl>
        <button className="secondaryButton" type="button" onClick={onRefreshRequested} disabled={buttonDisabled}>
          {requestState === 'requesting'
            ? 'Requesting refresh…'
            : activeRequest
              ? 'Refresh in progress…'
              : requestState === 'requested'
                ? 'Refresh queued'
                : 'Refresh now'}
        </button>
      </div>
    </section>
  )
}

function ProjectsPanel({ projects }: { projects: CanonicalProject[] }) {
  return (
    <section className="panel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">projects</p>
          <h2>Project movement board</h2>
        </div>
        <span className="countBadge">{projects.length} synced</span>
      </div>
      <div className="projectGrid">
        {projects.map((project) => (
          <article className="projectCard" key={project.id}>
            <div className="cardTopline">
              <span>{project.priority ?? 'priority unset'}</span>
              <span>{project.status ?? 'status unset'}</span>
            </div>
            <h3>{project.name}</h3>
            <p>{project.next_step || 'No next step captured yet.'}</p>
            <footer>
              <span>{project.owner || 'No owner'}</span>
              <span>{formatRelative(project.synced_at)}</span>
            </footer>
          </article>
        ))}
        {projects.length === 0 && <p className="emptyState">No projects synced yet. Run the local bridge after Supabase tables are created.</p>}
      </div>
    </section>
  )
}

function SourceHealthPanel({ sources, syncRuns }: { sources: SourceHealthSnapshot[]; syncRuns: SyncRun[] }) {
  const latestSuccess = getLatestSuccessfulSync(syncRuns)
  const latestSyncDate = latestSuccess?.finished_at ?? latestSuccess?.started_at ?? null
  const hasProblems = sources.some((source) => source.status !== 'healthy' || !source.exists || !source.readable)

  return (
    <section className="panel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">source health</p>
          <h2>Bridge truth sources</h2>
          <p className="muted smallCopy">The online dashboard is a snapshot mirror. This panel shows whether the local bridge can still read the source files it syncs from.</p>
        </div>
        <span className={hasProblems ? 'countBadge warningBadge' : 'countBadge okBadge'}>
          {hasProblems ? 'Needs attention' : 'Healthy'}
        </span>
      </div>
      <div className="sourceGrid">
        {sources.map((source) => (
          <article className="sourceCard" key={source.id}>
            <div className="sourceCardHeader">
              <span className={source.status === 'healthy' ? 'miniStatus ok' : 'miniStatus warning'} />
              <strong>{source.label}</strong>
            </div>
            <dl>
              <div><dt>Status</dt><dd>{source.status ?? 'unknown'}</dd></div>
              <div><dt>Readable</dt><dd>{source.readable ? 'yes' : 'no'}</dd></div>
              <div><dt>Modified</dt><dd>{formatRelative(source.modified_at)}</dd></div>
              <div><dt>Synced</dt><dd>{formatRelative(source.synced_at)}</dd></div>
            </dl>
            {source.error && <p className="errorText">{source.error}</p>}
          </article>
        ))}
        {sources.length === 0 && <p className="emptyState">No source health records synced yet.</p>}
      </div>
      <p className="muted smallCopy">Latest successful bridge sync: {formatDate(latestSyncDate)}.</p>
    </section>
  )
}

function TeamPanel({ teamMembers }: { teamMembers: CanonicalTeamMember[] }) {
  const grouped = useMemo(() => {
    return teamMembers.reduce<Record<string, CanonicalTeamMember[]>>((acc, member) => {
      const key = member.agent_group ?? 'unknown'
      acc[key] = [...(acc[key] ?? []), member]
      return acc
    }, {})
  }, [teamMembers])

  return (
    <section className="panel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">team</p>
          <h2>Agent roster</h2>
        </div>
        <span className="countBadge">{teamMembers.length} members</span>
      </div>
      <div className="teamColumns">
        {Object.entries(grouped).map(([group, members]) => (
          <article className="teamGroup" key={group}>
            <h3>{group}</h3>
            {members.map((member) => (
              <div className="teamRow" key={member.id}>
                <strong>{member.name}</strong>
                <span>{member.role}</span>
                <small>{member.model}</small>
              </div>
            ))}
          </article>
        ))}
        {teamMembers.length === 0 && <p className="emptyState">No team roster synced yet.</p>}
      </div>
    </section>
  )
}

function CronHealthPanel({ cronJobs, syncRuns }: { cronJobs: CronJobSnapshot[]; syncRuns: SyncRun[] }) {
  const latestSuccess = getLatestSuccessfulSync(syncRuns)
  const visibleJobs = cronJobs.filter((job) => job.id !== 'openclaw-cron-adapter')
  const adapterStatus = cronJobs.find((job) => job.id === 'openclaw-cron-adapter')
  const failedJobs = visibleJobs.filter((job) => job.status === 'failure')
  const runningJobs = visibleJobs.filter((job) => job.status === 'running')
  const disabledJobs = visibleJobs.filter((job) => job.status === 'disabled' || job.enabled === false)
  const hasProblems = Boolean(adapterStatus?.status === 'failure' || failedJobs.length > 0)

  return (
    <section className="panel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">cron health</p>
          <h2>Automation pulse</h2>
          <p className="muted smallCopy">Read-only OpenClaw cron snapshots from the local bridge. This shows what was scheduled at the last sync, not a live browser connection to the gateway.</p>
        </div>
        <span className={hasProblems ? 'countBadge warningBadge' : 'countBadge okBadge'}>
          {hasProblems ? 'Needs attention' : `${visibleJobs.length} jobs`}
        </span>
      </div>

      <div className="cronSummaryGrid">
        <div><strong>{visibleJobs.length}</strong><span>synced jobs</span></div>
        <div><strong>{runningJobs.length}</strong><span>running</span></div>
        <div><strong>{failedJobs.length}</strong><span>failed</span></div>
        <div><strong>{disabledJobs.length}</strong><span>disabled</span></div>
      </div>

      {adapterStatus?.error && <p className="errorText">{adapterStatus.error}</p>}

      <div className="cronGrid">
        {visibleJobs.slice(0, 8).map((job) => (
          <article className="cronCard" key={job.id}>
            <div className="sourceCardHeader">
              <span className={job.status === 'failure' ? 'miniStatus warning' : 'miniStatus ok'} />
              <strong>{job.name ?? 'Unnamed job'}</strong>
            </div>
            <div className="cardTopline">
              <span>{job.status ?? 'unknown'}</span>
              <span>{job.enabled === false ? 'disabled' : 'enabled'}</span>
            </div>
            <p>{job.schedule || 'No schedule captured.'}</p>
            <dl>
              <div><dt>Last</dt><dd>{formatRelative(job.last_run_at)}</dd></div>
              <div><dt>Next</dt><dd>{formatRelative(job.next_run_at)}</dd></div>
              <div><dt>Duration</dt><dd>{job.duration_ms == null ? '-' : `${job.duration_ms}ms`}</dd></div>
            </dl>
            {job.error && <p className="errorText">{job.error}</p>}
          </article>
        ))}
        {visibleJobs.length === 0 && !adapterStatus?.error && <p className="emptyState">No cron jobs synced yet.</p>}
      </div>
      <p className="muted smallCopy">Latest successful bridge sync: {formatDate(latestSuccess?.finished_at ?? latestSuccess?.started_at)}.</p>
    </section>
  )
}

function formatTokens(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`
  return value.toLocaleString()
}

function TokenUsagePanel({ tokenUsage, syncRuns }: { tokenUsage: AgentTokenUsageDaily[]; syncRuns: SyncRun[] }) {
  const latestSuccess = getLatestSuccessfulSync(syncRuns)
  const totals = useMemo(() => {
    const byAgent = tokenUsage.reduce<Record<string, { agent: string; total: number; turns: number }>>((acc, row) => {
      const current = acc[row.agent] ?? { agent: row.agent, total: 0, turns: 0 }
      current.total += row.total_tokens
      current.turns += row.turns
      acc[row.agent] = current
      return acc
    }, {})
    return Object.values(byAgent).sort((a, b) => b.total - a.total)
  }, [tokenUsage])
  const totalTokens = totals.reduce((sum, row) => sum + row.total, 0)
  const totalTurns = totals.reduce((sum, row) => sum + row.turns, 0)
  const maxTotal = Math.max(...totals.map((row) => row.total), 1)
  const latestDate = tokenUsage.map((row) => row.date).sort().at(-1)

  return (
    <section className="panel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">token usage</p>
          <h2>Agent token burn</h2>
          <p className="muted smallCopy">Daily aggregate tokens from local OpenClaw session logs. No raw transcripts or prompts are synced.</p>
        </div>
        <span className="countBadge">{formatTokens(totalTokens)} tokens</span>
      </div>

      <div className="cronSummaryGrid">
        <div><strong>{formatTokens(totalTokens)}</strong><span>tokens</span></div>
        <div><strong>{totalTurns}</strong><span>turns</span></div>
        <div><strong>{totals[0]?.agent ?? '-'}</strong><span>top agent</span></div>
        <div><strong>{latestDate ?? '-'}</strong><span>latest day</span></div>
      </div>

      <div className="usageList">
        {totals.map((agent) => {
          const width = maxTotal > 0 ? Math.max((agent.total / maxTotal) * 100, agent.total > 0 ? 3 : 0) : 0
          return (
            <div className="usageRow" key={agent.agent}>
              <div>
                <strong>{agent.agent}</strong>
                <span>{agent.turns} turns</span>
              </div>
              <div className="usageBar"><span style={{ width: `${width}%` }} /></div>
              <strong>{formatTokens(agent.total)}</strong>
            </div>
          )
        })}
        {totals.length === 0 && <p className="emptyState">No token usage rows synced yet. New OpenClaw runs will appear after session logs include usage data.</p>}
      </div>
      <p className="muted smallCopy">Latest successful bridge sync: {formatDate(latestSuccess?.finished_at ?? latestSuccess?.started_at)}.</p>
    </section>
  )
}

function WorkspaceSignalsPanel({ signal, syncRuns }: { signal: WorkspaceSignalSnapshot | null; syncRuns: SyncRun[] }) {
  const latestSuccess = getLatestSuccessfulSync(syncRuns)
  const recentCommits = signal?.recent_commits ?? []
  const fileChurn = signal?.file_churn ?? []
  const hasSignal = Boolean(signal)
  const isDirty = signal?.working_tree === 'dirty'

  return (
    <section className="panel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">workspace</p>
          <h2>Git signal</h2>
          <p className="muted smallCopy">Local V3 repository metadata from the bridge. It syncs commit and churn summaries only, not raw project files.</p>
        </div>
        <span className={isDirty ? 'countBadge warningBadge' : 'countBadge okBadge'}>
          {hasSignal ? signal?.working_tree ?? 'unknown' : 'No snapshot'}
        </span>
      </div>

      {signal ? (
        <>
          <div className="cronSummaryGrid">
            <div><strong>{signal.branch ?? '-'}</strong><span>branch</span></div>
            <div><strong>{signal.head ?? '-'}</strong><span>head</span></div>
            <div><strong>{signal.commits_24h ?? 0}</strong><span>commits 24h</span></div>
            <div><strong>{signal.commits_7d ?? 0}</strong><span>commits 7d</span></div>
          </div>

          <div className="workspaceColumns">
            <div className="workspaceList">
              <h3>Recent commits</h3>
              {recentCommits.slice(0, 5).map((commit) => (
                <div className="workspaceRow" key={`${commit.hash}-${commit.committed_at}`}>
                  <div>
                    <strong>{commit.subject}</strong>
                    <span>{commit.hash} by {commit.author}</span>
                  </div>
                  <small>{formatRelative(commit.committed_at)}</small>
                </div>
              ))}
              {recentCommits.length === 0 && <p className="emptyState">No recent commits captured yet.</p>}
            </div>

            <div className="workspaceList">
              <h3>File churn</h3>
              {fileChurn.slice(0, 6).map((file) => (
                <div className="workspaceRow" key={file.path}>
                  <div>
                    <strong>{file.path}</strong>
                    <span>{file.touches} touches</span>
                  </div>
                </div>
              ))}
              {fileChurn.length === 0 && <p className="emptyState">No churn captured for the last seven days.</p>}
            </div>
          </div>

          <p className="muted smallCopy">
            Latest commit: {formatDate(signal.latest_commit_at)}. Latest successful bridge sync: {formatDate(latestSuccess?.finished_at ?? latestSuccess?.started_at)}.
          </p>
        </>
      ) : (
        <p className="emptyState">No workspace signal snapshot synced yet.</p>
      )}
    </section>
  )
}

function Dashboard({ user }: { user: User }) {
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [data, setData] = useState<DashboardData>(emptyDashboard)
  const [requestState, setRequestState] = useState<'idle' | 'requesting' | 'requested' | 'error'>('idle')
  const [error, setError] = useState('')

  async function loadDashboard(options: { silent?: boolean } = {}) {
    if (!options.silent) setLoadState('loading')
    setError('')

    const [projects, teamMembers, syncRuns, syncRequests, sourceHealth, cronJobs, tokenUsage, workspaceSignals] = await Promise.all([
      supabase.from('canonical_projects').select('*').order('priority', { ascending: true }),
      supabase.from('canonical_team_members').select('*').order('name', { ascending: true }),
      supabase.from('sync_runs').select('*').order('started_at', { ascending: false }).limit(8),
      supabase.from('sync_requests').select('*').order('requested_at', { ascending: false }).limit(5),
      supabase.from('source_health_snapshots').select('*').order('label', { ascending: true }),
      supabase.from('cron_job_snapshots').select('*').order('name', { ascending: true }),
      supabase.from('agent_token_usage_daily').select('*').order('date', { ascending: false }).limit(120),
      supabase.from('workspace_signal_snapshots').select('*').order('synced_at', { ascending: false }).limit(1),
    ])

    const failed = [projects, teamMembers, syncRuns, syncRequests, sourceHealth, cronJobs, tokenUsage, workspaceSignals].find((result) => result.error)
    if (failed?.error) {
      setLoadState('error')
      setError(failed.error.message)
      return
    }

    const nextData = {
      projects: (projects.data ?? []) as CanonicalProject[],
      teamMembers: (teamMembers.data ?? []) as CanonicalTeamMember[],
      syncRuns: (syncRuns.data ?? []) as SyncRun[],
      syncRequests: (syncRequests.data ?? []) as SyncRequest[],
      sourceHealth: (sourceHealth.data ?? []) as SourceHealthSnapshot[],
      cronJobs: (cronJobs.data ?? []) as CronJobSnapshot[],
      tokenUsage: (tokenUsage.data ?? []) as AgentTokenUsageDaily[],
      workspaceSignal: ((workspaceSignals.data ?? [])[0] ?? null) as WorkspaceSignalSnapshot | null,
    }

    setData(nextData)
    if (!hasActiveSyncRequest(nextData.syncRequests) && requestState === 'requested') {
      setRequestState('idle')
    }
    setLoadState('ready')
  }

  async function requestRefresh() {
    setRequestState('requesting')
    const { error: requestError } = await supabase.from('sync_requests').insert({
      requested_by: user.id,
      status: 'pending',
    })

    if (requestError) {
      setRequestState('error')
      setError(requestError.message)
      return
    }

    setRequestState('requested')
    await loadDashboard()
  }

  useEffect(() => {
    void loadDashboard()
  }, [])

  useEffect(() => {
    if (!hasActiveSyncRequest(data.syncRequests) && requestState !== 'requested') return

    const interval = window.setInterval(() => {
      void loadDashboard({ silent: true })
    }, 5_000)

    return () => window.clearInterval(interval)
  }, [data.syncRequests, requestState])

  return (
    <main className="dashboardShell">
      <SyncPanel data={data} user={user} onRefreshRequested={requestRefresh} requestState={requestState} />
      {loadState === 'loading' && <p className="muted">Loading private dashboard snapshot…</p>}
      {loadState === 'error' && <p className="errorText">{error}</p>}
      <ProjectsPanel projects={data.projects} />
      <SourceHealthPanel sources={data.sourceHealth} syncRuns={data.syncRuns} />
      <CronHealthPanel cronJobs={data.cronJobs} syncRuns={data.syncRuns} />
      <TokenUsagePanel tokenUsage={data.tokenUsage} syncRuns={data.syncRuns} />
      <WorkspaceSignalsPanel signal={data.workspaceSignal} syncRuns={data.syncRuns} />
      <TeamPanel teamMembers={data.teamMembers} />
      <section className="panel compactPanel">
        <div>
          <p className="eyebrow">latest sync runs</p>
          <h2>Bridge history</h2>
        </div>
        <div className="runList">
          {data.syncRuns.map((run) => (
            <div className="runRow" key={run.id}>
              <span>{run.status}</span>
              <strong>{run.trigger}</strong>
              <small>{formatDate(run.finished_at ?? run.started_at)}</small>
            </div>
          ))}
          {data.syncRuns.length === 0 && <p className="emptyState">No sync runs recorded yet.</p>}
        </div>
      </section>
      <button className="logoutButton" type="button" onClick={() => supabase.auth.signOut()}>Sign out</button>
    </main>
  )
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setChecking(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  if (checking) return <main className="loginShell"><p className="muted">Checking session…</p></main>
  if (!user) return <LoginScreen />
  if (user.email?.toLowerCase() !== allowedEmail.toLowerCase()) {
    return (
      <main className="loginShell">
        <section className="loginCard">
          <h1>Access restricted</h1>
          <p className="errorText">This dashboard is only available to {allowedEmail}.</p>
          <button type="button" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </section>
      </main>
    )
  }
  return <Dashboard user={user} />
}
