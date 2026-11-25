import {expect, test} from 'bun:test'
import {mkdtemp, rm} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {captureSpa} from '../src/spa/capture.ts'
import {publishPreview} from '../src/spa/preview.ts'
import {serveSpa} from '../src/spa/serve.ts'

test('Chrome renders a deep SPA route from a nested build artifact at its deployed base path', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'workflows-spa-'))
  try {
    await Bun.write(path.join(temp, 'dist/index.html'), '<link rel="stylesheet" href="/demo/assets/site.css"><script type="module" src="/demo/assets/app.js"></script><main>Loading</main>')
    await Bun.write(path.join(temp, 'dist/assets/site.css'), 'main { color: rgb(12, 34, 56) }')
    await Bun.write(path.join(temp, 'dist/assets/app.js'), `
      const main = document.querySelector('main')
      if (location.pathname === '/demo/items/42' && location.search === '?lang=en' && location.hash === '#info'
        && getComputedStyle(main).color === 'rgb(12, 34, 56)' && (await fetch('/demo/assets/missing.js')).status === 404
        && (await fetch('/index.html')).status === 404) {
        main.id = 'ready'; main.textContent = 'Item 42'
      }`)
    const image = await captureSpa({siteDirectory: 'dist', basePath: '/demo/', route: '/items/42?lang=en#info', imageName: 'item', captureOptions: JSON.stringify({width: 400, height: 300, wait: {selector: '#ready'}, timeout: 10_000})}, temp, temp)
    const png = Buffer.from(await Bun.file(path.join(temp, image)).arrayBuffer())
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([400, 300])
    await expect(serveSpa(temp, '..', '/', '/')).rejects.toThrow('inside the build artifact')
    await expect(serveSpa(temp, '.', '/', '/')).rejects.toThrow('No index.html')
  } finally {
    await rm(temp, {recursive: true, force: true})
  }
}, 30_000)

test('parallel public previews create one independent branch and retain both immutable images', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'workflows-preview-'))
  try {
    const remote = path.join(temp, 'repo.git')
    await Bun.$`git init --quiet --bare ${remote}`
    const preview = async (name: string) => {
      const image = path.join(temp, `${name}.png`)
      await Bun.write(image, name)
      return publishPreview(remote, image, '123', temp)
    }
    const [first, second] = await Promise.all([preview('desktop'), preview('mobile')])
    for (const {commit, file} of [first, second]) {
      const read = (ref: string) => Bun.$`git --git-dir=${remote} show ${ref + ':' + file}`.text()
      expect(await read(commit)).toBe(path.basename(file, '.png'))
      expect(await read('ci-screenshots')).toBe(await read(commit))
    }
  } finally {
    await rm(temp, {recursive: true, force: true})
  }
}, 30_000)
