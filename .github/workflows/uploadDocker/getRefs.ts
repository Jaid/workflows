import * as core from '@actions/core'
import { context } from '@actions/github'
const inputs = JSON.parse(process.env.inputs)
const setOutput = (value, name = 'value') => {
  core.setOutput(name, value)
  core.info(`Output ${name}: ${value}`)
}
const refs = [process.env.githubRef]
if (process.env.dockerHubRef) {
  refs.push(process.env.dockerHubRef)
}
const output = refs.join('\n')
setOutput(output)
