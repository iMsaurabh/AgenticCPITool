// toolExecutor is the execution engine for all Excel tool calls.
// When the MCP server receives a tool call from the agent:
//   1. Checks USE_MOCK — returns mockResponse if true
//   2. Otherwise dispatches to the exceljs handler for the requested operation
//
// Operations are identified by toolConfig.operation, not HTTP method/endpoint.
// Adding a new tool to toolsConfig.json + a matching handler here enables it.

const ExcelJS = require('exceljs');

function getMockMode() {
    try {
        return require('../server').getMockMode();
    } catch {
        return process.env.USE_MOCK === 'true';
    }
}

// worksheetToRows converts an ExcelJS worksheet into an array of plain objects
// using the first row as headers, matching xlsx's sheet_to_json({ defval: '' }) behavior.
function worksheetToRows(worksheet, defval = '') {
    const headers = [];
    worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell) => {
        headers.push(cell.value != null ? cell.value.toString() : '');
    });

    const rows = [];
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const rowObj = {};
        headers.forEach((header, idx) => {
            const cell = row.getCell(idx + 1);
            rowObj[header] = cell.value != null ? cell.value.toString() : defval;
        });
        rows.push(rowObj);
    });
    return rows;
}

// parseExcelFile replicates the backend's forwardFillAndGroup logic so the
// agent sees the same grouped structure the frontend receives after an upload.
// fileContent is a base64 string sent by the backend upload route.
async function parseExcelFile({ fileContent, filename }) {
    console.log(`[Executor] Parsing excel file: ${filename || '(unnamed)'}`);
    const buffer = Buffer.from(fileContent, 'base64');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];
    const rows = worksheetToRows(worksheet);

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

async function getSheetNames({ filePath }) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    return { sheets: workbook.worksheets.map(ws => ws.name) };
}

async function readSheet({ filePath, sheetName }) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = sheetName
        ? workbook.getWorksheet(sheetName)
        : workbook.worksheets[0];

    if (!worksheet) {
        throw new Error(`Sheet "${sheetName}" not found in workbook`);
    }

    const rows = worksheetToRows(worksheet);
    return { sheetName: worksheet.name, rows };
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
