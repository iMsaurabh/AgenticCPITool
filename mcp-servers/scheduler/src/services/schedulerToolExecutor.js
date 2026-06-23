// schedulerToolExecutor handles tool call execution for scheduler tools.
// When the MCP server receives a tool call from the agent,
// this executor runs the appropriate job operation.

const jobStore = require('./jobStore');
const jobScheduler = require('./jobScheduler');
const sseManager = require('../utils/sseManager');

// buildCronExpression is imported to include in preview
const { buildCronExpression } = require('./jobScheduler');

// type coercion helpers
// all params arrive as strings since tool schema uses string types
// these convert to correct types before use
function toBoolean(val, defaultVal = true) {
    if (val === undefined || val === null || val === '') return defaultVal;
    if (typeof val === 'boolean') return val;
    return val === 'true';
}

function toNumber(val, defaultVal = 0) {
    if (val === undefined || val === null || val === '') return defaultVal;
    if (typeof val === 'number') return val;
    return parseInt(val, 10) || defaultVal;
}

// parse days — may arrive as JSON string "[]" or "[\"monday\"]"
function parseDays(days) {
    if (!days || days === '[]' || days === '') return [];
    if (Array.isArray(days)) return days;
    try {
        return JSON.parse(days);
    } catch {
        return [];
    }
}

