const express = require('express');
const multer = require('multer');
const mcpClient = require('../mcp/mcpClient');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload', upload.single('file'), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        const fileContent = req.file.buffer.toString('base64');
        const filename = req.file.originalname;

        const parsed = await mcpClient.callTool('parseExcelFile', { fileContent, filename });

        res.json({
            success: true,
            data: {
                filename,
                artifacts: parsed.artifacts,
                message: req.body.message || ''
            }
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
