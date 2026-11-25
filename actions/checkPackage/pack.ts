import path from 'node:path'
import {setOutputs} from '../../src/actions.ts'

type Manifest = {name?: string, version?: string, private?: boolean}

export async function packRelease(directory: string, tag: string, archive: string) {
  const validate = (pkg: Manifest) => {
    if (pkg.private || !pkg.name || !pkg.version || `v${pkg.version}` !== tag) throw new Error(`Cannot publish ${pkg.name}@${pkg.version} for ${tag}.`)
    return pkg.name
  }
  const name = validate(await Bun.file(path.join(directory, 'package.json')).json())
  await Bun.$`bun run --if-present prepublishOnly`.cwd(directory)
  await Bun.$`bun pm pack --filename ${archive}`.cwd(directory)
  const packed = validate(await Bun.$`tar -xOzf ${archive} package/package.json`.json())
  if (packed !== name) throw new Error(`Package name changed during packing: ${name} → ${packed}`)
  return name
}

if (import.meta.main) {
  const name = await packRelease(path.resolve(process.env.PACKAGE_DIRECTORY!), process.env.RELEASE_TAG!, path.join(process.env.RUNNER_TEMP!, 'package.tgz'))
  setOutputs({artifact: `npm-${name.replaceAll('/', '-')}-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}`})
}
