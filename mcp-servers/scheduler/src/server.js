// Scheduler MCP Server
// Exposes job scheduling tools via MCP protocol.
// Also provides SSE endpoint for real time job notifications.
// Runs independently on port 3002.

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const { z } = require('zod');
const schedulerTools = require('./tools/schedulerTools');
const schedulerToolExecutor = require('./services/schedulerToolExecutor');
const jobScheduler = require('./services/jobScheduler');
const sseManager = require('./utils/sseManager');
const jobStore = require('./services/jobStore');

const app = express();
app.use(express.json());
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:80', 'http://localhost'],
    methods: ['GET', 'POST', 'DELETE', 'PUT'],
    allowedHeaders: ['Content-Type']
}));

// initialize MCP server
const mcpServer = new McpServer({
    name: 'scheduler-mcp-server',
    version: '1.0.0'
});

// build Zod schema from JSON Schema properties
function buildZodSchema(properties, required = []) {
    const shape = {};

    if (!properties || Object.keys(properties).length === 0) {
        return shape;
    }

    for (const [name, prop] of Object.entries(properties)) {
        let zodType;

        switch (prop.type) {
            case 'string':
                zodType = z.string().describe(prop.description || '');
                break;
            case 'number':
                // z.coerce.number() converts string "2" to number 2 automatically
                // LLMs frequently return numbers as strings
                zodType = z.coerce.number().describe(prop.description || '');
                break;
            case 'boolean':
                // z.coerce.boolean() converts string "false" to boolean false
                zodType = z.coerce.boolean().describe(prop.description || '');
                break;
            case 'array':
                zodType = z.array(z.string()).describe(prop.description || '');
                break;
            case 'object':
                zodType = z.string().optional().describe(
                    `${prop.description || ''} (pass as JSON string)`
                );
                break;
            default:
                zodType = z.string().describe(prop.description || '');
        }

        if (!required.includes(name)) {
            zodType = zodType.optional();
        }

        shape[name] = zodType;
    }

    return shape;
}

// register all scheduler tools with MCP server
function registerTools() {
    console.log(`[Scheduler MCP] Registering ${schedulerTools.length} tools`);

    for (const tool of schedulerTools) {
        const zodSchema = buildZodSchema(
            tool.parameters.properties,
            tool.parameters.required || []
        );

        mcpServer.tool(
            tool.name,
            tool.description,
            zodSchema,
            async (params) => {
                console.log(`[Scheduler MCP] Tool called: ${tool.name}`, params);

                const executor = schedulerToolExecutor[tool.name];
                if (!executor) {
                    throw new Error(`No executor for tool: ${tool.name}`);
                }

                const result = await executor(params);
                return {
                    content: [{ type: 'text', text: JSON.stringify(result) }]
                };
            }
        );

        console.log(`[Scheduler MCP] Registered: ${tool.name}`);
    }
}

// MCP SSE transport for agent connections
const mcpTransports = {};

app.get('/mcp', async (req, res) => {
    const transport = new SSEServerTransport('/messages', res);
    mcpTransports[transport.sessionId] = transport;
    res.on('close', () => delete mcpTransports[transport.sessionId]);
    try {
        await mcpServer.connect(transport);
    } catch (err) {
        console.warn('[Scheduler MCP] Connection warning:', err.message);
    }
});

app.post('/messages', async (req, res) => {
    const sessionId = req.query.sessionId;
    const transport = mcpTransports[sessionId];
    if (!transport) return res.status(404).json({ error: 'Session not found' });
    await transport.handlePostMessage(req, res, req.body);
});

// SSE endpoint for frontend job notifications
// separate from MCP SSE — this is for real time job events
app.get('/events', (req, res) => {
    const clientId = `client_${Date.now()}`;
    sseManager.addClient(clientId, res);
    req.on('close', () => sseManager.removeClient(clientId));
});

// health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        server: 'scheduler-mcp-server',
        activeJobs: jobScheduler.getActiveJobCount(),
        connectedClients: sseManager.getClientCount()
    });
});

// admin — list all jobs (for UI jobs panel)
app.get('/admin/jobs', (req, res) => {
    res.json({ jobs: jobStore.getAllJobs() });
});

