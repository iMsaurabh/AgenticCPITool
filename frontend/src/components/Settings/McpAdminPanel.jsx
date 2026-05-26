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

    return (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-2">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Add New Tool</h4>
            <div className="space-y-3">

                <div>
                    <label className="block text-xs text-gray-500 mb-1">Tool Name</label>
                    <input type="text" value={form.name}
                        onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g. getIntegrationPackages"
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div>
                    <label className="block text-xs text-gray-500 mb-1">Description</label>
                    <textarea value={form.description}
                        onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Describe when the LLM should use this tool..."
                        rows={2}
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                </div>

                <div>
                    <label className="block text-xs text-gray-500 mb-1">CPI Endpoint</label>
                    <input type="text" value={form.endpoint}
                        onChange={e => setForm(prev => ({ ...prev, endpoint: e.target.value }))}
                        placeholder="e.g. /api/v1/IntegrationPackages"
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">HTTP Method</label>
                        <select value={form.method}
                            onChange={e => setForm(prev => ({ ...prev, method: e.target.value }))}
                            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                            className="w-4 h-4"
                        />
                        <label htmlFor="requiresCsrf" className="text-xs text-gray-600">Requires CSRF</label>
                    </div>
                </div>

                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-xs text-gray-500">Parameters</label>
                        <button onClick={addParameter} className="text-xs text-blue-600 hover:text-blue-700">
                            + Add Parameter
                        </button>
                    </div>
                    {form.parameters.length === 0 && (
                        <p className="text-xs text-gray-400 italic">No parameters</p>
                    )}
                    {form.parameters.map((param, index) => (
                        <div key={index} className="bg-white border border-gray-200 rounded-lg p-3 mb-2">
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <input type="text" value={param.name}
                                    onChange={e => updateParameter(index, 'name', e.target.value)}
                                    placeholder="Parameter name"
                                    className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                <select value={param.type}
                                    onChange={e => updateParameter(index, 'type', e.target.value)}
                                    className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                    <option value="string">string</option>
                                    <option value="number">number</option>
                                    <option value="boolean">boolean</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <select value={param.location}
                                    onChange={e => updateParameter(index, 'location', e.target.value)}
                                    className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                    <option value="path">path</option>
                                    <option value="query">query</option>
                                </select>
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" checked={param.required}
                                        onChange={e => updateParameter(index, 'required', e.target.checked)}
                                        className="w-3 h-3"
                                    />
                                    <span className="text-xs text-gray-600">Required</span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <input type="text" value={param.description}
                                    onChange={e => updateParameter(index, 'description', e.target.value)}
                                    placeholder="Description"
                                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                        className="flex-1 bg-blue-600 text-white text-xs font-medium py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
                    >
                        {loading ? 'Adding...' : 'Add Tool'}
                    </button>
                    <button onClick={onCancel}
                        className="flex-1 border border-gray-300 text-gray-600 text-xs py-2 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                </div>

            </div>
        </div>
    )
}

function ToolCard({ tool, serverUrl, onToolRemoved }) {
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
        <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 truncate">{tool.name}</p>
                <p className="text-xs text-gray-400 truncate">{tool.description}</p>
                <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        tool.method === 'GET'    ? 'bg-blue-100 text-blue-700' :
                        tool.method === 'POST'   ? 'bg-green-100 text-green-700' :
                        tool.method === 'PUT'    ? 'bg-amber-100 text-amber-700' :
                        tool.method === 'DELETE' ? 'bg-red-100 text-red-700' :
                                                   'bg-gray-100 text-gray-600'
                    }`}>
                        {tool.method}
                    </span>
                    {tool.requiresCsrf && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">
                            CSRF
                        </span>
                    )}
                    <span className="text-xs text-gray-400">
                        {tool.parameters?.length || 0} params
                    </span>
                </div>
            </div>
            <button onClick={handleRemove} disabled={removing}
                className="text-red-400 hover:text-red-600 text-xs flex-shrink-0 disabled:opacity-50"
            >
                {removing ? '...' : 'Remove'}
            </button>
        </div>
    )
}

// ServerCard — collapsible server with tools and add tool form
function ServerCard({ server, tools, onRefresh }) {
  const [expanded, setExpanded] = useState(false)
  console.log(`ServerCard render: ${server.name}, expanded: ${expanded}, tools:`, tools)
  const [showAddForm, setShowAddForm] = useState(false)

  const serverUrl = server.name === 'cpi'
    ? (import.meta.env.VITE_CPI_MCP_URL || 'http://localhost:3001/mcp')
    : (import.meta.env.VITE_SCHEDULER_MCP_URL || 'http://localhost:3002/mcp')

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">

      {/* server header */}
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="w-full bg-gray-50 px-3 py-2 flex items-center justify-between hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${server.connected ? 'bg-green-500' : 'bg-red-400'}`} />
          <span className="text-xs font-medium text-gray-700">{server.name}</span>
          <span className="text-xs text-gray-400">{server.toolCount} tools</span>
        </div>
        <span className="text-xs text-gray-400">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div>
          {/* tool list */}
          <div className="p-2 space-y-1.5">
            {server.name === 'scheduler' ? (
              <p className="text-xs text-gray-400 italic px-1">
                Scheduler tools are built-in. Use chat to manage scheduled jobs.
              </p>
            ) : (
              <>
                {(tools || []).length === 0 && (
                  <p className="text-xs text-gray-400 italic px-1">No tools configured</p>
                )}
                {(tools || []).map(tool => (
                  <ToolCard
                    key={tool.name}
                    tool={tool}
                    serverUrl={serverUrl}
                    onToolRemoved={onRefresh}
                  />
                ))}
              </>
            )}
          </div>

          {/* add tool button — only for manageable servers */}
          {server.name !== 'scheduler' && (
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
                  className="w-full text-xs text-blue-600 hover:text-blue-700 border border-dashed border-blue-300 hover:border-blue-400 rounded-lg py-2 transition-colors"
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
        // scheduler tools are hardcoded — no admin/tools endpoint
        // only fetch tools from servers that support dynamic tool management
        if (server.name === 'scheduler') {
          toolsMap[server.name] = [] // tools not manageable via UI
          continue
        }

        const mcpUrl = server.name === 'cpi'
          ? (import.meta.env.VITE_CPI_MCP_URL || 'http://localhost:3001/mcp')
          : (import.meta.env.VITE_SCHEDULER_MCP_URL || 'http://localhost:3002/mcp')

        const tools = await apiService.getMcpServerTools(mcpUrl)
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

  // handleReload MUST be defined before content block
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

  // content block uses handleReload — safe because it is defined above
const content = (
  <div className="space-y-2">

    {/* reload button */}
    <div className="flex justify-end">
      <button
        onClick={handleReload}
        disabled={reloading}
        className="text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50"
      >
        {reloading ? 'Reloading...' : '↺ Reload'}
      </button>
    </div>

    {/* loading state */}
    {loading && (
      <div className="space-y-2">
        {[1, 2].map(i => (
          <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    )}

    {/* empty state */}
    {!loading && servers.length === 0 && (
      <p className="text-xs text-gray-400 italic">No MCP servers connected</p>
    )}

    {/* server list */}
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
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer">
          MCP Servers
        </label>
        <span className="text-xs text-gray-400 group-hover:text-gray-600">
          {expanded ? '▲ collapse' : '▼ expand'}
        </span>
      </button>
      {expanded && content}
    </div>
  )
}

export default McpAdminPanel