import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pngToIco from 'png-to-ico'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const pngPath = path.join(root, 'build', 'icon.png')

if (!fs.existsSync(pngPath)) {
  console.error('Missing build/icon.png — add your logo first.')
  process.exit(1)
}

const ico = await pngToIco(pngPath)
const targets = [
  path.join(root, 'build', 'icon.ico'),
  path.join(root, 'public', 'icon.ico'),
]

for (const target of targets) {
  fs.writeFileSync(target, ico)
  console.log('Wrote', target)
}
