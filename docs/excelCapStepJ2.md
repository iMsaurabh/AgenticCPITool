# Group J2 — Batch Execution Agent

## Objective
Execute CPI parameter updates and deployments sequentially from a parsed Excel artifact list, without involving the LLM.

---

## Why Not the Orchestrator
`OrchestratorAgent` uses a ReAct loop — LLM decides what to call. Batch execution is deterministic; the sequence is already known from the parsed Excel. `BatchExecutionAgent` calls MCP tools directly, no LLM involved.

---

## Information Flow
```
POST /api/chat/upload
  → multer buffers file → base64
  → mcpClient.callTool('parseExcelFile')        [Excel MCP :3003]
  → batchExecutionAgent.run(artifacts)
      → updateIFlowConfiguration per parameter  [CPI MCP :3001]
      → deployArtifact if flagged               [CPI MCP :3001]
  → response with results[]
```

---

## New Files
- `backend/src/agents/batchExecutionAgent.js`
- `backend/src/routes/uploadRoutes.js` — updated to call batch agent after parse

---

## Deploy Logic

| Condition | Result |
|---|---|
| `deploy: false` | skipped |
| `deploy: true` + all params ok | success |
| `deploy: true` + any param failed | skipped — failures detected |
| `deploy: true` + params ok + CPI fails | failed + error |

---

## Tool Parameter Names
Must exactly match `toolsConfig.json` — case sensitive. Mismatch causes silent success with no actual CPI update.

`updateIFlowConfiguration` expects: `Id`, `ParameterKey` (path), `ParameterValue` (body).

---

## Critical Bug Fixed — `buildUrl` ignoring defaults

Optional path params with a `default` value were not being substituted — URL contained literal `'{Version}'`.

**Fix in `mcp-servers/cpi/src/services/toolExecutor.js`:**
```js
const value = params[paramConfig.name] !== undefined
    ? params[paramConfig.name]
    : paramConfig.default; // apply default if param not provided
```

Applies to all tools with optional path parameters.