import fs from 'node:fs/promises'
import path from 'node:path'
import type { ShieldTier } from '../shield/profiles'

export type FrameworkHint = 'qb' | 'esx' | 'ox' | 'standalone' | 'unknown'

export type ResourceKind =
  | 'nui-full'
  | 'client-server'
  | 'server-only'
  | 'client-only'
  | 'mixed'

export interface ResourceAnalysis {
  rootPath: string
  hasManifest: boolean
  hasNui: boolean
  hasUiPage: boolean
  framework: FrameworkHint
  resourceKind: ResourceKind
  suggestedTier: ShieldTier
  summaryLine: string
}

async function readManifestText(rootPath: string): Promise<string> {
  for (const name of ['fxmanifest.lua', '__resource.lua']) {
    try {
      return await fs.readFile(path.join(rootPath, name), 'utf8')
    } catch {
      /* try next */
    }
  }
  return ''
}

async function dirHasHtml(rootPath: string): Promise<boolean> {
  const names = ['html', 'ui', 'nui', 'web', 'interface', 'frontend']
  for (const name of names) {
    try {
      const stat = await fs.stat(path.join(rootPath, name))
      if (stat.isDirectory()) return true
    } catch {
      /* skip */
    }
  }
  return false
}

function detectFramework(manifest: string, luaSnippet: string): FrameworkHint {
  const blob = `${manifest}\n${luaSnippet}`.toLowerCase()
  if (
    blob.includes('qb-core') ||
    blob.includes('qbx_core') ||
    blob.includes('qb-') ||
    blob.includes('qbox')
  ) {
    return 'qb'
  }
  if (blob.includes('es_extended') || blob.includes('esx')) return 'esx'
  if (
    blob.includes('ox_lib') ||
    blob.includes('ox_core') ||
    blob.includes('overextended')
  ) {
    return 'ox'
  }
  if (manifest.length > 0 || luaSnippet.length > 0) return 'standalone'
  return 'unknown'
}

function detectResourceKind(
  manifest: string,
  hasNui: boolean,
  luaFiles: string[],
): ResourceKind {
  const m = manifest.toLowerCase()
  const hasClient =
    m.includes('client_script') ||
    luaFiles.some((f) => /client|cl_/i.test(path.basename(f)))
  const hasServer =
    m.includes('server_script') ||
    luaFiles.some((f) => /server|sv_/i.test(path.basename(f)))

  if (hasNui && hasClient) return 'nui-full'
  if (hasClient && hasServer) return 'client-server'
  if (hasServer && !hasClient) return 'server-only'
  if (hasClient && !hasServer) return 'client-only'
  return 'mixed'
}

function frameworkLabel(fw: FrameworkHint): string {
  switch (fw) {
    case 'qb':
      return 'QBCore'
    case 'esx':
      return 'ESX'
    case 'ox':
      return 'OX'
    case 'standalone':
      return 'Standalone'
    default:
      return 'Bilinmiyor'
  }
}

function kindLabel(kind: ResourceKind): string {
  switch (kind) {
    case 'nui-full':
      return 'NUI + Client'
    case 'client-server':
      return 'Client + Server'
    case 'server-only':
      return 'Server'
    case 'client-only':
      return 'Client'
    default:
      return 'Karışık'
  }
}

export async function analyzeResource(
  rootPath: string,
  luaFiles: string[],
  jsFiles: string[],
): Promise<ResourceAnalysis> {
  const manifest = await readManifestText(rootPath)
  const hasManifest = manifest.length > 0
  const hasUiPage = /ui_page\s+/i.test(manifest)
  const htmlDir = await dirHasHtml(rootPath)
  const hasNui = hasUiPage || htmlDir || jsFiles.length > 0

  let luaSnippet = ''
  for (const file of luaFiles.slice(0, 8)) {
    try {
      const part = await fs.readFile(file, 'utf8')
      luaSnippet += part.slice(0, 4000)
    } catch {
      /* skip */
    }
  }

  const framework = detectFramework(manifest, luaSnippet)
  const resourceKind = detectResourceKind(manifest, hasNui, luaFiles)

  let suggestedTier: ShieldTier = 'fivem-safe'
  if (resourceKind === 'server-only') suggestedTier = 'balanced'
  if (hasNui) suggestedTier = 'fivem-safe'

  const summaryLine = `FiveM: ${kindLabel(resourceKind)} · ${frameworkLabel(framework)} · Öneri: ${suggestedTier === 'fivem-safe' ? 'FiveM Safe' : 'Balanced'}`

  return {
    rootPath,
    hasManifest,
    hasNui,
    hasUiPage,
    framework,
    resourceKind,
    suggestedTier,
    summaryLine,
  }
}

export function logAnalysisLines(
  analysis: ResourceAnalysis,
  classifications: { roleLabel: string; shouldShield: boolean; path: string }[],
  log: (line: string) => void,
): void {
  log('——— FiveM analiz ———')
  log(analysis.summaryLine)
  if (!analysis.hasManifest) {
    log('UYARI: fxmanifest.lua bulunamadı — klasör modunda Output kullan.')
  }
  if (analysis.hasNui) {
    log('NUI algılandı — html/ui dosyaları Output ile birlikte kopyalanmalı.')
  }

  const skip = classifications.filter((c) => !c.shouldShield)
  const shield = classifications.filter((c) => c.shouldShield)

  if (skip.length > 0) {
    log(`Atlanacak (${skip.length}): ${skip.map((c) => path.basename(c.path)).slice(0, 6).join(', ')}${skip.length > 6 ? '…' : ''}`)
  }
  log(`Shield (${shield.length} dosya seçildi)`)
  for (const c of shield.slice(0, 12)) {
    log(`  · ${path.basename(c.path)} [${c.roleLabel}]`)
  }
  if (shield.length > 12) log(`  · … +${shield.length - 12} dosya`)
  log('—————————————————')
}
