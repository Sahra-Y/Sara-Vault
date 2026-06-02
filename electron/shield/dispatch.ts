import path from 'node:path'
import type { FileRole } from './profiles'
import { roleLabelTr, tierLabelTr } from './profiles'
import { obfuscateJsForRole } from './js/index'
import { obfuscateLuaForRole } from './lua/index'
import { isJsPath, isLuaPath, isWithinMaxJsSize, shouldSkipJsFile } from '../import/paths'
import type { ShieldTier } from './profiles'

export type ShieldKind = 'lua' | 'js'

export interface ShieldResult {
  code: string
  tier: ShieldTier
  roleLabel: string
  skipped?: boolean
}

export function shieldKindForPath(filePath: string): ShieldKind | null {
  if (isLuaPath(filePath)) return 'lua'
  if (isJsPath(filePath) && !shouldSkipJsFile(filePath)) return 'js'
  return null
}

export async function shieldFile(
  filePath: string,
  raw: string,
  role: FileRole = 'lua-other',
  fileSizeBytes?: number,
): Promise<ShieldResult> {
  const roleLabel = roleLabelTr(role)
  const kind = shieldKindForPath(filePath)

  if (kind === 'lua') {
    const { code, tier, skipped } = obfuscateLuaForRole(raw, role)
    return { code, tier, roleLabel, skipped }
  }

  if (kind === 'js') {
    if (fileSizeBytes !== undefined && !isWithinMaxJsSize(fileSizeBytes)) {
      throw new Error(`JS dosyası çok büyük (max ${Math.round((2 * 1024 * 1024) / 1024)} KB)`)
    }
    const { code, tier } = await obfuscateJsForRole(raw, role)
    const wrapped =
      tier === 'minimal' && code === raw
        ? code
        : `/* SaraVault | SaraShield NUI */\n${code}`
    return { code: wrapped, tier, roleLabel }
  }

  throw new Error(`Desteklenmeyen dosya: ${path.extname(filePath)}`)
}

export function shieldLabel(filePath: string): string {
  const kind = shieldKindForPath(filePath)
  if (kind === 'js') return 'JS'
  if (kind === 'lua') return 'Lua'
  return path.extname(filePath).slice(1).toUpperCase() || 'FILE'
}

export function formatShieldLogLine(
  fileName: string,
  roleLabel: string,
  tier: ShieldTier,
): string {
  return `${fileName} [${roleLabel}] → ${tierLabelTr(tier)}`
}
