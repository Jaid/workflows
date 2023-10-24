import * as core from '@actions/core'
const inputs = JSON.parse(process.env.inputs)
const setOutput = (value, name = 'value') => {
  core.setOutput(name, value)
  core.info(`Output ${name}: ${value}`)
}
const getCleanedVersionTag = tag => {
  if (!tag) {
    return ''
  }
  if (inputs.versionTagSemverPrefix == null) {
    return tag
  }
  const semver = /(?<versionPrefix>v?)(?<version>\d+\.\d+\.\d+)/.exec(tag)?.groups
  if (semver) {
    return `${inputs.versionTagSemverPrefix}${semver.version}`
  }
  return tag
}
setOutput(getCleanedVersionTag(inputs.versionTag))
