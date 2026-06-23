import { useState } from 'react'
import { useSettings } from '../../context/SettingsContext'

function EyeOffIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

const EMPTY_FORM = { name: '', cpiBaseUrl: '', tokenUrl: '', clientId: '', clientSecret: '' }

function EnvironmentForm({ initial = EMPTY_FORM, onSave, onCancel, saveLabel = 'Save Environment' }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial })
  const [showSecret, setShowSecret] = useState(false)
  const [error, setError] = useState(null)

  function validate() {
    if (!form.name.trim())          return 'Name is required'
    if (!form.cpiBaseUrl.trim())    return 'CPI Base URL is required'
    if (!form.tokenUrl.trim())      return 'Token URL is required'
    if (!form.clientId.trim())      return 'Client ID is required'
    if (!form.clientSecret.trim())  return 'Client Secret is required'
    return null
  }

  function handleSave() {
    const err = validate()
    if (err) { setError(err); return }
    setError(null)
    onSave(form)
  }

  const inputClass = `
    w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-[#0f172a]
    placeholder:text-[#94a3b8] bg-white
    focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
  `

  return (
    <div className="bg-slate-50 border border-[#e2e8f0] rounded-xl p-4 space-y-3">

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1.5">Environment Name</label>
        <input type="text" value={form.name}
          onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          placeholder="e.g. Development, Production, QA"
          className={inputClass}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1.5">CPI Base URL</label>
        <input type="text" value={form.cpiBaseUrl}
          onChange={e => setForm(p => ({ ...p, cpiBaseUrl: e.target.value }))}
          placeholder="https://your-tenant.it-cpi001.cfapps.eu10.hana.ondemand.com"
          className={inputClass}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1.5">Token URL</label>
        <input type="text" value={form.tokenUrl}
          onChange={e => setForm(p => ({ ...p, tokenUrl: e.target.value }))}
          placeholder="https://your-tenant.authentication.eu10.hana.ondemand.com/oauth/token"
          className={inputClass}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1.5">Client ID</label>
        <input type="text" value={form.clientId}
          onChange={e => setForm(p => ({ ...p, clientId: e.target.value }))}
          placeholder="OAuth2 client ID"
          className={inputClass}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1.5">Client Secret</label>
        <div className="relative">
          <input
            type={showSecret ? 'text' : 'password'}
            value={form.clientSecret}
            onChange={e => setForm(p => ({ ...p, clientSecret: e.target.value }))}
            placeholder="OAuth2 client secret"
            className={`${inputClass} pr-9`}
          />
          <button type="button" onClick={() => setShowSecret(p => !p)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            {showSecret ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
      )}

      <div className="flex gap-2 pt-1">
        <button onClick={handleSave}
          className="flex-1 bg-indigo-500 text-white text-sm font-medium py-2 rounded-lg hover:bg-indigo-600 transition-colors"
        >
          {saveLabel}
        </button>
        <button onClick={onCancel}
          className="flex-1 border border-[#e2e8f0] text-slate-600 text-sm py-2 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
      </div>

    </div>
  )
}

