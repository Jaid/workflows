import * as core from '@actions/core'
import { matches, firstMatch } from 'super-regex'
import { VM } from 'vm2'
import yaml from 'yaml'
const inputs = JSON.parse(process.env.inputs!)
const setOutput = (value, name = 'value') => {
  core.setOutput(name, value)
  core.info(`Output ${name}: ${value}`)
}
const flavorEval = inputs.flavorEval || `[
  baseShortcuts[base] ?? base,
  platformShortcuts[platform] ?? platform.replaceAll('/', '_')
].filter(part => part?.length).join('-')`

console.dir({
  inputs,
})

const matchAll = (regex, string) => {
  return Array.from(
    matches(regex, string, {
      matchTimeout: 60_000,
    })
  ).map((match) => match.namedGroups)
}

const runVm = (code, globals) => {
  const vm = new VM({
    sandbox: globals,
    allowAsync: false,
    timeout: 60_000,
  })
  return vm.run(code)
}

const compareNativeArch = platform => {
  const currentArch = process.env.arch.toLowerCase()
  if (currentArch === 'x64') {
    return platform === 'linux/amd64'
  }
  if (currentArch === 'arm64') {
    return platform === 'linux/arm64/v8'
  }
  if (currentArch === 'arm') {
    return platform === 'linux/arm/v7'
  }
  return false
}

const bases = inputs.bases
  ? matchAll(/(?<match>[\w-_:]+)/g, inputs.bases).map((match) => match.match)
  : ['']
const platforms = inputs.platform
  ? matchAll(/(?<match>[a-z0-9/]+)/g, inputs.platform).map((match) => match.match)
  : ['linux/amd64']
const additions = inputs.additionEvals
  ? inputs.additionEvals
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
  : []
const matrix = []
const nativeArchMatrix = []
for (const base of bases) {
  for (const platform of platforms) {
    const entry = {
      platform,
      base,
    }
    entry.isNativeArch = compareNativeArch(entry.platform)
    if (additions) {
      for (const addition of additions) {
        const { key, code } = firstMatch(
          /^(?<key>\w+)\s*:\s*(?<code>.+)$/,
          addition
        ).namedGroups
        entry[key] = runVm(code, {
          ...entry,
        })
      }
    }
    const platformShortcuts = {
      'linux/amd64': false,
      'linux/arm/v7': 'arm7',
      'linux/arm64/v8': 'arm8',
      'linux/ppc64le': 'ppc',
      'linux/s390x': 's390x',
      'linux/386': '386',
    }
    const baseShortcuts = {
      'ubuntu:rolling': false,
      'debian:stable-slim': 'debian',
      'ubuntu:latest': 'lts',
    }
    entry.flavor = runVm(flavorEval, {
      ...entry,
      platformShortcuts,
      baseShortcuts,
    })
    entry.buildArgs = Object.entries(entry).map(([key, value]) => `${key}=${value}`).join('\n')
    entry.id = entry.flavor || 'default'
    matrix.push(entry)
    if (entry.isNativeArch) {
      nativeArchMatrix.push(entry)
    }
  }
}

setOutput(JSON.stringify(matrix))
setOutput(JSON.stringify(nativeArchMatrix), 'nativeArch')

console.log('Matrix:')
const toYaml = input => yaml.stringify(input, null, {
  schema: 'core',
  lineWidth: 0,
  minContentWidth: 0,
  singleQuote: true,
  nullStr: '~'
})
console.log(toYaml(matrix))