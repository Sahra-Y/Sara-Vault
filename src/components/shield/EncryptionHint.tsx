export function EncryptionHint() {
  return (
    <p className="shrink-0 px-2 pb-1 text-center text-xs font-medium leading-relaxed text-slate-500">
      <span className="font-semibold text-fuchsia-300/80">Öneri:</span>{' '}
      <span className="text-slate-400">
        Tüm resource klasörü → SHIELD (Output’ta html+lua birlikte).
      </span>{' '}
      <span className="text-slate-500">
        Sadece client.lua değil — yoksa tasarım (NUI) yüklenmez.
      </span>
    </p>
  )
}
