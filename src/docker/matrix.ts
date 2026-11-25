import {runInNewContext} from 'node:vm'
import {readInputs, setOutputs} from '../actions.ts'
import {isNative} from './platform.ts'

type MatrixInputs = {bases?: string, platform?: string, additionEvals?: string, flavorEval?: string}
const split = (value?: string): string[] => value?.match(/[^\s,;]+/g) ?? []
const getFlavorPart = (value: string) => value.replaceAll(/[^\w.-]+/g, '-').replaceAll(/^[.-]+|[.-]+$/g, '').replaceAll(/-{2,}/g, '-')
const baseShortcuts: Record<string, string | false> = {'debian:stable-slim': 'debian', 'ubuntu:latest': 'lts', 'ubuntu:rolling': false}
const platformShortcuts: Record<string, string | false> = {
  'linux/386': '386', 'linux/amd64': false, 'linux/arm/v7': 'arm7', 'linux/arm64': 'arm8', 'linux/arm64/v8': 'arm8', 'linux/ppc64le': 'ppc', 'linux/riscv64': 'riscv', 'linux/s390x': 's390x',
}

export function makeMatrix(inputs: MatrixInputs, runnerArch = process.env.RUNNER_ARCH) {
  const bases = split(inputs.bases)
  const platforms = split(inputs.platform)
  if (!bases.length) bases.push('')
  if (!platforms.length) platforms.push('linux/amd64')
  if (bases.length * platforms.length > 256) throw new Error('GitHub Actions matrices support at most 256 jobs.')
  const additions = (inputs.additionEvals ?? '').split('\n').map(line => line.trim()).filter(Boolean).map(line => {
    const match = /^(\w+)\s*:\s*(.+)$/.exec(line)
    if (!match || ['base', 'platform', 'isNativeArch', 'id', 'flavor', 'buildArgs', '__proto__'].includes(match[1])) throw new Error(`Invalid matrix addition: ${line}`)
    return [match[1], match[2]] as const
  })
  const ids = new Set<string>()
  return bases.flatMap(base => platforms.map(platform => {
    const isNativeArch = isNative(platform, runnerArch)
    const values: Record<string, unknown> = {base, platform, isNativeArch}
    for (const [key, code] of additions) {
      values[key] = runInNewContext(code, {...values}, {timeout: 1000})
    }
    const flavor = inputs.flavorEval
      ? runInNewContext(inputs.flavorEval, {...values, baseShortcuts, platformShortcuts, getFlavorPart}, {timeout: 1000})
      : [baseShortcuts[base] ?? getFlavorPart(base), platformShortcuts[platform] ?? getFlavorPart(platform)].filter(Boolean).join('-')
    if (flavor && (typeof flavor !== 'string' || !/^[\w][\w.-]*$/.test(flavor))) throw new Error(`Invalid Docker flavor: ${flavor}`)
    const id = flavor || 'default'
    if (ids.has(id)) throw new Error(`Duplicate matrix ID “${id}”. Give each base/platform pair a distinct flavor.`)
    ids.add(id)
    const buildArgs = Object.entries({...values, flavor: flavor || ''}).map(([key, value]) => `${key}=${value}`).join('\n')
    return {...values, base, platform, isNativeArch, flavor: String(flavor || ''), id: String(id), buildArgs}
  }))
}

if (import.meta.main) {
  const matrix = makeMatrix(readInputs())
  console.log(JSON.stringify(matrix, null, 2))
  setOutputs({output: matrix, nativeArch: matrix.filter(entry => entry.isNativeArch)})
}
