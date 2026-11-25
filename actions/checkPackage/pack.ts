import path from 'node:path'
import {setOutputs} from '../../src/actions.ts'

type Manifest = {name?: string, version?: string, private?: boolean}

export async function packPackage(directory: string, archive: string, {tag, runScripts = false}: {tag?: string, runScripts?: boolean} = {}) {
  const validate = (pkg: Manifest) => {
    if (pkg.private || !pkg.name || !pkg.version || (tag !== undefined && `v${pkg.version}` !== tag)) throw new Error(`Cannot publish ${pkg.name}@${pkg.version}${tag ? ` for ${tag}` : ''}.`)
    return {name: pkg.name, version: pkg.version}
  }
  const source = validate(await Bun.file(path.join(directory, 'package.json')).json())
  if (runScripts) await Bun.$`bun run --if-present prepublishOnly`.cwd(directory)
  await Bun.$`bun pm pack ${runScripts ? [] : ['--ignore-scripts']} --filename ${archive}`.cwd(directory)
  const packed = validate(await Bun.$`tar -xOzf ${archive} package/package.json`.json())
  if (packed.name !== source.name || packed.version !== source.version) throw new Error('Package name or version changed during packing')
  return packed.name
}

if (import.meta.main) {
  const name = await packPackage(path.resolve(process.env.PACKAGE_DIRECTORY!), path.join(process.env.RUNNER_TEMP!, 'package.tgz'), {tag: process.env.RELEASE_TAG!, runScripts: true})
  setOutputs({artifact: `npm-${name.replaceAll('/', '-')}-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}`})
}
