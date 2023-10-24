import * as core from '@actions/core'
import { context } from '@actions/github'
import sortKeys from 'sort-keys'
import {camelCase, omit} from 'lodash-es'
import preventStart from 'prevent-start'
const inputs = JSON.parse(process.env.inputs!)
const passedInputs = JSON.parse(inputs.passedInputs)
const matrixEntry = JSON.parse(inputs.matrixEntry)
if (core.isDebug()) {
  console.dir({
    inputs,
    passedInputs,
    matrixEntry,
    context
  })
}
const setOutput = (value, name = 'value') => {
  core.setOutput(name, value)
  core.info(`Output ${name}: ${value}`)
}
console.dir(omit(inputs, ['passedInputs', 'matrixEntry']))
const outputs = {
  ...omit(inputs, ['passedInputs', 'matrixEntry']),
  ...passedInputs
}
for (const [key, value] of Object.entries(matrixEntry)) {
  const exclusiveKey = camelCase(`matrix ${key}`)
  outputs[exclusiveKey] = value
}
if (!outputs.imageName) {
  outputs.imageName = preventStart.default(context.payload.repository.name.toLowerCase(), 'docker-')
}
if (!outputs.imageUser) {
  outputs.imageUser = context.payload.repository.owner.login.toLowerCase()
}
if (!outputs.imageSlug) {
  outputs.imageSlug = `${outputs.imageUser}/${outputs.imageName}`
}
if (!outputs.imageArtifact) {
  outputs.imageArtifact = `${context.runId}_${outputs.matrixId}`
}
if (!outputs.imageFolder) {
  outputs.imageFolder = `/tmp/dockerBuild/${context.runId}_${outputs.matrixId}`
}
if (!outputs.nameSuffix) {
  if (outputs.matrixId && outputs.matrixId !== 'default') {
    outputs.nameSuffix = ` (${outputs.matrixId})`
  } else {
    outputs.nameSuffix = ''
  }
}
for (const [key, value] of Object.entries(sortKeys(outputs))) {
  setOutput(value, key)
}
setOutput(JSON.stringify(outputs))
