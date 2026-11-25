import {expect, test} from 'bun:test'
import {mkdtemp, rm} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {prepareRelease} from '../src/release.ts'

test('release tags contain the updated manifest, resume on retry and reject a stale branch', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'workflows-release-'))
  const origin = path.join(temp, 'origin.git'), project = path.join(temp, 'project')
  const git = async (...args: string[]) => (await Bun.$`git -C ${project} ${args}`.text()).trim()
  const inputs = {bumpAmount: 'patch', updateFiles: true, releaseBranch: 'main', makeLatest: 'true', releaseTitle: '{{repo.slug}} {{newTag}}', releaseBody: '{{#if oldTag}}{{oldTag}} → {{newTag}}{{else}}initial{{/if}}'}
  const release = () => prepareRelease(inputs, project, 'Jaid/fixture', 'https://github.com')
  try {
    await Bun.$`git init -q --bare -b main ${origin}`
    await Bun.$`git init -q -b main ${project}`
    await git('config', 'user.name', 'Fixture')
    await git('config', 'user.email', 'fixture@example.org')
    await git('config', 'commit.gpgsign', 'false')
    await git('config', 'core.autocrlf', 'false')
    await git('remote', 'add', 'origin', origin)
    await Bun.write(path.join(project, 'package.json'), '{\n\t"version": "0.0.0"\n}\n')
    await git('add', 'package.json')
    await git('commit', '-qm', 'First release')
    await git('push', '-q', 'origin', 'main')
    const source = await git('rev-parse', 'HEAD')
    const first = await release()
    expect(first).toMatchObject({oldTag: '', newTag: 'v0.0.1', newSemver: '0.0.1', releaseBody: 'initial'})
    expect(await Bun.$`git --git-dir ${origin} show v0.0.1:package.json`.text()).toBe('{\n\t"version": "0.0.1"\n}\n')
    expect(await git('rev-parse', 'origin/main')).toBe(await git('rev-parse', 'v0.0.1'))
    await git('checkout', '-q', '--detach', source)
    expect(await release()).toEqual(first)
    await git('checkout', '-q', 'main')
    await git('commit', '-q', '--allow-empty', '-m', 'Feature #minor')
    await git('push', '-q', 'origin', 'main')
    expect(await release()).toMatchObject({oldTag: 'v0.0.1', newTag: 'v0.1.0', releaseTitle: 'Jaid/fixture v0.1.0'})
    await git('commit', '-q', '--allow-empty', '-m', 'No release #none')
    await git('push', '-q', 'origin', 'main')
    expect(await release()).toBeUndefined()
    await git('checkout', '-q', '--detach', source)
    await expect(release()).rejects.toThrow('branch moved')
  } finally {
    await rm(temp, {recursive: true, force: true})
  }
}, 30_000)
