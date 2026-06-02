import type { Chunk, Identifier, Node, StringLiteral } from 'luaparse'
import { randomBytes } from 'node:crypto'

const RESERVED = new Set([
  'and',
  'break',
  'do',
  'else',
  'elseif',
  'end',
  'false',
  'for',
  'function',
  'goto',
  'if',
  'in',
  'local',
  'nil',
  'not',
  'or',
  'repeat',
  'return',
  'then',
  'true',
  'until',
  'while',
])

const FIVEM_GLOBALS = new Set([
  'Citizen',
  'CreateThread',
  'Wait',
  'RegisterNetEvent',
  'RegisterServerEvent',
  'AddEventHandler',
  'TriggerEvent',
  'TriggerServerEvent',
  'TriggerClientEvent',
  'exports',
  'GlobalState',
  'source',
  'print',
  'json',
  'GetCurrentResourceName',
  'IsDuplicityVersion',
  'vector3',
  'vector4',
  'SendNUIMessage',
  'SetNuiFocus',
  'RegisterNUICallback',
  'lib',
  'QBCore',
  'ESX',
])

/** Resource names used in exports['...'] — keep plaintext for FiveM compatibility */
const FIVEM_EXPORT_RESOURCES = new Set([
  'qb-core',
  'qb_core',
  'qbx_core',
  'es_extended',
  'ox_core',
  'ox_lib',
  'oxmysql',
  'ox_inventory',
  'ox_target',
  'ps-banking',
  'ps-inventory',
])

function randomHexName(): string {
  return `_0x${randomBytes(3).toString('hex').toUpperCase()}`
}

function walk(node: Node, visit: (n: Node) => void): void {
  visit(node)
  for (const key of Object.keys(node)) {
    const value = (node as unknown as Record<string, unknown>)[key]
    if (!value) continue
    if (Array.isArray(value)) {
      for (const child of value) {
        if (child && typeof child === 'object' && 'type' in child) walk(child as Node, visit)
      }
    } else if (typeof value === 'object' && value !== null && 'type' in value) {
      walk(value as Node, visit)
    }
  }
}

function walkWithParent(
  node: Node,
  parent: Node | null,
  ancestors: Node[],
  visit: (n: Node, p: Node | null, a: Node[]) => void,
): void {
  visit(node, parent, ancestors)
  const nextAncestors = parent ? [...ancestors, parent] : ancestors
  for (const key of Object.keys(node)) {
    const value = (node as unknown as Record<string, unknown>)[key]
    if (!value) continue
    if (Array.isArray(value)) {
      for (const child of value) {
        if (child && typeof child === 'object' && 'type' in child) {
          walkWithParent(child as Node, node, nextAncestors, visit)
        }
      }
    } else if (typeof value === 'object' && value !== null && 'type' in value) {
      walkWithParent(value as Node, node, nextAncestors, visit)
    }
  }
}

const NUI_MESSAGE_APIS = new Set(['SendNUIMessage', 'SendReactMessage'])

const NUI_EVENT_APIS = new Set([
  'RegisterNUICallback',
  'RegisterNuiCallback',
  'RegisterNetEvent',
  'RegisterServerEvent',
  'AddEventHandler',
  'TriggerEvent',
  'TriggerServerEvent',
  'TriggerClientEvent',
])

function callBaseName(node: Node): string | null {
  if (node.type !== 'CallExpression') return null
  const base = (node as { base?: Node }).base
  if (base?.type === 'Identifier') return (base as Identifier).name
  return null
}

/** luaparse often leaves value null and stores the text in raw */
export function stringFromLiteral(lit: StringLiteral): string | null {
  if (typeof lit.value === 'string') return lit.value
  const raw = lit.raw
  if (!raw || raw.length < 2) return null
  const q = raw[0]
  if ((q === '"' || q === "'") && raw[raw.length - 1] === q) {
    const inner = raw.slice(1, -1)
    return inner
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, '\\')
  }
  if (raw.startsWith('[[') && raw.endsWith(']]')) {
    return raw.slice(2, -2)
  }
  return null
}

