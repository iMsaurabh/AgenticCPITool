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
            When user confirms a previewed job with yes or confirm, immediately call createJob with the same parameters from the preview.
            Current UTC time is: ${new Date().toUTCString()}.
            When scheduling jobs, use this as the reference for current time.
            When responding with list or tabular data such as artifacts, logs, or statuses, always format it as a Markdown table.`
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

                // return friendly error — never expose raw API errors to user
                return {
                    success: false,
                    response: `I encountered an issue while trying to execute that operation. Please try rephrasing your request or check that all required information was provided.`,
                    agent: 'orchestratorAgent',
                    delegatedTo: [...new Set(toolsUsed)],
                    iterations,
                    error: err.message // logged but not shown to user
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