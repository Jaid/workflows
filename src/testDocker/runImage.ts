import {execa} from 'execa'
import fs from 'fs-extra'
import * as shellQuote from 'shell-quote'
import {VM} from 'vm2'

const inputs = JSON.parse(process.env.inputs!)
const args = ['run', '--rm']
if (inputs.dockerRunArgs) {
  const dockerRunArgsArray = shellQuote.parse(inputs.dockerRunArgs)
  args.push(...dockerRunArgsArray)
}
if (inputs.arch !== 'linux/amd64') {
  args.push('--platform', inputs.arch)
}
args.push(inputs.imageIdentifier)
if (inputs.appArgs) {
  const appArgsArray = shellQuote.parse(inputs.appArgs)
  args.push(...appArgsArray)
}
const executionResult = await execa('docker', args, {
  all: true,
  verbose: true,
})
const sandboxGlobals = {
  executionResult,
  fs,
  inputs,
  status: executionResult.exitCode,
  stderr: executionResult.stderr,
  stdout: executionResult.stdout,
}
console.dir(sandboxGlobals)
if (inputs.testEval) {
  console.log(`Running validation expression: ${inputs.testEval}`)
  const vm = new VM({
    sandbox: sandboxGlobals,
  })
  const validation = vm.run(inputs.testEval)
  console.log(`Validation expression returned: ${validation}`)
  if (!validation) {
    throw new Error(`Validation expression returned ${validation}`)
  }
}