function shouldSkipStringEncryption(
  text: string,
  lit: StringLiteral,
  parent: Node | null,
  ancestors: Node[],
): boolean {
  if (FIVEM_EXPORT_RESOURCES.has(text)) return true

  const chain = parent ? [...ancestors, parent] : ancestors

  for (const node of chain) {
    if (node.type === 'IndexExpression') {
      const base = (node as { base?: Node }).base
      if (base?.type === 'Identifier' && (base as Identifier).name === 'exports') {
        return true
      }
    }

    if (node.type === 'CallExpression') {
      const name = callBaseName(node)
      if (!name) continue

      if (NUI_MESSAGE_APIS.has(name)) return true

      if (NUI_EVENT_APIS.has(name)) {
        const args = (node as { arguments?: Node[] }).arguments
        if (args?.[0] === lit) return true
      }
    }
  }

  return false
}

function replaceStringWithDecryptCall(
  lit: StringLiteral,
  decryptFn: string,
  encoded: string,
): void {
  const target = lit as unknown as Record<string, unknown>
  for (const key of Object.keys(target)) delete target[key]
  Object.assign(target, {
    type: 'CallExpression',
    base: { type: 'Identifier', name: decryptFn },
    arguments: [
      {
        type: 'StringLiteral',
        value: encoded,
        raw: `"${encoded}"`,
      },
    ],
  })
}

export function collectLocalNames(chunk: Chunk): Set<string> {
  const names = new Set<string>()

  walk(chunk, (node) => {
    if (node.type === 'LocalStatement') {
      for (const v of node.variables) {
        if (v.type === 'Identifier') names.add(v.name)
      }
    }
    if (node.type === 'FunctionDeclaration' && node.isLocal) {
      const ident = node.identifier
      if (ident && ident.type === 'Identifier') names.add(ident.name)
    }
    if (node.type === 'FunctionDeclaration') {
      for (const p of node.parameters) {
        if (p.type === 'Identifier') names.add(p.name)
      }
    }
    if (node.type === 'ForNumericStatement' && node.variable.type === 'Identifier') {
      names.add(node.variable.name)
    }
    if (node.type === 'ForGenericStatement') {
      for (const v of node.variables) {
        if (v.type === 'Identifier') names.add(v.name)
      }
    }
  })

  return names
}

export function buildRenameMap(names: Iterable<string>): Map<string, string> {
  const map = new Map<string, string>()
  const used = new Set<string>()
  for (const name of names) {
    if (RESERVED.has(name) || FIVEM_GLOBALS.has(name)) continue
    let next = randomHexName()
    while (used.has(next)) next = randomHexName()
    used.add(next)
    map.set(name, next)
  }
  return map
}

export function applyRenames(chunk: Chunk, renameMap: Map<string, string>): void {
  walk(chunk, (node) => {
    if (node.type === 'Identifier') {
      const id = node as Identifier
      const next = renameMap.get(id.name)
      if (next) id.name = next
    }
    if (node.type === 'FunctionDeclaration') {
      const ident = node.identifier
      if (ident && ident.type === 'Identifier') {
        const next = renameMap.get(ident.name)
        if (next) ident.name = next
      }
    }
  })
}

export function encryptStrings(chunk: Chunk, decryptFn: string): number {
  const literals: { lit: StringLiteral; parent: Node | null; ancestors: Node[] }[] = []

  walkWithParent(chunk, null, [], (node, parent, ancestors) => {
    if (node.type === 'StringLiteral') {
      literals.push({ lit: node as StringLiteral, parent, ancestors })
    }
  })

  let touched = 0
  for (const { lit, parent, ancestors } of literals) {
    if (lit.type !== 'StringLiteral') continue

    const text = stringFromLiteral(lit)
    if (!text || text.length === 0) continue
    if (shouldSkipStringEncryption(text, lit, parent, ancestors)) continue

    const encoded = Buffer.from(text, 'utf8').toString('hex')
    replaceStringWithDecryptCall(lit, decryptFn, encoded)
    touched += 1
  }

  return touched
}

export function buildStringDecryptor(fnName: string): string {
  return `local function ${fnName}(_s)
  local _o = {}
  for i = 1, #_s, 2 do
    _o[#_o + 1] = string.char(tonumber(_s:sub(i, i + 1), 16))
  end
  return table.concat(_o)
end`
}

export { randomHexName }
