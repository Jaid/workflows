import * as core from '@actions/core';
const secrets = JSON.parse(process.env.secrets);
const setOutput = (value, name = `value`) => {
    core.setOutput(name, value);
    core.info(`Output ${name}: ${value}`);
};
setOutput(secrets.dockerHubToken?.length ?? 0);
