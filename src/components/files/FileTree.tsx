import { useCallback, useState } from 'react'
import type { FileTreeNode } from '../../shared/types'
import { countShieldSelection } from '../../shared/types'

interface FileTreeProps {
  tree: FileTreeNode | null
  selected: Set<string>
  onToggle: (path: string, checked: boolean) => void
  onSelectAll: (paths: string[]) => void
}

function ShieldCheckbox({
  path,
  checked,
  onToggle,
}: {
  path: string
  checked: boolean
  onToggle: (path: string, checked: boolean) => void
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onToggle(path, e.target.checked)}
      className="h-4 w-4 rounded border-2 border-cyan-400/60 bg-black/50 accent-cyan-400"
      onClick={(e) => e.stopPropagation()}
    />
  )
}

function TreeNode({
  node,
  depth,
  selected,
  onToggle,
}: {
  node: FileTreeNode
  depth: number
  selected: Set<string>
  onToggle: (path: string, checked: boolean) => void
}) {
  const [open, setOpen] = useState(depth < 2)
  const ext = node.extension
  const isShieldable = node.type === 'file' && (ext === 'lua' || ext === 'js')
  const isJs = ext === 'js'
  const padding = 12 + depth * 14

  if (node.type === 'folder') {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-2 py-1.5 text-left text-sm font-semibold text-slate-200 hover:text-cyan-100"
          style={{ paddingLeft: padding }}
        >
          <span className="w-4 font-mono-vault text-xs font-bold text-cyan-400">
            {open ? '▼' : '▶'}
          </span>
          <span className="text-amber-300">📁</span>
          <span>{node.name}</span>
        </button>
        {open &&
          node.children?.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selected={selected}
              onToggle={onToggle}
            />
          ))}
      </div>
    )
  }

  return (
    <div
      className={`flex items-center gap-2 py-1.5 text-sm font-medium ${isShieldable ? 'text-slate-100' : 'text-slate-500'}`}
      style={{ paddingLeft: padding + 18 }}
    >
      {isShieldable ? (
        <ShieldCheckbox path={node.path} checked={selected.has(node.path)} onToggle={onToggle} />
      ) : (
        <span className="w-4" />
      )}
      <span>{isJs ? '⚡' : isShieldable ? '📜' : '📄'}</span>
      <span
        className={
          isJs ? 'text-amber-100' : isShieldable ? 'text-cyan-50' : 'opacity-55'
        }
      >
        {node.name}
      </span>
      {isJs && (
        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-200">
          NUI
        </span>
      )}
    </div>
  )
}

export function FileTree({ tree, selected, onToggle, onSelectAll }: FileTreeProps) {
  const collectShieldable = useCallback((node: FileTreeNode | null): string[] => {
    if (!node) return []
    if (node.type === 'file' && (node.extension === 'lua' || node.extension === 'js')) {
      return [node.path]
    }
    return (node.children ?? []).flatMap(collectShieldable)
  }, [])

  const shieldPaths = collectShieldable(tree)
  const selectedCounts = countShieldSelection([...selected])

  return (
    <section className="glass-panel flex min-w-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-2 border-b border-cyan-500/15 px-4 py-3 sm:px-5 sm:py-4">
        <div className="min-w-0 flex-1">
          <p className="label-caps">Dosyalar</p>
          <h2 className="font-display mt-1 text-lg font-bold tracking-wide text-white sm:text-xl">
            File Tree
          </h2>
          <p className="mt-0.5 text-xs font-medium text-cyan-200/75 sm:text-sm">
            .lua ve NUI .js dosyalarını seç
          </p>
        </div>
        {shieldPaths.length > 0 && (
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onSelectAll(shieldPaths)}
              className="btn-ghost rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-3 py-1.5 text-cyan-100 hover:bg-cyan-500/25"
            >
              Tümünü seç
            </button>
            <button
              type="button"
              onClick={() => onSelectAll([])}
              className="btn-ghost rounded-lg border border-slate-500/40 px-3 py-1.5 text-slate-300 hover:bg-white/5"
            >
              Temizle
            </button>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-2">
        {!tree ? (
          <p className="p-8 text-center text-base font-medium text-slate-400">
            Üstten resource klasörü veya alttan .lua / .js dosyası yükle.
          </p>
        ) : (
          <TreeNode node={tree} depth={0} selected={selected} onToggle={onToggle} />
        )}
      </div>

      <footer className="border-t border-cyan-500/15 px-5 py-2.5 text-sm font-semibold text-fuchsia-200/90">
        {selected.size} / {shieldPaths.length} seçili
        {selected.size > 0 && (
          <span className="ml-2 text-xs font-medium text-slate-400">
            (Lua {selectedCounts.lua}, JS {selectedCounts.js})
          </span>
        )}
      </footer>
    </section>
  )
}
