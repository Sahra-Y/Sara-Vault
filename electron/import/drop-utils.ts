import fs from 'node:fs'
import path from 'node:path'
import { isJsPath, isLuaPath, shouldSkipJsFile } from './paths'

export type ImportMode = 'folder' | 'files'

export interface DropResolveResult {
  rootPath: string
  preselectedFiles: string[]
  importMode: ImportMode
}

export interface ResolveDropOptions {
  /** Üst kutu: yalnızca resource klasörü (tek .lua buraya düşmez) */
  folderOnly?: boolean
}

function commonAncestor(paths: string[]): string {
  if (paths.length === 1) return paths[0]
  const split = paths.map((p) => path.normalize(p).split(path.sep).filter(Boolean))
  const common: string[] = []
  const len = Math.min(...split.map((s) => s.length))

  for (let i = 0; i < len; i++) {
    const seg = split[0][i]
    if (split.every((s) => s[i] === seg)) common.push(seg)
    else break
  }

  const joined = common.join(path.sep)
  if (path.isAbsolute(paths[0])) {
    return path.join(path.parse(paths[0]).root, joined)
  }
  return joined || path.dirname(paths[0])
}

function hasResourceManifest(dir: string): boolean {
  const names = ['fxmanifest.lua', '__resource.lua']
  for (const name of names) {
    try {
      if (fs.statSync(path.join(dir, name)).isFile()) return true
    } catch {
      /* yok */
    }
  }
  return false
}

function walkUpForManifest(startDir: string): string | null {
  let candidate = startDir
  for (let depth = 0; depth < 12; depth++) {
    if (hasResourceManifest(candidate)) return candidate
    const parent = path.dirname(candidate)
    if (parent === candidate) break
    candidate = parent
  }
  return null
}

/** Klasör sürüklenince Electron çoğu zaman içindeki dosya yollarını verir — kökü bul */
function detectResourceRootFromFiles(filePaths: string[]): string | null {
  if (filePaths.length === 0) return null

  const roots = new Set<string>()
  for (const file of filePaths) {
    const found = walkUpForManifest(path.dirname(file))
    if (found) roots.add(found)
  }
  if (roots.size === 1) return [...roots][0]
  if (roots.size > 1) return commonAncestor([...roots])

  const candidate = commonAncestor(filePaths.map((f) => path.dirname(f)))
  return walkUpForManifest(candidate)
}

function normalizeShieldPath(p: string): string | null {
  const n = path.normalize(p)
  if (!isLuaPath(n) && !(isJsPath(n) && !shouldSkipJsFile(n))) return null
  try {
    if (fs.statSync(n).isFile()) return n
  } catch {
    return null
  }
  return null
}

export function resolveDropPaths(
  rawPaths: string[],
  options: ResolveDropOptions = {},
): DropResolveResult | null {
  const { folderOnly = false } = options
  const paths = rawPaths.filter(Boolean).map((p) => path.normalize(p))
  if (!paths.length) return null

  const shieldFiles: string[] = []
  const dirRoots: string[] = []

  for (const p of paths) {
    try {
      const stat = fs.statSync(p)
      if (stat.isDirectory()) {
        dirRoots.push(p)
        continue
      }
      if (stat.isFile()) {
        const shield = normalizeShieldPath(p)
        if (shield) shieldFiles.push(shield)
      }
    } catch {
      /* skip */
    }
  }

  if (dirRoots.length >= 1) {
    return {
      rootPath: dirRoots.length === 1 ? dirRoots[0] : commonAncestor(dirRoots),
      preselectedFiles: [],
      importMode: 'folder',
    }
  }

  const resourceRoot = detectResourceRootFromFiles(
    paths.filter((p) => {
      try {
        return fs.statSync(p).isFile()
      } catch {
        return false
      }
    }),
  )

  if (resourceRoot) {
    return {
      rootPath: resourceRoot,
      preselectedFiles: [],
      importMode: 'folder',
    }
  }

  if (folderOnly) {
    return null
  }

  if (shieldFiles.length > 0) {
    return {
      rootPath: commonAncestor(shieldFiles.map((f) => path.dirname(f))),
      preselectedFiles: shieldFiles,
      importMode: 'files',
    }
  }

  return null
}
