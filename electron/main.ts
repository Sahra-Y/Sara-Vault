import { app, BrowserWindow, dialog, ipcMain, nativeImage } from 'electron'
import fsSync from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveDropPaths } from './import/drop-utils'
import type { ImportMode } from './import/drop-utils'
import { shouldSkipJsFile } from './import/paths'
import { analyzeResource, logAnalysisLines } from './analyze/resource'
import { classifyFiles } from './analyze/classify'
import type { FileClassification } from './analyze/classify'
import {
  formatShieldLogLine,
  shieldFile,
  shieldLabel,
} from './shield/dispatch'
import type { FileRole } from './shield/profiles'
import { tierLabelTr } from './shield/profiles'
import type {
  FileTreeNode,
  ObfuscateRequest,
  ObfuscateResult,
  ScanImportRequest,
  ScanResult,
} from '../src/shared/types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function resolvePreloadPath(): string {
  for (const name of ['preload.cjs', 'preload.mjs', 'preload.js']) {
    const candidate = path.join(__dirname, name)
    if (fsSync.existsSync(candidate)) return candidate
  }
  return path.join(__dirname, 'preload.cjs')
}

function resolveAppIcon(): Electron.NativeImage {
  const candidates = app.isPackaged
    ? [path.join(process.resourcesPath, 'logo.png')]
    : [
        path.join(app.getAppPath(), 'public', 'logo.png'),
        path.join(app.getAppPath(), 'build', 'icon.png'),
      ]
  for (const candidate of candidates) {
    const image = nativeImage.createFromPath(candidate)
    if (!image.isEmpty()) return image
  }
  return nativeImage.createEmpty()
}

let mainWindow: BrowserWindow | null = null

function log(line: string): void {
  const stamp = new Date().toLocaleTimeString()
  mainWindow?.webContents.send('vault:log', `[${stamp}] ${line}`)
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 640,
    title: 'Sara Vault',
    icon: resolveAppIcon(),
    backgroundColor: '#050810',
    autoHideMenuBar: true,
    webPreferences: {
      preload: resolvePreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    const indexHtml = path.join(__dirname, '../dist/index.html')
    void mainWindow.loadFile(indexHtml).catch((err) => {
      console.error('Failed to load UI:', indexHtml, err)
      dialog.showErrorBox(
        'Sara Vault',
        'Arayüz yüklenemedi. Programı "Sara Vault App" klasöründen veya Sara Vault.bat ile açın.',
      )
    })
  }

  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

async function buildTree(
  dirPath: string,
  rootPath: string,
  luaFiles: string[],
  jsFiles: string[],
): Promise<FileTreeNode> {
  const id = path.relative(rootPath, dirPath) || '.'
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  const children: FileTreeNode[] = []

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith('.') || entry.name === 'Output') continue

    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      children.push(await buildTree(fullPath, rootPath, luaFiles, jsFiles))
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase()
      if (ext === '.lua') luaFiles.push(fullPath)
      else if (ext === '.js' && !shouldSkipJsFile(fullPath)) jsFiles.push(fullPath)
      children.push({
        id: path.relative(rootPath, fullPath),
        name: entry.name,
        path: fullPath,
        type: 'file',
        extension: ext.replace('.', ''),
      })
    }
  }

  return { id, name: path.basename(dirPath), path: dirPath, type: 'folder', children }
}

function ensureFolderNode(
  root: FileTreeNode,
  rootPath: string,
  dirPath: string,
): FileTreeNode {
  const rel = path.relative(rootPath, dirPath)
  if (!rel || rel === '.') return root

  const parts = rel.split(path.sep)
  let current = root

  for (const part of parts) {
    let child = current.children?.find((c) => c.name === part && c.type === 'folder')
    if (!child) {
      const full = path.join(current.path, part)
      child = {
        id: path.relative(rootPath, full) || part,
        name: part,
        path: full,
        type: 'folder',
        children: [],
      }
      current.children = [...(current.children ?? []), child]
    }
    current = child
  }

  return current
}

async function buildTreeFromShieldFiles(
  rootPath: string,
  files: string[],
): Promise<{ tree: FileTreeNode; luaPaths: string[]; jsPaths: string[] }> {
  const normalized = files.map((f) => path.normalize(f))
  const root: FileTreeNode = {
    id: '.',
    name: path.basename(rootPath) || rootPath,
    path: rootPath,
    type: 'folder',
    children: [],
  }

  const luaPaths: string[] = []
  const jsPaths: string[] = []

  for (const filePath of normalized) {
    const ext = path.extname(filePath).toLowerCase()
    if (ext === '.lua') luaPaths.push(filePath)
    else if (ext === '.js' && !shouldSkipJsFile(filePath)) jsPaths.push(filePath)
    else continue

    const parent = path.dirname(filePath)
    const folder = ensureFolderNode(root, rootPath, parent)
    const name = path.basename(filePath)
    folder.children = [
      ...(folder.children ?? []).filter((c) => c.path !== filePath),
      {
        id: path.relative(rootPath, filePath),
        name,
        path: filePath,
        type: 'file',
        extension: ext.slice(1),
      },
    ]
  }

  return { tree: root, luaPaths, jsPaths }
}

