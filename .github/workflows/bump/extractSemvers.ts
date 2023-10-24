import * as core from '@actions/core'
const steps = JSON.parse(process.env.steps!)
const extractSemver = (tag: string) => {
  return /(?<versionPrefix>v?)(?<version>\d+\.\d+\.\d+)/.exec(tag)?.groups
}
const newSemver = extractSemver(steps.createTag.outputs.new_tag)
console.dir({
  newTag: steps.createTag.outputs.new_tag,
  newSemver
})
core.setOutput('newSemver', newSemver?.version)
