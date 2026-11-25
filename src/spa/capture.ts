import path from 'node:path'
import capturePage, {type Options} from 'capture-page'
import {setOutputs} from '../actions.ts'
import {serveSpa} from './serve.ts'

type Inputs = {siteDirectory: string, basePath: string, route: string, imageName: string, captureOptions: string}
const imageOptions = ['width', 'height', 'deviceScaleFactor', 'fullPage', 'omitBackground', 'format', 'quality', 'colorScheme', 'motion', 'mediaType', 'wait', 'delay', 'timeout', 'toolCalls'] as const satisfies readonly (keyof Options)[]

export async function captureSpa(inputs: Inputs, artifact: string, output: string, attempt = '1') {
  if (!/^[a-z\d][a-z\d._-]{0,119}$/i.test(inputs.imageName)) throw new Error('imageName must be a filename stem using letters, digits, dots, underscores or hyphens')
  const options = JSON.parse(inputs.captureOptions) as Pick<Options, typeof imageOptions[number]>
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new Error('captureOptions must be a JSON object')
  for (const key of Object.keys(options)) {
    if (!imageOptions.some(option => option === key)) throw new Error(`Unsupported captureOptions key: ${key}`)
  }
  const format = options.format ?? 'png'
  if (!['png', 'jpeg', 'webp'].includes(format)) throw new Error(`Unknown screenshot format: ${format}`)
  const imageFile = `${inputs.imageName}${attempt === '1' ? '' : `-${attempt}`}.${format}`
  const {server, url} = await serveSpa(artifact, inputs.siteDirectory, inputs.basePath, inputs.route)
  try {
    const {passedTime, buffer} = await capturePage.save(url, path.join(output, imageFile), options)
    console.log(`Captured ${url.pathname}${url.search}${url.hash} → ${imageFile} (${buffer.length} bytes, ${Math.round(passedTime)} ms)`)
    return imageFile
  } finally {
    await server.stop(true)
  }
}

if (import.meta.main) {
  const imageFile = await captureSpa({
    siteDirectory: process.env.SITE_DIRECTORY!, basePath: process.env.BASE_PATH!, route: process.env.ROUTE!,
    imageName: process.env.IMAGE_NAME!, captureOptions: process.env.CAPTURE_OPTIONS!,
  }, process.argv[2], process.argv[3], process.env.GITHUB_RUN_ATTEMPT)
  setOutputs({imageFile})
}
