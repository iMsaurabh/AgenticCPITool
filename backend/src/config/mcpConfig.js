// mcpConfig is the central registry of all MCP servers
// the backend connects to as an MCP client.
//
// Each entry defines one MCP server:
//   name: identifier used internally
//   url: SSE endpoint the client connects to
//   enabled: toggle without removing the entry
//   description: what this server provides
//
// Adding a new MCP server to the ecosystem:
//   1. Start the new MCP server
//   2. Add one entry here
//   3. Backend discovers its tools automatically on next startup
//
// No agent code, no tool registry changes needed.

const mcpConfig = {
    servers: [
        {
            name: 'cpi',
            url: process.env.CPI_MCP_URL || 'http://localhost:3001/mcp',
            enabled: true,
            description: 'SAP Cloud Platform Integration tools'
        },
        {
            name: 'scheduler',
            url: process.env.SCHEDULER_MCP_URL || 'http://localhost:3002/mcp',
            enabled: true,
            description: 'Job scheduling and automation tools'
        },
        {
            name: 'excel',
            url: process.env.EXCEL_MCP_URL || 'http://localhost:3003/mcp',
            enabled: true,
            description: 'Upload, read, parse excel files'
        }
    ]
};

module.exports = mcpConfig;