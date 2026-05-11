const mcpClient = require('../mcp/mcpClient');
const { getAgentLogger } = require('../utils/agentLogger');

const logger = getAgentLogger('batchExecutionAgent');

async function run(artifacts) {
    logger.info({ artifactCount: artifacts.length }, 'BatchExecutionAgent started');

    const results = [];

    for (const artifact of artifacts) {
        const artifactResult = {
            artifactId: artifact.artifactId,
            parameters: [],
            deploy: null
        };

        // set each parameter sequentially
        for (const param of artifact.parameters) {
            try {
                logger.info({ artifactId: artifact.artifactId, key: param.key }, 'Setting parameter');

                await mcpClient.callTool('updateIFlowConfiguration', {
                    Id: artifact.artifactId,
                    ParameterKey: param.key,
                    ParameterValue: param.value
                });

                artifactResult.parameters.push({
                    key: param.key,
                    value: param.value,
                    status: 'success'
                });

            } catch (err) {
                logger.error({ artifactId: artifact.artifactId, key: param.key, error: err.message }, 'Parameter update failed');

                artifactResult.parameters.push({
                    key: param.key,
                    value: param.value,
                    status: 'failed',
                    error: err.message
                });
            }
        }

        // deploy only if flagged AND no parameter failures
        if (artifact.deploy) {
            const hasFailures = artifactResult.parameters.some(p => p.status === 'failed');

            if (hasFailures) {
                logger.warn({ artifactId: artifact.artifactId }, 'Skipping deploy — parameter failures detected');
                artifactResult.deploy = { status: 'skipped', reason: 'Parameter update failures detected' };
            } else {
                try {
                    logger.info({ artifactId: artifact.artifactId }, 'Deploying artifact');

                    await mcpClient.callTool('deployArtifact', {
                        artifactId: artifact.artifactId
                    });

                    artifactResult.deploy = { status: 'success' };

                } catch (err) {
                    logger.error({ artifactId: artifact.artifactId, error: err.message }, 'Deploy failed');
                    artifactResult.deploy = { status: 'failed', error: err.message };
                }
            }
        } else {
            artifactResult.deploy = { status: 'skipped', reason: 'Not flagged for deploy' };
        }

        results.push(artifactResult);
    }

    logger.info({ artifactCount: artifacts.length }, 'BatchExecutionAgent completed');
    return results;
}

module.exports = { run };