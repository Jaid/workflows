import {expect, test} from 'bun:test'
import {mkdtemp, rm, symlink} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {checkCommands} from '../actions/checkPackage/check.ts'
import {packPackage} from '../actions/checkPackage/pack.ts'
import {buildOutput, restoreTarget} from '../src/buildArtifact.ts'

test('CI honors custom lint and script order and never fetches missing lint tools', () => {
  expect(checkCommands({lint: 'eslint src', test: 'bun test', build: 'bun build'}, true, ' test\n\nbuild ')).toEqual([['run', 'lint'], ['run', 'test'], ['run', 'build']])
  expect(checkCommands({}, true, '')).toEqual([['x', '--no-install', '--bun', 'eslint', '.']])
  expect(() => checkCommands({}, false, 'missing')).toThrow('Unknown package script')
})

test('a generated package is packed from its own directory and must match the release tag', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'workflows-pack-'))
  try {
    const directory = path.join(temp, 'dist'), archive = path.join(temp, 'package.tgz')
    const file = path.join(directory, 'package.json')
    const pkg = {name: '@fixture/packed', version: '2.1.0', files: ['built.txt'], scripts: {prepublishOnly: `bun -e "Bun.write('built.txt', 'from-hook')"`}}
    await Bun.write(file, JSON.stringify(pkg))
    expect(await packPackage(directory, archive, {tag: 'v2.1.0', runScripts: true})).toBe(pkg.name)
    expect(await Bun.$`tar -xOzf ${archive} package/built.txt`.text()).toBe('from-hook')
    await expect(packPackage(directory, archive, {tag: 'v2.1.1'})).rejects.toThrow('Cannot publish')
    await Bun.write(file, JSON.stringify({...pkg, private: true}))
    await expect(packPackage(directory, archive, {tag: 'v2.1.0'})).rejects.toThrow('Cannot publish')
  } finally {
    await rm(temp, {recursive: true, force: true})
  }
})

test('a prepared package preserves the build bytes without rerunning publish or pack hooks', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'workflows-prepared-'))
  try {
    const rebuild = `bun -e "Bun.write('dist/app.js', 'rebuilt')"`, archive = path.join(temp, 'package.tgz')
    await Bun.write(path.join(temp, 'package.json'), JSON.stringify({name: 'fixture', version: '1.2.3', files: ['dist'], scripts: {prepublishOnly: rebuild, prepare: rebuild, prepack: rebuild}}))
    await Bun.write(path.join(temp, 'dist/app.js'), 'built once')
    await packPackage(temp, archive)
    expect(await Bun.$`tar -xOzf ${archive} package/dist/app.js`.text()).toBe('built once')
  } finally {
    await rm(temp, {recursive: true, force: true})
  }
})

test('restoring a build replaces only its output directory and refuses an ambiguous artifact or linked path', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'workflows-dist-'))
  try {
    const stale = path.join(temp, 'app/dist/.old'), keep = path.join(temp, 'source/keep')
    await Bun.write(stale, 'from checkout')
    await Bun.write(keep, 'source')
    expect(buildOutput(temp, 'app/dist')).toBe(path.dirname(stale))
    await symlink(path.dirname(keep), path.join(temp, 'app/dist/link'), 'junction')
    expect(() => buildOutput(temp, 'app/dist')).toThrow('artifact entry')
    expect(() => restoreTarget(temp, 'app/dist/link/out', '12')).toThrow('symlink')
    expect(() => restoreTarget(temp, 'app/dist', '12,34')).toThrow('one numeric')
    for (const unsafe of ['.', '../source', '.git', 'app/*']) expect(() => restoreTarget(temp, unsafe, '12')).toThrow('inside the checkout')
    expect(await Bun.file(stale).exists()).toBe(true)
    expect(restoreTarget(temp, 'app/dist', '12')).toBe(path.dirname(stale))
    expect(await Bun.file(stale).exists()).toBe(false)
    expect(await Bun.file(keep).text()).toBe('source')
  } finally {
    await rm(temp, {recursive: true, force: true})
  }
})
