// mcpClient manages connections to all registered MCP servers.
// It is the bridge between the backend agent and MCP tool servers.
//
// Responsibilities:
//   - Connect to each enabled MCP server on startup
//   - Discover tools from each server via tools/list
//   - Execute tool calls via tools/call
//   - Aggregate tools from all servers into one flat list
//
// The agent never knows which MCP server owns which tool.
// mcpClient handles routing tool calls to the correct server.
//
// This implements the MCP Host role in the MCP architecture.

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { SSEClientTransport } = require('@modelcontextprotocol/sdk/client/sse.js');
const mcpConfig = require('../config/mcpConfig');

// serverClients maps server name to connected MCP Client instance
const serverClients = {};

// toolServerMap maps tool name to server name for routing
// when LLM calls a tool, we look up which server owns it
const toolServerMap = {};

// allTools is the aggregated flat list of tools from all servers
// sent to the LLM so it knows what is available
let allTools = [];

// setMockMode notifies all connected MCP servers of mock mode change
// called when user toggles mock mode in UI
async function setMockMode(mockMode) {
    const axios = require('axios');

    for (const serverConfig of mcpConfig.servers) {
        if (!serverConfig.enabled) continue;
        try {
            const baseUrl = serverConfig.url.replace('/mcp', '');
            await axios.post(`${baseUrl}/admin/mock`, { mockMode });
            console.log(`[MCP Client] Set mock mode ${mockMode} on ${serverConfig.name}`);
        } catch (err) {
            console.warn(`[MCP Client] Failed to set mock mode on ${serverConfig.name}:`, err.message);
        }
    }
}

// connectToServer establishes MCP connection to a single server
// returns connected client or null if connection fails
async function connectToServer(serverConfig) {
    try {
        console.log(`[MCP Client] Connecting to ${serverConfig.name} at ${serverConfig.url}`);

        const client = new Client(
            {
                name: 'cpi-agent-backend',
                version: '1.0.0'
            },
            {
                capabilities: {
                    tools: {}
                }
            }
        );

        // SSEClientTransport connects to the MCP server's SSE endpoint
        const transport = new SSEClientTransport(new URL(serverConfig.url));

        await client.connect(transport);
        console.log(`[MCP Client] Connected to ${serverConfig.name}`);

        return client;

    } catch (err) {
        console.error(`[MCP Client] Failed to connect to ${serverConfig.name}:`, err.message);
        return null;
    }
}

// discoverTools fetches tool list from a connected server
// registers each tool in toolServerMap for routing
async function discoverTools(serverName, client) {
    try {
        const response = await client.listTools();
        const tools = response.tools || [];

        console.log(`[MCP Client] Discovered ${tools.length} tools from ${serverName}`);

        for (const tool of tools) {
            // register tool → server mapping for routing
            toolServerMap[tool.name] = serverName;

            // convert MCP tool definition to our internal format
            // that the LLM provider expects
            allTools.push({
                name: tool.name,
                description: tool.description,
                parameters: tool.inputSchema || {
                    type: 'object',
                    properties: {},
                    required: []
                }
            });

            console.log(`[MCP Client] Registered tool: ${tool.name} → ${serverName}`);
        }

    } catch (err) {
        console.error(`[MCP Client] Failed to discover tools from ${serverName}:`, err.message);
    }
}

// initialize connects to all enabled MCP servers and discovers tools
// called once at backend startup
async function initialize() {
    console.log('[MCP Client] Initializing connections to MCP servers...');

    // close existing connections before reinitializing
    for (const [name, client] of Object.entries(serverClients)) {
        try {
            await client.close();
            console.log(`[MCP Client] Closed existing connection to ${name}`);
        } catch (err) {
            console.warn(`[MCP Client] Error closing connection to ${name}:`, err.message);
        }
    }

    // reset state
    allTools = [];
    Object.keys(toolServerMap).forEach(k => delete toolServerMap[k]);
    Object.keys(serverClients).forEach(k => delete serverClients[k]);

    for (const serverConfig of mcpConfig.servers) {
        if (!serverConfig.enabled) {
            console.log(`[MCP Client] Skipping disabled server: ${serverConfig.name}`);
            continue;
        }

        const client = await connectToServer(serverConfig);

        if (client) {
            serverClients[serverConfig.name] = client;
            await discoverTools(serverConfig.name, client);
        }
    }

    console.log(`[MCP Client] Initialization complete. Total tools: ${allTools.length}`);
}

// getTools returns aggregated tool list from all connected servers
// used by orchestrator to send available tools to LLM
function getTools() {
    return allTools;
}

// callTool executes a tool call on the correct MCP server
// routes to correct server using toolServerMap
// returns the tool result
async function callTool(toolName, params) {
    const serverName = toolServerMap[toolName];

    if (!serverName) {
        throw new Error(`No MCP server registered for tool: ${toolName}`);
    }

    const client = serverClients[serverName];

    if (!client) {
        throw new Error(`MCP server not connected: ${serverName}`);
    }

    console.log(`[MCP Client] Calling tool ${toolName} on ${serverName}`, params);

    const response = await client.callTool({
        name: toolName,
        arguments: params
    });

    // MCP tool responses contain content array
    // extract text content and parse JSON
    const content = response.content || [];
    const textContent = content.find(c => c.type === 'text');

    if (textContent) {
        try {
            return JSON.parse(textContent.text);
        } catch {
            return textContent.text;
        }
    }

    return response;
}

// getConnectedServers returns list of connected server names
// used by admin UI to show connection status and resolve admin endpoints
function getConnectedServers() {
    return Object.keys(serverClients).map(name => {
        const config = mcpConfig.servers.find(s => s.name === name);
        return {
            name,
            connected: true,
            toolCount: allTools.filter(t => toolServerMap[t.name] === name).length,
            // adminUrl is the HTTP base without /mcp — frontend uses it to call /admin/tools
            adminUrl: config?.url?.replace('/mcp', '') || null
        };
    });
}

module.exports = {
    initialize,
    getTools,
    callTool,
    getConnectedServers,
    setMockMode
};