import {expect, test} from 'bun:test'
import {mkdtemp, rm} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {checkCommands} from '../actions/checkPackage/check.ts'
import {packRelease} from '../actions/checkPackage/pack.ts'

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
    expect(await packRelease(directory, 'v2.1.0', archive)).toBe(pkg.name)
    expect(await Bun.$`tar -xOzf ${archive} package/built.txt`.text()).toBe('from-hook')
    await expect(packRelease(directory, 'v2.1.1', archive)).rejects.toThrow('Cannot publish')
    await Bun.write(file, JSON.stringify({...pkg, private: true}))
    await expect(packRelease(directory, 'v2.1.0', archive)).rejects.toThrow('Cannot publish')
  } finally {
    await rm(temp, {recursive: true, force: true})
  }
})
