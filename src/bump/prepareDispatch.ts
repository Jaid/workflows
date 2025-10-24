import * as core from '@actions/core'

const steps = JSON.parse(process.env.steps!)
const setOutput = (value, name = 'value') => {
  core.setOutput(name, value)
  core.info(`Output ${name}: ${value}`)
}
const output = {
  newSemver: steps.extractSemvers.outputs.newSemver,
  newTag: steps.createTag.outputs.new_tag,
  oldTag: steps.createTag.outputs.old_tag,
  releaseBody: steps.getReleaseTexts.outputs.body,
  releaseId: steps.updateRelease.outputs.id,
  releaseTitle: steps.getReleaseTexts.outputs.title,
  releaseUrl: steps.updateRelease.outputs.html_url,
}
setOutput(JSON.stringify(output))
