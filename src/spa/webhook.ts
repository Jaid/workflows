import path from 'node:path'

export async function sendWebhook(endpoint: string, image: string) {
  const url = URL.parse(endpoint)
  if (url?.protocol !== 'https:' && url?.protocol !== 'http:') throw new Error('webhook must be an HTTP(S) URL')
  const body = new FormData
  body.set('file', Bun.file(image), path.basename(image))
  const response = await fetch(url, {method: 'POST', body, redirect: 'manual', signal: AbortSignal.timeout(60_000)}).catch(error => {
    throw new Error(`Screenshot webhook request failed (${error.code ?? error.name})`)
  })
  await response.body?.cancel()
  if (!response.ok) throw new Error(`Screenshot webhook returned HTTP ${response.status}`)
}

if (import.meta.main) await sendWebhook(process.env.WEBHOOK!, process.argv[2])
