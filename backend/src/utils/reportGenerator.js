const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const TMP_DIR = path.join(__dirname, '../../tmp');

function generateReport(filename, results) {
    // flatten results into rows
    const rows = [];

    for (const artifact of results) {
        for (const param of artifact.parameters) {
            rows.push({
                ArtifactId: artifact.artifactId,
                ParameterKey: param.key,
                ParameterValue: param.value,
                ParameterStatus: param.status,
                ParameterError: param.error || '',
                DeployStatus: artifact.deploy?.status || '',
                DeployError: artifact.deploy?.error || ''
            });
        }
    }

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Results');

    // ensure tmp dir exists
    if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

    const reportFilename = `report_${Date.now()}.xlsx`;
    const reportPath = path.join(TMP_DIR, reportFilename);
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    fs.writeFileSync(reportPath, buffer);

    return reportFilename;
}

module.exports = { generateReport };