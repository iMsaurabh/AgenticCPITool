// apiService is the single point of contact between the frontend
// and the backend API. All HTTP calls go through here.
//
// Same principle as the backend service layer —
// components never call axios directly, they call apiService.
// Swapping the backend URL or adding auth headers
// requires changes in one place only.

import axios from 'axios'

// base URL from environment variable
// in development this points to Vite proxy (localhost:5173)
// in production this points to actual backend URL
const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

const apiService = {

  // sendMessage sends a chat message to the orchestrator agent
  // provider and apiKey come from user settings
  async sendMessage(message, provider, apiKey, mockMode, history = []) {
    const response = await api.post('/api/chat', {
      message,
      provider,
      apiKey: apiKey || null,
      mockMode: mockMode !== undefined ? mockMode : true,
      // send only last 10 messages to avoid token limit issues
      history: history.slice(-5).map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      }))
    })
    return response.data
  },

  // uploadFile sends an Excel file to the batch execution endpoint
  async uploadFile(formData) {
    const response = await axios.post(`${BASE_URL}/api/chat/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data
  },

  // getProviders fetches available AI providers from backend
  // used to populate the provider dropdown in settings
  async getProviders() {
    const response = await api.get('/api/providers')
    return response.data.providers
  },

  // checkHealth verifies backend is reachable
  // used by status bar to show connection state
  async checkHealth() {
    const response = await api.get('/health')
    return response.data
  },

  // add these methods to the apiService object

  // getMcpServers returns connected MCP servers and their tools
  async getMcpServers() {
    const response = await api.get('/api/mcp/servers');
    return response.data;
  },

  // reloadMcpTools re-initializes MCP client after tool changes
  async reloadMcpTools() {
    const response = await api.post('/api/mcp/reload');
    return response.data;
  },

  // getMcpTools returns all tools from a specific MCP server
  // calls the MCP server's admin endpoint directly
  async getMcpServerTools(serverUrl) {
    const response = await axios.get(`${serverUrl.replace('/mcp', '')}/admin/tools`);
    return response.data.tools;
  },

  // addMcpTool adds a new tool to a specific MCP server
  async addMcpTool(serverUrl, toolConfig) {
    const baseUrl = serverUrl.replace('/mcp', '');
    const response = await axios.post(`${baseUrl}/admin/tools`, toolConfig);
    // restart MCP server to pick up new tool
    try {
      await axios.post(`${baseUrl}/admin/restart-tools`);
    } catch {
      // ignore restart errors — server is restarting
    }
    return response.data;
  },

  // removeMcpTool removes a tool from a specific MCP server
  async removeMcpTool(serverUrl, toolName) {
    const baseUrl = serverUrl.replace('/mcp', '');
    const response = await axios.delete(`${baseUrl}/admin/tools/${toolName}`);
    // restart MCP server to pick up tool removal
    try {
      await axios.post(`${baseUrl}/admin/restart-tools`);
    } catch {
      // ignore restart errors — server is restarting
    }
    return response.data;
  },

  // ─── Jobs API ────────────────────────────────────────────────────────

  // getAllJobs fetches all scheduled jobs from scheduler MCP server
  async getAllJobs() {
    const baseUrl = (import.meta.env.VITE_SCHEDULER_MCP_URL || 'http://localhost:3002/mcp')
      .replace('/mcp', '')
    const response = await axios.get(`${baseUrl}/admin/jobs`)
    return response.data.jobs
  },

  // getJobHistory fetches execution history for a specific job
  async getJobHistory(jobId) {
    const baseUrl = (import.meta.env.VITE_SCHEDULER_MCP_URL || 'http://localhost:3002/mcp')
      .replace('/mcp', '')
    const response = await axios.get(`${baseUrl}/admin/jobs/${jobId}/history`)
    return response.data.executions
  },

  // toggleJob enables or disables a job
  async toggleJob(jobId, enabled) {
    const baseUrl = (import.meta.env.VITE_SCHEDULER_MCP_URL || 'http://localhost:3002/mcp')
      .replace('/mcp', '')
    const response = await axios.post(`${baseUrl}/admin/jobs/${jobId}/toggle`, { enabled })
    return response.data
  },

  // deleteJob removes a job permanently
  async deleteJob(jobId) {
    const baseUrl = (import.meta.env.VITE_SCHEDULER_MCP_URL || 'http://localhost:3002/mcp')
      .replace('/mcp', '')
    const response = await axios.delete(`${baseUrl}/admin/jobs/${jobId}`)
    return response.data
  },

  // runJobNow triggers immediate execution of a job
  async runJobNow(jobId, keepSchedule) {
    const baseUrl = (import.meta.env.VITE_SCHEDULER_MCP_URL || 'http://localhost:3002/mcp')
      .replace('/mcp', '')
    const response = await axios.post(`${baseUrl}/admin/jobs/${jobId}/run`, { keepSchedule })
    return response.data
  },

  // createJobFromUI creates a job directly from UI without chat
  async createJobFromUI(jobConfig) {
    const baseUrl = (import.meta.env.VITE_SCHEDULER_MCP_URL || 'http://localhost:3002/mcp')
      .replace('/mcp', '')
    const response = await axios.post(`${baseUrl}/admin/jobs`, jobConfig)
    return response.data
  }

}

export default apiService