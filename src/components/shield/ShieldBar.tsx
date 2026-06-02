import { motion } from 'framer-motion'

interface ShieldBarProps {
  running: boolean
  percent: number
  logs: string[]
  disabled: boolean
  onCrypt: () => void
}

export function ShieldBar({
  running,
  percent,
  logs,
  disabled,
  onCrypt,
}: ShieldBarProps) {
  return (
    <motion.footer
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel flex w-full shrink-0 flex-col gap-3 p-3 sm:p-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <motion.button
          type="button"
          disabled={disabled || running}
          onClick={onCrypt}
          whileHover={!disabled && !running ? { scale: 1.02 } : {}}
          whileTap={!disabled && !running ? { scale: 0.98 } : {}}
          className="font-display w-full shrink-0 overflow-hidden rounded-xl px-6 py-3 text-sm font-bold tracking-[0.2em] text-slate-950 uppercase disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:min-w-[180px] sm:px-8 sm:py-3.5 sm:text-base"
          style={{
            background: running
              ? 'linear-gradient(135deg, #fbbf24, #f59e0b)'
              : 'linear-gradient(135deg, #f472b6, #c026d3 45%, #22d3ee)',
            boxShadow: running
              ? '0 0 36px rgba(251, 191, 36, 0.5)'
              : '0 0 36px rgba(244, 114, 182, 0.4), 0 0 24px rgba(34, 211, 238, 0.35)',
          }}
        >
          {running ? 'SHIELDING…' : 'SHIELD'}
        </motion.button>

        <div className="min-w-0 w-full flex-1">
          <div className="label-caps mb-1.5 flex justify-between text-cyan-200/80">
            <span>İlerleme</span>
            <span className="font-mono-vault text-sm tracking-normal text-white">
              {Math.round(percent)}%
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-black/50 ring-1 ring-cyan-500/20">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 via-violet-400 to-cyan-400"
              initial={{ width: 0 }}
              animate={{ width: `${percent}%` }}
              transition={{ ease: 'easeOut' }}
            />
          </div>
        </div>
      </div>

      <div className="font-mono-vault min-h-[72px] max-h-[28vh] overflow-y-auto rounded-xl border border-emerald-500/20 bg-black/60 p-3 text-[11px] leading-relaxed font-medium text-emerald-300 sm:max-h-32 sm:text-[12px]">
        {logs.length === 0 ? (
          <span className="text-slate-500">SaraShield terminal hazır…</span>
        ) : (
          logs.map((line, i) => (
            <div key={`${i}-${line.slice(0, 24)}`} className="break-words">
              {line}
            </div>
          ))
        )}
      </div>
    </motion.footer>
  )
}
