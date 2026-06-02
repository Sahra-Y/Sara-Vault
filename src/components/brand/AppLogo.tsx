import logoUrl from '../../assets/logo.png'

export function AppLogo() {
  return (
    <div
      className="flex h-[52px] w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#080c14] p-1"
      style={{
        boxShadow:
          '0 0 0 1px rgba(34,211,238,0.35), 0 0 20px rgba(244,114,182,0.2), inset 0 0 12px rgba(34,211,238,0.06)',
      }}
      title="Sara Vault"
    >
      <img
        src={logoUrl}
        alt="Sara Vault"
        className="h-full w-full object-contain object-center"
        draggable={false}
      />
    </div>
  )
}
