import {readInputs, setOutputs} from '../../src/actions.ts'

type Options = {
  title?: string, baseTags?: string, additionalTags?: string, versionTag?: string, versionTagSemverPrefix?: string, versionTagPrefix?: string,
  addVersionTag?: boolean, addShaTags?: boolean, addScheduleTags?: boolean, flavorLatest?: string, flavorPrefix?: string, flavorSuffix?: string, flavorConnectionString?: string,
}

export function tagRules(options: Options, imageName: string, id: string, matrixFlavor?: string) {
  const tags = [options.baseTags ?? 'type=ref,event=branch', options.additionalTags]
  if (options.versionTag) {
    const semver = /(\d+\.\d+\.\d+(?:-[\w.-]+)?)/.exec(options.versionTag)
    const version = (options.versionTagSemverPrefix && semver ? `${options.versionTagSemverPrefix}${semver[1]}` : options.versionTag).replaceAll('+', '-')
    if (!/^[\w][\w.-]{0,127}$/.test(version)) throw new Error(`Invalid version tag: ${version}`)
    tags.push(`type=raw,value=${version}`)
  }
  if (options.addVersionTag) tags.push(`type=semver,pattern=${options.versionTagPrefix ?? ''}{{version}}`)
  if (options.addShaTags) tags.push('type=sha,format=long')
  if (options.addScheduleTags) tags.push('type=schedule,pattern=nightly', "type=schedule,pattern={{date 'YYYYMMDD'}}")
  const suffix = matrixFlavor || options.flavorSuffix
  const join = options.flavorConnectionString ?? '-'
  const flavor = [`latest=${options.flavorLatest || 'auto'}`]
  if (options.flavorPrefix) flavor.push(`prefix=${options.flavorPrefix}${join},onlatest=true`)
  if (suffix) flavor.push(`suffix=${join}${suffix},onlatest=true`)
  const rules = tags.flatMap(value => (value ?? '').split('\n')).map(line => line.trim()).filter(Boolean)
  if (!rules.length) throw new Error('No Docker tag rules given.')
  return {tags: rules.join('\n'), flavor: flavor.join('\n'), title: options.title || (id && id !== 'default' ? `${imageName} (${id})` : imageName)}
}

if (import.meta.main) {
  const {options, imageName, id, flavorSuffix} = readInputs<Record<string, string>>()
  setOutputs(tagRules(JSON.parse(options || '{}'), imageName, id, flavorSuffix))
}
