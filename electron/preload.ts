import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  DropResolveResult,
  FileTreeNode,
  ObfuscateRequest,
  ObfuscateResult,
  ScanImportRequest,
  ScanResult,
} from '../src/shared/types'

function collectPathsFromDrop(files: File[]): string[] {
  const paths: string[] = []

  for (const file of files) {
    try {
      const p = webUtils.getPathForFile(file)
      if (p) paths.push(p)
      continue
    } catch {
      /* fallback */
    }
    const legacy = file as File & { path?: string }
    if (legacy.path) paths.push(legacy.path)
  }

  return paths
}

const api = {
  selectFolder: (): Promise<string | null> =>
    ipcRenderer.invoke('vault:select-folder'),

  selectShieldFiles: (): Promise<DropResolveResult | null> =>
    ipcRenderer.invoke('vault:select-shield-files'),

  selectLuaFiles: (): Promise<DropResolveResult | null> =>
    ipcRenderer.invoke('vault:select-lua-files'),

  resolveDropFiles: (
    files: File[],
    options?: { folderOnly?: boolean },
  ): Promise<DropResolveResult | null> => {
    const paths = collectPathsFromDrop(files)
    if (!paths.length) return Promise.resolve(null)
    return ipcRenderer.invoke('vault:resolve-drop', paths, options)
  },

  scanImport: (payload: ScanImportRequest): Promise<ScanResult> =>
    ipcRenderer.invoke('vault:scan-import', payload),

  obfuscate: (payload: ObfuscateRequest): Promise<ObfuscateResult> =>
    ipcRenderer.invoke('vault:obfuscate', payload),

  onLog: (callback: (line: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, line: string) =>
      callback(line)
    ipcRenderer.on('vault:log', handler)
    return () => ipcRenderer.removeListener('vault:log', handler)
  },

  ping: (): Promise<boolean> => ipcRenderer.invoke('vault:ping'),
}

contextBridge.exposeInMainWorld('saravault', api)

export type SaraVaultAPI = typeof api
export type {
  FileTreeNode,
  ObfuscateRequest,
  ObfuscateResult,
  ScanResult,
  DropResolveResult,
  ScanImportRequest,
}
