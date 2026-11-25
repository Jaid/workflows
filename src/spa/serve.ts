import {realpath, stat} from 'node:fs/promises'
import path from 'node:path'

function inside(root: string, file: string) {
  const relative = path.relative(root, file)
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
}

async function regularFile(root: string, file: string) {
  const resolved = await realpath(file).catch(() => undefined)
  if (resolved && inside(root, resolved) && (await stat(resolved)).isFile()) return Bun.file(resolved)
}

function requirePath(value: string) {
  if (!value.startsWith('/') || value.startsWith('//') || /[\\\x00-\x1f]/.test(value)) throw new Error(`Expected a local URL path: ${value}`)
}

export async function serveSpa(artifact: string, directory: string, basePath: string, route: string) {
  requirePath(basePath)
  requirePath(route)
  if (/[?#]/.test(basePath)) throw new Error('basePath cannot contain a query or fragment')
  const mount = new URL(basePath, 'http://localhost').pathname.replace(/\/+$/, '') + '/'
  const target = new URL(mount + route.slice(1), 'http://localhost')
  if (target.origin !== 'http://localhost' || !target.pathname.startsWith(mount)) throw new Error(`Route is outside basePath: ${route}`)

  const artifactRoot = await realpath(artifact)
  const root = await realpath(path.resolve(artifactRoot, directory))
  if (path.isAbsolute(directory) || !inside(artifactRoot, root)) throw new Error('siteDirectory must be inside the build artifact')
  const index = await regularFile(root, path.join(root, 'index.html'))
  if (!index) throw new Error(`No index.html in the build artifact at ${directory}`)

  const server = Bun.serve({
    hostname: '127.0.0.1', port: 0, development: false,
    async fetch(request) {
      if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, {status: 405, headers: {Allow: 'GET, HEAD'}})
      const url = new URL(request.url)
      if (url.pathname === mount.slice(0, -1)) return new Response(null, {status: 308, headers: {Location: mount + url.search}})
      if (!url.pathname.startsWith(mount)) return new Response(null, {status: 404})
      let relative: string
      try { relative = decodeURIComponent(url.pathname.slice(mount.length)) } catch { return new Response(null, {status: 400}) }
      if (/[\\\x00]/.test(relative)) return new Response(null, {status: 400})
      const file = path.resolve(root, relative)
      if (!inside(root, file)) return new Response(null, {status: 404})
      const asset = await regularFile(root, file) ?? await regularFile(root, path.join(file, 'index.html'))
      // Only document navigations fall back to the SPA shell. A missing module must stay a 404.
      const body = asset ?? (request.headers.get('accept')?.includes('text/html') ? index : undefined)
      if (!body) return new Response(null, {status: 404})
      return new Response(request.method === 'HEAD' ? null : body, {headers: {'Content-Type': body.type, 'Content-Length': String(body.size)}})
    },
  })
  return {server, url: new URL(server.url.origin + target.pathname + target.search + target.hash)}
}
