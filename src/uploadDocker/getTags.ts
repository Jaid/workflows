import * as core from '@actions/core'
const inputs = JSON.parse(process.env.inputs)
const setOutput = (value, name = 'value') => {
  core.setOutput(name, value)
  core.info(`Output ${name}: ${value}`)
}
const tags = []
const add = input => {
  if (!input) {
    return
  }
  let addition
  if (typeof input === 'string') {
    addition = input.split('\n')
  } else {
    addition = input
  }
  for (const tag of addition) {
    if (tag) {
      tags.push(tag.trim())
    }
  }
}
add(inputs.baseTags)
add(inputs.additionalTags)
if (process.env.versionTag) {
  add(`type=raw,value=${process.env.versionTag}`)
}
if (inputs.addVersionTag) {
  add(`type=pep440,pattern=${inputs.versionTagPrefix ?? ''}{{version}}`)
}
if (inputs.addShaTags) {
  add('type=sha,format=long')
}
if (inputs.addScheduleTags) {
  add('type=schedule,pattern=nightly')
  add('type=schedule,pattern={{date \'YYYYMMDD\'}}')
}
if (!tags.length) {
  core.error('No tags given')
  process.exit(1)
}
setOutput(tags.join('\n'))
