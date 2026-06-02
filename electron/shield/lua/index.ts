import * as luaparse from 'luaparse'
import type { Chunk } from 'luaparse'
import { fivemSanityIssues } from '../../analyze/fivem-sanity'
import type { FileRole, ShieldTier } from '../profiles'
import {
  getLuaOptionsForTier,
  getTierCascade,
  minimalLuaOutput,
} from '../profiles'
import { generate, minify } from './codegen'
import {
  applyRenames,
  buildRenameMap,
  buildStringDecryptor,
  collectLocalNames,
  encryptStrings,
  randomHexName,
} from './transforms'

export interface ShieldLuaResult {
  code: string
  tier: ShieldTier
  skipped?: boolean
}

export interface ObfuscateOptions {
  rename?: boolean
  encryptStrings?: boolean
  minify?: boolean
}

const SAFE_DEFAULTS: Required<ObfuscateOptions> = {
  rename: false,
  encryptStrings: true,
  minify: false,
}

function isValidLua(code: string): boolean {
  try {
    luaparse.parse(code, { wait: false, luaVersion: '5.3', comments: false })
    return true
  } catch {
    return false
  }
}

function obfuscateOnce(source: string, opts: Required<ObfuscateOptions>): string {
  const decryptFn = randomHexName()

  let ast: Chunk
  try {
    ast = luaparse.parse(source, {
      wait: false,
      luaVersion: '5.3',
      comments: false,
    }) as Chunk
  } catch {
    return fallbackObfuscate(source, decryptFn, opts.minify)
  }

  const preludeParts: string[] = [
    '-- SaraVault | SaraShield Protected',
    buildStringDecryptor(decryptFn),
  ]

  if (opts.rename) {
    const locals = collectLocalNames(ast)
    const renameMap = buildRenameMap(locals)
    applyRenames(ast, renameMap)
  }

  if (opts.encryptStrings) {
    encryptStrings(ast, decryptFn)
  }

  let output = preludeParts.join('\n') + '\n' + generate(ast as unknown as Parameters<typeof generate>[0])

  if (opts.minify) {
    output = minify(output)
  }

  return output
}

export function obfuscateLuaFile(
  source: string,
  options: ObfuscateOptions = {},
): string {
  const userOpts = { ...SAFE_DEFAULTS, ...options }

  const attempts: Required<ObfuscateOptions>[] = [
    userOpts,
    { rename: false, encryptStrings: true, minify: false },
    { rename: true, encryptStrings: true, minify: false },
    { rename: false, encryptStrings: false, minify: false },
  ]

  for (const opts of attempts) {
    const output = obfuscateOnce(source, opts)
    if (isValidLua(output)) return output
  }

  return source
}

/** FiveM dosya rolüne göre profil zinciri (Agresif → … → Minimal) */
export function obfuscateLuaForRole(source: string, role: FileRole): ShieldLuaResult {
  if (role.startsWith('skip-')) {
    return { code: source, tier: 'minimal', skipped: true }
  }

  for (const tier of getTierCascade(role)) {
    const { rename, encryptStrings, minify } = getLuaOptionsForTier(tier)
    const output = obfuscateOnce(source, { rename, encryptStrings, minify })
    if (!isValidLua(output)) continue
    if (fivemSanityIssues(output).length > 0) continue
    return { code: output, tier }
  }

  return { code: minimalLuaOutput(source), tier: 'minimal' }
}

function fallbackObfuscate(source: string, decryptFn: string, doMinify: boolean): string {
  const prelude = buildStringDecryptor(decryptFn)
  const stringPattern = /(["'])(?:(?=(\\?))\2.)*?\1/g
  let touched = 0

  const body = source.replace(stringPattern, (match) => {
    const inner = match.slice(1, -1)
    if (!inner || inner.length > 4000) return match
    try {
      const decoded = inner
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'")
        .replace(/\\\\/g, '\\')
      const hex = Buffer.from(decoded, 'utf8').toString('hex')
      touched += 1
      return `${decryptFn}("${hex}")`
    } catch {
      return match
    }
  })

  const output = prelude + '\n' + body
  if (touched === 0) return source
  const final = doMinify ? minify(output) : output
  return isValidLua(final) ? final : output
}