function roleForPath(
  filePath: string,
  classMap: Map<string, FileClassification>,
): FileRole {
  return classMap.get(path.normalize(filePath))?.role ?? 'lua-other'
}

async function scanWithAnalysis(
  rootPath: string,
  luaFiles: string[],
  jsFiles: string[],
): Promise<{ analysis: Awaited<ReturnType<typeof analyzeResource>>; classifications: FileClassification[] }> {
  const analysis = await analyzeResource(rootPath, luaFiles, jsFiles)
  const classifications = await classifyFiles(luaFiles, jsFiles, analysis)
  logAnalysisLines(analysis, classifications, log)
  return { analysis, classifications }
}

async function writeShieldedFile(
  src: string,
  dest: string,
  classMap: Map<string, FileClassification>,
): Promise<{ tier: string; roleLabel: string }> {
  const stat = await fs.stat(src)
  const raw = await fs.readFile(src, 'utf8')
  const role = roleForPath(src, classMap)
  const result = await shieldFile(src, raw, role, stat.size)
  await fs.mkdir(path.dirname(dest), { recursive: true })
  await fs.writeFile(dest, result.code, 'utf8')
  log(`  → ${formatShieldLogLine(path.basename(src), result.roleLabel, result.tier)}`)
  return { tier: tierLabelTr(result.tier), roleLabel: result.roleLabel }
}

async function writeFilesModeOutput(
  selectedFiles: Set<string>,
  classMap: Map<string, FileClassification>,
): Promise<{ outputPaths: string[]; failed: ObfuscateResult['failed']; processed: number }> {
  const failed: ObfuscateResult['failed'] = []
  let processed = 0
  const outputPaths = new Set<string>()

  for (const filePath of selectedFiles) {
    const dir = path.dirname(filePath)
    const outputDir = path.join(dir, 'Output')
    const fileName = path.basename(filePath)
    const dest = path.join(outputDir, fileName)

    try {
      await writeShieldedFile(filePath, dest, classMap)
      outputPaths.add(outputDir)
      processed += 1
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      failed.push({ path: filePath, error: message })
      log(`ERROR: ${fileName} — ${message}`)
    }
  }

  return { outputPaths: [...outputPaths], failed, processed }
}

async function copyResourceTree(
  sourceDir: string,
  destDir: string,
  obfuscateSet: Set<string>,
  classMap: Map<string, FileClassification>,
  failed: ObfuscateResult['failed'],
): Promise<number> {
  await fs.mkdir(destDir, { recursive: true })
  const entries = await fs.readdir(sourceDir, { withFileTypes: true })
  let processed = 0

  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'Output') continue

    const src = path.join(sourceDir, entry.name)
    const dest = path.join(destDir, entry.name)

    if (entry.isDirectory()) {
      processed += await copyResourceTree(src, dest, obfuscateSet, classMap, failed)
    } else if (entry.isFile()) {
      if (obfuscateSet.has(src)) {
        try {
          await writeShieldedFile(src, dest, classMap)
          processed += 1
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          failed.push({ path: src, error: message })
          log(`ERROR: ${path.relative(sourceDir, src)} — ${message}`)
        }
      } else {
        await fs.copyFile(src, dest)
      }
    }
  }

  return processed
}

