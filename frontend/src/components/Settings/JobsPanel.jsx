import { useState, useEffect, useCallback } from 'react'
import apiService from '../../services/apiService'
import { useNotifications } from '../../context/NotificationContext'

// computeNextRun estimates the next fire time of a job for sort ordering.
// Uses hourCycle h23 to avoid the Node.js h24 midnight bug (00:xx → "24:xx").
function computeNextRun(job) {
  if (!job.enabled || !job.schedule?.time) return null
  const [h, m] = job.schedule.time.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return null
  const tz = job.schedule.timezone || 'UTC'
  const now = new Date()
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(now).map(p => [p.type, p.value])
  )
  const passedToday = parseInt(parts.hour) > h || (parseInt(parts.hour) === h && parseInt(parts.minute) >= m)
  const candidate = new Date(now)
  candidate.setSeconds(0, 0)
  switch (job.schedule.frequency) {
    case 'once':
    case 'daily': {
      if (passedToday) candidate.setDate(candidate.getDate() + 1)
      candidate.setHours(h, m, 0, 0)
      return candidate
    }
    case 'weekly': {
      const dayMap = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 }
      const days = (job.schedule.days || []).map(d => dayMap[d.toLowerCase()]).filter(n => n !== undefined)
      if (!days.length) return null
      const todayDow = now.getDay()
      let minDiff = 8
      for (const dow of days) {
        let diff = (dow - todayDow + 7) % 7
        if (diff === 0 && passedToday) diff = 7
        if (diff < minDiff) minDiff = diff
      }
      candidate.setDate(candidate.getDate() + minDiff)
      candidate.setHours(h, m, 0, 0)
      return candidate
    }
    case 'monthly': {
      const dom = job.schedule.dayOfMonth || 1
      candidate.setDate(dom)
      candidate.setHours(h, m, 0, 0)
      if (candidate <= now) candidate.setMonth(candidate.getMonth() + 1)
      return candidate
    }
    default: return null
  }
}

// ─── Schedule Builder ────────────────────────────────────────────────

