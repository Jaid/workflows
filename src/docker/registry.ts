import {readInputs, setOutputs} from '../actions.ts'

type RegistryInputs = {dockerHubRegistry: string, githubRegistry: string, dockerHubUser?: string, imageSlug?: string}

export function registries(options: RegistryInputs, repository: string, imageName: string, hub: boolean) {
  const repo = repository.toLowerCase()
  const imageSlug = options.imageSlug || `${repo.split('/')[0]}/${imageName}`
  const [namespace, ...name] = imageSlug.split('/')
  const imageUser = options.dockerHubUser || namespace
  if (!namespace || !name.join('/')) throw new Error(`Invalid image slug: ${imageSlug}`)
  const hubRepository = `${imageUser}/${name.join('/')}`
  const images = [`${options.githubRegistry}/${repo}/${imageName}`]
  if (hub) images.push(`${options.dockerHubRegistry}/${hubRepository}`)
  return {images, imageName, imageSlug, imageUser, hubRepository}
}

if (import.meta.main) {
  setOutputs(registries(readInputs(), process.env.GITHUB_REPOSITORY!, process.env.IMAGE_NAME!, process.env.HUB_ENABLED === 'true'))
}
