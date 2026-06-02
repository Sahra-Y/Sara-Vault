import type { ObfuscateOptions } from './lua/index'

export type ShieldTier = 'aggressive' | 'balanced' | 'fivem-safe' | 'minimal'

export type FileRole =
  | 'skip-manifest'
  | 'skip-config'
  | 'skip-locale'
  | 'nui-client'
  | 'client'
  | 'server'
  | 'shared'
  | 'nui-js'
  | 'lua-other'

export interface LuaShieldProfile extends Required<ObfuscateOptions> {
  tier: ShieldTier
}

export function tierLabelTr(tier: ShieldTier): string {
  switch (tier) {
    case 'aggressive':
      return 'Agresif'
    case 'balanced':
      return 'Balanced'
    case 'fivem-safe':
      return 'FiveM Safe'
    case 'minimal':
      return 'Minimal'
  }
}

export function roleLabelTr(role: FileRole): string {
  switch (role) {
    case 'skip-manifest':
      return 'Manifest (atla)'
    case 'skip-config':
      return 'Config (atla)'
    case 'skip-locale':
      return 'Locale (atla)'
    case 'nui-client':
      return 'NUI Client'
    case 'client':
      return 'Client'
    case 'server':
      return 'Server'
    case 'shared':
      return 'Shared'
    case 'nui-js':
      return 'NUI JS'
    case 'lua-other':
      return 'Lua'
  }
}

export function shouldShieldRole(role: FileRole): boolean {
  return (
    role !== 'skip-manifest' && role !== 'skip-config' && role !== 'skip-locale'
  )
}

export function getLuaOptionsForTier(tier: ShieldTier): LuaShieldProfile {
  switch (tier) {
    case 'aggressive':
      return { tier, rename: true, encryptStrings: true, minify: false }
    case 'balanced':
      return { tier, rename: false, encryptStrings: true, minify: false }
    case 'fivem-safe':
      return { tier, rename: false, encryptStrings: true, minify: false }
    case 'minimal':
      return { tier, rename: false, encryptStrings: false, minify: false }
  }
}

/** Role göre deneme sırası (yukarıdan aşağı, fail olunca iner) */
export function getTierCascade(role: FileRole): ShieldTier[] {
  switch (role) {
    case 'nui-client':
      return ['fivem-safe', 'balanced', 'minimal']
    case 'client':
    case 'shared':
      return ['balanced', 'fivem-safe', 'minimal']
    case 'server':
      return ['balanced', 'aggressive', 'fivem-safe', 'minimal']
    case 'nui-js':
      return ['fivem-safe', 'minimal']
    case 'lua-other':
      return ['balanced', 'fivem-safe', 'minimal']
    default:
      return ['fivem-safe', 'minimal']
  }
}

export function minimalLuaOutput(source: string): string {
  if (source.startsWith('-- SaraVault')) return source
  return `-- SaraVault | SaraShield Protected (Minimal)\n${source}`
}
