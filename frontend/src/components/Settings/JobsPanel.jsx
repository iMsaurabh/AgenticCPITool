// JobsPanel provides a complete UI for managing scheduled jobs.
// Displays all jobs with status, schedule and controls.
// Allows creating new jobs via visual schedule builder.
// Complements chat-driven scheduling for users who prefer UI.

import { useState, useEffect, useCallback } from 'react'
import apiService from '../../services/apiService'

// ─── Schedule Builder ────────────────────────────────────────────────

function ScheduleBuilder({ value, onChange }) {
  const frequencies = ['once', 'daily', 'weekly', 'monthly']
  const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
  const minutes = ['00', '15', '30', '45']

  function update(field, val) {
    onChange({ ...value, [field]: val })
  }

  function toggleDay(day) {
    const days = value.days || []
    const next = days.includes(day)
      ? days.filter(d => d !== day)
      : [...days, day]
    update('days', next)
  }

  return (
    <div className="space-y-3">

      {/* frequency */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Frequency</label>
        <select
          value={value.frequency || 'daily'}
          onChange={e => update('frequency', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {frequencies.map(f => (
            <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* day of week — weekly only */}
      {value.frequency === 'weekly' && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">Days</label>
          <div className="flex flex-wrap gap-1">
            {weekdays.map(day => (
              <button
                key={day}
                onClick={() => toggleDay(day)}
                className={`
                  text-xs px-2 py-1 rounded border transition-colors
                  ${(value.days || []).includes(day)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                  }
                `}
              >
                {day.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* day of month — monthly only */}
      {value.frequency === 'monthly' && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">Day of Month</label>
          <input
            type="number"
            min="1"
            max="31"
            value={value.dayOfMonth || 1}
            onChange={e => update('dayOfMonth', parseInt(e.target.value))}
            className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {/* time — UTC */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Time (UTC)</label>
        <div className="flex items-center gap-2">
          <select
            value={(value.time || '09:00').split(':')[0]}
            onChange={e => update('time', `${e.target.value}:${(value.time || '09:00').split(':')[1]}`)}
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {hours.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
          <span className="text-gray-400">:</span>
          <select
            value={(value.time || '09:00').split(':')[1]}
            onChange={e => update('time', `${(value.time || '09:00').split(':')[0]}:${e.target.value}`)}
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {minutes.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <span className="text-xs text-gray-400">UTC</span>
        </div>
        {/* show local time equivalent */}
        <p className="text-xs text-gray-400 mt-1">
          Local: {(() => {
            const [h, m] = (value.time || '09:00').split(':')
            const utcDate = new Date()
            utcDate.setUTCHours(parseInt(h), parseInt(m), 0, 0)
            return utcDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          })()}
        </p>
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
    schedule: { frequency: 'daily', days: [], time: '09:00' },
    retry: { enabled: true, maxRetries: 2, delayMinutes: 5, timeoutSeconds: 30 }
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // get selected tool definition
  const selectedTool = availableTools.find(t => t.name === form.tool)

  // get parameters for selected tool — filter out internal ones
  const toolParameters = (selectedTool?.parameters || [])
    .filter(p => !p.name.startsWith('__'))

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

    // validate required parameters
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
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
      <h4 className="text-sm font-semibold text-gray-700">Create New Job</h4>

      {/* job name */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Job Name</label>
        <input
          type="text"
          value={form.name}
          onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          placeholder="e.g. Daily deploy MyIFlow"
          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* tool selection */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Tool</label>
        <select
          value={form.tool}
          onChange={e => handleToolChange(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select a tool...</option>
          {availableTools.map(t => (
            <option key={t.name} value={t.name}>{t.name}</option>
          ))}
        </select>
        {selectedTool && (
          <p className="text-xs text-gray-400 mt-1">
            {selectedTool.description?.slice(0, 100)}...
          </p>
        )}
      </div>

      {/* dynamic parameter fields */}
      {toolParameters.length > 0 && (
        <div className="space-y-2">
          <label className="block text-xs text-gray-500">Parameters</label>
          {toolParameters.map(param => (
            <div key={param.name}>
              <label className="block text-xs text-gray-400 mb-1">
                {param.name}
                {param.required && <span className="text-red-400 ml-1">*</span>}
              </label>
              <input
                type="text"
                value={form.paramValues[param.name] || ''}
                onChange={e => handleParamChange(param.name, e.target.value)}
                placeholder={param.description || param.name}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-0.5">{param.description}</p>
            </div>
          ))}
        </div>
      )}

      {toolParameters.length === 0 && form.tool && (
        <p className="text-xs text-gray-400 italic">No parameters required for this tool</p>
      )}

      {/* schedule builder */}
      <div>
        <label className="block text-xs text-gray-500 mb-2">Schedule</label>
        <ScheduleBuilder
          value={form.schedule}
          onChange={schedule => setForm(p => ({ ...p, schedule }))}
        />
      </div>

      {/* retry config */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="retryEnabled"
          checked={form.retry.enabled}
          onChange={e => setForm(p => ({
            ...p,
            retry: { ...p.retry, enabled: e.target.checked }
          }))}
          className="w-4 h-4"
        />
        <label htmlFor="retryEnabled" className="text-xs text-gray-600">
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
          className="flex-1 bg-blue-600 text-white text-xs font-medium py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
        >
          {loading ? 'Creating...' : 'Create Job'}
        </button>
        <button
          onClick={onCancel}
          className="flex-1 border border-gray-300 text-gray-600 text-xs py-2 rounded-lg hover:bg-gray-50 transition-colors"
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
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-5 max-w-sm w-full mx-4">
        <h3 className="font-semibold text-gray-800 mb-2">Run Now</h3>
        <p className="text-sm text-gray-600 mb-4">
          Run <strong>{job.name}</strong> immediately?
        </p>

        <div className="flex items-center gap-3 mb-4">
          <input
            type="checkbox"
            id="keepSchedule"
            checked={keepSchedule}
            onChange={e => setKeepSchedule(e.target.checked)}
            className="w-4 h-4"
          />
          <label htmlFor="keepSchedule" className="text-sm text-gray-600">
            Keep schedule active after this run
          </label>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onConfirm(keepSchedule)}
            className="flex-1 bg-blue-600 text-white text-sm py-2 rounded-lg hover:bg-blue-700"
          >
            Run Now
          </button>
          <button
            onClick={onCancel}
            className="flex-1 border border-gray-300 text-gray-600 text-sm py-2 rounded-lg hover:bg-gray-50"
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
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-5 max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">{job.name} — History</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {loading && (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          )}

          {!loading && history.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No execution history yet</p>
          )}

          {!loading && history.map(exec => (
            <div key={exec.id} className="border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                  exec.status === 'SUCCESS' ? 'text-green-700 bg-green-100' :
                  exec.status === 'FAILED'  ? 'text-red-700 bg-red-100' :
                  exec.status === 'RETRYING'? 'text-amber-700 bg-amber-100' :
                                              'text-gray-600 bg-gray-100'
                }`}>
                  {exec.status}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(exec.startedAt).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500">
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

  // convert UTC schedule time to local for display
  function getLocalTime(utcTime) {
    if (!utcTime) return ''
    const [h, m] = utcTime.split(':')
    const d = new Date()
    d.setUTCHours(parseInt(h), parseInt(m), 0, 0)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  function buildScheduleLabel(schedule) {
    if (!schedule) return '—'
    const time = `${schedule.time} UTC (${getLocalTime(schedule.time)} local)`
    switch (schedule.frequency) {
      case 'once': return `Once at ${time}`
      case 'daily': return `Daily at ${time}`
      case 'weekly': return `Weekly on ${(schedule.days || []).join(', ')} at ${time}`
      case 'monthly': return `Monthly on day ${schedule.dayOfMonth || 1} at ${time}`
      default: return time
    }
  }

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-lg p-3">

        {/* job header */}
<div className="flex items-start gap-2 mb-2">
  <div className="flex-1 min-w-0">
    <div className="flex items-center gap-2 flex-wrap">
      <p className="text-sm font-medium text-gray-800 truncate">{job.name}</p>
      {!job.enabled && (
        <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded flex-shrink-0">
          Paused
        </span>
      )}
    </div>
    <p className="text-xs text-gray-400 truncate">{job.tool}</p>
  </div>

  {/* enable/disable toggle — constrained size */}
  <button
  onClick={handleToggle}
  disabled={toggling}
  title={job.enabled ? 'Disable job' : 'Enable job'}
  className={`
    relative flex-shrink-0 mt-0.5
    h-6 w-11 rounded-full transition-colors duration-200
    disabled:opacity-50 focus:outline-none
    ${job.enabled ? 'bg-blue-600' : 'bg-gray-300'}
  `}
>
  <span
    className={`
      absolute top-1 left-1
      h-4 w-4 rounded-full bg-white shadow-sm
      transition-transform duration-200
      ${job.enabled ? 'translate-x-5' : 'translate-x-0'}
    `}
  />
</button>
</div>

        {/* schedule */}
        <p className="text-xs text-gray-500 mb-2">
          {buildScheduleLabel(job.schedule)}
        </p>

        {/* last status */}
        {job.lastStatus && (
          <p className={`text-xs font-medium mb-2 ${
            job.lastStatus === 'SUCCESS'  ? 'text-green-700' :
            job.lastStatus === 'FAILED'   ? 'text-red-600' :
            job.lastStatus === 'RETRYING' ? 'text-amber-600' :
                                            'text-gray-500'
          }`}>
            Last run: {job.lastStatus}
            {job.lastRun && ` · ${new Date(job.lastRun).toLocaleString()}`}
          </p>
        )}

        {/* action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRunNowModal(true)}
            className="text-xs text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-300 rounded px-2 py-1 transition-colors"
          >
            Run Now
          </button>
          <button
            onClick={() => setHistoryModal(true)}
            className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 rounded px-2 py-1 transition-colors"
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

      {/* modals */}
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

// ─── Main Jobs Panel ─────────────────────────────────────────────────

function JobsPanel({ inline = false }) {
  const [jobs, setJobs] = useState([])
  const [availableTools, setAvailableTools] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)

  // when inline, always fetch on mount
  // when standalone, fetch on expand
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

  const fetchTools = useCallback(async () => {
    try {
      const cpiUrl = import.meta.env.VITE_CPI_MCP_URL || 'http://localhost:3001/mcp'
      const tools = await apiService.getMcpServerTools(cpiUrl)
      setAvailableTools(tools || [])
    } catch (err) {
      console.error('Failed to fetch tools:', err)
    }
  }, [])

  useEffect(() => {
    if (!expanded) return
    fetchJobs()
    fetchTools()
    const interval = setInterval(fetchJobs, 30000)
    return () => clearInterval(interval)
  }, [expanded, fetchJobs, fetchTools])

  const content = (
    <div className="space-y-2">
      <div className="flex justify-end">
        <button onClick={fetchJobs} className="text-xs text-blue-600 hover:text-blue-700">
          ↺ Refresh
        </button>
      </div>

      {!showCreateForm && (
        <button
          onClick={() => setShowCreateForm(true)}
          className="w-full text-xs text-blue-600 hover:text-blue-700 border border-dashed border-blue-300 hover:border-blue-400 rounded-lg py-2 transition-colors"
        >
          + Schedule New Job
        </button>
      )}

      {showCreateForm && (
        <CreateJobForm
          availableTools={availableTools}
          onJobCreated={() => { setShowCreateForm(false); fetchJobs(); }}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {loading && (
        <div className="space-y-2">
          {[1, 2].map(i => (
            <div key={i} className="h-20 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      )}

      {!loading && jobs.length === 0 && !showCreateForm && (
        <p className="text-xs text-gray-400 italic text-center py-2">
          No scheduled jobs. Create one above or via chat.
        </p>
      )}

      {!loading && jobs.map(job => (
        <JobCard key={job.id} job={job} onRefresh={fetchJobs} />
      ))}
    </div>
  )

  // inline mode — no wrapper, just content
  if (inline) return content

  // standalone mode — collapsible wrapper
  return (
    <div>
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="w-full flex items-center justify-between py-1 group"
      >
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer">
          Scheduled Jobs
          {jobs.length > 0 && (
            <span className="ml-2 bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full text-xs font-medium">
              {jobs.length}
            </span>
          )}
        </label>
        <span className="text-xs text-gray-400 group-hover:text-gray-600">
          {expanded ? '▲ collapse' : '▼ expand'}
        </span>
      </button>
      {expanded && content}
    </div>
  )
}

export default JobsPanel