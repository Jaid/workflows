import * as fs from 'node:fs'
import {runInNewContext} from 'node:vm'
import {readInputs} from '../actions.ts'

// Split literal argv without interpreting variables, pipes or command substitutions.
export function splitArgs(text = '') {
  const args: string[] = []
  let word = '', quote = '', started = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '\\' && quote !== "'") {
      if (++i === text.length) throw new Error('Dangling escape in Docker arguments.')
      word += text[i]
    } else if (quote) {
      if (char === quote) quote = ''
      else word += char
    } else if (char === '"' || char === "'") {
      quote = char
    } else if (/\s/.test(char)) {
      if (started) args.push(word)
      word = ''
      started = false
      continue
    } else {
      word += char
    }
    started = true
  }
  if (quote) throw new Error('Unterminated quote in Docker arguments.')
  if (started) args.push(word)
  return args
}

export async function testImage(inputs: Record<string, string>) {
  const command = ['docker', 'run', '--rm', '--pull=never', ...splitArgs(inputs.dockerRunArgs), '--platform', inputs.arch, inputs.imageIdentifier, ...splitArgs(inputs.appArgs)]
  const child = Bun.spawn(command, {stdin: 'ignore', stdout: 'pipe', stderr: 'pipe'})
  const [out, err, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  const stdout = out.replace(/\r?\n$/, ''), stderr = err.replace(/\r?\n$/, '')
  const result = {stdout, stderr, exitCode, failed: exitCode !== 0, all: [stdout, stderr].filter(Boolean).join('\n'), command: command.join(' '), cwd: process.cwd()}
  if (child.signalCode) throw new Error(`Docker terminated with ${child.signalCode}.`)
  const readJson = (file: string) => Bun.file(file).json()
  const readJsonSync = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'))
  const files = {...fs, pathExists: (file: string) => fs.promises.access(file).then(() => true, () => false), pathExistsSync: fs.existsSync, readJson, readJSON: readJson, readJsonSync, readJSONSync: readJsonSync}
  const expression = inputs.test || inputs.testEval || 'status === 0'
  const passed = await runInNewContext(expression, {result, executionResult: result, inputs, stdout, stderr, status: exitCode, fs: files}, {timeout: 60_000})
  if (!passed) throw new Error(`Docker test failed (${expression}).\n${JSON.stringify(result, null, 2)}`)
}

if (import.meta.main) await testImage({...readInputs<Record<string, string>>(), imageIdentifier: process.env.IMAGE_IDENTIFIER!})
