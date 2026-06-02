import * as luaparse from 'luaparse'
import { obfuscateLuaFile } from '../../electron/shield/lua/index.ts'

const hudClient = `
local QBCore = exports['qb-core']:GetCoreObject()
local isOpen = false

RegisterNUICallback('close', function(_, cb)
    SetNuiFocus(false, false)
    isOpen = false
    cb('ok')
end)

RegisterNetEvent('QBCore:Client:OnPlayerLoaded', function()
    SendNUIMessage({ action = 'setup', resource = GetCurrentResourceName() })
end)

CreateThread(function()
    Wait(1000)
    SendNUIMessage({ action = 'showHud', display = true })
    SetNuiFocus(false, false)
end)
`

const out = obfuscateLuaFile(hudClient)
console.log('--- OUTPUT ---')
console.log(out)
console.log('--- PARSE ---')
try {
  luaparse.parse(out, { wait: false, luaVersion: '5.3', comments: false })
  console.log('parse OK')
} catch (e) {
  console.log('parse FAIL', e.message)
}
console.log('has setup action literal', /showHud|setup/.test(out))
console.log('has close callback', /close/.test(out))
console.log('has decrypt fn', /local function _0x/.test(out))
