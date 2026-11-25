import path from 'node:path'
import {setOutputs} from '../actions.ts'

// Upload the tested archive once per registry. Additional tags copy the remote manifest by digest.
export async function publishImage(archive: string, images: string[], names: string[], buildMeta: Record<string, unknown>, temp: string) {
  if (!names.length || names.some(name => !/^[\w][\w.-]{0,127}$/.test(name))) throw new Error('Expected at least one valid Docker tag. Check baseTags for the triggering event.')
  const digestFile = path.join(temp, 'published-digest')
  const tags: string[] = []
  let descriptor: {digest: string, mediaType: string, size: number} | undefined
  const local = `docker-archive:${archive}`
  const imageId: string = (await Bun.$`skopeo inspect --raw ${local}`.json()).config.digest
  const expected = buildMeta['containerimage.config.digest']
  if (expected && imageId !== expected) throw new Error(`Archive config ${imageId} does not match the build (${expected}).`)
  for (const image of images) {
    const ref = `${image}:${names[0]}`
    await Bun.$`skopeo copy --format v2s2 --digestfile ${digestFile} ${local} ${`docker://${ref}`}`
    const digest = (await Bun.file(digestFile).text()).trim()
    if (!/^sha256:[0-9a-f]{64}$/.test(digest)) throw new Error(`No manifest digest returned for ${ref}.`)
    const source = `docker://${image}@${digest}`
    if (!descriptor) {
      const raw = await Bun.$`skopeo inspect --raw ${source}`.text()
      const manifest = JSON.parse(raw)
      if (manifest.config.digest !== imageId) throw new Error(`Published config differs from the archive for ${ref}.`)
      descriptor = {digest, mediaType: manifest.mediaType, size: Buffer.byteLength(raw)}
    }
    tags.push(ref)
    for (const name of names.slice(1)) {
      const tag = `${image}:${name}`
      await Bun.$`skopeo copy --preserve-digests ${source} ${`docker://${tag}`}`
      tags.push(tag)
    }
  }
  if (!descriptor) throw new Error('No destination registry given.')
  const meta = {...buildMeta, 'containerimage.digest': descriptor.digest, 'containerimage.descriptor': descriptor, 'containerimage.config.digest': imageId, 'image.name': tags.join(',')}
  return {digest: descriptor.digest, imageId, meta}
}

if (import.meta.main) {
  const env = process.env
  const names = [...new Set((env.TAG_NAMES || '').split(/\s+/).filter(Boolean))]
  setOutputs(await publishImage(env.IMAGE_PATH!, JSON.parse(env.IMAGES!), names, JSON.parse(env.BUILD_META || '{}'), env.RUNNER_TEMP!))
}
