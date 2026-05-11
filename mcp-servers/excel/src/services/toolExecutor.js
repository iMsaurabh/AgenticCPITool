// toolExecutor is the execution engine for all Excel tool calls.
// When the MCP server receives a tool call from the agent:
//   1. Checks USE_MOCK — returns mockResponse if true
//   2. Otherwise dispatches to the xlsx handler for the requested operation
//
// Operations are identified by toolConfig.operation, not HTTP method/endpoint.
// Adding a new tool to toolsConfig.json + a matching handler here enables it.

const XLSX = require('xlsx');

function getMockMode() {
    try {
        return require('../server').getMockMode();
    } catch {
        return process.env.USE_MOCK === 'true';
    }
}

// parseExcelFile replicates the backend's forwardFillAndGroup logic so the
// agent sees the same grouped structure the frontend receives after an upload.
// fileContent is a base64 string sent by the backend upload route.
function parseExcelFile({ fileContent, filename }) {
    console.log(`[Executor] Parsing excel file: ${filename || '(unnamed)'}`);
    const buffer = Buffer.from(fileContent, 'base64');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    // forward-fill ArtifactId across merged rows
    let lastArtifactId = '';
    rows.forEach(row => {
        const id = row.ArtifactId?.toString().trim();
        if (id) {
            lastArtifactId = id;
        } else {
            row.ArtifactId = lastArtifactId;
        }
    });

    // group by ArtifactId
    const grouped = {};
    rows.forEach(row => {
        const id = row.ArtifactId;
        if (!grouped[id]) {
            grouped[id] = { artifactId: id, parameters: [], deploy: false };
        }

        grouped[id].parameters.push({
            key: row.ParameterKey?.toString().trim(),
            value: row.ParameterValue?.toString().trim()
        });

        const deployVal = row.Deploy?.toString().trim().toLowerCase();
        if (['yes', 'true', '1'].includes(deployVal)) {
            grouped[id].deploy = true;
        }
    });

    return { artifacts: Object.values(grouped) };
}

function getSheetNames({ filePath }) {
    const workbook = XLSX.readFile(filePath);
    return { sheets: workbook.SheetNames };
}

function readSheet({ filePath, sheetName }) {
    const workbook = XLSX.readFile(filePath);
    const name = sheetName || workbook.SheetNames[0];
    const sheet = workbook.Sheets[name];

    if (!sheet) {
        throw new Error(`Sheet "${name}" not found in workbook`);
    }

    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    return { sheetName: name, rows };
}

const handlers = { parseExcelFile, getSheetNames, readSheet };

async function executeTool(toolConfig, params) {
    const mockMode = getMockMode();

    if (mockMode) {
        console.log(`[Executor] Mock mode — returning mock response for ${toolConfig.name}`);
        return toolConfig.mockResponse;
    }

    console.log(`[Executor] Real mode — executing ${toolConfig.name}`, params);

    const handler = handlers[toolConfig.operation];
    if (!handler) {
        throw new Error(`No handler registered for operation: ${toolConfig.operation}`);
    }

    return handler(params);
}

module.exports = { executeTool };
