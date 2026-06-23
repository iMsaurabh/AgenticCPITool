// toolExecutor is the execution engine for all CPI tool calls.
// When the MCP server receives a tool call from the agent:
//   1. Checks USE_MOCK — returns mockResponse if true
//   2. Otherwise constructs CPI HTTP request from tool config
//   3. Handles OAuth token fetching and CSRF token for write operations
//   4. Returns normalized response
//
// This is fully data driven — no hardcoded service methods per tool.
// Adding a new tool to toolsConfig.json automatically gets
// full execution support without any code changes here.

const axios = require('axios');
const runtimeCredentials = require('../config/runtimeCredentials');

// tokenCache stores OAuth access token in memory
let tokenCache = {
    accessToken: null,
    expiresAt: null
};

// clearTokenCache is called when credentials change so the next
// tool call fetches a fresh token with the new credentials
function clearTokenCache() {
    tokenCache = { accessToken: null, expiresAt: null };
}

// at top of toolExecutor.js
// lazy require to avoid circular dependency
function getMockMode() {
    try {
        return require('../server').getMockMode();
    } catch {
        return process.env.USE_MOCK === 'true';
    }
}

async function getAccessToken() {
    try {
        const now = Date.now();

        if (tokenCache.accessToken && tokenCache.expiresAt > now) {
            return tokenCache.accessToken;
        }

        const creds = runtimeCredentials.getCredentials();

        const response = await axios.post(
            creds.tokenUrl,
            new URLSearchParams({ grant_type: 'client_credentials' }),
            {
                auth: {
                    username: creds.clientId,
                    password: creds.clientSecret
                },
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            }
        );

        tokenCache = {
            accessToken: response.data.access_token,
            expiresAt: now + (response.data.expires_in - 60) * 1000
        };

        return tokenCache.accessToken;

    } catch (err) {
        console.error('[Executor] Token fetch failed:', err.response?.status, err.response?.data);
        throw err;
    }
}

function getApiClient(accessToken) {
    const { cpiBaseUrl } = runtimeCredentials.getCredentials();
    return axios.create({
        baseURL: cpiBaseUrl,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
            'Content-Type': 'application/json'
        },
        withCredentials: true
    });
}

async function getCsrfToken(client) {
    const response = await client.get('/api/v1/', {
        headers: { 'X-CSRF-Token': 'Fetch' }
    });
    return response.headers['x-csrf-token'];
}

// buildUrl replaces path parameters in endpoint template with actual values
// e.g. /api/v1/MessageProcessingLogs('{messageId}') + { messageId: 'ABC' }
//   → /api/v1/MessageProcessingLogs('ABC')
function buildUrl(endpoint, params, parameters) {
    let url = endpoint;

    for (const paramConfig of parameters) {
        if (paramConfig.location === 'path') {
            const value = params[paramConfig.name] !== undefined
                ? params[paramConfig.name]
                : paramConfig.default;  // ← add this
            if (value !== undefined) {
                url = url.replace(`{${paramConfig.name}}`, value);
                url = url.replace(`'{${paramConfig.name}}'`, `'${value}'`);
            }
        }
    }

    return url;
}

// buildQueryParams extracts query parameters from tool call params
function buildQueryParams(params, parameters, staticQueryParams) {
    const queryParams = { ...staticQueryParams };

    for (const paramConfig of parameters) {
        if (paramConfig.location === 'query') {
            const value = params[paramConfig.name] !== undefined
                ? params[paramConfig.name]
                : paramConfig.default;

            if (value !== undefined && value !== '') {
                const queryKey = paramConfig.queryParamName || paramConfig.name;

                if (paramConfig.filterTemplate) {
                    // substitute the runtime value into the OData filter template
                    // e.g. "ApplicationMessageId eq '{value}'" → "ApplicationMessageId eq '20'"
                    queryParams[queryKey] = paramConfig.filterTemplate.replace('{value}', value);
                } else {
                    queryParams[queryKey] = paramConfig.quoted ? `'${value}'` : value;
                }
            }
        }
    }

    return queryParams;
}

// buildRequestBody create body in case PUT request needs a body
function buildRequestBody(params, parameters) {
    const body = {};

    for (const paramConfig of parameters) {
        if (paramConfig.location === 'body') {
            const value = params[paramConfig.name];
            if (value !== undefined && value !== '') {
                body[paramConfig.name] = value;
            }
        }
    }

    return Object.keys(body).length > 0 ? body : null;
}

