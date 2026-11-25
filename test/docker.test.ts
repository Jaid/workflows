import {expect, test} from 'bun:test'
import {tagRules} from '../actions/dockerMetadata/rules.ts'
import {makeMatrix} from '../src/docker/matrix.ts'
import {registries} from '../src/docker/registry.ts'
import {splitArgs} from '../src/docker/testImage.ts'

test('the builder matrix keeps existing flavor tags and evaluates build arguments in order', () => {
  const entries = makeMatrix({
    bases: 'latest, lts;debian', platform: 'linux/amd64\nlinux/arm64/v8',
    additionEvals: "image: Object.create({lts: 'ubuntu:latest', debian: 'debian:stable-slim'})[base] ?? 'ubuntu:rolling'\nfamily: image.split(':')[0]",
    flavorEval: "[base === 'latest' ? null : base, platformShortcuts[platform]].filter(Boolean).join('-')",
  }, 'ARM64')
  expect(entries.map(entry => entry.id)).toEqual(['default', 'arm8', 'lts', 'lts-arm8', 'debian', 'debian-arm8'])
  expect(entries.filter(entry => entry.isNativeArch)).toHaveLength(3)
  expect(entries.at(-1)!.buildArgs).toContain('image=debian:stable-slim\nfamily=debian')
})

test('ARM64 aliases are native and ambiguous flavors cannot publish over one another', () => {
  expect(makeMatrix({platform: 'linux/arm64'}, 'ARM64')[0]).toMatchObject({id: 'arm8', isNativeArch: true})
  expect(() => makeMatrix({platform: 'linux/arm64,linux/arm64/v8'})).toThrow('Duplicate matrix ID')
  expect(makeMatrix({bases: '  ', platform: ''}, 'X64')[0]).toMatchObject({id: 'default', platform: 'linux/amd64', isNativeArch: true})
})

test('a flavored version release also flavors the automatic latest tag', () => {
  const rules = tagRules({addVersionTag: true, addShaTags: true, versionTag: 'v1.2.3-rc.1', versionTagSemverPrefix: 'release-', flavorPrefix: 'ci'}, 'builder', 'arm8', 'arm8')
  expect(rules.tags.split('\n')).toEqual(['type=ref,event=branch', 'type=raw,value=release-1.2.3-rc.1', 'type=semver,pattern={{version}}', 'type=sha,format=long'])
  expect(rules.flavor.split('\n')).toContain('suffix=-arm8,onlatest=true')
  expect(rules.title).toBe('builder (arm8)')
})

test('registry targets retain the GHCR path and opt in to the configured Hub namespace', () => {
  const options = {githubRegistry: 'ghcr.io', dockerHubRegistry: 'docker.io', dockerHubUser: 'jaidchen'}
  const ghcr = 'ghcr.io/jaid/docker-runner/runner'
  expect(registries(options, 'Jaid/docker-runner', 'runner', false).images).toEqual([ghcr])
  expect(registries(options, 'Jaid/docker-runner', 'runner', true).images).toEqual([ghcr, 'docker.io/jaidchen/runner'])
})

test('Docker command arguments preserve empty and quoted words without shell expansion', () => {
  expect(splitArgs(`bash -c 'echo "$HOME"' "" one\\ two a"b c"`)).toEqual(['bash', '-c', 'echo "$HOME"', '', 'one two', 'ab c'])
  expect(() => splitArgs(`'unterminated`)).toThrow('Unterminated')
})
