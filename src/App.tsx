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
      { href: '#tokens', label: 'Token Usage', tone: 'runtime', icon: '📊' },
      { href: '#automation', label: 'Automation Pulse', tone: 'runtime', icon: '⚡' },
      { href: '#projects', label: 'Projects', tone: 'canonical', icon: '📋' },
      { href: '#team', label: 'Team', tone: 'canonical', icon: '👥' },
    ],
  },
  {
    title: 'System View',
    items: [
      { href: '#workspace', label: 'Workspace/Git', tone: 'runtime', icon: '🌿' },
      { href: '#source-health', label: 'Source Health', tone: 'canonical', icon: '🔍' },
      { href: '#history', label: 'Last Sync Run', tone: 'fallback', icon: '📜' },
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

function getLatestSuccessfulSync(syncRuns: SyncRun[]) {
  return syncRuns.find((run) => run.status === 'success') ?? null
}

const sectionMetaByAnchor: Record<string, { eyebrow: string; question: string }> = {
  '#projects': { eyebrow: 'Movement Board', question: 'Which project should move next?' },
  '#source-health': { eyebrow: 'Source Audit', question: 'Are all truth sources readable and healthy?' },
  '#automation': { eyebrow: 'Automation Audit', question: 'What is scheduled and is it healthy?' },
  '#tokens': { eyebrow: 'Cost Surface', question: 'Where are the tokens going?' },
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

function CronHealthPanel({ cronJobs, syncRuns }: { cronJobs: CronJobSnapshot[]; syncRuns: SyncRun[] }) {
  const latestSuccess = getLatestSuccessfulSync(syncRuns)
  const visibleJobs = cronJobs.filter((job) => job.id !== 'openclaw-cron-adapter')
  const adapterStatus = cronJobs.find((job) => job.id === 'openclaw-cron-adapter')
  const failedJobs = visibleJobs.filter((job) => job.status === 'failure')
  const runningJobs = visibleJobs.filter((job) => job.status === 'running')
  const disabledJobs = visibleJobs.filter((job) => job.status === 'disabled' || job.enabled === false)
  // Only flag system-level problems: adapter failure, or a high ratio of failing vs total.
  // Single-digit transient failures (rate-limit, timeout) are normal operational noise.
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

const tokenPalette = ['#f4a261', '#58a6ff', '#86efac', '#fbbf24', '#fda4af', '#67e8f9', '#c4b5fd', '#fdba74', '#93c5fd', '#bef264']

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
        const key = groupedByParent ? row.parent_agent ?? 'Independent' : row.agent
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
  }, [groupedByParent, tokenUsage])

  const totalTokens = chart.totals.reduce((sum, row) => sum + row.total, 0)
  const totalTurns = chart.totals.reduce((sum, row) => sum + row.turns, 0)
  const maxDailyTotal = Math.max(...chart.days.map((day) => day.total), 1)
  const latestDate = chart.days.at(-1)?.date
  const yTicks = [maxDailyTotal, Math.round(maxDailyTotal * 0.66), Math.round(maxDailyTotal * 0.33), 0]
  const selectedParent = drilldown?.parent ?? null
  const selectedDate = drilldown?.date ?? null
  const drilldownRows = useMemo(() => {
    if (!selectedDate || !selectedParent || !groupedByParent) return []
    return tokenUsage
      .filter((row) => row.date === selectedDate && (row.parent_agent ?? 'Independent') === selectedParent)
      .sort((a, b) => b.total_tokens - a.total_tokens)
  }, [groupedByParent, selectedDate, selectedParent, tokenUsage])

  return (
    <section className="panel" id="tokens">
      <div className="panelHeader tokenPanelHeader">
        <div>
          <p className="eyebrow">token usage</p>
          <h2>Agent token burn</h2>
          <p className="muted smallCopy">Where are the tokens going? Daily aggregate tokens from local OpenClaw session logs. No raw transcripts or prompts are synced.</p>
        </div>
        <div className="tokenHeaderActions">
          <button
            className="tokenToggleButton"
            type="button"
            onClick={() => {
              setGroupedByParent((value) => !value)
              setDrilldown(null)
            }}
          >
            {groupedByParent ? 'Group by parent' : 'Flat list'}
          </button>
          <span className="countBadge">{formatTokens(totalTokens)} tokens</span>
        </div>
      </div>

      <div className="cronSummaryGrid">
        <div><strong>{formatTokens(totalTokens)}</strong><span>tokens</span></div>
        <div><strong>{totalTurns}</strong><span>turns</span></div>
        <div><strong>{chart.totals[0]?.key ?? '-'}</strong><span>top agent</span></div>
        <div><strong>{latestDate ?? '-'}</strong><span>latest day</span></div>
      </div>

      {chart.days.length > 0 ? (
        <>
          <div className="tokenChartShell">
            <div className="tokenYAxis" aria-hidden="true">
              {yTicks.map((tick, index) => <span key={`${tick}-${index}`}>{formatTokens(tick)}</span>)}
            </div>
            <div className="tokenPlot" role="img" aria-label="Stacked daily token usage by agent">
              <div className="tokenBars">
                {chart.days.map((day, dayIndex) => (
                  <div className="tokenDay" key={day.date}>
                    <span className="tokenDailyTotal">{formatTokens(day.total)}</span>
                    <div className="tokenStack" style={{ height: `${Math.max((day.total / maxDailyTotal) * 100, day.total > 0 ? 2 : 0)}%` }}>
                      {day.segments.map((segment) => {
                        const height = day.total > 0 ? Math.max((segment.total / day.total) * 100, 2) : 0
                        const isSelected = selectedDate === day.date && selectedParent === segment.key
                        return (
                          <button
                            className={isSelected ? 'tokenSegment selected' : 'tokenSegment'}
                            key={`${day.date}-${segment.key}`}
                            type="button"
                            style={{ backgroundColor: getTokenColor(segment.key), height: `${height}%` }}
                            onClick={() => groupedByParent && setDrilldown({ date: day.date, parent: segment.key })}
                            aria-disabled={!groupedByParent}
                            aria-label={`${segment.key}, ${formatTokens(segment.total)} tokens on ${day.date}`}
                          >
                            <span className="tokenTooltip">{segment.key}: {formatTokens(segment.total)} tokens</span>
                          </button>
                        )
                      })}
                    </div>
                    <span className="tokenXAxisLabel">{dayIndex % 3 === 0 || dayIndex === chart.days.length - 1 ? formatChartDate(day.date) : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="tokenLegend" aria-label="Token chart legend">
            {chart.totals.map((row) => (
              <span className="tokenLegendItem" key={row.key}>
                <i style={{ backgroundColor: getTokenColor(row.key) }} />
                {row.key}
                <strong>{formatTokens(row.total)}</strong>
              </span>
            ))}
          </div>

          {drilldownRows.length > 0 && (
            <div className="tokenDrilldown">
              <div className="sourceCardHeader">
                <span className="miniStatus ok" />
                <strong>{selectedParent} children on {selectedDate}</strong>
              </div>
              <div className="tokenDrilldownRows">
                {drilldownRows.map((row) => (
                  <div className="tokenDrilldownRow" key={`${row.id}-${row.parent_agent ?? 'root'}`}>
                    <span>{row.agent}</span>
                    <div className="usageBar"><span style={{ width: `${Math.max((row.total_tokens / Math.max(...drilldownRows.map((item) => item.total_tokens), 1)) * 100, 3)}%`, background: getTokenColor(row.agent) }} /></div>
                    <strong>{formatTokens(row.total_tokens)}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="emptyState">No token usage rows synced yet. New OpenClaw runs will appear after session logs include usage data.</p>
      )}

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

const panelAnchors = ['#tokens', '#automation', '#projects', '#team', '#workspace', '#source-health', '#history'] as const

function Dashboard({ user }: { user: User }) {
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [data, setData] = useState<DashboardData>(emptyDashboard)
  const [requestState, setRequestState] = useState<'idle' | 'requesting' | 'requested' | 'error'>('idle')
  const [error, setError] = useState('')
  const [activeAnchor, setActiveAnchor] = useState<string>('#projects')

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
        {loadState === 'ready' && <TokenUsagePanel tokenUsage={data.tokenUsage} syncRuns={data.syncRuns} />}
        <SyncPanel data={data} user={user} onRefreshRequested={requestRefresh} requestState={requestState} />
        {loadState === 'loading' && (
          <div className="loadingShell">
            <div className="loadingSkeleton" />
            <div className="loadingSkeleton short" />
            <p className="muted loadNotice">Loading private dashboard snapshot…</p>
          </div>
        )}
        {loadState === 'error' && <p className="errorText loadNotice">{error}</p>}
        <div className="dashboardGrid">
          <CronHealthPanel cronJobs={data.cronJobs} syncRuns={data.syncRuns} />
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
