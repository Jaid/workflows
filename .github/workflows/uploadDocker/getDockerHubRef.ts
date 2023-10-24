import * as core from '@actions/core'
const inputs = JSON.parse(process.env.inputs)
const setOutput = (value, name = 'value') => {
  core.setOutput(name, value)
  core.info(`Output ${name}: ${value}`)
}
if (process.env.dockerHubTokenLength > 0) {
  const dockerHubRef = `${inputs.dockerHubRegistry}/${inputs.imageSlug}`
  setOutput(dockerHubRef)
}
