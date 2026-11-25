import assert from 'node:assert/strict'
import {publishImage} from '../src/docker/publish.ts'

const archive = process.env.ARCHIVE!
const image = `${process.env.REGISTRY}/fixture`
const [entry] = await Bun.$`tar -xOf ${archive} manifest.json`.json()
const sha256 = (data: ArrayBuffer) => `sha256:${Bun.CryptoHasher.hash('sha256', data, 'hex')}`
const expected = sha256(await Bun.$`tar -xOf ${archive} ${entry.Config}`.arrayBuffer())
const names = ['ci', 'alias']
const published = await publishImage(archive, [image], names, {'containerimage.config.digest': expected}, process.env.RUNNER_TEMP!)
assert.equal(published.imageId, expected)
for (const name of names) {
  const raw = await Bun.$`skopeo inspect --raw ${`docker://${image}:${name}`}`.arrayBuffer()
  assert.equal(sha256(raw), published.digest)
  assert.equal(JSON.parse(new TextDecoder().decode(raw)).config.digest, expected)
}
