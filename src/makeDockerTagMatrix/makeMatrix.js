import * as core from '@actions/core';
import { firstMatch, matches } from 'super-regex';
import { VM } from 'vm2';
import yaml from 'yaml';
const inputs = JSON.parse(process.env.inputs);
const currentArch = process.env.arch.toLowerCase();
const setOutput = (value, name = `value`) => {
    core.setOutput(name, value);
    core.info(`Output ${name}: ${value}`);
};
const flavorEval = inputs.flavorEval ?? `[
  baseShortcuts[base] ?? base,
  platformShortcuts[platform] ?? platform.replaceAll('/', '_')
].filter(part => part?.length).join('-')`;
console.dir({
    inputs,
});
const matchAll = (regex, string) => {
    return [...matches(regex, string, {
            matchTimeout: 60000,
        })].map(match => match.namedGroups);
};
const runVm = (code, globals) => {
    const vm = new VM({
        allowAsync: false,
        sandbox: globals,
        timeout: 60000,
    });
    return vm.run(code);
};
const compareNativeArch = (platform) => {
    if (currentArch === `x64`) {
        return platform === `linux/amd64`;
    }
    if (currentArch === `arm64`) {
        return platform === `linux/arm64/v8`;
    }
    if (currentArch === `arm`) {
        return platform === `linux/arm/v7`;
    }
    return false;
};
const bases = inputs.bases
    ? matchAll(/(?<match>[\w\-:]+)/g, inputs.bases).map(match => match.match)
    : [``];
const platforms = inputs.platform
    ? matchAll(/(?<match>[\d/a-z]+)/g, inputs.platform).map(match => match.match)
    : [`linux/amd64`];
const additions = inputs.additionEvals
    ? inputs.additionEvals
        .split(`\n`)
        .map(line => line.trim())
        .filter(line => line.length > 0)
    : [];
const matrix = [];
const nativeArchMatrix = [];
for (const base of bases) {
    for (const platform of platforms) {
        const entry = {
            base,
            platform,
        };
        entry.isNativeArch = compareNativeArch(entry.platform);
        if (additions) {
            for (const addition of additions) {
                const { code, key } = firstMatch(/^(?<key>\w+)\s*:\s*(?<code>.+)$/, addition).namedGroups;
                entry[key] = runVm(code, {
                    ...entry,
                });
            }
        }
        const platformShortcuts = {
            'linux/386': `386`,
            'linux/amd64': false,
            'linux/arm/v7': `arm7`,
            'linux/arm64/v8': `arm8`,
            'linux/ppc64le': `ppc`,
            'linux/riscv64': `riscv`,
            'linux/s390x': `s390x`,
        };
        const baseShortcuts = {
            'debian:stable-slim': `debian`,
            'ubuntu:latest': `lts`,
            'ubuntu:rolling': false,
        };
        entry.flavor = runVm(flavorEval, {
            ...entry,
            baseShortcuts,
            platformShortcuts,
        });
        entry.buildArgs = Object.entries(entry).map(([key, value]) => `${key}=${value}`).join(`\n`);
        entry.id = entry.flavor || `default`;
        matrix.push(entry);
        if (entry.isNativeArch) {
            nativeArchMatrix.push(entry);
        }
    }
}
setOutput(JSON.stringify(matrix));
setOutput(JSON.stringify(nativeArchMatrix), `nativeArch`);
console.log(`Matrix:`);
const toYaml = (input) => yaml.stringify(input, null, {
    lineWidth: 0,
    minContentWidth: 0,
    nullStr: `~`,
    schema: `core`,
    singleQuote: true,
});
console.log(toYaml(matrix));
