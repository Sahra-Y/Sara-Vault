import path from 'node:path'

const JS_SKIP_DIR = new Set([
  'node_modules',
  '.git',
  'Output',
  'build-output',
  'dist-electron',
])

const NUI_DIR_NAMES = new Set(['html', 'ui', 'nui', 'web', 'interface', 'frontend'])

const JS_SKIP_BASENAMES = new Set([
  'webpack.config.js',
  'webpack.config.cjs',
  'webpack.config.mjs',
  'vite.config.js',
  'vite.config.ts',
  'rollup.config.js',
  'esbuild.config.js',
  'postcss.config.js',
  'tailwind.config.js',
])

const MAX_JS_BYTES = 2 * 1024 * 1024

export function isLuaPath(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === '.lua'
}

export function isJsPath(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === '.js'
}

export function shouldSkipJsFile(fullPath: string): boolean {
  const normalized = path.normalize(fullPath)
  const base = path.basename(normalized).toLowerCase()
  const segments = normalized.split(path.sep).map((s) => s.toLowerCase())

  if (segments.some((s) => JS_SKIP_DIR.has(s))) return true
  if (JS_SKIP_BASENAMES.has(base)) return true
  if (base.endsWith('.min.js')) return true
  if (base.endsWith('.bundle.js')) return true

  return false
}

/** NUI klasörlerindeki .js dosyalarını varsayılan seçimde işaretle */
export function shouldAutoSelectJs(fullPath: string, rootPath: string): boolean {
  if (!isJsPath(fullPath) || shouldSkipJsFile(fullPath)) return false

  const rel = path.relative(rootPath, fullPath).split(path.sep)
  const lower = rel.map((s) => s.toLowerCase())
  if (lower.some((s) => NUI_DIR_NAMES.has(s))) return true

  return false
}

export function isWithinMaxJsSize(bytes: number): boolean {
  return bytes <= MAX_JS_BYTES
}

export { MAX_JS_BYTES }
