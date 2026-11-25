export function checkCommands(scripts: Record<string, string>, lint: boolean, list: string) {
  const commands: string[][] = []
  if (lint) commands.push(scripts.lint ? ['run', 'lint'] : ['x', '--no-install', '--bun', 'eslint', '.'])
  for (const name of list.split('\n').map(name => name.trim()).filter(Boolean)) {
    if (name.startsWith('-') || !Object.hasOwn(scripts, name)) throw new Error(`Unknown package script: ${name}`)
    commands.push(['run', name])
  }
  return commands
}

if (import.meta.main) {
  const pkg = await Bun.file('package.json').json()
  for (const args of checkCommands(pkg.scripts ?? {}, process.env.RUN_LINT === 'true', process.env.PACKAGE_SCRIPTS ?? '')) {
    console.log(`$ bun ${args.join(' ')}`)
    const code = await Bun.spawn([process.execPath, ...args], {stdout: 'inherit', stderr: 'inherit'}).exited
    if (code !== 0) process.exit(code)
  }
}
