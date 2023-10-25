import {execa} from 'execa'
import fs from 'fs-extra'
import {globby} from 'globby'
import {firstMatch} from 'super-regex'

type Entry = {
  fileBase: string
  folderName: string
  rootFolder: string
}

try {
  // only compile files in src/**
  // dont emit tsd
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
  const to = `dist/build/${folderName}/${fileBase}.js`
  await fs.copy(from, to)
}
