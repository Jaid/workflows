import * as core from '@actions/core';
import { camelCase, omit } from 'lodash-es';
import sortKeys from 'sort-keys';
const inputs = JSON.parse(process.env.inputs);
const buildOutput = JSON.parse(inputs.buildOutput);
const setOutput = (value, name = `value`) => {
    core.setOutput(name, value);
    core.info(`Output ${name}: ${value}`);
};
const outputs = {
    ...omit(inputs, [`buildOutput`]),
};
for (const [key, value] of Object.entries(buildOutput)) {
    const exclusiveKey = camelCase(`build ${key}`);
    outputs[exclusiveKey] = value;
}
if (!outputs.id) {
    outputs.id = `default`;
}
if (!outputs.title) {
    if (outputs.id === `default`) {
        outputs.title = buildOutput.imageName;
    }
    else {
        outputs.title = `${buildOutput.imageName} (${outputs.id})`;
    }
}
for (const [key, value] of Object.entries(sortKeys(outputs))) {
    setOutput(value, key);
}
setOutput(JSON.stringify(outputs));
