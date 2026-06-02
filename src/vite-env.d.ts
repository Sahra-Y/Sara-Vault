/// <reference types="vite/client" />

import type {
  DropResolveResult,
  ImportMode,
  ObfuscateRequest,
  ObfuscateResult,
  ScanImportRequest,
  ScanResult,
} from './shared/types'

interface SaraVaultAPI {
  ping: () => Promise<boolean>
  selectFolder: () => Promise<string | null>
  selectShieldFiles: () => Promise<DropResolveResult | null>
  selectLuaFiles: () => Promise<DropResolveResult | null>
  resolveDropFiles: (
    files: File[],
    options?: { folderOnly?: boolean },
  ) => Promise<DropResolveResult | null>
  scanImport: (payload: ScanImportRequest) => Promise<ScanResult>
  obfuscate: (payload: ObfuscateRequest) => Promise<ObfuscateResult>
  onLog: (callback: (line: string) => void) => () => void
}

declare global {
  interface Window {
    saravault: SaraVaultAPI
  }
}

export type { ImportMode }
