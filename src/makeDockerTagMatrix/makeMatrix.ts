import * as core from '@actions/core'
import * as lodash from 'lodash-es'
import {firstMatch, matches} from 'super-regex'
import {VM} from 'vm2'
import yaml from 'yaml'

type Input = {
  additionEvals?: string
  bases?: string
  flavorEval?: string
  platform?: string
}
type GithubRunnerArch = 'arm64' | 'arm' | 'x64'
type DockerArch = 'linux/386' | 'linux/amd64' | 'linux/arm64/v8' | 'linux/arm/v5' | 'linux/arm/v7' | 'linux/mips64le' | 'linux/ppc64le' | 'linux/riscv64' | 'linux/s390x'

const inputs = JSON.parse(process.env.inputs!) as Input
const currentArch = process.env.arch!.toLowerCase() as GithubRunnerArch
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
const matchAll = (regex: RegExp, string: string) => {
  return [
    ...matches(regex, string, {
      matchTimeout: 60_000,
    }),
  ].map(match => match.namedGroups)
}
const runVm = (code: string, globals: Record<string, unknown>) => {
  const vm = new VM({
    allowAsync: false,
    sandbox: globals,
    timeout: 60_000,
  })
  return vm.run(code) as unknown
}
const compareNativeArch = (platform: DockerArch) => {
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
const bases = inputs.bases ? matchAll(/(?<match>[\w\-:]+)/g, inputs.bases).map(match => match.match) : ['']
const platforms = (inputs.platform as unknown) as Array<DockerArch> ? matchAll(/(?<match>[\d/a-z]+)/g, inputs.platform!).map(match => match.match) : ['linux/amd64']
const additions = inputs.additionEvals ? inputs.additionEvals
  .split('\n')
  .map(line => line.trim())
  .filter(line => line.length > 0) : []
const matrix = []
const nativeArchMatrix = []
for (const base of bases) {
  for (const platform of platforms) {
    const entry: Record<string, unknown> = {
      base,
      platform,
    }
    entry.isNativeArch = compareNativeArch(entry.platform)
    if (additions) {
      for (const addition of additions) {
        const {code, key} = firstMatch(/^(?<key>\w+)\s*:\s*(?<code>.+)$/, addition)!.namedGroups
        entry[key] = runVm(code, {
          ...entry,
        })
      }
    }
    const platformShortcuts = {
      'linux/386': '386',
      'linux/amd64': false,
      'linux/arm/v7': 'arm7',
      'linux/arm64/v8': 'arm8',
      'linux/ppc64le': 'ppc',
      'linux/riscv64': 'riscv',
      'linux/s390x': 's390x',
    }
    const baseShortcuts = {
      'debian:stable-slim': 'debian',
      'ubuntu:latest': 'lts',
      'ubuntu:rolling': false,
    }
    entry.flavor = runVm(flavorEval, {
      ...entry,
      baseShortcuts,
      platformShortcuts,
    })
    entry.buildArgs = Object.entries(entry).map(([key, value]) => `${key}=${value}`)
      .join('\n')
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
const toYaml = (input: unknown) => yaml.stringify(input, null, {
  lineWidth: 0,
  minContentWidth: 0,
  nullStr: '~',
  schema: 'core',
  singleQuote: true,
})
console.log(toYaml(matrix))
