import {mkdtemp} from 'node:fs/promises'
import path from 'node:path'
import {setOutputs} from '../actions.ts'

const ref = 'refs/heads/ci-screenshots'

// Append one image without checking out previous captures. Never force-push: other matrix entries may publish concurrently.
export async function publishPreview(remote: string, image: string, runId: string, temp: string) {
  const cwd = await mkdtemp(path.join(temp, 'spa-preview-'))
  const git = async (...args: string[]) => (await Bun.$`git ${args}`.cwd(cwd).text()).trim()
  await git('init', '--quiet')
  await git('remote', 'add', 'origin', remote)
  await git('config', 'user.name', 'github-actions[bot]')
  await git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com')
  const blob = await git('hash-object', '-w', path.resolve(image))
  const file = `runs/${runId}/${path.basename(image)}`
  const head = async () => (await git('ls-remote', '--refs', 'origin', ref)).split('\t')[0]
  for (let retry = 0; retry < 8; retry++) {
    let parent = await head()
    if (parent) {
      await git('fetch', '--quiet', '--depth=1', '--filter=blob:none', 'origin', ref)
      parent = await git('rev-parse', 'FETCH_HEAD')
      await git('read-tree', parent)
    } else {
      await git('read-tree', '--empty')
    }
    await git('update-index', '--add', '--cacheinfo', `100644,${blob},${file}`)
    const commit = await git('commit-tree', await git('write-tree'), ...parent ? ['-p', parent] : [], '-m', `Capture ${file}`)
    const push = await Bun.$`git push origin ${commit + ':' + ref}`.cwd(cwd).quiet().nothrow()
    if (!push.exitCode) return {commit, file}
    if (await head() === parent) throw new Error(push.stderr.toString().trim())
    await Bun.sleep(100 + Math.random() * 200 * (retry + 1))
  }
  throw new Error('The screenshot branch kept changing; rerun the preview job')
}

if (import.meta.main) {
  const repo = process.env.GITHUB_REPOSITORY!
  const {commit, file} = await publishPreview(`${process.env.GITHUB_SERVER_URL}/${repo}.git`, process.argv[2], process.env.GITHUB_RUN_ID!, process.env.RUNNER_TEMP!)
  setOutputs({previewUrl: `https://raw.githubusercontent.com/${repo}/${commit}/${file}`})
}
