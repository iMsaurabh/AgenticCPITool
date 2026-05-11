const express = require('express');
const multer = require('multer');
const mcpClient = require('../mcp/mcpClient');
const batchExecutionAgent = require('../agents/batchExecutionAgent');
const { generateReport } = require('../utils/reportGenerator');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/chat/upload', upload.single('file'), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        const fileContent = req.file.buffer.toString('base64');
        const filename = req.file.originalname;

        const parsed = await mcpClient.callTool('parseExcelFile', { fileContent, filename });
        const results = await batchExecutionAgent.run(parsed.artifacts);

        const reportFilename = generateReport(filename, results);

        res.json({
            success: true,
            data: {
                filename,
                results,
                reportUrl: `/api/reports/${reportFilename}`,
                message: req.body.message || ''
            }
        });
    } catch (err) {
        next(err);
    }
});

const path = require('path');
router.get('/reports/:filename', (req, res) => {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, '../../tmp', req.params.filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, error: 'Report not found' });
    }

    const fileBuffer = fs.readFileSync(filePath);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.filename}"`);
    res.setHeader('Content-Length', fileBuffer.length);
    res.end(fileBuffer);
});

module.exports = router;