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