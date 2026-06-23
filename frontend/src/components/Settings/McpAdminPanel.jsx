import { useState, useEffect } from 'react'
import apiService from '../../services/apiService'

function AddToolForm({ serverUrl, onToolAdded, onCancel }) {
    const [form, setForm] = useState({
        name: '',
        description: '',
        endpoint: '',
        method: 'GET',
        requiresCsrf: false,
        parameters: []
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    function addParameter() {
        setForm(prev => ({
            ...prev,
            parameters: [...prev.parameters, {
                name: '', type: 'string', required: true, description: '', location: 'path'
            }]
        }))
    }

    function removeParameter(index) {
        setForm(prev => ({
            ...prev,
            parameters: prev.parameters.filter((_, i) => i !== index)
        }))
    }

    function updateParameter(index, field, value) {
        setForm(prev => ({
            ...prev,
            parameters: prev.parameters.map((p, i) => i === index ? { ...p, [field]: value } : p)
        }))
    }

    async function handleSubmit() {
        if (!form.name || !form.description || !form.endpoint) {
            setError('Name, description and endpoint are required')
            return
        }
        setLoading(true)
        setError(null)
        try {
            const mockResponse = { status: 'SUCCESS', message: `${form.name} executed successfully` }
            form.parameters.forEach(p => {
                if (p.required) mockResponse[p.name] = `MOCK_${p.name.toUpperCase()}`
            })
            await apiService.addMcpTool(serverUrl, { ...form, mockResponse })
            await apiService.reloadMcpTools()
            onToolAdded()
        } catch (err) {
            setError(err.response?.data?.error || err.message)
        } finally {
            setLoading(false)
        }
    }

    const inputClass = 'w-full border border-[#e2e8f0] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white'
    const smallInputClass = 'border border-[#e2e8f0] rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white'

    return (
        <div className="bg-slate-50 border border-[#e2e8f0] rounded-lg p-4 mt-2">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Add New Tool</h4>
            <div className="space-y-3">

                <div>
                    <label className="block text-xs text-slate-500 mb-1">Tool Name</label>
                    <input type="text" value={form.name}
                        onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g. getIntegrationPackages"
                        className={inputClass}
                    />
                </div>

                <div>
                    <label className="block text-xs text-slate-500 mb-1">Description</label>
                    <textarea value={form.description}
                        onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Describe when the LLM should use this tool..."
                        rows={2}
                        className={`${inputClass} resize-none`}
                    />
                </div>

                <div>
                    <label className="block text-xs text-slate-500 mb-1">CPI Endpoint</label>
                    <input type="text" value={form.endpoint}
                        onChange={e => setForm(prev => ({ ...prev, endpoint: e.target.value }))}
                        placeholder="e.g. /api/v1/IntegrationPackages"
                        className={inputClass}
                    />
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <label className="block text-xs text-slate-500 mb-1">HTTP Method</label>
                        <select value={form.method}
                            onChange={e => setForm(prev => ({ ...prev, method: e.target.value }))}
                            className={inputClass}
                        >
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="DELETE">DELETE</option>
                            <option value="PUT">PUT</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2 mt-4">
                        <input type="checkbox" id="requiresCsrf" checked={form.requiresCsrf}
                            onChange={e => setForm(prev => ({ ...prev, requiresCsrf: e.target.checked }))}
                            className="w-4 h-4 accent-indigo-500"
                        />
                        <label htmlFor="requiresCsrf" className="text-xs text-slate-600">Requires CSRF</label>
                    </div>
                </div>

                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-xs text-slate-500">Parameters</label>
                        <button onClick={addParameter} className="text-xs text-indigo-500 hover:text-indigo-600">
                            + Add Parameter
                        </button>
                    </div>
                    {form.parameters.length === 0 && (
                        <p className="text-xs text-[#94a3b8] italic">No parameters</p>
                    )}
                    {form.parameters.map((param, index) => (
                        <div key={index} className="bg-white border border-[#e2e8f0] rounded-lg p-3 mb-2">
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <input type="text" value={param.name}
                                    onChange={e => updateParameter(index, 'name', e.target.value)}
                                    placeholder="Parameter name"
                                    className={smallInputClass}
                                />
                                <select value={param.type}
                                    onChange={e => updateParameter(index, 'type', e.target.value)}
                                    className={smallInputClass}
                                >
                                    <option value="string">string</option>
                                    <option value="number">number</option>
                                    <option value="boolean">boolean</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <select value={param.location}
                                    onChange={e => updateParameter(index, 'location', e.target.value)}
                                    className={smallInputClass}
                                >
                                    <option value="path">path</option>
                                    <option value="query">query</option>
                                </select>
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" checked={param.required}
                                        onChange={e => updateParameter(index, 'required', e.target.checked)}
                                        className="w-3 h-3 accent-indigo-500"
                                    />
                                    <span className="text-xs text-slate-600">Required</span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <input type="text" value={param.description}
                                    onChange={e => updateParameter(index, 'description', e.target.value)}
                                    placeholder="Description"
                                    className={`flex-1 ${smallInputClass}`}
                                />
                                <button onClick={() => removeParameter(index)}
                                    className="text-red-400 hover:text-red-600 text-xs"
                                >
                                    Remove
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {error && (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                        {error}
                    </p>
                )}

                <div className="flex gap-2">
                    <button onClick={handleSubmit} disabled={loading}
                        className="flex-1 bg-indigo-500 text-white text-xs font-medium py-2 rounded-lg hover:bg-indigo-600 disabled:bg-slate-300 transition-colors"
                    >
                        {loading ? 'Adding...' : 'Add Tool'}
                    </button>
                    <button onClick={onCancel}
                        className="flex-1 border border-[#e2e8f0] text-slate-600 text-xs py-2 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                        Cancel
                    </button>
                </div>

            </div>
        </div>
    )
}

function ToolCard({ tool, serverUrl, onToolRemoved, removable = true }) {
    const [removing, setRemoving] = useState(false)

    async function handleRemove() {
        if (!confirm(`Remove tool "${tool.name}"? This cannot be undone.`)) return
        setRemoving(true)
        try {
            await apiService.removeMcpTool(serverUrl, tool.name)
            await apiService.reloadMcpTools()
            onToolRemoved()
        } catch (err) {
            console.error('Failed to remove tool:', err)
        } finally {
            setRemoving(false)
        }
    }

    return (
        <div className="bg-white border border-[#e2e8f0] rounded-lg px-3 py-2 flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[#0f172a] truncate">{tool.name}</p>
                <p className="text-xs text-[#94a3b8] truncate">{tool.description}</p>
                <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        tool.method === 'GET'    ? 'bg-indigo-100 text-indigo-700' :
                        tool.method === 'POST'   ? 'bg-green-100 text-green-700' :
                        tool.method === 'PUT'    ? 'bg-amber-100 text-amber-700' :
                        tool.method === 'DELETE' ? 'bg-red-100 text-red-700' :
                        tool.method === 'MCP'    ? 'bg-purple-100 text-purple-700' :
                                                   'bg-slate-100 text-slate-600'
                    }`}>
                        {tool.method}
                    </span>
                    {tool.requiresCsrf && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">
                            CSRF
                        </span>
                    )}
                    <span className="text-xs text-[#94a3b8]">
                        {tool.parameters?.length || 0} params
                    </span>
                </div>
            </div>
            {removable && (
                <button onClick={handleRemove} disabled={removing}
                    className="text-red-400 hover:text-red-600 text-xs flex-shrink-0 disabled:opacity-50"
                >
                    {removing ? '...' : 'Remove'}
                </button>
            )}
        </div>
    )
}

// servers where tools can be dynamically added/removed via UI
const DYNAMIC_TOOL_SERVERS = ['cpi', 'excel']

// browser-accessible MCP URL for each server
// must use VITE env vars — never use the backend's adminUrl which contains
// Docker-internal service names that the browser cannot resolve
function getMcpUrl(serverName) {
  switch (serverName) {
    case 'cpi':       return import.meta.env.VITE_CPI_MCP_URL       || 'http://localhost:3001/mcp'
    case 'scheduler': return import.meta.env.VITE_SCHEDULER_MCP_URL  || 'http://localhost:3002/mcp'
    default:          return import.meta.env.VITE_EXCEL_MCP_URL      || 'http://localhost:3003/mcp'
  }
}

function ServerCard({ server, tools, onRefresh }) {
  const [expanded, setExpanded] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

  const serverUrl = getMcpUrl(server.name)
  const isDynamic = DYNAMIC_TOOL_SERVERS.includes(server.name)

  return (
    <div className="border border-[#e2e8f0] rounded-lg overflow-hidden">

      <button
        onClick={() => setExpanded(prev => !prev)}
        className="w-full bg-slate-50 px-3 py-2.5 flex items-center justify-between hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${server.connected ? 'bg-green-500' : 'bg-red-400'}`} />
          <span className="text-xs font-medium text-slate-700">{server.name}</span>
          <span className="text-xs text-[#94a3b8]">{server.toolCount} tools</span>
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div>
          <div className="p-2 space-y-1.5">
            {(tools || []).length === 0 && (
              <p className="text-xs text-[#94a3b8] italic px-1">No tools found</p>
            )}
            {(tools || []).map(tool => (
              <ToolCard
                key={tool.name}
                tool={tool}
                serverUrl={serverUrl}
                onToolRemoved={onRefresh}
                removable={isDynamic}
              />
            ))}
          </div>

          {isDynamic && (
            showAddForm ? (
              <div className="px-2 pb-2">
                <AddToolForm
                  serverUrl={serverUrl}
                  onToolAdded={() => {
                    setShowAddForm(false)
                    onRefresh()
                  }}
                  onCancel={() => setShowAddForm(false)}
                />
              </div>
            ) : (
              <div className="px-2 pb-2">
                <button
                  onClick={() => setShowAddForm(true)}
                  className="w-full text-xs text-indigo-500 hover:text-indigo-600 border border-dashed border-indigo-200 hover:border-indigo-300 rounded-lg py-2 transition-colors"
                >
                  + Add Tool
                </button>
              </div>
            )
          )}
        </div>
      )}

    </div>
  )
}

function McpAdminPanel({ inline = false }) {
  const [servers, setServers] = useState([])
  const [serverTools, setServerTools] = useState({})
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [reloading, setReloading] = useState(false)

  async function fetchData() {
    setLoading(true)
    try {
      const data = await apiService.getMcpServers()
      setServers(data.servers || [])

      const toolsMap = {}
      for (const server of (data.servers || [])) {
        try {
          const tools = await apiService.getMcpServerTools(getMcpUrl(server.name))
          toolsMap[server.name] = tools
        } catch (err) {
          console.error(`Failed to fetch tools for ${server.name}:`, err)
          toolsMap[server.name] = []
        }
      }
      setServerTools(toolsMap)
    } catch (err) {
      console.error('Failed to fetch MCP data:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleReload() {
    setReloading(true)
    try {
      await apiService.reloadMcpTools()
      await fetchData()
    } finally {
      setReloading(false)
    }
  }

  useEffect(() => {
    if (inline || expanded) fetchData()
  }, [inline, expanded])

  const content = (
    <div className="space-y-2">

      <div className="flex justify-end">
        <button
          onClick={handleReload}
          disabled={reloading}
          className="text-xs text-indigo-500 hover:text-indigo-600 disabled:opacity-50 flex items-center gap-1"
        >
          <svg className={`w-3.5 h-3.5 ${reloading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          {reloading ? 'Reloading...' : 'Reload'}
        </button>
      </div>

      {loading && (
        <div className="space-y-2">
          {[1, 2].map(i => (
            <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {!loading && servers.length === 0 && (
        <p className="text-xs text-[#94a3b8] italic text-center py-4">No MCP servers connected</p>
      )}

      {!loading && servers.map(server => (
        <ServerCard
          key={server.name}
          server={server}
          tools={serverTools[server.name]}
          onRefresh={fetchData}
        />
      ))}

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
          MCP Servers
        </label>
        <span className="text-xs text-[#94a3b8] group-hover:text-slate-600">
          {expanded ? '▲ collapse' : '▼ expand'}
        </span>
      </button>
      {expanded && content}
    </div>
  )
}

export default McpAdminPanel
