import * as core from '@actions/core'
import path from 'path'
const inputs = JSON.parse(process.env.inputs!)
const github = JSON.parse(process.env.github!)
const setOutput = (value, name = 'value') => {
  core.setOutput(name, value)
  core.info(`Output ${name}: ${value}`)
}
const outputs = {
  ...inputs
}
if (!outputs.id) {
  outputs.id = 'default'
}
if (!outputs.cacheKey) {
  outputs.cacheKey = `${github.repository}|${github.workflow}|${github.ref_name}|${outputs.id}`.replaceAll(/[,|\/\\ _]+/g, '_')
}
if (!outputs.cacheFrom) {
  outputs.cacheFrom = `type=gha,scope=${outputs.cacheKey}`
}
if (!outputs.cacheTo) {
  outputs.cacheTo = `${outputs.cacheFrom},mode=max`
}
outputs.cacheHint = outputs.cacheTo.replace('mode=max', '').replace(/^,+/, '').replace(/,+$/, '').replace(/,+/g, ',')
if (!outputs.imageArtifact) {
  outputs.imageArtifact = `${github.run_id}_${outputs.id}`
}
if (!outputs.imageFile) {
  outputs.imageFile = `${outputs.imageName}.tar`
}
if (!outputs.imageFolder) {
  outputs.imageFolder = `/tmp/dockerBuild/${github.run_id}_${outputs.id}`
}
if (!outputs.imagePath) {
  outputs.imagePath = path.resolve(outputs.imageFolder, outputs.imageFile)
}
if (!outputs.imageIdentifier) {
  outputs.imageIdentifier = `${outputs.imageName}:${outputs.tag}`
}
for (const [key, value] of Object.entries(outputs)) {
  setOutput(value, key)
}
setOutput(JSON.stringify(outputs))
