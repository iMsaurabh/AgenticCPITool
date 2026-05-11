# Group J1 — Excel MCP Server

## Objective
Scaffold a dedicated MCP server for Excel capabilities. Handles parsing of uploaded Excel files into a structured artifact/parameter format consumable by the BatchExecutionAgent.

---

## Architecture Decision
Excel parsing runs as an MCP server (port 3003) rather than a backend utility, consistent with the project's MCP-first architecture. All Excel capabilities are discoverable and extensible via `toolsConfig.json` without touching the backend.

File upload (multipart) is still handled by the backend via `multer` — MCP servers do not handle multipart. The backend buffers the file, converts to base64, and calls `parseExcelFile` via the MCP client.

---

## New Files

### `mcp-servers/excel/`
```
mcp-servers/excel/
  package.json
  .env
  src/
    server.js
    config/
      toolsConfig.json
    services/
      toolExecutor.js
    tools/
      toolLoader.js
```

### `backend/src/routes/uploadRoutes.js`
Multipart upload endpoint. Accepts `.xlsx`/`.xls` file via `POST /api/upload`. Converts buffer to base64 and calls `parseExcelFile` on the Excel MCP server via `mcpClient.callTool()`.

---

## Excel MCP Server — Port 3003

Same structure as `mcp-servers/cpi/` and `mcp-servers/scheduler/`.

### Dependencies
```bash
npm install @modelcontextprotocol/sdk xlsx zod express cors dotenv
```

### `.env`
```
PORT=3003
USE_MOCK=false
```

---

## Tools Registered

### `parseExcelFile`
Parses a base64-encoded Excel file in the standard CPI bulk-update format.

**Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| fileContent | string | yes | Base64-encoded Excel file content |
| filename | string | no | Original filename, used for logging only |

**Expected Excel columns:**
| Column | Description |
|---|---|
| ArtifactId | iFlow ID. Supports merged cells — forward-filled automatically |
| ParameterKey | Configuration parameter key |
| ParameterValue | New value for the parameter |
| Deploy | Whether to deploy after param update. Truthy: `yes`, `true`, `1` |

**Merged cell handling:**
SheetJS reads merged cells as empty strings for non-anchor rows. The parser forward-fills the `ArtifactId` column downward. The `Deploy` flag uses last-truthy-wins per artifact group.

**Returns:**
```json
{
  "artifacts": [
    {
      "artifactId": "MyIFlow_v1",
      "parameters": [
        { "key": "endpoint", "value": "https://..." },
        { "key": "timeout", "value": "30" }
      ],
      "deploy": true
    }
  ]
}
```

### `getSheetNames`
Returns list of sheet names in a workbook. Takes `filePath` (absolute path).

### `readSheet`
Reads raw rows from a named sheet. Takes `filePath` and optional `sheetName`.

---

## Backend Registration

### `backend/src/config/mcpConfig.js`
Add entry:
```js
{
  name: 'excel-mcp-server',
  url: process.env.EXCEL_MCP_URL
}
```

### `backend/.env`
```
EXCEL_MCP_URL=http://localhost:3003/mcp
```

---

## Backend Upload Route

### `backend/src/routes/uploadRoutes.js`
- Uses `multer` with `memoryStorage` — file never written to disk on inbound
- Validates file presence before calling MCP
- Converts buffer to base64: `req.file.buffer.toString('base64')`
- Calls `parseExcelFile` via `mcpClient.callTool()`
- Endpoint: `POST /api/upload`

### `backend/src/server.js`
```js
const uploadRoutes = require('./routes/uploadRoutes');
app.use('/api', uploadRoutes);
```

### Backend dependencies
```bash
npm install multer
```

---

## Test

`backend/testExcelUpload.js` (gitignored):
```js
const fs = require('fs');
const path = require('path');

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node testExcelUpload.js <path-to-excel-file>');
  process.exit(1);
}

const buffer = fs.readFileSync(path.resolve(filePath));
const base64 = buffer.toString('base64');

async function test() {
  const response = await fetch('http://localhost:3003/admin/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      toolName: 'parseExcelFile',
      parameters: { fileContent: base64, filename: 'test.xlsx' }
    })
  });
  const result = await response.json();
  console.log(JSON.stringify(result, null, 2));
}

test().catch(console.error);
```

Run:
```bash
node testExcelUpload.js ./test.xlsx
```

---

## Key Gotchas

- `/admin/execute` expects `toolName` not `tool` — mismatch returns `Tool not found: undefined`
- `parseExcelFile` handler expects `fileContent` not `file` — mismatch causes buffer error
- SheetJS merged cells read as empty string, not `null` — forward-fill handles this
- `Deploy` column: last truthy value in an artifact group wins

---

## Confirmed Working Output
```json
{
  "success": true,
  "result": {
    "artifacts": [
      {
        "artifactId": "Demo_CheckAdapters",
        "parameters": [
          { "key": "param1", "value": "1" },
          { "key": "param2", "value": "2" }
        ],
        "deploy": true
      },
      {
        "artifactId": "Demo",
        "parameters": [
          { "key": "param0", "value": "0" }
        ],
        "deploy": false
      }
    ]
  }
}
```