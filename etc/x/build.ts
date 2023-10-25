import type {PackageJson} from 'type-fest'

import {execa} from 'execa'
import fs from 'fs-extra'
import {globby} from 'globby'
import * as lodash from 'lodash-es'
import readFileJson from 'read-file-json'
import {firstMatch} from 'super-regex'

type Entry = {
  fileBase: string
  folderName: string
  rootFolder: string
}

const pkg = <PackageJson> await readFileJson.default(`package.json`)
try {
  await execa(`tsc`)
} catch (error) {
  console.error(error)
}
const files = await globby(`*/*.js`, {
  absolute: true,
  cwd: `out/ts/src`,
})
const entries = files.map(file => {
  const fileForwardSlashes = file.replaceAll(`\\`, `/`)
  const match = firstMatch(/^(?<rootFolder>.+)\/(?<folderName>.+)\/(?<fileBase>.+)\.[a-z]+$/, fileForwardSlashes)
  return <Entry> match!.namedGroups
})
for (const entry of entries) {
  const {fileBase, folderName, rootFolder} = entry
  const from = `${rootFolder}/${folderName}/${fileBase}.js`
  const to = `dist/package/${folderName}/${fileBase}.js`
  await fs.copy(from, to)
}
await fs.outputJson(`dist/package/package.json`, {
  ...lodash.pick(pkg, [
    `version`,
    `description`,
  ]),
  name: `@jaid/workflows-scripts`,
  type: `module`,
})
