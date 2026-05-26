const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

const TMP_DIR = path.join(__dirname, '../../tmp');

async function generateReport(filename, results) {
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

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Results');

    worksheet.columns = [
        { header: 'ArtifactId', key: 'ArtifactId' },
        { header: 'ParameterKey', key: 'ParameterKey' },
        { header: 'ParameterValue', key: 'ParameterValue' },
        { header: 'ParameterStatus', key: 'ParameterStatus' },
        { header: 'ParameterError', key: 'ParameterError' },
        { header: 'DeployStatus', key: 'DeployStatus' },
        { header: 'DeployError', key: 'DeployError' }
    ];

    worksheet.addRows(rows);

    if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

    const reportFilename = `report_${Date.now()}.xlsx`;
    const reportPath = path.join(TMP_DIR, reportFilename);
    await workbook.xlsx.writeFile(reportPath);

    return reportFilename;
}

module.exports = { generateReport };
