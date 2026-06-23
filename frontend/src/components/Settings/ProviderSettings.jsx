import { useState, useEffect } from 'react'
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

function ProviderSettings() {
  const { settings, providers, providersLoading, updateSettings } = useSettings()
  const [apiKeyDraft, setApiKeyDraft] = useState(settings.apiKey)
  const [showApiKey, setShowApiKey] = useState(false)
  const [saved, setSaved] = useState(false)

  // keep draft in sync if settings change from outside this component
  useEffect(() => {
    setApiKeyDraft(settings.apiKey)
  }, [settings.apiKey])

  function flash() {
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  function handleProviderChange(provider) {
    updateSettings({ provider })
    flash()
  }

  function handleMockToggle() {
    updateSettings({ mockMode: !settings.mockMode })
    flash()
  }

  function handleApiKeyBlur() {
    if (apiKeyDraft !== settings.apiKey) {
      updateSettings({ apiKey: apiKeyDraft })
      flash()
    }
  }

  const inputClass = `
    w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-[#0f172a]
    focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white
  `
  const labelClass = 'block text-xs font-medium text-slate-500 mb-1.5'

  return (
    <div className="space-y-5">

      <div>
        <label className={labelClass}>AI Provider</label>
        {providersLoading ? (
          <div className="h-9 bg-slate-100 rounded-lg animate-pulse" />
        ) : (
          <select
            value={settings.provider}
            onChange={e => handleProviderChange(e.target.value)}
            className={inputClass}
          >
            {providers.map(p => (
              <option key={p} value={p}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <label className={labelClass}>API Key</label>
        <div className="relative">
          <input
            type={showApiKey ? 'text' : 'password'}
            value={apiKeyDraft}
            onChange={e => setApiKeyDraft(e.target.value)}
            onBlur={handleApiKeyBlur}
            placeholder={`${settings.provider} API key (optional)`}
            className={`${inputClass} pr-9`}
          />
          <button onClick={() => setShowApiKey(p => !p)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            {showApiKey ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
        <p className="text-xs text-[#94a3b8] mt-1">Saved automatically when you leave the field</p>
      </div>

      <div className="flex items-center justify-between py-1">
        <div>
          <p className="text-xs font-medium text-slate-500">Mock Mode</p>
          <p className="text-xs text-[#94a3b8] mt-0.5">
            {settings.mockMode ? 'Using simulated CPI data' : 'Calling real CPI API'}
          </p>
        </div>
        <button
          onClick={handleMockToggle}
          className={`
            relative h-6 w-11 rounded-full transition-colors duration-200 flex-shrink-0
            ${settings.mockMode ? 'bg-indigo-500' : 'bg-slate-300'}
          `}
        >
          <span className={`
            absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow-sm
            transition-transform duration-200
            ${settings.mockMode ? 'translate-x-5' : 'translate-x-0'}
          `} />
        </button>
      </div>

      {saved && (
        <p className="text-xs text-green-600 text-right">✓ Saved</p>
      )}

    </div>
  )
}

export default ProviderSettings
