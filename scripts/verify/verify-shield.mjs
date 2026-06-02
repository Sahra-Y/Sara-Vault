import * as luaparse from 'luaparse'
import { obfuscateLuaFile } from '../../electron/shield/lua/index.ts'
import { obfuscateJsFile } from '../../electron/shield/js/index.ts'

let failed = 0

function check(name, ok) {
  if (ok) console.log('OK  ', name)
  else {
    console.log('FAIL', name)
    failed += 1
  }
}

const luaSrc =
  "local QBCore = exports['qb-core']:GetCoreObject()\nprint('test')"
const luaOut = obfuscateLuaFile(luaSrc)
check('Lua parse', (() => {
  try {
    luaparse.parse(luaOut, { wait: false, luaVersion: '5.3', comments: false })
    return true
  } catch {
    return false
  }
})())
check('Lua exports qb-core', luaOut.includes("'qb-core'") || luaOut.includes('"qb-core"'))
check('Lua no empty exports', !/exports\[['"]{2}\]/.test(luaOut))

const hudSrc =
  "RegisterNUICallback('close', function() end)\nSendNUIMessage({ action = 'showHud' })"
const hudOut = obfuscateLuaFile(hudSrc)
check('NUI callback name plain', hudOut.includes("'close'") || hudOut.includes('"close"'))
check('NUI action key plain', /\baction\s*=/.test(hudOut))
check('NUI action value plain', hudOut.includes("'showHud'") || hudOut.includes('"showHud"'))

const jsSrc = `window.addEventListener('message', (e) => { console.log(e.data); });`
const jsOut = await obfuscateJsFile(jsSrc)
check('JS obfuscate changed', jsOut !== jsSrc && jsOut.length > 50)
check('JS header', jsOut.includes('SaraShield') === false) // header added in shield-file only

if (failed > 0) {
  console.error(`\n${failed} kontrol başarısız.`)
  process.exit(1)
}
console.log('\nTüm shield kontrolleri geçti.')
