import {lstatSync, readdirSync, realpathSync, rmSync} from 'node:fs'
import path from 'node:path'
import {packPackage} from '../actions/checkPackage/pack.ts'
import {setOutputs} from './actions.ts'

// Upload a literal directory and restore only under the checkout. An existing parent might be a symlink or junction.
function workspaceDirectory(workspace: string, relative: string, allowRoot = false) {
  const parts = relative.split('/').filter(part => part && part !== '.')
  const unsafePart = parts.some(part => /[ .]$/.test(part) || ['.git', 'node_modules'].includes(part.toLowerCase()))
  if (!relative.trim() || path.win32.isAbsolute(relative) || /[\\:*?\[\]\x00-\x1f]/.test(relative) || (!parts.length && !allowRoot) || unsafePart) {
    throw new Error(`Expected a literal build directory inside the checkout: ${relative}`)
  }
  let directory = realpathSync(workspace)
  for (const part of parts) {
    directory = path.join(directory, part)
    const stat = lstatSync(directory, {throwIfNoEntry: false})
    if (stat && !stat.isDirectory()) throw new Error(`Expected a directory, not a file or symlink: ${directory}`)
  }
  return directory
}

export function buildOutput(workspace: string, relative: string) {
  const directory = workspaceDirectory(workspace, relative)
  // upload-artifact follows symlinks. Only collect self-contained build output, including its dotfiles.
  const pending = [directory]
  while (pending.length) {
    const parent = pending.pop()!
    for (const entry of readdirSync(parent, {withFileTypes: true})) {
      if (entry.isDirectory()) pending.push(path.join(parent, entry.name))
      else if (!entry.isFile()) throw new Error(`Unsupported build artifact entry: ${path.join(parent, entry.name)}`)
    }
  }
  return directory
}

export function restoreTarget(workspace: string, relative: string, artifactId: string) {
  if (!/^[1-9]\d*$/.test(artifactId)) throw new Error('Expected one numeric build artifact ID')
  const directory = workspaceDirectory(workspace, relative)
  // download-artifact overlays files. Remove stale generated files before restoring the immutable snapshot.
  rmSync(directory, {recursive: true, force: true})
  return directory
}

if (import.meta.main) {
  const workspace = process.cwd(), relative = process.env.DIST_DIRECTORY!
  if (process.argv[2] === 'restore') {
    setOutputs({directory: restoreTarget(workspace, relative, process.env.ARTIFACT_ID!)})
  } else if (process.argv[2] === 'collect') {
    const directory = buildOutput(workspace, relative)
    if (process.env.PACKAGE_DIRECTORY) {
      await packPackage(workspaceDirectory(workspace, process.env.PACKAGE_DIRECTORY, true), path.join(process.env.RUNNER_TEMP!, 'package.tgz'))
    }
    setOutputs({directory})
  } else {
    throw new Error('Expected collect or restore')
  }
}
