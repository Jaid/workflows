import * as core from '@actions/core'
import {context} from '@actions/github'

const inputs = JSON.parse(process.env.inputs)
const setOutput = (value, name = 'value') => {
  core.setOutput(name, value)
  core.info(`Output ${name}: ${value}`)
}
const references = [process.env.githubRef]
if (process.env.dockerHubRef) {
  references.push(process.env.dockerHubRef)
}
const output = references.join('\n')
setOutput(output)
