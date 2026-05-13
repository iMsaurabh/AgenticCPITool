const express = require('express');
const router = express.Router();
const { getProvider, getSupportedProviders } = require('../providers/providerFactory');
const orchestrator = require('../agents/orchestratorAgent');
const responseFormatter = require('../utils/responseFormatter');

const mcpClient = require('../mcp/mcpClient');

router.post('/chat', async (req, res, next) => {
    const { message, provider, apiKey, mockMode, history } = req.body

    if (!message || typeof message !== 'string' || message.trim() === '') {
        return responseFormatter.error(res, 'message is required and must be a non-empty string', 400)
    }

    try {
        // notify all MCP servers of current mock mode
        await mcpClient.setMockMode(mockMode !== undefined ? mockMode : true)

        const providerInstance = getProvider(provider, { apiKey: apiKey || undefined })
        const result = await orchestrator.run(
            providerInstance,
            message.trim(),
            { mockMode, history: history || [] }
        )
        return responseFormatter.success(res, result)
    } catch (err) {
        console.error('[ChatRoutes] Error:', err.message, err.status)
        next(err)
    }
})

router.get('/providers', (req, res) => {
    return responseFormatter.success(res, {
        providers: getSupportedProviders()
    });
});

// POST /api/mcp/reload
// Re-initializes MCP client connections and re-discovers all tools
// Called by admin UI after adding or removing a tool
router.post('/mcp/reload', async (req, res, next) => {
    try {
        const mcpClient = require('../mcp/mcpClient');
        await mcpClient.initialize();
        return responseFormatter.success(res, {
            message: 'MCP tools reloaded successfully',
            servers: mcpClient.getConnectedServers()
        });
    } catch (err) {
        next(err);
    }
});

// GET /api/mcp/servers
// Returns connected MCP servers and their tools
// Used by admin UI to display current state
router.get('/mcp/servers', async (req, res, next) => {
    try {
        const mcpClient = require('../mcp/mcpClient');
        return responseFormatter.success(res, {
            servers: mcpClient.getConnectedServers(),
            tools: mcpClient.getTools()
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;