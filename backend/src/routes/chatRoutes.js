const express = require('express');
const router = express.Router();
const { getProvider, getSupportedProviders } = require('../providers/providerFactory');
const orchestrator = require('../agents/orchestratorAgent');
const responseFormatter = require('../utils/responseFormatter');
const axios = require('axios');

const mcpClient = require('../mcp/mcpClient');

router.post('/chat', async (req, res, next) => {
    const { message, provider, apiKey, mockMode, history, timezone } = req.body

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
            { mockMode, history: history || [], timezone: timezone || 'UTC' }
        )

        // send notifications for certain tool executions
        console.log('[ChatRoutes] delegatedTo:', result.delegatedTo);
        if (result.delegatedTo && result.delegatedTo.length > 0) {
            const schedulerUrl = process.env.SCHEDULER_MCP_URL || 'http://localhost:3002';
            console.log('[ChatRoutes] Scheduler URL:', schedulerUrl);

            // notify for deployment operations
            if (result.delegatedTo.includes('deployArtifact')) {
                console.log('[ChatRoutes] Sending deployment notification to scheduler');
                try {
                    const notifyResponse = await axios.post(`${schedulerUrl}/notify`, {
                        type: 'operation:completed',
                        title: 'Deployment Triggered',
                        message: 'Artifact deployment has been initiated',
                        status: 'success'
                    });
                    console.log('[ChatRoutes] Deployment notification sent successfully');
                } catch (err) {
                    console.error('[ChatRoutes] Failed to send deployment notification:', err.message);
                }
            }

            // notify for undeployment operations
            if (result.delegatedTo.includes('undeployArtifact')) {
                console.log('[ChatRoutes] Sending undeployment notification to scheduler');
                try {
                    const notifyResponse = await axios.post(`${schedulerUrl}/notify`, {
                        type: 'operation:completed',
                        title: 'Undeployment Triggered',
                        message: 'Artifact undeployment has been initiated',
                        status: 'info'
                    });
                    console.log('[ChatRoutes] Undeployment notification sent successfully');
                } catch (err) {
                    console.error('[ChatRoutes] Failed to send undeployment notification:', err.message);
                }
            }
        }

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

// POST /api/environment
// Receives CPI credentials from the frontend and forwards them to the CPI MCP
// server's in-memory credential store. The backend acts as a secure proxy so
// the frontend never talks directly to the CPI MCP admin endpoints.
router.post('/environment', async (req, res, next) => {
    try {
        const { cpiBaseUrl, tokenUrl, clientId, clientSecret } = req.body;

        if (!cpiBaseUrl || !tokenUrl || !clientId || !clientSecret) {
            return res.status(400).json({ success: false, error: 'All credential fields are required' });
        }

        const cpiMcpBase = (process.env.CPI_MCP_URL || 'http://localhost:3001/mcp').replace('/mcp', '');
        await axios.post(`${cpiMcpBase}/admin/credentials`, { cpiBaseUrl, tokenUrl, clientId, clientSecret });

        return responseFormatter.success(res, { message: 'Credentials pushed to CPI MCP server' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;