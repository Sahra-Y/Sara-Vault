import path from 'node:path'
import { isJsPath, isLuaPath, shouldSkipJsFile } from '../import/paths'
import type { FileRole } from '../shield/profiles'
import {
  roleLabelTr,
  shouldShieldRole,
  type ShieldTier,
} from '../shield/profiles'
import type { ResourceAnalysis } from './resource'

export interface FileClassification {
  path: string
  role: FileRole
  roleLabel: string
  shouldShield: boolean
  startTier: ShieldTier
}

const CONFIG_NAMES = new Set([
  'config.lua',
  'settings.lua',
  'configuration.lua',
  'shared_config.lua',
])

function detectLuaRoleFromContent(content: string): FileRole {
  const nui =
    /\bSendNUIMessage\b/.test(content) ||
    /\bRegisterNUICallback\b/.test(content) ||
    /\bSetNuiFocus\b/.test(content) ||
    /\bSendReactMessage\b/.test(content)

  const serverHints =
    /\bRegisterServerEvent\b/.test(content) ||
    /\bTriggerClientEvent\b/.test(content) ||
    /\bMySQL\b/.test(content) ||
    /\boxmysql\b/i.test(content)

  const clientHints =
    /\bRegisterNetEvent\b/.test(content) ||
    /\bTriggerServerEvent\b/.test(content) ||
    /\bCreateThread\b/.test(content)

  if (nui) return 'nui-client'
  if (serverHints && !clientHints) return 'server'
  if (clientHints) return 'client'
  return 'lua-other'
}

function classifyLuaPath(
  filePath: string,
  content: string,
  resource: ResourceAnalysis,
): FileClassification {
  const base = path.basename(filePath).toLowerCase()
  const rel = path
    .relative(resource.rootPath, filePath)
    .split(path.sep)
    .map((s) => s.toLowerCase())

  if (base === 'fxmanifest.lua' || base === '__resource.lua') {
    return make(filePath, 'skip-manifest', 'minimal')
  }
  if (CONFIG_NAMES.has(base) || rel.some((p) => p === 'config')) {
    return make(filePath, 'skip-config', 'minimal')
  }
  if (rel.includes('locales') || rel.includes('locale') || base.startsWith('locales')) {
    return make(filePath, 'skip-locale', 'minimal')
  }

  let role = detectLuaRoleFromContent(content)
  if (role === 'client' && resource.hasNui) {
    role = 'nui-client'
  }

  return make(filePath, role, resource.suggestedTier)
}

function classifyJsPath(filePath: string, resource: ResourceAnalysis): FileClassification {
  return make(filePath, 'nui-js', resource.suggestedTier)
}

function make(filePath: string, role: FileRole, startTier: ShieldTier): FileClassification {
  return {
    path: filePath,
    role,
    roleLabel: roleLabelTr(role),
    shouldShield: shouldShieldRole(role),
    startTier,
  }
}

export function classifyFile(
  filePath: string,
  content: string,
  resource: ResourceAnalysis,
): FileClassification | null {
  const normalized = path.normalize(filePath)
  if (isLuaPath(normalized)) {
    return classifyLuaPath(normalized, content, resource)
  }
  if (isJsPath(normalized) && !shouldSkipJsFile(normalized)) {
    return classifyJsPath(normalized, resource)
  }
  return null
}

export async function classifyFiles(
  luaFiles: string[],
  jsFiles: string[],
  resource: ResourceAnalysis,
): Promise<FileClassification[]> {
  const out: FileClassification[] = []

  for (const filePath of luaFiles) {
    let content = ''
    try {
      const fs = await import('node:fs/promises')
      content = await fs.readFile(filePath, 'utf8')
    } catch {
      content = ''
    }
    const c = classifyFile(filePath, content, resource)
    if (c) out.push(c)
  }

  for (const filePath of jsFiles) {
    const c = classifyFile(filePath, '', resource)
    if (c) out.push(c)
  }

  return out
}
