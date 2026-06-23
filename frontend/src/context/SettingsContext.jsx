import { createContext, useContext, useState, useEffect } from 'react'
import apiService from '../services/apiService'

const DEFAULT_SETTINGS = {
    provider: 'groq',
    apiKey: '',
    mockMode: false   // default to real CPI API
}

const DEFAULT_ENVIRONMENTS = {
    list: [],
    activeId: null
}

const SettingsContext = createContext(null)

export function SettingsProvider({ children }) {

    const [settings, setSettings] = useState(() => {
        try {
            const saved = localStorage.getItem('cpi-agent-settings')
            return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS
        } catch {
            return DEFAULT_SETTINGS
        }
    })

    const [environments, setEnvironments] = useState(() => {
        try {
            const saved = localStorage.getItem('cpi-environments')
            if (saved) return JSON.parse(saved)

            // migrate from the legacy single-environment key if it has data
            const legacy = localStorage.getItem('cpi-environment')
            if (legacy) {
                const parsed = JSON.parse(legacy)
                if (parsed.cpiBaseUrl || parsed.tokenUrl) {
                    const id = `env_${Date.now()}`
                    const migrated = {
                        list: [{ id, name: 'Default', ...parsed }],
                        activeId: id
                    }
                    localStorage.setItem('cpi-environments', JSON.stringify(migrated))
                    return migrated
                }
            }

            return DEFAULT_ENVIRONMENTS
        } catch {
            return DEFAULT_ENVIRONMENTS
        }
    })

    const [providers, setProviders] = useState([])
    const [providersLoading, setProvidersLoading] = useState(true)

    // computed — the currently active environment object
    const activeEnvironment = environments.list.find(e => e.id === environments.activeId) || null

    // auto-push active credentials on every app startup
    // this re-hydrates the CPI MCP server's in-memory store after a Docker restart
    useEffect(() => {
        if (activeEnvironment) {
            apiService.saveEnvironment(activeEnvironment)
                .catch(err => console.warn('[Settings] Auto-push on startup failed:', err.message))
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        async function fetchProviders() {
            try {
                const list = await apiService.getProviders()
                setProviders(list)
            } catch {
                setProviders(['ollama', 'groq', 'claude', 'openai'])
            } finally {
                setProvidersLoading(false)
            }
        }
        fetchProviders()
    }, [])

    function updateSettings(updates) {
        setSettings(prev => {
            const next = { ...prev, ...updates }
            try { localStorage.setItem('cpi-agent-settings', JSON.stringify(next)) } catch { }
            return next
        })
    }

    function persistEnvironments(next) {
        setEnvironments(next)
        try { localStorage.setItem('cpi-environments', JSON.stringify(next)) } catch { }
    }

    function addEnvironment(env) {
        const id = `env_${Date.now()}`
        const newEnv = { id, ...env }
        const isFirst = environments.list.length === 0
        const next = {
            list: [...environments.list, newEnv],
            activeId: isFirst ? id : environments.activeId
        }
        persistEnvironments(next)
        // auto-activate and push if this is the first environment
        if (isFirst) {
            apiService.saveEnvironment(newEnv)
                .catch(err => console.warn('[Settings] Push first env failed:', err.message))
        }
        return newEnv
    }

    function updateEnvironmentById(id, updates) {
        const next = {
            ...environments,
            list: environments.list.map(e => e.id === id ? { ...e, ...updates } : e)
        }
        persistEnvironments(next)
        // re-push if the active env was edited
        if (environments.activeId === id) {
            const updated = { ...environments.list.find(e => e.id === id), ...updates }
            apiService.saveEnvironment(updated)
                .catch(err => console.warn('[Settings] Re-push edited active env failed:', err.message))
        }
    }

    function deleteEnvironment(id) {
        const remaining = environments.list.filter(e => e.id !== id)
        const newActiveId = environments.activeId === id
            ? (remaining[0]?.id || null)
            : environments.activeId
        persistEnvironments({ list: remaining, activeId: newActiveId })
    }

    // setActiveEnvironment pushes credentials to the CPI MCP server immediately
    async function setActiveEnvironment(id) {
        const env = environments.list.find(e => e.id === id)
        if (!env) return
        persistEnvironments({ ...environments, activeId: id })
        await apiService.saveEnvironment(env)
    }

    function resetSettings() {
        setSettings(DEFAULT_SETTINGS)
        localStorage.removeItem('cpi-agent-settings')
    }

    return (
        <SettingsContext.Provider value={{
            settings,
            environments,
            activeEnvironment,
            providers,
            providersLoading,
            updateSettings,
            addEnvironment,
            updateEnvironmentById,
            deleteEnvironment,
            setActiveEnvironment,
            resetSettings
        }}>
            {children}
        </SettingsContext.Provider>
    )
}

export function useSettings() {
    const context = useContext(SettingsContext)
    if (!context) throw new Error('useSettings must be used inside SettingsProvider')
    return context
}
