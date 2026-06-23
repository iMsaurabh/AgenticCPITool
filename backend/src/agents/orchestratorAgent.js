// orchestratorAgent is the entry point for all user messages.
// It now uses the MCP client to discover tools dynamically
// and route tool calls to the correct MCP server.
//
// Key change from previous implementation:
//   Before: hardcoded tool registry + specialist agents
//   After: dynamic tool discovery via MCP client
//
// The orchestrator no longer knows about specific CPI operations.
// It only knows how to:
//   1. Get available tools from MCP client
//   2. Send tools + message to LLM
//   3. Execute tool calls via MCP client
//   4. Return synthesized response

const mcpClient = require('../mcp/mcpClient');
const { getAgentLogger } = require('../utils/agentLogger');

const logger = getAgentLogger('orchestratorAgent');

// maximum iterations of the ReAct loop before giving up
const MAX_ITERATIONS = 8;

async function run(provider, userMessage, options = {}) {
    logger.info({ userMessage }, 'Orchestrator received message')

    const tools = mcpClient.getTools()
    logger.info({ toolCount: tools.length }, 'Tools loaded from MCP servers')

    // resolve user's local time from the timezone they sent with the request
    const userTimezone = options.timezone || 'UTC'
    const now = new Date()

    // hourCycle:'h23' forces 00-23 range — avoids the Node.js/ICU bug where
    // hour12:false uses h24, displaying midnight as "24:xx" and 1 AM as "25:xx"
    const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone: userTimezone,
        weekday: 'short',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
    })
    const parts = Object.fromEntries(dtf.formatToParts(now).map(p => [p.type, p.value]))
    // build a clean, unambiguous datetime string the LLM can use for arithmetic
    const localTimeStr = `${parts.weekday} ${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`

    // build conversation history from previous messages
    // this gives LLM context of what was discussed before
    const historyMessages = (options.history || []).map(m => ({
        role: m.role,
        content: m.content
    }))

    const messages = [
        {
            role: 'system',
            content: `You are an intelligent assistant for SAP Cloud Platform Integration.
            You have access to tools that can retrieve message status, logs, manage deployments, schedule jobs, and read or update iFlow configuration parameters.
            Always use the available tools to answer questions about CPI operations.
            Never make up or guess CPI data — always call the appropriate tool first.
            If the user request is unclear, ask for clarification before calling tools.
            When a tool returns results, always present the data clearly and completely to the user.
            Never say you do not have access to results — if a tool was called, use its output in your response.
            Format lists and structured data in a readable way.
            When scheduling a job, you must always ask for user confirmation to ahead with scheduling. Show user a preview of the job with its details to confirm.
            Do not schedule a job as a recurring task unless user explicitely asks you do it.
            When user confirms a previewed job with yes or confirm, immediately call createJob with the same parameters from the preview.
            User's current local time: ${localTimeStr} (${userTimezone}).
            Use this as the reference for "now", "in 5 minutes", "tonight" and any relative time expressions.
            When calculating a future time (e.g. "5 minutes from now", "in 2 hours"), add to the current time above using standard clock arithmetic: if the result exceeds 23:59 it wraps to the next calendar day starting at 00:00. Never output hour values above 23. Always express time as HH:MM where HH is 00-23.
            When calling previewJob or createJob, always pass timezone='${userTimezone}' and express the time field in the user's local timezone (HH:MM, 00-23). Never convert to UTC when calling these tools.
            In the preview you show to the user, display times in their local timezone (${userTimezone}), not in UTC or ISO format.
            When responding with list or tabular data such as artifacts, logs, or statuses, always format it as a Markdown table.
            IMPORTANT — Message ID vs Application Message ID: CPI message GUIDs are long alphanumeric strings (e.g. "AGqzMlDYlHy3..."). Any other identifier the user provides — including purchase order numbers (PO), sales order numbers (SO), invoice numbers, or any short numeric or business document ID — is NOT a CPI message GUID. Treat all such identifiers as an ApplicationMessageId and call the findMessageByApplicationId tool to look them up. Never call getMessageStatus with a non-GUID identifier.
            IMPORTANT — iFlow Configuration Parameters: When the user asks to see, list, inspect, or fetch the externalized parameters, external params, configuration parameters, or key-value settings of an integration flow or iFlow, ALWAYS call the getIFlowConfigurations tool. Pass the artifact Id the user provides and use Version 'active' unless the user specifies otherwise. Do NOT say you lack access or that this information is unavailable — always call the tool. If the tool returns an error from CPI, report the exact error text to the user so they can diagnose it.`
        },
        ...historyMessages,
        { role: 'user', content: userMessage }
    ]

    let iterations = 0
    const toolsUsed = []

    while (iterations < MAX_ITERATIONS) {
        iterations++
        logger.debug({ iterations }, 'ReAct loop iteration')

        const response = await provider.chat(messages, tools)

        if (response.toolCalls.length === 0) {
            logger.info({ iterations, toolsUsed }, 'Orchestrator completed')
            return {
                success: true,
                response: response.content,
                agent: 'orchestratorAgent',
                delegatedTo: [...new Set(toolsUsed)],
                iterations
            }
        }

        logger.info({ toolCalls: response.toolCalls.map(tc => tc.name) }, 'Tool calls requested by LLM')

        const toolResults = []

        for (const toolCall of response.toolCalls) {
            try {
                logger.debug({ toolName: toolCall.name, params: toolCall.parameters }, 'Executing tool')
                logger.info(`mockMode received from Chatroutes.js is ${options.mockMode} and comparison value is ${options.mockMode !== undefined}`)

                const result = await mcpClient.callTool(toolCall.name, toolCall.parameters)

                toolsUsed.push(toolCall.name)
                toolResults.push({ tool: toolCall.name, result })
                logger.info({ toolName: toolCall.name }, 'Tool executed successfully')

            } catch (err) {
                logger.error({ toolName: toolCall.name, error: err.message }, 'Tool execution failed')

                // surface real error so user can act on it (wrong ID, missing CPI scope, etc.)
                return {
                    success: false,
                    response: `The **${toolCall.name}** tool returned an error: ${err.message}`,
                    agent: 'orchestratorAgent',
                    delegatedTo: [...new Set(toolsUsed)],
                    iterations,
                    error: err.message
                }
            }
        }

        messages.push(response.raw.choices[0].message)
        response.raw.choices[0].message.tool_calls.forEach((tc, index) => {
            messages.push({
                role: 'tool',
                tool_call_id: tc.id,
                content: JSON.stringify(toolResults[index]?.result || toolResults[index]?.error)
            })
        })
    }

    logger.warn({ MAX_ITERATIONS }, 'Max iterations reached')
    return {
        success: false,
        response: 'Maximum iterations reached without completing the task.',
        agent: 'orchestratorAgent',
        delegatedTo: [...new Set(toolsUsed)],
        iterations
    }
}

module.exports = { run };