// admin — get execution history for a job
app.get('/admin/jobs/:jobId/history', (req, res) => {
    const executions = jobStore.getExecutionsByJobId(req.params.jobId);
    res.json({ executions });
});

// admin — get all recent executions
app.get('/admin/executions', (req, res) => {
    res.json({ executions: jobStore.getAllExecutions() });
});

// admin — toggle job enabled/disabled
app.post('/admin/jobs/:jobId/toggle', (req, res) => {
    try {
        const { enabled } = req.body;
        const job = jobStore.getJobById(req.params.jobId);
        if (!job) return res.status(404).json({ success: false, error: 'Job not found' });

        jobStore.updateJob(req.params.jobId, { enabled });

        if (enabled) {
            jobScheduler.startJob({ ...job, enabled: true });
        } else {
            jobScheduler.stopJob(req.params.jobId);
        }

        res.json({ success: true, enabled });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// admin — delete a job
app.delete('/admin/jobs/:jobId', (req, res) => {
    try {
        const job = jobStore.getJobById(req.params.jobId);
        if (!job) return res.status(404).json({ success: false, error: 'Job not found' });

        jobScheduler.stopJob(req.params.jobId);
        jobStore.deleteJob(req.params.jobId);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// admin — run job immediately
app.post('/admin/jobs/:jobId/run', async (req, res) => {
    try {
        const { keepSchedule } = req.body;
        const job = jobStore.getJobById(req.params.jobId);
        if (!job) return res.status(404).json({ success: false, error: 'Job not found' });

        // run async — respond immediately
        jobScheduler.runJobNow(req.params.jobId, keepSchedule !== false)
            .catch(err => console.error('[Admin] runJobNow error:', err.message));

        res.json({ success: true, message: `Job "${job.name}" triggered` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// admin — create job directly from UI
app.post('/admin/jobs', (req, res) => {
    try {
        const jobConfig = req.body;

        // build cron expression from schedule config
        const cron = jobScheduler.buildCronExpression(jobConfig.schedule);
        jobConfig.schedule.cron = cron;
        jobConfig.schedule.timezone = 'UTC';

        const job = jobStore.createJob(jobConfig);
        jobScheduler.startJob(job);

        // broadcast job:scheduled event to notify frontend
        sseManager.broadcastJobScheduled(job);

        // if frequency is 'once' and time is soon, run immediately
        if (jobConfig.schedule.frequency === 'once') {
            const [hour, minute] = (jobConfig.schedule.time || '').split(':').map(Number);
            if (!isNaN(hour) && !isNaN(minute)) {
                const now = new Date();
                const scheduled = new Date();
                scheduled.setUTCHours(hour, minute, 0, 0);

                // if scheduled time is within next 60 seconds, run immediately
                const timeUntilRun = scheduled.getTime() - now.getTime();
                if (timeUntilRun >= 0 && timeUntilRun <= 60000) {
                    jobScheduler.runJobNow(job.id, false)
                        .catch(err => console.error('[Admin] Immediate execution error:', err.message));
                }
            }
        }

        res.status(201).json({ success: true, job });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// admin — broadcast a custom notification to frontend
// used by backend to notify about tool execution results
app.post('/notify', (req, res) => {
    try {
        const { type, title, message, status } = req.body;

        if (!type || !title) {
            return res.status(400).json({ success: false, error: 'type and title are required' });
        }

        console.log(`[Notify] Broadcasting ${type}: "${title}" to ${sseManager.getClientCount()} clients`);

        sseManager.broadcast({
            type: type,
            title: title,
            message: message || '',
            status: status || 'info',
            timestamp: new Date().toISOString()
        });

        res.json({ success: true });
    } catch (err) {
        console.error(`[Notify] Error:`, err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// initialize and start
registerTools();
jobScheduler.initialize();

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`[Scheduler MCP] Server running on port ${PORT}`);
    console.log(`[Scheduler MCP] MCP endpoint: http://localhost:${PORT}/mcp`);
    console.log(`[Scheduler MCP] SSE events: http://localhost:${PORT}/events`);
});