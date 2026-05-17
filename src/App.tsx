import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { allowedEmail, supabase } from './lib/supabase'
import type { AgentTokenUsageDaily, CanonicalProject, CanonicalTeamMember, CronJobSnapshot, ModelTokenUsageDaily, SourceHealthSnapshot, SyncRequest, SyncRun, WorkspaceSignalSnapshot } from './types/supabase'
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
  modelUsage: ModelTokenUsageDaily[]
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
  modelUsage: [],
  workspaceSignal: null,
}

interface NavItem {
  href: string
  label: string
  tone: 'canonical' | 'runtime' | 'fallback'
  icon: string
}

interface NavSection {
  title: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    title: 'Primary Surfaces',
    items: [
      { href: '#tokens', label: 'Token Usage', tone: 'runtime', icon: 'TKN' },
      { href: '#models', label: 'Model Usage', tone: 'runtime', icon: 'MOD' },
      { href: '#automation', label: 'Automation Pulse', tone: 'runtime', icon: 'AUT' },
      { href: '#projects', label: 'Projects', tone: 'canonical', icon: 'PRJ' },
      { href: '#team', label: 'Team', tone: 'canonical', icon: 'AGT' },
    ],
  },
  {
    title: 'System View',
    items: [
      { href: '#workspace', label: 'Workspace/Git', tone: 'runtime', icon: 'GIT' },
      { href: '#source-health', label: 'Source Health', tone: 'canonical', icon: 'SRC' },
      { href: '#history', label: 'Last Sync Run', tone: 'fallback', icon: 'SYN' },
    ],
  },
]

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

function formatModelName(value: string | null | undefined) {
  if (!value) return 'model unknown'
  const slashIndex = value.indexOf('/')
  return slashIndex >= 0 ? value.slice(slashIndex + 1) : value
}

function getModelSourceLabel(value: string | null | undefined) {
  if (value === 'job') return 'job assigned'
  if (value === 'agent') return 'agent inherited'
  if (value === 'default') return 'default inherited'
  return 'not captured'
}

function getLatestSuccessfulSync(syncRuns: SyncRun[]) {
  return syncRuns.find((run) => run.status === 'success') ?? null
}

