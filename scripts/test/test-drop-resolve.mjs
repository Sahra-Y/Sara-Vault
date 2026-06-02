import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { resolveDropPaths } from '../../electron/import/drop-utils.ts'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'saravault-test-'))
const resource = path.join(tmp, 'MyResource')
fs.mkdirSync(path.join(resource, 'html'), { recursive: true })
fs.writeFileSync(path.join(resource, 'fxmanifest.lua'), "fx_version 'cerulean'\n")
fs.writeFileSync(path.join(resource, 'client.lua'), 'print(1)\n')
fs.writeFileSync(path.join(resource, 'html', 'app.js'), 'console.log(1)\n')

const clientPath = path.join(resource, 'client.lua')
const jsPath = path.join(resource, 'html', 'app.js')

const asFolder = resolveDropPaths([resource])
const asExpandedFiles = resolveDropPaths([clientPath, jsPath], { folderOnly: true })
const insideResource = resolveDropPaths([clientPath], { folderOnly: true })
const desktopLua = path.join(tmp, 'lonely.lua')
fs.writeFileSync(desktopLua, 'print(1)\n')
const looseFile = resolveDropPaths([desktopLua], { folderOnly: true })

console.log('direct folder:', asFolder?.importMode, asFolder?.rootPath)
console.log('expanded files folderOnly:', asExpandedFiles?.importMode, asExpandedFiles?.rootPath)
console.log('file inside resource:', insideResource?.importMode, insideResource?.rootPath)
console.log('loose file folderOnly:', looseFile)

fs.rmSync(tmp, { recursive: true, force: true })

if (asFolder?.importMode !== 'folder') process.exit(1)
if (asExpandedFiles?.importMode !== 'folder' || asExpandedFiles.rootPath !== resource) process.exit(1)
if (insideResource?.rootPath !== resource) process.exit(1)
if (looseFile !== null) process.exit(1)
console.log('drop-resolve OK')
