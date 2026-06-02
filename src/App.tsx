import { useCallback, useEffect, useState } from 'react'
import { AppLogo } from './components/brand/AppLogo'
import { FileTree } from './components/files/FileTree'
import { ImportPanel } from './components/import/ImportPanel'
import { EncryptionHint } from './components/shield/EncryptionHint'
import { ShieldBar } from './components/shield/ShieldBar'
import type { FileClassification, FileTreeNode, ImportMode } from './shared/types'
import { defaultShieldSelection } from './shared/types'

function App() {
  const [bridgeReady, setBridgeReady] = useState(false)
  const [importMode, setImportMode] = useState<ImportMode>('folder')
  const [rootPath, setRootPath] = useState<string | null>(null)
  const [tree, setTree] = useState<FileTreeNode | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [classifications, setClassifications] = useState<FileClassification[]>([])
  const [logs, setLogs] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const [percent, setPercent] = useState(0)

  const appendLog = useCallback((line: string) => {
    setLogs((prev) => [...prev.slice(-200), line])
  }, [])

  useEffect(() => {
    const blockWindowDrop = (e: DragEvent) => {
      e.preventDefault()
    }
    window.addEventListener('dragover', blockWindowDrop)

    let unsubLog: (() => void) | undefined

    const connect = async () => {
      for (let i = 0; i < 30; i++) {
        if (window.saravault) {
          try {
            const ok = await window.saravault.ping()
            if (ok) {
              setBridgeReady(true)
              unsubLog = window.saravault.onLog(appendLog)
              appendLog('Sara Vault hazır.')
              return
            }
          } catch {
            /* retry */
          }
        }
        await new Promise((r) => setTimeout(r, 100))
      }
      appendLog('HATA: Sistem köprüsü yüklenemedi — Sara Vault.exe ile aç.')
    }

    void connect()

    return () => {
      window.removeEventListener('dragover', blockWindowDrop)
      unsubLog?.()
    }
  }, [appendLog])

  const loadImport = useCallback(
    async (
      folderPath: string,
      mode: ImportMode,
      preselectedFiles: string[] = [],
    ) => {
      if (!window.saravault) {
        appendLog('HATA: Sistem köprüsü yok.')
        return
      }
      try {
        appendLog(`Yükleniyor: ${folderPath}`)
        const result = await window.saravault.scanImport({
          rootPath: folderPath,
          importMode: mode,
          fileList: mode === 'files' ? preselectedFiles : undefined,
        })
        setImportMode(result.importMode)
        setRootPath(result.rootPath)
        setTree(result.tree)
        setClassifications(result.classifications ?? [])

        const allShield = [...result.luaFiles, ...result.jsFiles]
        if (preselectedFiles.length > 0) {
          const valid = preselectedFiles.filter((p) => allShield.includes(p))
          setSelected(new Set(valid.length > 0 ? valid : defaultShieldSelection(result)))
        } else {
          setSelected(new Set(defaultShieldSelection(result)))
        }

      } catch (err) {
        appendLog(`HATA: ${err instanceof Error ? err.message : String(err)}`)
      }
    },
    [appendLog],
  )

  const browseFolder = useCallback(async () => {
    if (!window.saravault) return
    try {
      const folder = await window.saravault.selectFolder()
      if (folder) {
        await loadImport(folder, 'folder', [])
      }
    } catch (err) {
      appendLog(`HATA: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [loadImport, appendLog])

  const browseShieldFiles = useCallback(async () => {
    if (!window.saravault) return
    try {
      const resolved = await window.saravault.selectShieldFiles()
      if (resolved?.rootPath) {
        await loadImport(resolved.rootPath, resolved.importMode, resolved.preselectedFiles)
      }
    } catch (err) {
      appendLog(`HATA: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [loadImport, appendLog])

  const handleDropResolved = useCallback(
    (resolved: { rootPath: string; preselectedFiles: string[]; importMode: ImportMode }) => {
      void loadImport(resolved.rootPath, resolved.importMode, resolved.preselectedFiles)
    },
    [loadImport],
  )

  const reportError = useCallback(
    (message: string) => {
      appendLog(`UYARI: ${message}`)
    },
    [appendLog],
  )

  const toggleFile = useCallback((path: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(path)
      else next.delete(path)
      return next
    })
  }, [])

  const selectAll = useCallback((paths: string[]) => {
    setSelected(new Set(paths))
  }, [])

  const crypt = useCallback(async () => {
    if (!window.saravault || !rootPath || selected.size === 0) return
    setRunning(true)
    setPercent(8)
    try {
      const result = await window.saravault.obfuscate({
        rootPath,
        selectedFiles: [...selected],
        importMode,
        classifications,
      })
      setPercent(100)
      appendLog(result.message)
      if (result.outputPath) {
        appendLog(`Output: ${result.outputPath}`)
      }
    } catch (err) {
      appendLog(`HATA: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setRunning(false)
      setTimeout(() => setPercent(0), 1500)
    }
  }, [rootPath, selected, importMode, classifications, appendLog])

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden p-3 sm:gap-4 sm:p-4">
      <header className="flex shrink-0 items-center gap-3 border-b border-cyan-500/10 pb-2 sm:gap-4 sm:pb-3">
        <AppLogo />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl font-bold tracking-wide text-gradient-brand sm:text-2xl">
            Sara Vault
          </h1>
          <p className="mt-0.5 text-xs font-semibold tracking-wide text-cyan-200/90 sm:text-sm">
            SaraShield · FiveM Lua & NUI JS Protection
          </p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden lg:flex-row lg:gap-4">
        <ImportPanel
          rootPath={rootPath}
          bridgeReady={bridgeReady}
          onBrowseFolder={browseFolder}
          onBrowseShieldFiles={browseShieldFiles}
          onDropResolved={handleDropResolved}
          onError={reportError}
        />
        <FileTree
          tree={tree}
          selected={selected}
          onToggle={toggleFile}
          onSelectAll={selectAll}
        />
      </div>

      <div className="flex shrink-0 flex-col gap-2">
        <ShieldBar
          running={running}
          percent={percent}
          logs={logs}
          disabled={!rootPath || selected.size === 0}
          onCrypt={crypt}
        />
        <EncryptionHint />
      </div>
    </div>
  )
}

export default App
