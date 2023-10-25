import * as core from '@actions/core'
const inputs = JSON.parse(process.env.inputs!)
const github = JSON.parse(process.env.github!)
const setOutput = (value:unknown, name = 'value') => {
  core.setOutput(name, value)
  core.info(`Output ${name}: ${value}`)
}
const outputs = {
  ...inputs
}
if (!outputs.id) {
  outputs.id = 'default'
}
if (!outputs.imageArtifact) {
  outputs.imageArtifact = `${github.run_id}_${outputs.id}`
}
if (!outputs.imageFolder) {
  outputs.imageFolder = `/tmp/dockerBuild/${github.run_id}_${outputs.id}`
}
for (const [key, value] of Object.entries(outputs)) {
  setOutput(value, key)
}
setOutput(JSON.stringify(outputs))