function EnvironmentCard({ env, isActive, onActivate, onEdit, onDelete }) {
  const [activating, setActivating] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleActivate() {
    if (isActive) return
    setActivating(true)
    try { await onActivate(env.id) } finally { setActivating(false) }
  }

  return (
    <div className={`border rounded-xl p-4 transition-colors ${
      isActive ? 'border-indigo-200 bg-indigo-50/40' : 'border-[#e2e8f0] bg-white'
    }`}>
      <div className="flex items-start justify-between gap-3">

        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 ${
            isActive ? 'bg-green-500' : 'bg-slate-300'
          }`} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#0f172a]">{env.name}</p>
            <p className="text-xs text-[#94a3b8] truncate mt-0.5">
              {env.cpiBaseUrl || 'No URL configured'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isActive ? (
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
              Active
            </span>
          ) : (
            <button
              onClick={handleActivate}
              disabled={activating}
              className="text-xs text-indigo-500 hover:text-indigo-600 border border-indigo-200 hover:border-indigo-300 rounded-lg px-2.5 py-1 transition-colors disabled:opacity-50"
            >
              {activating ? 'Activating...' : 'Use This'}
            </button>
          )}

          <button onClick={() => { setConfirmDelete(false); onEdit(env) }}
            className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 transition-colors"
            title="Edit"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>

          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button onClick={() => onDelete(env.id)}
                className="text-xs text-red-600 border border-red-300 rounded px-1.5 py-0.5 hover:bg-red-50 transition-colors"
              >
                Delete
              </button>
              <button onClick={() => setConfirmDelete(false)}
                className="text-xs text-slate-500 border border-[#e2e8f0] rounded px-1.5 py-0.5 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)}
              className="p-1 text-slate-400 hover:text-red-400 rounded hover:bg-red-50 transition-colors"
              title="Delete"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </button>
          )}
        </div>

      </div>
    </div>
  )
}

function EnvironmentPanel() {
  const { environments, activeEnvironment, addEnvironment, updateEnvironmentById, deleteEnvironment, setActiveEnvironment } = useSettings()
  const [creating, setCreating] = useState(false)
  const [editingEnv, setEditingEnv] = useState(null)
  const [pushError, setPushError] = useState(null)

  async function handleActivate(id) {
    setPushError(null)
    try {
      await setActiveEnvironment(id)
    } catch (err) {
      setPushError('Could not push credentials to server: ' + (err.response?.data?.error || err.message))
    }
  }

  function handleCreate(form) {
    addEnvironment(form)
    setCreating(false)
  }

  function handleUpdate(form) {
    updateEnvironmentById(editingEnv.id, form)
    setEditingEnv(null)
  }

  const { list, activeId } = environments

  return (
    <div className="max-w-xl mx-auto p-6 space-y-5">

      <div>
        <h2 className="text-base font-semibold text-[#0f172a]">CPI Environments</h2>
        <p className="text-sm text-[#94a3b8] mt-1">
          Save multiple CPI tenants and switch between them instantly. The active environment's credentials are pushed to the server automatically on startup.
        </p>
      </div>

      {pushError && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
          {pushError}
        </div>
      )}

      {!creating && (
        <button
          onClick={() => { setCreating(true); setEditingEnv(null) }}
          className="w-full flex items-center justify-center gap-2 text-sm text-indigo-500 hover:text-indigo-600 border border-dashed border-indigo-200 hover:border-indigo-300 rounded-xl px-4 py-2.5 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Environment
        </button>
      )}

      {creating && (
        <EnvironmentForm
          onSave={handleCreate}
          onCancel={() => setCreating(false)}
          saveLabel="Create Environment"
        />
      )}

      {list.length === 0 && !creating && (
        <div className="text-center py-10">
          <svg className="w-8 h-8 mx-auto mb-3 text-slate-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <p className="text-sm text-slate-500">No environments yet</p>
          <p className="text-xs text-[#94a3b8] mt-1">Create one above to configure your CPI connection</p>
        </div>
      )}

      {list.length > 0 && (
        <div className="space-y-2">
          {list.map(env => (
            editingEnv?.id === env.id ? (
              <EnvironmentForm
                key={env.id}
                initial={env}
                onSave={handleUpdate}
                onCancel={() => setEditingEnv(null)}
                saveLabel="Update Environment"
              />
            ) : (
              <EnvironmentCard
                key={env.id}
                env={env}
                isActive={env.id === activeId}
                onActivate={handleActivate}
                onEdit={env => { setEditingEnv(env); setCreating(false) }}
                onDelete={id => deleteEnvironment(id)}
              />
            )
          ))}
        </div>
      )}

      {activeEnvironment && (
        <p className="text-xs text-[#94a3b8] pt-1">
          Credentials are stored in your browser and re-pushed to the server on every page load — no action needed after a Docker restart.
        </p>
      )}

    </div>
  )
}

export default EnvironmentPanel
