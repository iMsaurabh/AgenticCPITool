// toolLoader reads toolsConfig.json and converts each tool entry
// into an MCP compatible tool definition.

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.resolve(__dirname, '../config/toolsConfig.json');

function loadTools() {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const config = JSON.parse(raw);
    return config.tools;
}

function buildInputSchema(parameters) {
    const properties = {};
    const required = [];

    for (const param of parameters) {
        properties[param.name] = {
            type: param.type,
            description: param.description
        };

        if (param.required) {
            required.push(param.name);
        }
    }

    return { type: 'object', properties, required };
}

function getMcpToolDefinitions() {
    const tools = loadTools();
    return tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: buildInputSchema(tool.parameters)
    }));
}

function getToolConfig(toolName) {
    const tools = loadTools();
    return tools.find(t => t.name === toolName) || null;
}

function getAllToolConfigs() {
    return loadTools();
}

function addTool(toolConfig) {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const config = JSON.parse(raw);

    const exists = config.tools.find(t => t.name === toolConfig.name);
    if (exists) {
        throw new Error(`Tool with name "${toolConfig.name}" already exists`);
    }

    config.tools.push(toolConfig);
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
    return toolConfig;
}

function removeTool(toolName) {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const config = JSON.parse(raw);

    const index = config.tools.findIndex(t => t.name === toolName);
    if (index === -1) {
        throw new Error(`Tool "${toolName}" not found`);
    }

    config.tools.splice(index, 1);
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

module.exports = {
    loadTools,
    getMcpToolDefinitions,
    getToolConfig,
    getAllToolConfigs,
    addTool,
    removeTool
};
