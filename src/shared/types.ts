export interface FileTreeNode {
  id: string
  name: string
  path: string
  type: 'file' | 'folder'
  extension?: string
  children?: FileTreeNode[]
}

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

export interface ResourceAnalysis {
  rootPath: string
  hasManifest: boolean
  hasNui: boolean
  framework: 'qb' | 'esx' | 'ox' | 'standalone' | 'unknown'
  resourceKind: string
  suggestedTier: ShieldTier
  summaryLine: string
}

export interface FileClassification {
  path: string
  role: FileRole
  roleLabel: string
  shouldShield: boolean
  startTier: ShieldTier
}

export interface ScanResult {
  rootPath: string
  tree: FileTreeNode
  luaFiles: string[]
  /** NUI / html / ui altındaki ve seçilebilir .js dosyaları */
  jsFiles: string[]
  importMode: ImportMode
  analysis?: ResourceAnalysis
  classifications?: FileClassification[]
}

export function defaultShieldSelection(result: ScanResult): string[] {
  if (result.classifications?.length) {
    return result.classifications.filter((c) => c.shouldShield).map((c) => c.path)
  }

  const jsAuto = result.jsFiles.filter((f) => {
    const rel = f.slice(result.rootPath.length).replace(/^[/\\]+/, '')
    const parts = rel.split(/[/\\]/).map((s) => s.toLowerCase())
    const nuiDirs = new Set(['html', 'ui', 'nui', 'web', 'interface', 'frontend'])
    return parts.some((p) => nuiDirs.has(p))
  })
  return [...result.luaFiles, ...jsAuto]
}

export function countShieldSelection(paths: string[]): { lua: number; js: number } {
  let lua = 0
  let js = 0
  for (const p of paths) {
    if (p.toLowerCase().endsWith('.js')) js += 1
    else if (p.toLowerCase().endsWith('.lua')) lua += 1
  }
  return { lua, js }
}

export type ImportMode = 'folder' | 'files'

export interface DropResolveResult {
  rootPath: string
  /** Sürüklenen .lua / .js dosyaları */
  preselectedFiles: string[]
  importMode: ImportMode
}

export interface ScanImportRequest {
  rootPath: string
  importMode: ImportMode
  fileList?: string[]
}

export interface ObfuscateRequest {
  rootPath: string
  selectedFiles: string[]
  importMode: ImportMode
  classifications?: FileClassification[]
}

export interface ObfuscateResult {
  success: boolean
  outputPath: string
  processed: number
  failed: { path: string; error: string }[]
  message: string
}

export interface ObfuscateProgress {
  phase: 'idle' | 'running' | 'done' | 'error'
  percent: number
  currentFile?: string
}
