import path from 'node:path'
import Handlebars from 'handlebars'
import {readInputs, setOutputs} from './actions.ts'

type ReleaseInputs = {bumpAmount: string, releaseBranch: string, updateFiles: boolean, releaseTitle: string, releaseBody: string, makeLatest: string}
const increments = ['major', 'minor', 'patch', 'none'] as const
const stableTag = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
const commitMessage = (version: string) => `Update package.json version to ${version}`

async function updateManifest(cwd: string, version: string) {
  const file = Bun.file(path.join(cwd, 'package.json'))
  if (!await file.exists()) return false
  const source = await file.text()
  const pkg = JSON.parse(source)
  if (!Object.hasOwn(pkg, 'version') || pkg.version === version) return false
  pkg.version = version
  const indent = /^[\t ]+(?=")/m.exec(source)?.[0]
  const text = JSON.stringify(pkg, null, indent) + (source.endsWith('\n') ? '\n' : '')
  await Bun.write(file, source.includes('\r\n') ? text.replaceAll('\n', '\r\n') : text)
  return true
}

export async function prepareRelease(inputs: ReleaseInputs, cwd: string, repository: string, serverUrl: string) {
  const {bumpAmount, makeLatest, releaseBranch} = inputs
  if (!increments.some(value => value === bumpAmount)) throw new Error(`Unknown bump amount: ${bumpAmount}`)
  if (!['true', 'false', 'legacy'].includes(makeLatest)) throw new Error(`Invalid makeLatest: ${makeLatest}`)
  const git = async (...args: string[]) => (await Bun.$`git ${args}`.cwd(cwd).text()).trim()
  const branch = `refs/heads/${releaseBranch}`
  await git('check-ref-format', branch)
  const head = await git('rev-parse', 'HEAD')
  const remote = (await git('ls-remote', '--exit-code', 'origin', branch)).split(/\s/)[0]
  const tags = (await git('tag', '--list')).split('\n').filter(tag => stableTag.test(tag)).sort((a, b) => Bun.semver.order(b.replace(/^v/, ''), a.replace(/^v/, '')))
  const [latest, previous] = tags
  const tagged = latest && await git('rev-list', '-1', `refs/tags/${latest}`)
  // A rerun can start at the parent of the version commit created by the first attempt.
  const resumed = inputs.updateFiles && latest && tagged === remote && head !== remote
    && await git('show', '-s', '--format=%P', remote) === head
    && await git('show', '-s', '--format=%s', remote) === commitMessage(latest.replace(/^v/, ''))
  if (head !== remote && !resumed) throw new Error(`The ${releaseBranch} branch moved. Start a fresh run at its tip.`)
  const alreadyTagged = tagged === remote
  const oldTag = (alreadyTagged ? previous : latest) ?? ''
  let newTag = latest
  if (!alreadyTagged) {
    const log = await git('log', '--format=%B', latest ? `refs/tags/${latest}..HEAD` : 'HEAD')
    const part = increments.find(value => log.includes(`#${value}`)) ?? bumpAmount
    if (part === 'none') return
    const numbers = (stableTag.exec(latest || '0.0.0')!).slice(1).map(BigInt)
    const index = ['major', 'minor', 'patch'].indexOf(part)
    newTag = `v${numbers.map((n, i) => i < index ? n : i === index ? n + 1n : 0n).join('.')}`
  }
  const newSemver = newTag.replace(/^v/, '')
  const [owner, name] = repository.split('/')
  const context = {repo: {owner, name, slug: repository, url: `${serverUrl}/${repository}`}, oldTag, newTag}
  const render = (template: string) => Handlebars.compile(template, {noEscape: true})(context)
  const releaseTitle = render(inputs.releaseTitle), releaseBody = render(inputs.releaseBody)
  if (!alreadyTagged) {
    if (inputs.updateFiles && await updateManifest(cwd, newSemver)) {
      await git('add', '--', 'package.json')
      await git('-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com', '-c', 'commit.gpgsign=false', 'commit', '-m', commitMessage(newSemver), '--', 'package.json')
    }
    await git('tag', '--no-sign', newTag)
    await git('push', '--atomic', 'origin', `HEAD:${branch}`, `refs/tags/${newTag}`)
  }
  return {oldTag, newTag, newSemver, releaseTitle, releaseBody}
}

if (import.meta.main) {
  const result = await prepareRelease(readInputs(), path.resolve(process.argv[2]), process.env.GITHUB_REPOSITORY!, process.env.GITHUB_SERVER_URL!)
  if (result) setOutputs({...result, payload: result})
  else console.log('No release requested.')
}
