require('dotenv').config();
const express = require('express');
const logger = require('./utils/logger');
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');
const chatRoutes = require('./routes/chatRoutes');
const uploadRoutes = require('./routes/uploadRoutes')
const mcpClient = require('./mcp/mcpClient');
const { startCleanupScheduler } = require('./utils/reportCleanup');

const app = express();

app.use(express.json());
app.use(requestLogger);

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        mock: process.env.USE_MOCK,
        aiProvider: process.env.AI_PROVIDER,
        aiModel: process.env.AI_MODEL,
        mcpServers: mcpClient.getConnectedServers()
    });
});

app.use('/api', chatRoutes);
app.use('/api', uploadRoutes);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

async function start() {
    try {
        // initialize MCP client before accepting requests
        // this connects to all registered MCP servers and discovers tools
        await mcpClient.initialize();

        //clean up scheduler to remove expired excel report files from backend/tmp
        startCleanupScheduler();

        app.listen(PORT, () => {
            logger.info(`Server running on port ${PORT}`);
            logger.info(`Mock mode: ${process.env.USE_MOCK}`);
            logger.info(`AI Provider: ${process.env.AI_PROVIDER}`);
        });

    } catch (err) {
        logger.error({ error: err.message }, 'Failed to start server');
        process.exit(1);
    }
}

start();