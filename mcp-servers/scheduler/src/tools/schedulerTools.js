// schedulerTools defines the MCP tool contracts for job scheduling.
// These tools are discovered by the backend agent and made available
// to the LLM for chat-driven job scheduling.

const schedulerTools = [
    {
        name: 'previewJob',
        description: `Preview a scheduled job before creating it. Use this when the user wants
      to schedule any task or job. Gather all required information first, then call this tool
      to show the user a confirmation summary before creating the job. Always call previewJob
      BEFORE createJob. Never create a job without user confirmation.`,
        parameters: {
            type: 'object',
            properties: {
                jobName: { type: 'string', description: 'Descriptive name for the job' },
                tool: { type: 'string', description: 'Tool name to execute (e.g. deployArtifact)' },
                parameters: { type: 'string', description: 'Tool parameters as JSON string e.g. {"artifactId":"demo"}' },
                frequency: { type: 'string', description: 'once | daily | weekly | monthly' },
                days: {
                    type: 'string',
                    description: 'Days of week for weekly jobs as JSON string e.g. "[\"monday\",\"tuesday\"]" or "[]" for non-weekly'
                },
                time: { type: 'string', description: 'Execution time in HH:MM format in the user\'s local timezone e.g. 09:00' },
                timezone: { type: 'string', description: 'IANA timezone of the user e.g. Europe/London, Asia/Kolkata, America/New_York. Always pass this from the system context.' },
                dayOfMonth: { type: 'string', description: 'Day of month for monthly jobs as string e.g. "1"' },
                retryEnabled: { type: 'string', description: 'Whether to retry on failure: "true" or "false"' },
                maxRetries: { type: 'string', description: 'Maximum retry attempts as string e.g. "2"' }
            },
            required: ['jobName', 'tool', 'frequency', 'time']
        }
    },

    {
        name: 'createJob',
        description: `Create a scheduled job after user has confirmed the preview.
      Only call this after the user has explicitly said yes, confirmed, or agreed
      to the job preview. Never call this without prior user confirmation.`,
        parameters: {
            type: 'object',
            properties: {
                jobName: { type: 'string', description: 'Descriptive name for the job' },
                tool: { type: 'string', description: 'Tool name to execute' },
                parameters: { type: 'string', description: 'Tool parameters as JSON string' },
                frequency: { type: 'string', description: 'once | daily | weekly | monthly' },
                days: {
                    type: 'string',
                    description: 'Days of week for weekly jobs as JSON string e.g. "[\"monday\",\"tuesday\"]" or "[]" for non-weekly'
                },
                time: { type: 'string', description: 'Execution time in HH:MM format in the user\'s local timezone' },
                timezone: { type: 'string', description: 'IANA timezone of the user e.g. Europe/London, Asia/Kolkata, America/New_York. Always pass this from the system context.' },
                dayOfMonth: { type: 'string', description: 'Day of month for monthly jobs as string' },
                retryEnabled: { type: 'string', description: 'Whether to retry on failure: "true" or "false"' },
                maxRetries: { type: 'string', description: 'Maximum retry attempts as string' },
                delayMinutes: { type: 'string', description: 'Minutes between retries as string' }
            },
            required: ['jobName', 'tool', 'frequency', 'time']
        }
    },

    {
        name: 'listJobs',
        description: `List all scheduled jobs with their status, schedule and last execution result.
      Use when user asks to see, show, list or check their scheduled jobs.`,
        parameters: {
            type: 'object',
            properties: {},
            required: []
        }
    },

    {
        name: 'deleteJob',
        description: `Delete a scheduled job permanently. Always confirm with user before deleting.
      Use listJobs first if the user does not know the job ID.`,
        parameters: {
            type: 'object',
            properties: {
                jobId: { type: 'string', description: 'ID of the job to delete' }
            },
            required: ['jobId']
        }
    },

    {
        name: 'toggleJob',
        description: `Enable or disable a scheduled job without deleting it. 
      Use when user wants to pause or resume a job.`,
        parameters: {
            type: 'object',
            properties: {
                jobId: { type: 'string', description: 'ID of the job to toggle' },
                enabled: { type: 'string', description: 'true to enable, false to disable' }
            },
            required: ['jobId', 'enabled']
        }
    },

    {
        name: 'runJobNow',
        description: `Execute a scheduled job immediately, outside its normal schedule.
      Ask user if they want to keep the schedule running after immediate execution.`,
        parameters: {
            type: 'object',
            properties: {
                jobId: { type: 'string', description: 'ID of the job to run immediately' },
                keepSchedule: {
                    type: 'string',
                    description: 'Whether to keep schedule after immediate run: "true" or "false"'
                }
            },
            required: ['jobId', 'keepSchedule']
        }
    },

    {
        name: 'getJobHistory',
        description: `Get execution history for a specific job. Use when user asks about 
      past executions, job logs or execution details.`,
        parameters: {
            type: 'object',
            properties: {
                jobId: { type: 'string', description: 'ID of the job to get history for' }
            },
            required: ['jobId']
        }
    }
];

module.exports = schedulerTools;