import * as core from '@actions/core'
import * as github from '@actions/github'
import yaml from 'yaml'
const toYaml = input => yaml.stringify(input, null, {
  schema: 'core',
  lineWidth: 0,
  minContentWidth: 0,
  singleQuote: true,
  nullStr: '~'
})
core.startGroup('all as dir')
console.dir(github)
core.endGroup()
core.startGroup('context as yaml')
console.log(toYaml(github.context))
core.endGroup()