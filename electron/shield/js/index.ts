import type { ObfuscatorOptions } from 'javascript-obfuscator'
import type { FileRole, ShieldTier } from '../profiles'

export interface ObfuscateJsOptions {
  /** FiveM CEF / NUI uyumu için varsayılan: false */
  aggressive?: boolean
}

const NUI_SAFE: ObfuscatorOptions = {
  compact: true,
  simplify: true,
  target: 'browser',
  renameGlobals: false,
  renameProperties: false,
  renamePropertiesMode: 'safe',
  selfDefending: false,
  debugProtection: false,
  disableConsoleOutput: false,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  numbersToExpressions: false,
  splitStrings: true,
  splitStringsChunkLength: 8,
  stringArray: true,
  stringArrayCallsTransform: false,
  stringArrayEncoding: ['base64'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayThreshold: 0.65,
  transformObjectKeys: false,
  unicodeEscapeSequence: false,
  identifierNamesGenerator: 'hexadecimal',
  identifiersPrefix: '_0xSara',
}

const NUI_AGGRESSIVE: ObfuscatorOptions = {
  ...NUI_SAFE,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.2,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.15,
  stringArrayThreshold: 0.8,
}

type ObfuscatorApi = {
  obfuscate: (
    source: string,
    options?: ObfuscatorOptions,
  ) => { getObfuscatedCode: () => string }
}

let obfuscatorApi: ObfuscatorApi | null = null

async function loadObfuscator(): Promise<ObfuscatorApi> {
  if (obfuscatorApi) return obfuscatorApi
  const mod = await import('javascript-obfuscator')
  const api = (mod as { default?: ObfuscatorApi }).default ?? (mod as ObfuscatorApi)
  if (typeof api.obfuscate !== 'function') {
    throw new Error('javascript-obfuscator yüklenemedi')
  }
  obfuscatorApi = api
  return obfuscatorApi
}

export async function obfuscateJsFile(
  source: string,
  options: ObfuscateJsOptions = {},
): Promise<string> {
  const trimmed = source.trim()
  if (!trimmed) return source

  const ob = await loadObfuscator()
  const opts = options.aggressive ? NUI_AGGRESSIVE : NUI_SAFE

  try {
    const result = ob.obfuscate(source, {
      ...opts,
      sourceMap: false,
    })
    const code = result.getObfuscatedCode()
    return code && code.length > 0 ? code : source
  } catch {
    return source
  }
}

export interface ShieldJsResult {
  code: string
  tier: ShieldTier
}

export async function obfuscateJsForRole(
  source: string,
  role: FileRole,
): Promise<ShieldJsResult> {
  const trimmed = source.trim()
  if (!trimmed || role !== 'nui-js') {
    return { code: source, tier: 'minimal' }
  }

  try {
    const out = await obfuscateJsFile(source, { aggressive: false })
    if (out && out.length > 0 && out !== source) {
      return { code: out, tier: 'fivem-safe' }
    }
  } catch {
    /* minimal */
  }

  return { code: source, tier: 'minimal' }
}