const schedulerToolExecutor = {

    // previewJob returns a formatted summary for user confirmation
    // does NOT create the job — only previews it
    async previewJob(params) {
        const parsedParams = typeof params.parameters === 'string'
            ? JSON.parse(params.parameters)
            : (params.parameters || {});

        const tz = params.timezone || 'UTC'
        const schedule = {
            frequency: params.frequency,
            days: parseDays(params.days),
            time: params.time,
            dayOfMonth: params.dayOfMonth ? toNumber(params.dayOfMonth) : undefined,
            timezone: tz
        };

        const cronExpression = buildCronExpression(schedule);

        return {
            preview: true,
            jobName: params.jobName,
            tool: params.tool,
            parameters: parsedParams,
            schedule: {
                ...schedule,
                cron: cronExpression,
                description: buildScheduleDescription(schedule)
            },
            retry: {
                enabled: toBoolean(params.retryEnabled, true),
                maxRetries: toNumber(params.maxRetries, 2),
                delayMinutes: 5,
                timeoutSeconds: 30
            },
            message: `Please confirm: "${params.jobName}" will run ${buildScheduleDescription(schedule)} using tool "${params.tool}" with parameters ${JSON.stringify(parsedParams)}. Reply "yes" to confirm or "no" to cancel.`
        };
    },

    // createJob creates and schedules the job
    async createJob(params) {
        const parsedParams = typeof params.parameters === 'string'
            ? JSON.parse(params.parameters)
            : (params.parameters || {});

        const tz = params.timezone || 'UTC'
        const schedule = {
            frequency: params.frequency,
            days: parseDays(params.days),
            time: params.time,
            dayOfMonth: params.dayOfMonth ? toNumber(params.dayOfMonth) : undefined,
            timezone: tz,
            cron: buildCronExpression({
                frequency: params.frequency,
                days: params.days || [],
                time: params.time,
                dayOfMonth: params.dayOfMonth ? toNumber(params.dayOfMonth) : undefined
            })
        };

        const job = jobStore.createJob({
            name: params.jobName,
            tool: params.tool,
            parameters: parsedParams,
            schedule,
            retry: {
                enabled: toBoolean(params.retryEnabled, true),
                maxRetries: toNumber(params.maxRetries, 2),
                delayMinutes: toNumber(params.delayMinutes, 5),
                timeoutSeconds: 30
            },
            enabled: true
        });

        jobScheduler.startJob(job);

        // broadcast job:scheduled event to notify frontend
        sseManager.broadcastJobScheduled(job);

        // if frequency is 'once' and time is soon, run immediately
        if (schedule.frequency === 'once') {
            const [hour, minute] = (schedule.time || '').split(':').map(Number);
            if (!isNaN(hour) && !isNaN(minute)) {
                const now = new Date();
                const scheduled = new Date();
                scheduled.setUTCHours(hour, minute, 0, 0);

                // if scheduled time is within next 60 seconds, run immediately
                const timeUntilRun = scheduled.getTime() - now.getTime();
                if (timeUntilRun >= 0 && timeUntilRun <= 60000) {
                    jobScheduler.runJobNow(job.id, false)
                        .catch(err => console.error('[Executor] Immediate execution error:', err.message));
                }
            }
        }

        return {
            success: true,
            jobId: job.id,
            jobName: job.name,
            schedule: buildScheduleDescription(schedule),
            message: `Job "${job.name}" created and scheduled. ID: ${job.id}`
        };
    },

    // listJobs returns all jobs with human readable schedule
    async listJobs() {
        const jobs = jobStore.getAllJobs();
        return {
            count: jobs.length,
            jobs: jobs.map(j => ({
                id: j.id,
                name: j.name,
                tool: j.tool,
                schedule: buildScheduleDescription(j.schedule),
                enabled: j.enabled,
                lastRun: j.lastRun,
                lastStatus: j.lastStatus,
                nextRun: j.nextRun
            }))
        };
    },

    // deleteJob removes job from store and stops cron task
    async deleteJob(params) {
        const job = jobStore.getJobById(params.jobId);
        if (!job) throw new Error(`Job ${params.jobId} not found`);

        jobScheduler.stopJob(params.jobId);
        jobStore.deleteJob(params.jobId);

        return {
            success: true,
            message: `Job "${job.name}" deleted successfully`
        };
    },

    // toggleJob enables or disables a job
    async toggleJob(params) {
        const job = jobStore.getJobById(params.jobId);
        if (!job) throw new Error(`Job ${params.jobId} not found`);

        const enabled = toBoolean(params.enabled, true);
        jobStore.updateJob(params.jobId, { enabled });

        if (enabled) {
            jobScheduler.startJob({ ...job, enabled: true });
        } else {
            jobScheduler.stopJob(params.jobId);
        }

        return {
            success: true,
            message: `Job "${job.name}" ${enabled ? 'enabled' : 'disabled'}`
        };
    },

    // runJobNow triggers immediate execution
    async runJobNow(params) {
        const job = jobStore.getJobById(params.jobId);
        if (!job) throw new Error(`Job ${params.jobId} not found`);

        const keepSchedule = toBoolean(params.keepSchedule, true);

        jobScheduler.runJobNow(params.jobId, keepSchedule)
            .catch(err => console.error(`[Executor] runJobNow error:`, err.message));

        return {
            success: true,
            message: `Job "${job.name}" triggered immediately. ${keepSchedule ? 'Schedule will continue.' : 'Schedule will be disabled after completion.'}`
        };
    },


    // getJobHistory returns execution history for a job
    async getJobHistory(params) {
        const job = jobStore.getJobById(params.jobId);
        if (!job) throw new Error(`Job ${params.jobId} not found`);

        const executions = jobStore.getExecutionsByJobId(params.jobId);

        return {
            jobId: params.jobId,
            jobName: job.name,
            executions: executions.map(e => ({
                id: e.id,
                status: e.status,
                attempt: e.attempt,
                maxAttempts: e.maxAttempts,
                startedAt: e.startedAt,
                completedAt: e.completedAt,
                duration: `${(e.duration / 1000).toFixed(1)}s`,
                error: e.error
            }))
        };
    }
};

// buildScheduleDescription converts schedule config to human readable string
function buildScheduleDescription(schedule) {
    const tz = schedule.timezone || 'UTC'
    const tzLabel = tz === 'UTC' ? 'UTC' : tz.split('/').pop().replace(/_/g, ' ')
    const time = `${schedule.time} ${tzLabel}`;
    switch (schedule.frequency) {
        case 'once': return `once at ${time}`;
        case 'daily': return `daily at ${time}`;
        case 'weekly': {
            const days = (schedule.days || []).join(', ');
            return `every ${days} at ${time}`;
        }
        case 'monthly': return `monthly on day ${schedule.dayOfMonth || 1} at ${time}`;
        default: return `on schedule at ${time}`;
    }
}

module.exports = schedulerToolExecutor;