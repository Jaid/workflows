import * as core from '@actions/core'
import { context } from '@actions/github'
const inputs = JSON.parse(process.env.inputs!)
const setOutput = (value:string, name = 'value') => {
  core.setOutput(name, value)
  core.info(`Output ${name}: ${value}`)
}
const githubRef = `${inputs.githubRegistry}/${context.payload.repository.full_name.toLowerCase()}/${inputs.buildImageName}`
setOutput(githubRef)