function ScheduleBuilder({ value, onChange }) {
  const frequencies = ['once', 'daily', 'weekly', 'monthly']
  const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
  const minutes = ['00', '15', '30', '45']

  // auto-detect the user's local IANA timezone
  const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const tzLabel = userTz.split('/').pop().replace(/_/g, ' ')

  const inputClass = 'border border-[#e2e8f0] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white'

  function update(field, val) {
    // always include the detected timezone so scheduler uses local time
    onChange({ ...value, [field]: val, timezone: userTz })
  }

  function toggleDay(day) {
    const days = value.days || []
    const next = days.includes(day)
      ? days.filter(d => d !== day)
      : [...days, day]
    onChange({ ...value, days: next, timezone: userTz })
  }

  return (
    <div className="space-y-3">

      <div>
        <label className="block text-xs text-slate-500 mb-1">Frequency</label>
        <select
          value={value.frequency || 'daily'}
          onChange={e => update('frequency', e.target.value)}
          className={`w-full ${inputClass}`}
        >
          {frequencies.map(f => (
            <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
          ))}
        </select>
      </div>

      {value.frequency === 'weekly' && (
        <div>
          <label className="block text-xs text-slate-500 mb-1">Days</label>
          <div className="flex flex-wrap gap-1">
            {weekdays.map(day => (
              <button
                key={day}
                onClick={() => toggleDay(day)}
                className={`
                  text-xs px-2 py-1 rounded border transition-colors
                  ${(value.days || []).includes(day)
                    ? 'bg-indigo-500 text-white border-indigo-500'
                    : 'bg-white text-slate-600 border-[#e2e8f0] hover:border-indigo-300'
                  }
                `}
              >
                {day.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>
      )}

      {value.frequency === 'monthly' && (
        <div>
          <label className="block text-xs text-slate-500 mb-1">Day of Month</label>
          <input
            type="number"
            min="1"
            max="31"
            value={value.dayOfMonth || 1}
            onChange={e => update('dayOfMonth', parseInt(e.target.value))}
            className={`w-24 ${inputClass}`}
          />
        </div>
      )}

      <div>
        <label className="block text-xs text-slate-500 mb-1">
          Time
          <span className="ml-1 text-indigo-500 font-normal">({tzLabel})</span>
        </label>
        <div className="flex items-center gap-2">
          <select
            value={(value.time || '09:00').split(':')[0]}
            onChange={e => update('time', `${e.target.value}:${(value.time || '09:00').split(':')[1]}`)}
            className={inputClass}
          >
            {hours.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
          <span className="text-[#94a3b8]">:</span>
          <select
            value={(value.time || '09:00').split(':')[1]}
            onChange={e => update('time', `${(value.time || '09:00').split(':')[0]}:${e.target.value}`)}
            className={inputClass}
          >
            {minutes.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <p className="text-xs text-[#94a3b8] mt-1">Detected timezone: {userTz}</p>
      </div>

    </div>
  )
}

// ─── Create Job Form ─────────────────────────────────────────────────

function CreateJobForm({ availableTools, onJobCreated, onCancel }) {
  const [form, setForm] = useState({
    name: '',
    tool: '',
    paramValues: {},
    schedule: {
      frequency: 'daily',
      days: [],
      time: '09:00',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    },
    retry: { enabled: true, maxRetries: 2, delayMinutes: 5, timeoutSeconds: 30 }
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const selectedTool = availableTools.find(t => t.name === form.tool)
  const toolParameters = (selectedTool?.parameters || []).filter(p => !p.name.startsWith('__'))

  const inputClass = 'w-full border border-[#e2e8f0] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white'

  function handleToolChange(toolName) {
    setForm(p => ({ ...p, tool: toolName, paramValues: {} }))
  }

  function handleParamChange(paramName, value) {
    setForm(p => ({ ...p, paramValues: { ...p.paramValues, [paramName]: value } }))
  }

  async function handleCreate() {
    if (!form.name || !form.tool || !form.schedule.time) {
      setError('Name, tool and time are required')
      return
    }

    const missingParams = toolParameters
      .filter(p => p.required && !form.paramValues[p.name])
      .map(p => p.name)

    if (missingParams.length > 0) {
      setError(`Required parameters missing: ${missingParams.join(', ')}`)
      return
    }

    setLoading(true)
    setError(null)

    try {
      await apiService.createJobFromUI({
        name: form.name,
        tool: form.tool,
        parameters: form.paramValues,
        schedule: form.schedule,
        retry: form.retry,
        enabled: true
      })
      onJobCreated()
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-slate-50 border border-[#e2e8f0] rounded-lg p-4 space-y-3">
      <h4 className="text-sm font-semibold text-slate-700">Create New Job</h4>

      <div>
        <label className="block text-xs text-slate-500 mb-1">Job Name</label>
        <input
          type="text"
          value={form.name}
          onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          placeholder="e.g. Daily deploy MyIFlow"
          className={inputClass}
        />
      </div>

      <div>
        <label className="block text-xs text-slate-500 mb-1">Tool</label>
        <select
          value={form.tool}
          onChange={e => handleToolChange(e.target.value)}
          className={inputClass}
        >
          <option value="">Select a tool...</option>
          {availableTools.map(t => (
            <option key={t.name} value={t.name}>{t.name}</option>
          ))}
        </select>
        {selectedTool && (
          <p className="text-xs text-[#94a3b8] mt-1">
            {selectedTool.description?.slice(0, 100)}...
          </p>
        )}
      </div>

      {toolParameters.length > 0 && (
        <div className="space-y-2">
          <label className="block text-xs text-slate-500">Parameters</label>
          {toolParameters.map(param => (
            <div key={param.name}>
              <label className="block text-xs text-[#94a3b8] mb-1">
                {param.name}
                {param.required && <span className="text-red-400 ml-1">*</span>}
              </label>
              <input
                type="text"
                value={form.paramValues[param.name] || ''}
                onChange={e => handleParamChange(param.name, e.target.value)}
                placeholder={param.description || param.name}
                className={inputClass}
              />
              <p className="text-xs text-[#94a3b8] mt-0.5">{param.description}</p>
            </div>
          ))}
        </div>
      )}

      {toolParameters.length === 0 && form.tool && (
        <p className="text-xs text-[#94a3b8] italic">No parameters required for this tool</p>
      )}

      <div>
        <label className="block text-xs text-slate-500 mb-2">Schedule</label>
        <ScheduleBuilder
          value={form.schedule}
          onChange={schedule => setForm(p => ({ ...p, schedule }))}
        />
      </div>

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="retryEnabled"
          checked={form.retry.enabled}
          onChange={e => setForm(p => ({
            ...p,
            retry: { ...p.retry, enabled: e.target.checked }
          }))}
          className="w-4 h-4 accent-indigo-500"
        />
        <label htmlFor="retryEnabled" className="text-xs text-slate-600">
          Retry on failure (2 attempts, 5 min delay)
        </label>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleCreate}
          disabled={loading}
          className="flex-1 bg-indigo-500 text-white text-xs font-medium py-2 rounded-lg hover:bg-indigo-600 disabled:bg-slate-300 transition-colors"
        >
          {loading ? 'Creating...' : 'Create Job'}
        </button>
        <button
          onClick={onCancel}
          className="flex-1 border border-[#e2e8f0] text-slate-600 text-xs py-2 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Run Now Modal ────────────────────────────────────────────────────

function RunNowModal({ job, onConfirm, onCancel }) {
  const [keepSchedule, setKeepSchedule] = useState(true)

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl border border-[#e2e8f0] p-5 max-w-sm w-full mx-4">
        <h3 className="font-semibold text-[#0f172a] mb-2">Run Now</h3>
        <p className="text-sm text-slate-600 mb-4">
          Run <strong>{job.name}</strong> immediately?
        </p>

        <div className="flex items-center gap-3 mb-4">
          <input
            type="checkbox"
            id="keepSchedule"
            checked={keepSchedule}
            onChange={e => setKeepSchedule(e.target.checked)}
            className="w-4 h-4 accent-indigo-500"
          />
          <label htmlFor="keepSchedule" className="text-sm text-slate-600">
            Keep schedule active after this run
          </label>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onConfirm(keepSchedule)}
            className="flex-1 bg-indigo-500 text-white text-sm py-2 rounded-lg hover:bg-indigo-600 transition-colors"
          >
            Run Now
          </button>
          <button
            onClick={onCancel}
            className="flex-1 border border-[#e2e8f0] text-slate-600 text-sm py-2 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Job History Modal ────────────────────────────────────────────────

function JobHistoryModal({ job, onClose }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiService.getJobHistory(job.id)
      .then(setHistory)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [job.id])

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl border border-[#e2e8f0] p-5 max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[#0f172a]">{job.name} — History</h3>
          <button onClick={onClose} className="text-[#94a3b8] hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {loading && (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          )}

          {!loading && history.length === 0 && (
            <p className="text-sm text-[#94a3b8] text-center py-4">No execution history yet</p>
          )}

          {!loading && history.map(exec => (
            <div key={exec.id} className="border border-[#e2e8f0] rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                  exec.status === 'SUCCESS' ? 'text-green-700 bg-green-100' :
                  exec.status === 'FAILED'  ? 'text-red-700 bg-red-100' :
                  exec.status === 'RETRYING'? 'text-amber-700 bg-amber-100' :
                                              'text-slate-600 bg-slate-100'
                }`}>
                  {exec.status}
                </span>
                <span className="text-xs text-[#94a3b8]">
                  {new Date(exec.startedAt).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span>Attempt {exec.attempt}/{exec.maxAttempts}</span>
                <span>{exec.duration ? `${(exec.duration / 1000).toFixed(1)}s` : '—'}</span>
              </div>
              {exec.error && (
                <p className="text-xs text-red-600 mt-1 truncate">{exec.error}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Job Card ────────────────────────────────────────────────────────

function JobCard({ job, onRefresh }) {
  const [runNowModal, setRunNowModal] = useState(false)
  const [historyModal, setHistoryModal] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleToggle() {
    setToggling(true)
    try {
      await apiService.toggleJob(job.id, !job.enabled)
      onRefresh()
    } finally {
      setToggling(false)
    }
  }

  async function handleRunNow(keepSchedule) {
    setRunNowModal(false)
    try {
      await apiService.runJobNow(job.id, keepSchedule)
      onRefresh()
    } catch (err) {
      console.error('Run now failed:', err)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete job "${job.name}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await apiService.deleteJob(job.id)
      onRefresh()
    } finally {
      setDeleting(false)
    }
  }

  function buildScheduleLabel(schedule) {
    if (!schedule) return '—'
    const tz = schedule.timezone || 'UTC'
    const isUtc = tz === 'UTC'
    // for UTC-stored legacy jobs, convert to local time for display
    // for local-timezone jobs, the stored time IS local — just show it
    let timeDisplay
    if (isUtc) {
      const [h, m] = (schedule.time || '00:00').split(':')
      const d = new Date()
      d.setUTCHours(parseInt(h), parseInt(m), 0, 0)
      const local = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      timeDisplay = `${local} (local)`
    } else {
      const tzLabel = tz.split('/').pop().replace(/_/g, ' ')
      timeDisplay = `${schedule.time} ${tzLabel}`
    }
    switch (schedule.frequency) {
      case 'once': return `Once at ${timeDisplay}`
      case 'daily': return `Daily at ${timeDisplay}`
      case 'weekly': return `Weekly on ${(schedule.days || []).join(', ')} at ${timeDisplay}`
      case 'monthly': return `Monthly on day ${schedule.dayOfMonth || 1} at ${timeDisplay}`
      default: return timeDisplay
    }
  }

  return (
    <>
      <div className="bg-white border border-[#e2e8f0] rounded-lg p-3">

        <div className="flex items-start gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-[#0f172a] truncate">{job.name}</p>
              {!job.enabled && (
                <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded flex-shrink-0">
                  Paused
                </span>
              )}
            </div>
            <p className="text-xs text-[#94a3b8] truncate">{job.tool}</p>
          </div>

          <button
            onClick={handleToggle}
            disabled={toggling}
            title={job.enabled ? 'Disable job' : 'Enable job'}
            className={`
              relative flex-shrink-0 mt-0.5
              h-6 w-11 rounded-full transition-colors duration-200
              disabled:opacity-50 focus:outline-none
              ${job.enabled ? 'bg-indigo-500' : 'bg-slate-300'}
            `}
          >
            <span className={`
              absolute top-1 left-1
              h-4 w-4 rounded-full bg-white shadow-sm
              transition-transform duration-200
              ${job.enabled ? 'translate-x-5' : 'translate-x-0'}
            `} />
          </button>
        </div>

        <p className="text-xs text-slate-500 mb-2">
          {buildScheduleLabel(job.schedule)}
        </p>

        {job.lastStatus && (
          <p className={`text-xs font-medium mb-2 ${
            job.lastStatus === 'SUCCESS'  ? 'text-green-700' :
            job.lastStatus === 'FAILED'   ? 'text-red-600' :
            job.lastStatus === 'RETRYING' ? 'text-amber-600' :
                                            'text-slate-500'
          }`}>
            Last run: {job.lastStatus}
            {job.lastRun && ` · ${new Date(job.lastRun).toLocaleString()}`}
          </p>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={() => setRunNowModal(true)}
            className="text-xs text-indigo-500 hover:text-indigo-600 border border-indigo-200 hover:border-indigo-300 rounded px-2 py-1 transition-colors"
          >
            Run Now
          </button>
          <button
            onClick={() => setHistoryModal(true)}
            className="text-xs text-slate-500 hover:text-slate-700 border border-[#e2e8f0] hover:border-slate-300 rounded px-2 py-1 transition-colors"
          >
            History
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-300 rounded px-2 py-1 transition-colors disabled:opacity-50 ml-auto"
          >
            {deleting ? '...' : 'Delete'}
          </button>
        </div>

      </div>

      {runNowModal && (
        <RunNowModal
          job={job}
          onConfirm={handleRunNow}
          onCancel={() => setRunNowModal(false)}
        />
      )}

      {historyModal && (
        <JobHistoryModal
          job={job}
          onClose={() => setHistoryModal(false)}
        />
      )}
    </>
  )
}

// ─── Execution Card ──────────────────────────────────────────────────

function ExecutionCard({ execution }) {
  const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const statusColor = {
    SUCCESS: 'text-green-700 bg-green-100',
    FAILED:  'text-red-700 bg-red-100',
  }[execution.status] || 'text-slate-600 bg-slate-100'

  const ts = execution.startedAt
    ? new Date(execution.startedAt).toLocaleString(undefined, {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
        timeZone: userTz
      })
    : ''

  return (
    <div className="bg-white border border-[#e2e8f0] rounded-lg px-3 py-2 flex items-center gap-3">
      <span className={`text-xs font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${statusColor}`}>
        {execution.status}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[#0f172a] truncate">{execution.jobName}</p>
        {execution.error
          ? <p className="text-xs text-red-500 truncate">{execution.error}</p>
          : <p className="text-xs text-[#94a3b8] truncate">{execution.tool}</p>
        }
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-xs text-slate-500 whitespace-nowrap">{ts}</p>
        {execution.duration != null && (
          <p className="text-xs text-[#94a3b8]">{(execution.duration / 1000).toFixed(1)}s</p>
        )}
      </div>
    </div>
  )
}

// ─── Main Jobs Panel ─────────────────────────────────────────────────

function JobsPanel({ inline = false }) {
  const { lastJobEvent } = useNotifications()
  const [jobs, setJobs] = useState([])
  const [executions, setExecutions] = useState([])
  const [availableTools, setAvailableTools] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [expanded, setExpanded] = useState(inline)

  const fetchJobs = useCallback(async () => {
    try {
      const data = await apiService.getAllJobs()
      setJobs(data || [])
    } catch (err) {
      console.error('Failed to fetch jobs:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchExecutions = useCallback(async () => {
    try {
      const data = await apiService.getAllExecutions()
      setExecutions(data || [])
    } catch (err) {
      console.error('Failed to fetch executions:', err)
    }
  }, [])

  const fetchTools = useCallback(async () => {
    try {
      const cpiUrl = import.meta.env.VITE_CPI_MCP_URL || 'http://localhost:3001/mcp'
      const tools = await apiService.getMcpServerTools(cpiUrl)
      setAvailableTools(tools || [])
    } catch (err) {
      console.error('Failed to fetch tools:', err)
    }
  }, [])

  const refreshAll = useCallback(() => {
    fetchJobs()
    fetchExecutions()
  }, [fetchJobs, fetchExecutions])

  useEffect(() => {
    if (!expanded) return
    fetchJobs()
    fetchExecutions()
    fetchTools()
    const interval = setInterval(refreshAll, 30000)
    return () => clearInterval(interval)
  }, [expanded, fetchJobs, fetchExecutions, fetchTools, refreshAll])

  // refresh immediately when any job:started or job:complete SSE event fires
  useEffect(() => {
    if (!expanded || lastJobEvent === 0) return
    refreshAll()
  }, [lastJobEvent, expanded, refreshAll])

  // ── derived lists ────────────────────────────────────────────────
  const scheduledJobs = jobs
    .filter(j => j.enabled)
    .map(j => ({ j, next: computeNextRun(j) }))
    .sort((a, b) => {
      if (!a.next && !b.next) return 0
      if (!a.next) return 1
      if (!b.next) return -1
      return a.next - b.next
    })
    .map(({ j }) => j)

  const completedExecutions = executions
    .filter(e => e.status === 'SUCCESS' || e.status === 'FAILED')
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))

  // helper: human-readable "next run" label
  function nextRunLabel(job) {
    const next = computeNextRun(job)
    if (!next) return null
    const diffMs = next - Date.now()
    if (diffMs < 0) return 'overdue'
    if (diffMs < 60000) return 'in < 1 min'
    if (diffMs < 3600000) return `in ${Math.round(diffMs / 60000)} min`
    if (diffMs < 86400000) return `in ${Math.round(diffMs / 3600000)}h`
    return next.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
      ' ' + next.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  }

  const content = (
    <div className="space-y-5">

      {/* toolbar */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-[#94a3b8]">
          {jobs.length > 0 ? `${jobs.length} job${jobs.length !== 1 ? 's' : ''}` : ''}
        </span>
        <button
          onClick={refreshAll}
          className="text-xs text-indigo-500 hover:text-indigo-600 flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* create job */}
      {!showCreateForm && (
        <button
          onClick={() => setShowCreateForm(true)}
          className="w-full text-xs text-indigo-500 hover:text-indigo-600 border border-dashed border-indigo-200 hover:border-indigo-300 rounded-lg py-2.5 transition-colors"
        >
          + Schedule New Job
        </button>
      )}
      {showCreateForm && (
        <CreateJobForm
          availableTools={availableTools}
          onJobCreated={() => { setShowCreateForm(false); refreshAll() }}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {/* loading skeleton */}
      {loading && (
        <div className="space-y-2">
          {[1, 2].map(i => (
            <div key={i} className="h-16 bg-slate-100 rounded animate-pulse" />
          ))}
        </div>
      )}

      {/* empty state */}
      {!loading && jobs.length === 0 && executions.length === 0 && !showCreateForm && (
        <div className="text-center py-8">
          <svg className="w-8 h-8 text-slate-200 mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <p className="text-xs text-[#94a3b8]">No scheduled jobs. Create one above or via chat.</p>
        </div>
      )}

      {/* ── Scheduled section ─────────────────────────────────── */}
      {!loading && (scheduledJobs.length > 0 || jobs.filter(j => !j.enabled).length > 0) && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Scheduled</span>
            {scheduledJobs.length > 0 && (
              <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">
                {scheduledJobs.length}
              </span>
            )}
          </div>
          {scheduledJobs.length === 0 ? (
            <p className="text-xs text-[#94a3b8]">No active jobs right now</p>
          ) : (
            <div className="space-y-2">
              {scheduledJobs.map(job => {
                const label = nextRunLabel(job)
                return (
                  <div key={job.id}>
                    {label && (
                      <p className="text-xs text-indigo-500 font-medium mb-0.5 pl-1">↑ Next: {label}</p>
                    )}
                    <JobCard job={job} onRefresh={refreshAll} />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── History section ────────────────────────────────────── */}
      {!loading && completedExecutions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">History</span>
            <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-medium">
              {completedExecutions.length}
            </span>
          </div>
          <div className="space-y-1.5">
            {completedExecutions.map(exec => (
              <ExecutionCard key={exec.id} execution={exec} />
            ))}
          </div>
        </div>
      )}

    </div>
  )

  if (inline) return content

  return (
    <div>
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="w-full flex items-center justify-between py-1 group"
      >
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer">
          Scheduled Jobs
          {jobs.length > 0 && (
            <span className="ml-2 bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full text-xs font-medium">
              {jobs.length}
            </span>
          )}
        </label>
        <span className="text-xs text-[#94a3b8] group-hover:text-slate-600">
          {expanded ? '▲ collapse' : '▼ expand'}
        </span>
      </button>
      {expanded && content}
    </div>
  )
}

export default JobsPanel