app.whenReady().then(() => {
  createWindow()

  ipcMain.handle('vault:ping', () => true)

  ipcMain.handle('vault:select-folder', async () => {
    const win = BrowserWindow.getFocusedWindow() ?? mainWindow
    if (!win) return null

    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Script / Resource Klasörü Seç',
      buttonLabel: 'Klasörü aç',
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('vault:select-shield-files', async () => {
    const win = BrowserWindow.getFocusedWindow() ?? mainWindow
    if (!win) return null

    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
      title: 'Lua / NUI JS Dosyaları Seç',
      buttonLabel: 'Dosyaları yükle',
      filters: [
        { name: 'Lua + JavaScript', extensions: ['lua', 'js'] },
        { name: 'Lua Scripts', extensions: ['lua'] },
        { name: 'NUI JavaScript', extensions: ['js'] },
      ],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return resolveDropPaths(result.filePaths)
  })

  ipcMain.handle('vault:select-lua-files', async () => {
    const win = BrowserWindow.getFocusedWindow() ?? mainWindow
    if (!win) return null

    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
      title: 'Lua Dosyaları Seç',
      buttonLabel: 'Dosyaları yükle',
      filters: [{ name: 'Lua Scripts', extensions: ['lua'] }],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return resolveDropPaths(result.filePaths)
  })

  ipcMain.handle(
    'vault:resolve-drop',
    (_e, paths: string[], options?: { folderOnly?: boolean }) => {
      return resolveDropPaths(paths, options)
    },
  )

  ipcMain.handle('vault:scan-import', async (_e, payload: ScanImportRequest): Promise<ScanResult> => {
    const normalized = path.normalize(payload.rootPath)

    if (payload.importMode === 'files' && payload.fileList?.length) {
      const files = payload.fileList.map((f) => path.normalize(f))
      log(`Importing ${files.length} dosya (Lua/JS).`)
      const { tree, luaPaths, jsPaths } = await buildTreeFromShieldFiles(normalized, files)
      const { analysis, classifications } = await scanWithAnalysis(
        normalized,
        luaPaths,
        jsPaths,
      )
      log(
        `Ready — ${luaPaths.length} Lua, ${jsPaths.length} JS. Output her dosyanın yanına yazılır.`,
      )
      return {
        rootPath: normalized,
        tree,
        luaFiles: luaPaths,
        jsFiles: jsPaths,
        importMode: 'files',
        analysis,
        classifications,
      }
    }

    try {
      const stat = await fs.stat(normalized)
      if (!stat.isDirectory()) {
        throw new Error('Seçilen yol bir klasör değil.')
      }
    } catch {
      throw new Error(`Klasör bulunamadı: ${normalized}`)
    }

    log(`Scanning folder: ${normalized}`)
    const luaFiles: string[] = []
    const jsFiles: string[] = []
    const tree = await buildTree(normalized, normalized, luaFiles, jsFiles)
    log(`Found ${luaFiles.length} Lua, ${jsFiles.length} JS (NUI).`)
    const { analysis, classifications } = await scanWithAnalysis(
      normalized,
      luaFiles,
      jsFiles,
    )
    return {
      rootPath: normalized,
      tree,
      luaFiles,
      jsFiles,
      importMode: 'folder',
      analysis,
      classifications,
    }
  })

  ipcMain.handle(
    'vault:obfuscate',
    async (_e, payload: ObfuscateRequest): Promise<ObfuscateResult> => {
      const { rootPath, selectedFiles, importMode, classifications } = payload
      const selectedSet = new Set(selectedFiles.map((f) => path.normalize(f)))
      const mode: ImportMode = importMode ?? 'folder'
      const classMap = new Map(
        (classifications ?? []).map((c) => [path.normalize(c.path), c]),
      )

      try {
        log('SaraShield engine engaged (Lua + NUI JS).')

        if (mode === 'files') {
          const total = selectedSet.size
          let index = 0
          for (const filePath of selectedSet) {
            index += 1
            const label = shieldLabel(filePath)
            log(`[${index}/${total}] Shielding [${label}] ${path.basename(filePath)}`)
          }

          const { outputPaths, failed, processed } = await writeFilesModeOutput(
            selectedSet,
            classMap,
          )
          for (const out of outputPaths) {
            log(`Output: ${out}`)
          }

          const msg =
            failed.length === 0
              ? `Tamam — ${processed} dosya shield edildi. Output dosyaların yanında.`
              : `${failed.length} hata, ${processed} dosya başarılı.`

          log(msg)
          return {
            success: failed.length === 0,
            outputPath:
              outputPaths[0] ??
              path.join(path.dirname([...selectedSet][0] ?? rootPath), 'Output'),
            processed,
            failed,
            message: msg,
          }
        }

        const outputPath = path.join(rootPath, 'Output')
        log(`Output directory: ${outputPath}`)

        await fs.rm(outputPath, { recursive: true, force: true })
        await fs.mkdir(outputPath, { recursive: true })

        const total = selectedSet.size
        let index = 0
        const failed: ObfuscateResult['failed'] = []
        let processed = 0

        for (const filePath of selectedSet) {
          index += 1
          const rel = path.relative(rootPath, filePath)
          log(
            `[${index}/${total}] Shielding [${shieldLabel(filePath)}] ${rel || path.basename(filePath)}`,
          )
        }

        log('Klasör kopyalanıyor → Output (shield + html/lua kopya)...')
        processed = await copyResourceTree(
          rootPath,
          outputPath,
          selectedSet,
          classMap,
          failed,
        )
        log(`Shield raporu: ${processed}/${total} dosya başarılı.`)

        const msg =
          failed.length === 0
            ? `Tamam — ${processed} dosya. Output: ${outputPath}`
            : `${failed.length} hata, ${processed} dosya başarılı.`

        log(msg)
        return { success: failed.length === 0, outputPath, processed, failed, message: msg }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        log(`FATAL: ${message}`)
        return {
          success: false,
          outputPath: path.join(rootPath, 'Output'),
          processed: 0,
          failed: [],
          message,
        }
      }
    },
  )

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
