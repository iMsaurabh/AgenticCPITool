// server.js is the entry point for the Excel MCP Server.
// It does three things:
// 1. Initializes the MCP server with the official SDK
// 2. Registers tools dynamically from toolsConfig.json
// 3. Starts an HTTP server with SSE transport for client connections
//
// The MCP server runs independently on port 3003.
// The backend agent connects to it as an MCP client.

require('dotenv').config();

const { z } = require('zod');

const express = require('express');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const { getMcpToolDefinitions, getToolConfig, getAllToolConfigs, addTool, removeTool } = require('./tools/toolLoader');
const { executeTool } = require('./services/toolExecutor');

const app = express();
app.use(express.json());

const cors = require('cors');

app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://localhost:80',
        'http://localhost'
    ],
    methods: ['GET', 'POST', 'DELETE', 'PUT'],
    allowedHeaders: ['Content-Type']
}));

const mcpServer = new McpServer({
    name: 'excel-mcp-server',
    version: '1.0.0'
});

let runtimeMockMode = process.env.USE_MOCK === 'true';

function getMockMode() {
    return runtimeMockMode;
}

app.post('/admin/mock', (req, res) => {
    const { mockMode } = req.body;
    runtimeMockMode = mockMode === true || mockMode === 'true';
    console.log(`[Excel MCP] Mock mode set to: ${runtimeMockMode}`);
    res.json({ success: true, mockMode: runtimeMockMode });
});

function buildZodSchema(properties, required) {
    const shape = {};

    for (const [name, prop] of Object.entries(properties)) {
        let zodType;

        switch (prop.type) {
            case 'string':
                zodType = z.string().describe(prop.description || '');
                break;
            case 'number':
                zodType = z.number().describe(prop.description || '');
                break;
            case 'boolean':
                zodType = z.boolean().describe(prop.description || '');
                break;
            case 'array':
                zodType = z.array(z.any()).describe(prop.description || '');
                break;
            default:
                zodType = z.any().describe(prop.description || '');
        }

        if (!required.includes(name)) {
            zodType = zodType.optional();
        }

        shape[name] = zodType;
    }

    return shape;
}

function registerTools() {
    const toolDefinitions = getMcpToolDefinitions();

    console.log(`[MCP Server] Registering ${toolDefinitions.length} tools`);

    for (const tool of toolDefinitions) {
        const zodSchema = buildZodSchema(tool.inputSchema.properties, tool.inputSchema.required || []);

        mcpServer.tool(
            tool.name,
            tool.description,
            zodSchema,
            async (params) => {
                console.log(`[MCP Server] Tool called: ${tool.name}`, params);
                const toolConfig = getToolConfig(tool.name);
                const result = await executeTool(toolConfig, params);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result)
                        }
                    ]
                };
            }
        );

        console.log(`[MCP Server] Registered tool: ${tool.name}`);
    }
}

const transports = {};

app.get('/mcp', async (req, res) => {
    console.log('[MCP Server] New client connection');

    const transport = new SSEServerTransport('/messages', res);
    transports[transport.sessionId] = transport;

    res.on('close', () => {
        console.log(`[MCP Server] Client disconnected: ${transport.sessionId}`);
        delete transports[transport.sessionId];
    });

    await mcpServer.connect(transport);
});

app.post('/messages', async (req, res) => {
    const sessionId = req.query.sessionId;
    const transport = transports[sessionId];

    if (!transport) {
        return res.status(404).json({ error: 'Session not found' });
    }

    await transport.handlePostMessage(req, res, req.body);
});

app.get('/health', (req, res) => {
    const toolDefinitions = getMcpToolDefinitions();
    res.json({
        status: 'ok',
        server: 'excel-mcp-server',
        tools: toolDefinitions.length,
        mock: runtimeMockMode
    });
});

app.get('/admin/tools', (req, res) => {
    res.json({ tools: getAllToolConfigs() });
});

app.post('/admin/tools', (req, res) => {
    try {
        const tool = addTool(req.body);
        res.status(201).json({ success: true, tool });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.post('/admin/restart-tools', (req, res) => {
    res.json({ success: true, message: 'MCP server restarting...' });
    setTimeout(() => process.exit(0), 100);
});

app.delete('/admin/tools/:name', (req, res) => {
    try {
        removeTool(req.params.name);
        res.json({ success: true });
    } catch (err) {
        res.status(404).json({ success: false, error: err.message });
    }
});

// direct tool execution — used by backend orchestrator for server-to-server calls
app.post('/admin/execute', async (req, res) => {
    const { toolName, parameters } = req.body;

    try {
        const toolConfig = getToolConfig(toolName);
        if (!toolConfig) {
            return res.status(404).json({ success: false, error: `Tool not found: ${toolName}` });
        }

        const result = await executeTool(toolConfig, parameters || {});
        res.json({ success: true, result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

registerTools();

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
    console.log(`[MCP Server] Excel MCP Server running on port ${PORT}`);
    console.log(`[MCP Server] Mock mode: ${runtimeMockMode}`);
    console.log(`[MCP Server] SSE endpoint: http://localhost:${PORT}/mcp`);
});

module.exports = { getMockMode };
