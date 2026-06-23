// jobScheduler manages all scheduled job lifecycles.
// On startup it reads jobsConfig.json and starts cron jobs
// for all enabled jobs.
//
// Responsibilities:
//   - Start/stop cron jobs
//   - Execute jobs with retry logic
//   - Fire SSE events for job lifecycle
//   - Update job state after execution
//   - Calculate next run time
//
// node-cron runs jobs in-process. Jobs survive as long as
// the process is running. On restart, jobs are re-scheduled
// from jobsConfig.json automatically.

const cron = require('node-cron');
const jobStore = require('./jobStore');
const { executeTool } = require('./jobExecutor');
const sseManager = require('../utils/sseManager');

// activeJobs maps jobId → node-cron task instance
// used to start/stop individual jobs without restarting the server
const activeJobs = new Map();

// ─── Cron expression builder ─────────────────────────────────────────

// buildCronExpression converts user-friendly schedule config
// into a standard cron expression
// frequency: once | daily | weekly | monthly
// days: ['monday', 'tuesday', ...] (for weekly)
// time: 'HH:MM' in UTC
function buildCronExpression(schedule) {
    const [hour, minute] = schedule.time.split(':').map(Number);

    switch (schedule.frequency) {
        case 'daily':
            return `${minute} ${hour} * * *`;

        case 'weekly': {
            const dayMap = {
                sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
                thursday: 4, friday: 5, saturday: 6
            };
            const days = (schedule.days || ['monday'])
                .map(d => dayMap[d.toLowerCase()])
                .join(',');
            return `${minute} ${hour} * * ${days}`;
        }

        case 'monthly': {
            const dayOfMonth = schedule.dayOfMonth || 1;
            return `${minute} ${hour} ${dayOfMonth} * *`;
        }

        case 'once':
            // for one-time jobs, cron runs once at specified time
            // job is disabled after execution
            return `${minute} ${hour} * * *`;

        default:
            throw new Error(`Unsupported frequency: ${schedule.frequency}`);
    }
}

// ─── Job execution with retry ────────────────────────────────────────

// runJobWithRetry executes a job with configured retry logic
// fires SSE events at each stage
async function runJobWithRetry(job) {
    const maxAttempts = (job.retry?.enabled ? job.retry.maxRetries : 0) + 1;
    const timeoutMs = (job.retry?.timeoutSeconds || 30) * 1000;
    const retryDelayMs = (job.retry?.delayMinutes || 5) * 60 * 1000;

    let lastExecution = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        console.log(`[Scheduler] Running job ${job.name} — attempt ${attempt}/${maxAttempts}`);

        // fire started event
        sseManager.broadcastJobStarted(job, attempt);

        // execute the tool
        const execResult = await executeTool(
            job.tool,
            { ...job.parameters, __mockMode: 'false' }, // jobs always use real mode
            timeoutMs
        );

        // record execution in history
        lastExecution = jobStore.addExecution({
            jobId: job.id,
            jobName: job.name,
            tool: job.tool,
            parameters: job.parameters,
            status: execResult.success ? 'SUCCESS' : 'FAILED',
            result: execResult.result,
            error: execResult.error,
            attempt,
            maxAttempts,
            startedAt: execResult.startedAt,
            completedAt: execResult.completedAt,
            duration: execResult.duration,
            nextRetryAt: null
        });

        if (execResult.success) {
            // success — update job state and fire complete event
            jobStore.updateJob(job.id, {
                lastRun: new Date().toISOString(),
                lastStatus: 'SUCCESS'
            });

            sseManager.broadcastJobComplete(job, lastExecution);

            // disable one-time jobs after successful execution
            if (job.schedule.frequency === 'once') {
                jobStore.updateJob(job.id, { enabled: false });
                stopJob(job.id);
            }

            return; // exit retry loop on success
        }

        // failed — check if retries remain
        if (attempt < maxAttempts) {
            const nextRetryAt = new Date(Date.now() + retryDelayMs).toISOString();

            // update execution record with retry info
            jobStore.updateJob(job.id, { lastStatus: 'RETRYING' });

            // fire retry event — individual notification, never batched
            sseManager.broadcastJobRetry(job, attempt, maxAttempts, nextRetryAt);

            // wait before next attempt
            await new Promise(resolve => setTimeout(resolve, retryDelayMs));

            // refresh job config in case it was updated during wait
            const refreshedJob = jobStore.getJobById(job.id);
            if (!refreshedJob || !refreshedJob.enabled) {
                console.log(`[Scheduler] Job ${job.id} was disabled during retry wait. Stopping.`);
                return;
            }

        } else {
            // final failure after all retries exhausted
            jobStore.updateJob(job.id, {
                lastRun: new Date().toISOString(),
                lastStatus: 'FAILED'
            });

            sseManager.broadcastJobComplete(job, lastExecution);
        }
    }
}

// ─── Cron job management ─────────────────────────────────────────────

// startJob creates and starts a cron task for a job
function startJob(job) {
    if (activeJobs.has(job.id)) {
        stopJob(job.id); // stop existing task before starting new one
    }

    const cronExpression = buildCronExpression(job.schedule);

    if (!cron.validate(cronExpression)) {
        throw new Error(`Invalid cron expression: ${cronExpression}`);
    }

    const task = cron.schedule(cronExpression, async () => {
        // re-read job from store to get latest config
        const currentJob = jobStore.getJobById(job.id);
        if (!currentJob || !currentJob.enabled) return;

        try {
            await runJobWithRetry(currentJob);
        } catch (err) {
            console.error(`[Scheduler] Unhandled error in job ${job.id}:`, err.message);
        }
    }, {
        timezone: job.schedule.timezone || 'UTC'
    });

    activeJobs.set(job.id, task);
    console.log(`[Scheduler] Started job: ${job.name} (${cronExpression})`);
}

// stopJob stops and removes a cron task
function stopJob(jobId) {
    const task = activeJobs.get(jobId);
    if (task) {
        task.stop();
        activeJobs.delete(jobId);
        console.log(`[Scheduler] Stopped job: ${jobId}`);
    }
}

// runJobNow executes a job immediately outside its schedule
// keepSchedule: if false, job is disabled after immediate execution
async function runJobNow(jobId, keepSchedule = true) {
    const job = jobStore.getJobById(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    try {
        await runJobWithRetry(job);
    } finally {
        if (!keepSchedule) {
            jobStore.updateJob(jobId, { enabled: false });
            stopJob(jobId);
        }
    }
}

// initialize starts all enabled jobs on server startup
function initialize() {
    const jobs = jobStore.getAllJobs();
    const enabledJobs = jobs.filter(j => j.enabled);

    console.log(`[Scheduler] Initializing ${enabledJobs.length} enabled jobs`);

    for (const job of enabledJobs) {
        try {
            startJob(job);
        } catch (err) {
            console.error(`[Scheduler] Failed to start job ${job.name}:`, err.message);
        }
    }
}

function getActiveJobCount() {
    return activeJobs.size;
}

module.exports = {
    initialize,
    startJob,
    stopJob,
    runJobNow,
    buildCronExpression,
    getActiveJobCount
};