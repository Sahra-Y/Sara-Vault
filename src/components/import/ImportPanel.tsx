import { motion } from 'framer-motion'
import { useState, type DragEvent } from 'react'
import type { DropResolveResult } from '../../shared/types'

interface ImportPanelProps {
  rootPath: string | null
  onBrowseFolder: () => void
  onBrowseShieldFiles: () => void
  onDropResolved: (resolved: DropResolveResult) => void
  onError: (message: string) => void
  bridgeReady: boolean
}

function filesFromTransfer(dt: DataTransfer): File[] {
  const list: File[] = []
  if (dt.files?.length) {
    for (let i = 0; i < dt.files.length; i++) {
      const f = dt.files.item(i)
      if (f) list.push(f)
    }
  }
  if (list.length === 0 && dt.items?.length) {
    for (let i = 0; i < dt.items.length; i++) {
      const item = dt.items[i]
      if (item.kind === 'file') {
        const f = item.getAsFile()
        if (f) list.push(f)
      }
    }
  }
  return list
}

export function ImportPanel({
  rootPath,
  onBrowseFolder,
  onBrowseShieldFiles,
  onDropResolved,
  onError,
  bridgeReady,
}: ImportPanelProps) {
  const [dragOver, setDragOver] = useState(false)

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)

    if (!bridgeReady || !window.saravault) {
      onError('Sistem hazır değil — Sara Vault.exe ile aç.')
      return
    }

    const files = filesFromTransfer(e.dataTransfer)
    if (!files.length) {
      onError('Klasör algılanamadı — resource klasörünü kutuya bırak.')
      return
    }

    try {
      const resolved = await window.saravault.resolveDropFiles(files, {
        folderOnly: true,
      })
      if (!resolved?.rootPath) {
        onError(
          'Resource klasörü gerekli (fxmanifest.lua olan klasör). Tek .lua için alttaki butonu kullan.',
        )
        return
      }
      onDropResolved(resolved)
    } catch {
      onError('Sürükle-bırak başarısız — Klasör seç ile dene.')
    }
  }

  return (
    <motion.aside
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      className="glass-panel flex h-full min-h-[220px] w-full shrink-0 flex-col gap-3 overflow-hidden p-4 lg:max-w-[300px] lg:min-w-[260px]"
    >
      <div className="shrink-0">
        <p className="label-caps">Import</p>
        <h2 className="font-display mt-1.5 text-lg font-bold tracking-wide text-white lg:text-xl">
          Script Yükle
        </h2>
        <p className="mt-1.5 text-xs font-medium leading-relaxed text-slate-300 lg:text-sm">
          FiveM resource klasörünü sürükle veya tıkla (html + lua birlikte).
        </p>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => (bridgeReady ? onBrowseFolder() : onError('Sistem hazır değil.'))}
        onKeyDown={(e) => e.key === 'Enter' && bridgeReady && onBrowseFolder()}
        onDragEnter={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragOver(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragOver(false)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
          e.dataTransfer.dropEffect = 'copy'
          setDragOver(true)
        }}
        onDrop={handleDrop}
        className={`flex min-h-[120px] flex-1 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition ${
          dragOver
            ? 'border-fuchsia-400 bg-fuchsia-500/15 shadow-[0_0_24px_rgba(244,114,182,0.25)]'
            : 'border-cyan-400/45 bg-cyan-500/8 hover:border-fuchsia-400/50 hover:bg-fuchsia-500/8'
        } ${!bridgeReady ? 'opacity-60' : ''}`}
      >
        <span className="font-display text-2xl font-bold text-cyan-300 lg:text-3xl">📁</span>
        <p className="mt-2 text-sm font-semibold text-white lg:text-base">Sürükle &amp; bırak</p>
        <p className="mt-0.5 text-xs font-medium text-cyan-200/80 lg:text-sm">
          Resource klasörü
        </p>
      </div>

      <button
        type="button"
        disabled={!bridgeReady}
        onClick={onBrowseShieldFiles}
        className="btn-ghost w-full shrink-0 rounded-lg border border-fuchsia-400/35 bg-fuchsia-500/10 py-2.5 text-sm text-fuchsia-100 hover:bg-fuchsia-500/20 disabled:opacity-40"
      >
        .lua / .js seç (tek / çoklu)
      </button>

      {rootPath && (
        <div className="max-h-24 shrink-0 overflow-y-auto rounded-xl border border-cyan-500/20 bg-black/40 p-2.5">
          <p className="label-caps text-fuchsia-300/90">Kök klasör</p>
          <p className="mt-1 break-all text-xs font-medium text-slate-200">{rootPath}</p>
        </div>
      )}

      <p className="shrink-0 text-xs font-medium leading-relaxed text-slate-500">
        Klasör modu: Output resource içinde. Tek dosya: Output dosyanın yanında.
      </p>
    </motion.aside>
  )
}
