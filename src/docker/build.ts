import path from 'node:path'
import {readInputs, setOutputs} from '../actions.ts'
import {isNative} from './platform.ts'

export function buildConfig(inputs: Record<string, string>, env = process.env) {
  const id = inputs.id || 'default'
  const imageName = inputs.imageName || env.GITHUB_REPOSITORY!.split('/')[1].toLowerCase().replace(/^docker-/, '')
  const cacheKey = inputs.cacheKey || [env.GITHUB_REPOSITORY, env.GITHUB_WORKFLOW, env.GITHUB_REF_NAME, id, inputs.arch].join('|').replaceAll(/[\s,/|\\]+/g, '_')
  const cacheFrom = inputs.cacheFrom || `type=gha,scope=${cacheKey}`
  const cacheTo = inputs.cacheTo || `type=gha,scope=${cacheKey},mode=max`
  const cacheHint = cacheTo.split('\n').map(line => line.split(',').filter(part => !part.startsWith('mode=')).join(',')).join('\n')
  const imageArtifact = inputs.imageArtifact || `${env.GITHUB_RUN_ID}_${id}${env.GITHUB_RUN_ATTEMPT === '1' ? '' : `_${env.GITHUB_RUN_ATTEMPT}`}`
  const imageFolder = path.resolve(inputs.imageFolder || path.join(env.RUNNER_TEMP!, 'dockerBuild', imageArtifact))
  const imageFile = inputs.imageFile || `${path.posix.basename(imageName)}.tar`
  if (imageFile !== path.basename(imageFile) || ['.', '..'].includes(imageFile)) throw new Error('imageFile must be a basename.')
  const {releaseOptions, ...rest} = inputs
  return {...rest, id, imageName, cacheKey, cacheFrom, cacheTo, cacheHint, imageArtifact, imageFolder, imageFile, imagePath: path.join(imageFolder, imageFile), imageIdentifier: `${imageName}:${inputs.tag}`, isNativeArch: String(isNative(inputs.arch, env.RUNNER_ARCH))}
}

if (import.meta.main) {
  const config = buildConfig(readInputs())
  setOutputs({...config, value: config})
}
