import * as core from '@actions/core'
const steps = JSON.parse(process.env.steps!)
const setOutput = (value, name = 'value') => {
  core.setOutput(name, value)
  core.info(`Output ${name}: ${value}`)
}
const output = {
  oldTag: steps.createTag.outputs.old_tag,
  newTag: steps.createTag.outputs.new_tag,
  newSemver: steps.extractSemvers.outputs.newSemver,
  releaseId: steps.updateRelease.outputs.id,
  releaseUrl: steps.updateRelease.outputs.html_url,
  releaseTitle: steps.getReleaseTexts.outputs.title,
  releaseBody: steps.getReleaseTexts.outputs.body
}
setOutput(JSON.stringify(output))
