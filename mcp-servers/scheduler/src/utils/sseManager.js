// sseManager manages Server Sent Events connections from frontend clients.
// When a job completes, fails or retries, the scheduler broadcasts
// an event to all connected clients in real time.
//
// SSE is one-directional — server pushes to client.
// Each connected browser tab gets its own SSE connection.
// Events are broadcast to ALL connected clients simultaneously.
//
// This is the same SSE technology used by MCP transport,
// repurposed here for real time job notifications.

const clients = new Map(); // clientId → response object

// addClient registers a new SSE client connection
// res is the Express response object kept open for SSE
function addClient(clientId, res) {
    // SSE requires specific headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });

    // send initial connection confirmation
    res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

    clients.set(clientId, res);
    console.log(`[SSE] Client connected: ${clientId}. Total: ${clients.size}`);
}

// removeClient cleans up when client disconnects
function removeClient(clientId) {
    clients.delete(clientId);
    console.log(`[SSE] Client disconnected: ${clientId}. Total: ${clients.size}`);
}

// broadcast sends an event to all connected clients
// event: object with type and payload
function broadcast(event) {
    const data = JSON.stringify(event);
    let sent = 0;

    for (const [clientId, res] of clients.entries()) {
        try {
            res.write(`data: ${data}\n\n`);
            sent++;
        } catch (err) {
            // client disconnected ungracefully — clean up
            console.warn(`[SSE] Failed to send to ${clientId}, removing`);
            clients.delete(clientId);
        }
    }

    console.log(`[SSE] Broadcast ${event.type} to ${sent} clients`);
}

// broadcastJobStarted fires when a job begins execution
function broadcastJobStarted(job, attempt) {
    broadcast({
        type: 'job:started',
        job: {
            id: job.id,
            name: job.name,
            tool: job.tool,
            attempt,
            maxAttempts: (job.retry?.maxRetries || 0) + 1
        },
        timestamp: new Date().toISOString()
    });
}

// broadcastJobComplete fires when a job finishes (success or final failure)
function broadcastJobComplete(job, execution) {
    broadcast({
        type: 'job:complete',
        job: {
            id: job.id,
            name: job.name,
            tool: job.tool,
            status: execution.status,
            attempt: execution.attempt,
            maxAttempts: execution.maxAttempts
        },
        result: execution.result,
        error: execution.error,
        duration: execution.duration,
        timestamp: new Date().toISOString()
    });
}

// broadcastJobRetry fires when a job attempt fails but retries remain
function broadcastJobRetry(job, attempt, maxAttempts, nextRetryAt) {
    broadcast({
        type: 'job:retry',
        job: {
            id: job.id,
            name: job.name,
            tool: job.tool
        },
        attempt,
        maxAttempts,
        nextRetryAt,
        timestamp: new Date().toISOString()
    });
}

// broadcastJobScheduled fires when a job is successfully created and scheduled
function broadcastJobScheduled(job) {
    broadcast({
        type: 'job:scheduled',
        job: {
            id: job.id,
            name: job.name,
            tool: job.tool,
            schedule: job.schedule
        },
        timestamp: new Date().toISOString()
    });
}

function getClientCount() {
    return clients.size;
}

module.exports = {
    addClient,
    removeClient,
    broadcast,
    broadcastJobStarted,
    broadcastJobComplete,
    broadcastJobRetry,
    broadcastJobScheduled,
    getClientCount
};