function formatClockTime(value: Date) {
  return new Intl.DateTimeFormat('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(value)
}

function formatTimelineDate(value: Date) {
  return new Intl.DateTimeFormat('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(value)
}

const sectionMetaByAnchor: Record<string, { eyebrow: string; question: string }> = {
  '#projects': { eyebrow: 'Movement Board', question: 'Which project should move next?' },
  '#source-health': { eyebrow: 'Source Audit', question: 'Are all truth sources readable and healthy?' },
  '#automation': { eyebrow: 'Automation Audit', question: 'What is scheduled and is it healthy?' },
  '#tokens': { eyebrow: 'Cost Surface', question: 'Where are the tokens going?' },
  '#models': { eyebrow: 'Model Spend', question: 'Which models are eating the most tokens?' },
  '#workspace': { eyebrow: 'Repository Watch', question: 'What moved in the local repo recently?' },
  '#team': { eyebrow: 'Crew Structure', question: 'Who exists in the system and how are they organised?' },
  '#history': { eyebrow: 'Sync History', question: 'How fresh is the bridge and when did it last run?' },
}

const defaultHeaderMeta = { eyebrow: 'online control room', question: 'Read-only operating picture' }

function ShellSidebar({ data, activeAnchor }: { data: DashboardData; activeAnchor: string }) {
  const latestSuccess = getLatestSuccessfulSync(data.syncRuns)
  const latestSync = latestSuccess?.finished_at ?? latestSuccess?.started_at

  return (
    <aside className="shellSidebar" aria-label="Mission Control Online navigation">
      <div className="brandBlock">
        <span className="brandPill">V1.1 mirror</span>
        <h1>Mission Control</h1>
        <p>Private snapshot surface for projects, agents, automation truth, and workspace movement.</p>
      </div>

      <nav className="shellNav">
        {navSections.map((section) => (
          <div className="navSection" key={section.title}>
            <p className="navLabel">{section.title}</p>
            {section.items.map((item) => {
              const isActive = activeAnchor === item.href
              return (
                <a
                  href={item.href}
                  key={item.href}
                  className={isActive ? 'navLink active' : 'navLink'}
                >
                  <span className={`navIcon ${item.tone}${isActive ? ' active' : ''}`}>{item.icon}</span>
                  <span className="navLinkLabel">{item.label}</span>
                  <span className={`navDot ${item.tone}${isActive ? ' active' : ''}`} />
                </a>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="truthLegend">
        <p className="navLabel">Truth legend</p>
        <div className="truthPills">
          <span className="truthPill canonical">canonical</span>
          <span className="truthPill runtime">runtime</span>
          <span className="truthPill fallback">fallback</span>
        </div>
        <p>Every online panel is snapshot-based. No browser-triggered local actions are enabled.</p>
      </div>

      <div className="operatorCard">
        <div className="operatorAvatar">N</div>
        <div>
          <strong>Noona</strong>
          <span>Tech lead session</span>
        </div>
        <span className="statusDot ok" />
      </div>

      <p className="sidebarSync">Latest successful sync: {formatRelative(latestSync)}</p>
    </aside>
  )
}

function ShellHeader({ data, user, activeAnchor }: { data: DashboardData; user: User; activeAnchor: string }) {
  const latestSuccess = getLatestSuccessfulSync(data.syncRuns)
  const latestRun = data.syncRuns[0]
  const latestSync = latestSuccess?.finished_at ?? latestSuccess?.started_at
  const latestSyncDate = parseDate(latestSync)
  const isStale = latestSyncDate ? Date.now() - latestSyncDate.getTime() > 15 * 60_000 : true
  const headerMeta = sectionMetaByAnchor[activeAnchor] ?? defaultHeaderMeta

  return (
    <header className="shellHeader">
      <div>
        <p className="eyebrow">{headerMeta.eyebrow}</p>
        <h2>{headerMeta.question}</h2>
        <p className="muted">Vercel + Supabase mirror for Raz. Local Mission Control V3 remains the source system.</p>
      </div>
      <div className="headerStatusRail" aria-label="Snapshot status">
        <span className={isStale ? 'truthPill fallback' : 'truthPill canonical'}>{isStale ? 'stale snapshot' : 'fresh snapshot'}</span>
        <span>{latestRun ? `latest run: ${latestRun.status}` : 'latest run: none'}</span>
        <span>{latestSync ? `synced ${formatRelative(latestSync)}` : 'never synced'}</span>
        <span>{user.email}</span>
      </div>
    </header>
  )
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
    <section className="panel" id="projects">
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
    <section className="panel" id="source-health">
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
    <section className="panel" id="team">
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

function CronHealthPanel({ cronJobs, syncRuns, teamMembers }: { cronJobs: CronJobSnapshot[]; syncRuns: SyncRun[]; teamMembers: CanonicalTeamMember[] }) {
  const latestSuccess = getLatestSuccessfulSync(syncRuns)
  const visibleJobs = cronJobs.filter((job) => job.id !== 'openclaw-cron-adapter')
  const adapterStatus = cronJobs.find((job) => job.id === 'openclaw-cron-adapter')
  const modelByAgent = useMemo(() => {
    const map = new Map<string, string>()
    for (const member of teamMembers) {
      if (member.name && member.model) map.set(member.name.trim().toLowerCase(), member.model)
      if (member.id && member.model) map.set(member.id.trim().toLowerCase(), member.model)
    }
    return map
  }, [teamMembers])

  // Filters
  const [agentFilter, setAgentFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showAll, setShowAll] = useState(false)

  // Derive unique agents from the data
  const agents = useMemo(() => {
    const set = new Set<string>()
    for (const job of visibleJobs) {
      if (job.agent) set.add(job.agent)
    }
    return [...set].sort()
  }, [visibleJobs])

  // Apply filters
  const filteredJobs = useMemo(() => {
    let jobs = visibleJobs
    if (agentFilter !== 'all') {
      jobs = jobs.filter((job) => job.agent === agentFilter)
    }
    if (statusFilter === 'enabled') {
      jobs = jobs.filter((job) => job.enabled !== false)
    } else if (statusFilter === 'disabled') {
      jobs = jobs.filter((job) => job.enabled === false)
    }
    return jobs
  }, [visibleJobs, agentFilter, statusFilter])

  const displayedJobs = showAll ? filteredJobs : filteredJobs.slice(0, 8)
  const hasMore = filteredJobs.length > 8

  const failedJobs = visibleJobs.filter((job) => job.status === 'failure')
  const runningJobs = visibleJobs.filter((job) => job.status === 'running')
  const disabledJobs = visibleJobs.filter((job) => job.status === 'disabled' || job.enabled === false)
  // Only flag system-level problems: adapter failure, or a high ratio of failing vs total.
  const adapterDown = adapterStatus?.status === 'failure'
  const failureRatio = visibleJobs.length > 0 ? failedJobs.length / visibleJobs.length : 0
  const hasProblems = adapterDown || failureRatio > 0.25

  return (
    <section className="panel" id="automation">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">cron health</p>
          <h2>Automation pulse</h2>
          <p className="muted smallCopy">Read-only OpenClaw cron snapshots from the local bridge. This shows what was scheduled at the last sync, not a live browser connection to the gateway.</p>
        </div>
        <span className={hasProblems ? 'countBadge warningBadge' : 'countBadge okBadge'}>
          {hasProblems ? 'Needs attention' : `${filteredJobs.length} jobs`}
        </span>
      </div>

      <div className="cronSummaryGrid">
        <div><strong>{visibleJobs.length}</strong><span>synced jobs</span></div>
        <div><strong>{runningJobs.length}</strong><span>running</span></div>
        <div><strong>{failedJobs.length}</strong><span>failed</span></div>
        <div><strong>{disabledJobs.length}</strong><span>disabled</span></div>
      </div>

      {adapterStatus?.error && <p className="errorText">{adapterStatus.error}</p>}

      <div className="cronFilters">
        <select className="cronFilterSelect" value={agentFilter} onChange={(e) => { setAgentFilter(e.target.value); setShowAll(false) }}>
          <option value="all">All agents</option>
          {agents.map((agent) => <option key={agent} value={agent}>{agent}</option>)}
        </select>
        <select className="cronFilterSelect" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setShowAll(false) }}>
          <option value="all">All statuses</option>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      <div className="cronGrid">
        {displayedJobs.map((job) => {
          const rosterModel = job.agent ? modelByAgent.get(job.agent.trim().toLowerCase()) : null
          const displayModel = job.model ?? rosterModel
          const displayModelSource = job.model_source ?? (rosterModel ? 'agent' : null)

          return (
            <article className="cronCard" key={job.id}>
              <div className="sourceCardHeader">
                <span className={job.status === 'failure' ? 'miniStatus warning' : 'miniStatus ok'} />
                <strong>{job.name ?? 'Unnamed job'}</strong>
              </div>
              <div className="cardTopline">
                <span>{job.status ?? 'unknown'}</span>
                <span>{job.enabled === false ? 'disabled' : 'enabled'}</span>
                {job.agent && <span className="cronAgentLabel">{job.agent}</span>}
              </div>
              <div className="cronModelLine" title={displayModel ?? undefined}>
                <span className="cronModelLabel">model</span>
                <strong>{formatModelName(displayModel)}</strong>
                <span>{getModelSourceLabel(displayModelSource)}</span>
              </div>
              <p>{job.schedule || 'No schedule captured.'}</p>
              <dl>
                <div><dt>Last</dt><dd>{formatRelative(job.last_run_at)}</dd></div>
                <div><dt>Next</dt><dd>{formatRelative(job.next_run_at)}</dd></div>
                <div><dt>Duration</dt><dd>{job.duration_ms == null ? '-' : `${job.duration_ms}ms`}</dd></div>
              </dl>
              {job.error && <p className="errorText">{job.error}</p>}
            </article>
          )
        })}
        {filteredJobs.length === 0 && !adapterStatus?.error && <p className="emptyState">No cron jobs match the current filters.</p>}
      </div>

      {hasMore && !showAll && (
        <button className="showMoreButton" type="button" onClick={() => setShowAll(true)}>
          Show all {filteredJobs.length} jobs
        </button>
      )}
      {showAll && hasMore && (
        <button className="showMoreButton" type="button" onClick={() => setShowAll(false)}>
          Show fewer
        </button>
      )}

      <p className="muted smallCopy">Latest successful bridge sync: {formatDate(latestSuccess?.finished_at ?? latestSuccess?.started_at)}.</p>
    </section>
  )
}

interface CronTimelineEvent {
  id: string
  job: CronJobSnapshot
  date: Date
  kind: 'last' | 'next'
  position: number
}

function CronTimelinePanel({ cronJobs, syncRuns }: { cronJobs: CronJobSnapshot[]; syncRuns: SyncRun[] }) {
  const latestSuccess = getLatestSuccessfulSync(syncRuns)
  const now = useMemo(() => new Date(), [cronJobs, syncRuns])
  const start = useMemo(() => new Date(now.getTime() - 12 * 60 * 60 * 1000), [now])
  const end = useMemo(() => new Date(now.getTime() + 12 * 60 * 60 * 1000), [now])
  const activeJobs = useMemo(
    () => cronJobs.filter((job) => job.id !== 'openclaw-cron-adapter' && job.enabled !== false),
    [cronJobs],
  )
  const events = useMemo<CronTimelineEvent[]>(() => {
    const windowMs = end.getTime() - start.getTime()

    return activeJobs
      .flatMap((job) => {
        const candidates: Array<{ kind: 'last' | 'next'; date: Date | null }> = [
          { kind: 'last', date: parseDate(job.last_run_at) },
          { kind: 'next', date: parseDate(job.next_run_at) },
        ]

        return candidates.flatMap(({ kind, date }) => {
          if (!date) return []
          if (date < start || date > end) return []

          return [{
            id: `${job.id}-${kind}`,
            job,
            date,
            kind,
            position: ((date.getTime() - start.getTime()) / windowMs) * 100,
          }]
        })
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [activeJobs, end, start])
  const upcomingEvents = events.filter((event) => event.kind === 'next')
  const completedEvents = events.filter((event) => event.kind === 'last')
  const tickMarks = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const position = (index / 6) * 100
      const date = new Date(start.getTime() + ((end.getTime() - start.getTime()) * index) / 6)
      return { date, position }
    })
  }, [end, start])

  return (
    <section className="panel cronTimelinePanel" id="automation-timeline">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">automation timeline</p>
          <h2>24-hour activity window</h2>
          <p className="muted smallCopy">Active cron jobs mapped from their captured last and next run times. Repeating future slots will come in a later schedule-expansion pass.</p>
        </div>
        <span className="countBadge">{events.length} markers</span>
      </div>

      <div className="cronTimelineSummary">
        <div><strong>{activeJobs.length}</strong><span>active jobs</span></div>
        <div><strong>{completedEvents.length}</strong><span>just ran</span></div>
        <div><strong>{upcomingEvents.length}</strong><span>up next</span></div>
        <div><strong>{formatClockTime(now)}</strong><span>current time</span></div>
      </div>

      <div className="cronTimelineFrame">
        <div className="cronTimelineRange">
          <span>{formatTimelineDate(start)} · {formatClockTime(start)}</span>
          <span>{formatTimelineDate(end)} · {formatClockTime(end)}</span>
        </div>

        <div className="cronTimelineTrack" aria-label="24 hour cron timeline">
          {tickMarks.map((tick) => (
            <div className="cronTimelineTick" key={tick.position} style={{ left: `${tick.position}%` }}>
              <span>{formatClockTime(tick.date)}</span>
            </div>
          ))}
          <div className="cronTimelineNow" style={{ left: '50%' }}>
            <span>now</span>
          </div>
          {events.map((event) => {
            const isFailure = event.job.status === 'failure'
            const tone = isFailure ? 'failure' : event.kind

            return (
              <div
                className={`cronTimelineMarker ${tone}`}
                key={event.id}
                style={{ left: `${event.position}%` }}
                title={`${event.job.name ?? 'Unnamed job'} · ${event.kind === 'last' ? 'last ran' : 'next run'} · ${formatDate(event.date.toISOString())}`}
              >
                <span />
              </div>
            )
          })}
        </div>
      </div>

      <div className="cronTimelineList">
        {events.map((event) => (
          <article className="cronTimelineRow" key={`${event.id}-row`}>
            <span className={`cronTimelineKind ${event.job.status === 'failure' ? 'failure' : event.kind}`}>
              {event.kind === 'last' ? 'last' : 'next'}
            </span>
            <div>
              <strong>{event.job.name ?? 'Unnamed job'}</strong>
              <span>{event.job.agent ?? 'agent unknown'} · {event.job.schedule || 'No schedule captured'}</span>
            </div>
            <time>{formatClockTime(event.date)}</time>
          </article>
        ))}
        {events.length === 0 && <p className="emptyState">No active cron jobs have last or next run markers inside this 24-hour window.</p>}
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

const tokenPalette = [
  'var(--mc-chart-dominant)',
  'var(--mc-chart-blue)',
  'var(--mc-chart-teal)',
  'var(--mc-chart-green)',
  'var(--mc-chart-violet)',
  'var(--mc-chart-rose)',
  'var(--mc-chart-amber)',
  'var(--mc-chart-indigo)',
  'var(--mc-chart-cyan)',
  'var(--mc-chart-slate)',
]

function getTokenColor(name: string) {
  let hash = 0
  for (const char of name) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0
  return tokenPalette[Math.abs(hash) % tokenPalette.length]
}

function formatChartDate(value: string) {
  const date = parseDate(value)
  if (!date) return value.slice(5)
  return new Intl.DateTimeFormat('en-AU', { day: '2-digit', month: 'short' }).format(date)
}

function ModelUsagePanel({ modelUsage, syncRuns }: { modelUsage: ModelTokenUsageDaily[]; syncRuns: SyncRun[] }) {
  const latestSuccess = getLatestSuccessfulSync(syncRuns)

  const chart = useMemo(() => {
    const dates = [...new Set(modelUsage.map((row) => row.date))].sort()
    const keyTotals = new Map<string, { key: string; total: number; turns: number }>()
    const days = dates.map((date) => {
      const rows = modelUsage.filter((row) => row.date === date)
      const segmentTotals = new Map<string, { key: string; total: number; turns: number }>()

      for (const row of rows) {
        const key = row.model
        const current = segmentTotals.get(key) ?? { key, total: 0, turns: 0 }
        current.total += row.total_tokens
        current.turns += row.turns
        segmentTotals.set(key, current)

        const running = keyTotals.get(key) ?? { key, total: 0, turns: 0 }
        running.total += row.total_tokens
        running.turns += row.turns
        keyTotals.set(key, running)
      }

      const segments = [...segmentTotals.values()].sort((a, b) => b.total - a.total)
      return {
        date,
        total: segments.reduce((sum, segment) => sum + segment.total, 0),
        turns: segments.reduce((sum, segment) => sum + segment.turns, 0),
        segments,
      }
    })

    return {
      days,
      totals: [...keyTotals.values()].sort((a, b) => b.total - a.total),
    }
  }, [modelUsage])

  const totalTokens = chart.totals.reduce((sum, row) => sum + row.total, 0)
  const totalTurns = chart.totals.reduce((sum, row) => sum + row.turns, 0)
  const maxDailyTotal = Math.max(...chart.days.map((day) => day.total), 1)
  const latestDate = chart.days.at(-1)?.date
  const yTicks = [maxDailyTotal, Math.round(maxDailyTotal * 0.66), Math.round(maxDailyTotal * 0.33), 0]

  return (
    <section className="panel" id="models">
      <div className="panelHeader tokenPanelHeader">
        <div>
          <p className="eyebrow">model usage</p>
          <h2>Model token burn</h2>
          <p className="muted smallCopy">Which models are consuming tokens? Daily aggregate from local OpenClaw session logs.</p>
        </div>
        <span className="countBadge">{formatTokens(totalTokens)} tokens</span>
      </div>

      <div className="cronSummaryGrid">
        <div><strong>{formatTokens(totalTokens)}</strong><span>tokens</span></div>
        <div><strong>{totalTurns}</strong><span>turns</span></div>
        <div><strong>{chart.totals[0]?.key ?? '-'}</strong><span>top model</span></div>
        <div><strong>{latestDate ?? '-'}</strong><span>latest day</span></div>
      </div>

      {chart.days.length > 0 ? (
        <>
          <div className="tokenChartShell">
            <div className="tokenYAxis" aria-hidden="true">
              {yTicks.map((tick, index) => <span key={`${tick}-${index}`}>{formatTokens(tick)}</span>)}
            </div>
            <div className="tokenPlot" role="img" aria-label="Stacked daily token usage by model">
              <div className="tokenBars">
                {chart.days.map((day, dayIndex) => (
                  <div className="tokenDay" key={day.date}>
                    <span className="tokenDailyTotal">{formatTokens(day.total)}</span>
                    <div className="tokenStack" style={{ height: `${Math.max((day.total / maxDailyTotal) * 100, day.total > 0 ? 2 : 0)}%` }}>
                      {day.segments.map((segment) => {
                        const height = day.total > 0 ? Math.max((segment.total / day.total) * 100, 2) : 0
                        return (
                          <div
                            className="tokenSegment"
                            key={`${day.date}-${segment.key}`}
                            style={{ backgroundColor: getTokenColor(segment.key), height: `${height}%` }}
                            aria-label={`${segment.key}, ${formatTokens(segment.total)} tokens on ${day.date}`}
                          >
                            <span className="tokenTooltip">{segment.key}: {formatTokens(segment.total)} tokens</span>
                          </div>
                        )
                      })}
                    </div>
                    <span className="tokenXAxisLabel">{dayIndex % 3 === 0 || dayIndex === chart.days.length - 1 ? formatChartDate(day.date) : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="tokenLegend" aria-label="Model chart legend">
            {chart.totals.map((row) => (
              <span className="tokenLegendItem" key={row.key}>
                <i style={{ backgroundColor: getTokenColor(row.key) }} />
                {row.key}
                <strong>{formatTokens(row.total)}</strong>
              </span>
            ))}
          </div>
        </>
      ) : (
        <p className="emptyState">No model usage rows synced yet. New OpenClaw runs will appear after session logs include usage data.</p>
      )}

      <p className="muted smallCopy">Latest successful bridge sync: {formatDate(latestSuccess?.finished_at ?? latestSuccess?.started_at)}.</p>
    </section>
  )
}

function TokenUsagePanel({ tokenUsage, syncRuns }: { tokenUsage: AgentTokenUsageDaily[]; syncRuns: SyncRun[] }) {
  const latestSuccess = getLatestSuccessfulSync(syncRuns)
  const [groupedByParent, setGroupedByParent] = useState(false)
  const [drilldown, setDrilldown] = useState<{ date: string; parent: string } | null>(null)

  const chart = useMemo(() => {
    const dates = [...new Set(tokenUsage.map((row) => row.date))].sort()
    const keyTotals = new Map<string, { key: string; total: number; turns: number }>()
    const days = dates.map((date) => {
      const rows = tokenUsage.filter((row) => row.date === date)
      const segmentTotals = new Map<string, { key: string; total: number; turns: number }>()

      for (const row of rows) {
        const key = groupedByParent ? (row.parent_agent ?? row.agent) : row.agent
        const current = segmentTotals.get(key) ?? { key, total: 0, turns: 0 }
        current.total += row.total_tokens
        current.turns += row.turns
        segmentTotals.set(key, current)

        const running = keyTotals.get(key) ?? { key, total: 0, turns: 0 }
        running.total += row.total_tokens
        running.turns += row.turns
        keyTotals.set(key, running)
      }

      const segments = [...segmentTotals.values()].sort((a, b) => b.total - a.total)
      return {
        date,
        total: segments.reduce((sum, segment) => sum + segment.total, 0),
        turns: segments.reduce((sum, segment) => sum + segment.turns, 0),
        segments,
      }
    })

    // Stable parent order: baro → noona → obey → others
    const parentOrder = new Map([
      ['baro', 0],
      ['noona', 1],
      ['obey', 2],
    ])
    const sortedTotals = [...keyTotals.values()].sort((a, b) => {
      const ao = parentOrder.get(a.key) ?? 99
      const bo = parentOrder.get(b.key) ?? 99
      if (ao !== bo) return ao - bo
      return b.total - a.total
    })

    return {
      days,
      totals: sortedTotals,
    }
  }, [groupedByParent, tokenUsage])

  const totalTokens = chart.totals.reduce((sum, row) => sum + row.total, 0)
  const totalTurns = chart.totals.reduce((sum, row) => sum + row.turns, 0)
  const maxDailyTotal = Math.max(...chart.days.map((day) => day.total), 1)
  const latestDate = chart.days.at(-1)?.date
  const firstDate = chart.days[0]?.date
  const yTicks = [maxDailyTotal, Math.round(maxDailyTotal * 0.66), Math.round(maxDailyTotal * 0.33), 0]
  const selectedParent = drilldown?.parent ?? null
  const selectedDate = drilldown?.date ?? null
  const topAgent = chart.totals[0] ?? null
  const drilldownRows = useMemo(() => {
    if (!selectedDate || !selectedParent || !groupedByParent) return []
    return tokenUsage
      .filter((row) => row.date === selectedDate && (row.parent_agent ?? row.agent) === selectedParent)
      .sort((a, b) => b.total_tokens - a.total_tokens)
  }, [groupedByParent, selectedDate, selectedParent, tokenUsage])

  return (
    <section className="panel mcTokenModule" id="tokens">
      <div className="mcTokenMain">
          <div className="panelHeader mcTokenHeader">
            <div>
              <p className="eyebrow">Agent token usage</p>
              <h2>Token burn by operating surface</h2>
              <p className="muted smallCopy">
                Daily aggregate from local OpenClaw sessions. No raw transcripts or prompts are synced.
              </p>
            </div>
            <div className="mcTokenHeaderMeta">
              <button
                type="button"
                onClick={() => {
                  setGroupedByParent((value) => !value)
                  setDrilldown(null)
                }}
              >
                {groupedByParent ? 'Grouping / parent' : 'Grouping / agent'}
              </button>
              <strong>{formatTokens(totalTokens)} total</strong>
            </div>
          </div>

          <div className="mcTokenIntro">
            <p>
              The orange register marks the dominant agent path; the remaining surfaces stay structural so graph color remains useful instead of decorative.
            </p>
            <div>
              <span>Window</span>
              <strong>{firstDate && latestDate ? `${formatChartDate(firstDate)} - ${formatChartDate(latestDate)}` : '-'}</strong>
            </div>
          </div>

          <div className="mcTokenMetricStrip" aria-label="Token usage summary">
            <div><span>Tokens</span><strong>{formatTokens(totalTokens)}</strong><small>{topAgent ? `${formatTokens(topAgent.total)} top surface` : 'no surface'}</small></div>
            <div><span>Turns</span><strong>{totalTurns.toLocaleString()}</strong><small>captured turns</small></div>
            <div><span>Top agent</span><strong>{topAgent?.key ?? '-'}</strong><small>{topAgent ? `${Math.round((topAgent.total / Math.max(totalTokens, 1)) * 100)}% share` : 'waiting for data'}</small></div>
            <div><span>Latest day</span><strong>{latestDate ?? '-'}</strong><small>{latestDate ? 'latest capture' : 'not synced'}</small></div>
          </div>

          {chart.days.length > 0 ? (
            <>
              <div className="mcTokenAnalysis">
                <div>
                  <div className="mcTokenChartFrame">
                    <div className="mcTokenYAxis" aria-hidden="true">
                      {yTicks.map((tick, index) => <span key={`${tick}-${index}`}>{formatTokens(tick)}</span>)}
                    </div>
                    <div className="mcTokenPlot" role="img" aria-label="Stacked daily token usage by agent">
                      <span className="mcTokenRule top" />
                      <span className="mcTokenRule mid" />
                      <div className="mcTokenBars">
                        {chart.days.map((day, dayIndex) => (
                          <div className="mcTokenDay" key={day.date}>
                            <span className="mcTokenDailyTotal">{formatTokens(day.total)}</span>
                            <div className="mcTokenBarTrack">
                              <div className="mcTokenStack" style={{ height: `${Math.max((day.total / maxDailyTotal) * 100, day.total > 0 ? 2 : 0)}%` }}>
                                {day.segments.map((segment) => {
                                  const height = day.total > 0 ? Math.max((segment.total / day.total) * 100, 2) : 0
                                  const isSelected = selectedDate === day.date && selectedParent === segment.key
                                  return (
                                    <button
                                      className={isSelected ? 'mcTokenSegment selected' : 'mcTokenSegment'}
                                      key={`${day.date}-${segment.key}`}
                                      type="button"
                                      style={{ backgroundColor: getTokenColor(segment.key), height: `${height}%` }}
                                      onClick={() => groupedByParent && setDrilldown({ date: day.date, parent: segment.key })}
                                      aria-disabled={!groupedByParent}
                                      aria-label={`${segment.key}, ${formatTokens(segment.total)} tokens on ${day.date}`}
                                    >
                                      <span className="mcTokenTooltip">{segment.key}: {formatTokens(segment.total)} tokens</span>
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                            <span className="mcTokenXAxisLabel">{dayIndex % 3 === 0 || dayIndex === chart.days.length - 1 ? formatChartDate(day.date) : ''}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mcTokenLegend" aria-label="Token chart legend">
                    {chart.totals.map((row) => (
                      <span className={row.key === topAgent?.key ? 'dominant' : ''} key={row.key}>
                        <i style={{ backgroundColor: getTokenColor(row.key) }} />
                        {row.key}
                        <strong>{formatTokens(row.total)}</strong>
                      </span>
                    ))}
                  </div>
                </div>

                <aside className="mcTokenDiagnostic" aria-label="Dominant token surface">
                  <span className="mcTokenDiagnosticPlus">+</span>
                  <p>Dominant surface</p>
                  <strong>{topAgent?.key ?? '-'}</strong>
                  <dl>
                    {chart.totals.slice(0, 6).map((row) => (
                      <div key={row.key}>
                        <dt>{row.key}</dt>
                        <dd>{Math.round((row.total / Math.max(totalTokens, 1)) * 100)}%</dd>
                      </div>
                    ))}
                  </dl>
                </aside>
              </div>

              {drilldownRows.length > 0 && (
                <div className="mcTokenDrilldown">
                  <div className="mcTokenDrilldownTitle">
                    <span>+</span>
                    <strong>{selectedParent} children / {selectedDate}</strong>
                  </div>
                  <div className="mcTokenDrilldownRows">
                    {drilldownRows.map((row) => (
                      <div className="mcTokenDrilldownRow" key={`${row.id}-${row.parent_agent ?? 'root'}`}>
                        <span>{row.agent}</span>
                        <div><i style={{ width: `${Math.max((row.total_tokens / Math.max(...drilldownRows.map((item) => item.total_tokens), 1)) * 100, 3)}%`, background: getTokenColor(row.agent) }} /></div>
                        <strong>{formatTokens(row.total_tokens)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="mcTokenEmpty">No token usage rows synced yet. New OpenClaw runs will appear after session logs include usage data.</p>
          )}

          <footer className="mcTokenFooter">
            <span>Bridge sync</span>
            <strong>{formatDate(latestSuccess?.finished_at ?? latestSuccess?.started_at)}</strong>
            <span className="mcTokenCornerPlus">+</span>
          </footer>
      </div>
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
    <section className="panel" id="workspace">
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

const panelAnchors = ['#tokens', '#models', '#automation', '#projects', '#team', '#workspace', '#source-health', '#history'] as const

function Dashboard({ user }: { user: User }) {
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [data, setData] = useState<DashboardData>(emptyDashboard)
  const [requestState, setRequestState] = useState<'idle' | 'requesting' | 'requested' | 'error'>('idle')
  const [error, setError] = useState('')
  const [activeAnchor, setActiveAnchor] = useState<string>('#projects')

  async function loadDashboard(options: { silent?: boolean } = {}) {
    if (!options.silent) setLoadState('loading')
    setError('')

    const [projects, teamMembers, syncRuns, syncRequests, sourceHealth, cronJobs, tokenUsage, modelUsage, workspaceSignals] = await Promise.all([
      supabase.from('canonical_projects').select('*').order('priority', { ascending: true }),
      supabase.from('canonical_team_members').select('*').order('name', { ascending: true }),
      supabase.from('sync_runs').select('*').order('started_at', { ascending: false }).limit(8),
      supabase.from('sync_requests').select('*').order('requested_at', { ascending: false }).limit(5),
      supabase.from('source_health_snapshots').select('*').order('label', { ascending: true }),
      supabase.from('cron_job_snapshots').select('*').order('name', { ascending: true }),
      supabase.from('agent_token_usage_daily').select('*').order('date', { ascending: false }).limit(120),
      supabase.from('model_token_usage_daily').select('*').order('date', { ascending: false }).limit(120),
      supabase.from('workspace_signal_snapshots').select('*').order('synced_at', { ascending: false }).limit(1),
    ])

    const failed = [projects, teamMembers, syncRuns, syncRequests, sourceHealth, cronJobs, tokenUsage, modelUsage, workspaceSignals].find((result) => result.error)
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
      modelUsage: (modelUsage.data ?? []) as ModelTokenUsageDaily[],
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

  // Intersection Observer: track which panel section is currently in view
  useEffect(() => {
    if (loadState !== 'ready') return

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the entry with the highest intersection ratio that is above threshold
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)

        if (visible.length > 0) {
          const anchor = `#${visible[0].target.id}`
          if (panelAnchors.includes(anchor as typeof panelAnchors[number])) {
            setActiveAnchor(anchor)
          }
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: [0, 0.25, 0.5] },
    )

    // Observe all panel sections by their id
    for (const anchor of panelAnchors) {
      const el = document.getElementById(anchor.slice(1))
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [loadState])

  useEffect(() => {
    if (!hasActiveSyncRequest(data.syncRequests) && requestState !== 'requested') return

    const interval = window.setInterval(() => {
      void loadDashboard({ silent: true })
    }, 5_000)

    return () => window.clearInterval(interval)
  }, [data.syncRequests, requestState])

  return (
    <div className="controlRoomShell">
      <ShellSidebar data={data} activeAnchor={activeAnchor} />
      <main className="dashboardShell">
        <ShellHeader data={data} user={user} activeAnchor={activeAnchor} />
        <SyncPanel data={data} user={user} onRefreshRequested={requestRefresh} requestState={requestState} />
        {loadState === 'ready' && <TokenUsagePanel tokenUsage={data.tokenUsage} syncRuns={data.syncRuns} />}
        {loadState === 'ready' && <ModelUsagePanel modelUsage={data.modelUsage} syncRuns={data.syncRuns} />}
        {loadState === 'loading' && (
          <div className="loadingShell">
            <div className="loadingSkeleton" />
            <div className="loadingSkeleton short" />
            <p className="muted loadNotice">Loading private dashboard snapshot…</p>
          </div>
        )}
        {loadState === 'error' && <p className="errorText loadNotice">{error}</p>}
        <div className="dashboardGrid">
          <CronHealthPanel cronJobs={data.cronJobs} syncRuns={data.syncRuns} teamMembers={data.teamMembers} />
          <CronTimelinePanel cronJobs={data.cronJobs} syncRuns={data.syncRuns} />
          <ProjectsPanel projects={data.projects} />
          <TeamPanel teamMembers={data.teamMembers} />
          <WorkspaceSignalsPanel signal={data.workspaceSignal} syncRuns={data.syncRuns} />
          <SourceHealthPanel sources={data.sourceHealth} syncRuns={data.syncRuns} />
          <section className="panel compactPanel" id="history">
            <div>
              <p className="eyebrow">last sync run</p>
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
        </div>
        <button className="logoutButton" type="button" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </main>
    </div>
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