// parseCpiDate converts CPI OData date format to ISO string
function parseCpiDate(cpiDate) {
    if (!cpiDate) return null;
    const match = String(cpiDate).match(/\/Date\((\d+)\)\//);
    if (!match) return cpiDate;
    return new Date(parseInt(match[1])).toISOString();
}

// normalizeResponse extracts relevant fields from CPI OData response
function normalizeResponse(data) {
    // OData wraps response in 'd' property
    if (data && data.d) {
        const d = data.d;

        // handle collection responses — d.results is an array
        if (Array.isArray(d.results)) {
            return d.results.map(item => {
                const cleaned = {};
                for (const [key, value] of Object.entries(item)) {
                    // skip deferred navigation properties
                    if (value?.__deferred) continue;
                    if (typeof value === 'string' && value.startsWith('/Date(')) {
                        cleaned[key] = parseCpiDate(value);
                    } else {
                        cleaned[key] = value;
                    }
                }
                return cleaned;
            });
        }

        // handle single object responses
        const result = {};
        for (const [key, value] of Object.entries(d)) {
            if (value?.__deferred) continue;
            if (typeof value === 'string' && value.startsWith('/Date(')) {
                result[key] = parseCpiDate(value);
            } else {
                result[key] = value;
            }
        }
        return result;
    }
    return data;
}

// executeTool is the main entry point called by the MCP server
// toolConfig: full tool config from toolsConfig.json
// params: parameters passed by the LLM (e.g. { messageId: 'ABC' })
async function executeTool(toolConfig, params) {
    // extract mockMode from params — injected by backend orchestrator
    // falls back to process.env.USE_MOCK if not provided
    const mockMode = getMockMode();

    // remove __mockMode from params if present (legacy, no longer used)
    const cleanParams = { ...params };
    delete cleanParams.__mockMode;
    console.log(`mock mode inside tool Executor.js in mcp server is ${params.__mockMode}, so selected mock mode is: ${mockMode}`)
    if (mockMode) {
        console.log(`[Executor] Mock mode — returning mock response for ${toolConfig.name}`)
        const mock = { ...toolConfig.mockResponse }
        for (const param of toolConfig.parameters) {
            if (param.required && cleanParams[param.name]) {
                const key = Object.keys(mock).find(k =>
                    k.toLowerCase().includes(param.name.toLowerCase())
                )
                if (key) mock[key] = cleanParams[param.name]
            }
        }
        return mock
    }

    // real mode — use cleanParams for CPI calls
    console.log(`[Executor] Real mode — calling CPI for ${toolConfig.name}`)

    const accessToken = await getAccessToken()
    const client = getApiClient(accessToken)
    const url = buildUrl(toolConfig.endpoint, cleanParams, toolConfig.parameters)
    const queryParams = buildQueryParams(cleanParams, toolConfig.parameters, toolConfig.queryParams || {})

    let csrfToken = null
    if (toolConfig.requiresCsrf) {
        csrfToken = await getCsrfToken(client)
    }

    const requestConfig = {
        params: Object.keys(queryParams).length > 0 ? queryParams : undefined,
        headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {}
    }

    let response

    console.log('[Executor] URL:', url);
    console.log('[Executor] Method:', toolConfig.method);
    console.log('[Executor] QueryParams:', JSON.stringify(queryParams));
    console.log('[Executor] CSRF required:', toolConfig.requiresCsrf);
    console.log('[Executor] Mock mode:', mockMode);

    switch (toolConfig.method.toUpperCase()) {
        case 'GET':
            response = await client.get(url, requestConfig)
            break
        case 'POST':
            response = await client.post(url, null, requestConfig)
            break
        case 'DELETE':
            response = await client.delete(url, requestConfig)
            break
        case 'PUT':
            const putBody = buildRequestBody(cleanParams, toolConfig.parameters);
            console.log('[Executor] PUT URL:', url);
            console.log('[Executor] PUT Body:', JSON.stringify(putBody));
            console.log('[Executor] PUT Params:', JSON.stringify(cleanParams));
            response = await client.put(url, putBody, requestConfig);
            break;
        default:
            throw new Error(`Unsupported HTTP method: ${toolConfig.method}`)
    }

    return normalizeResponse(response.data) || {
        status: 'success',
        message: `${toolConfig.name} executed successfully`
    }
}

module.exports = { executeTool, clearTokenCache };