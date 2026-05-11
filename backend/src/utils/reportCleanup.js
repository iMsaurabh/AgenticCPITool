const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const TMP_DIR = path.join(__dirname, '../../tmp');
const RETENTION_MS = (parseInt(process.env.REPORT_RETENTION_DAYS) || 7) * 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // run every hour

function cleanup() {
    if (!fs.existsSync(TMP_DIR)) return;

    const now = Date.now();
    const files = fs.readdirSync(TMP_DIR);

    let deleted = 0;
    for (const file of files) {
        if (file === '.gitkeep') continue;
        const filePath = path.join(TMP_DIR, file);
        const stat = fs.statSync(filePath);
        if (now - stat.mtimeMs > RETENTION_MS) {
            fs.unlinkSync(filePath);
            deleted++;
        }
    }

    if (deleted > 0) logger.info({ deleted }, 'Report cleanup: removed old reports');
}

function startCleanupScheduler() {
    cleanup(); // run once on start
    setInterval(cleanup, CLEANUP_INTERVAL_MS);
}

module.exports = { startCleanupScheduler };