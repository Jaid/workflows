import {appendFileSync} from 'node:fs'

export function readInputs<T>(): T {
  return JSON.parse(process.env.WORKFLOW_INPUTS!)
}

export function setOutputs(outputs: Record<string, unknown>) {
  for (const [key, value] of Object.entries(outputs)) {
    const delimiter = `end_${crypto.randomUUID()}`
    const text = typeof value === 'string' ? value : JSON.stringify(value)
    appendFileSync(process.env.GITHUB_OUTPUT!, `${key}<<${delimiter}\n${text}\n${delimiter}\n`)
  }
}
