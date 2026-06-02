# Sara Vault (SaraShield)

FiveM **Lua** ve **NUI JavaScript** dosyalarını yerelde şifreleyen masaüstü araç.

## Proje yapısı

```
Sara Vault/
├── electron/                 # Masaüstü arka plan (Electron main)
│   ├── main.ts               # Pencere + IPC
│   ├── preload.ts            # Renderer köprüsü
│   ├── import/               # Klasör / dosya yükleme
│   │   ├── drop-utils.ts
│   │   └── paths.ts
│   └── shield/               # Şifreleme motoru
│       ├── dispatch.ts       # Lua + JS yönlendirme
│       ├── lua/              # SaraShield (luaparse)
│       └── js/               # NUI (javascript-obfuscator)
├── src/                      # Arayüz (React)
│   ├── components/
│   │   ├── brand/            # Logo
│   │   ├── import/           # Sol panel
│   │   ├── files/            # Dosya ağacı
│   │   └── shield/           # SHIELD bar + ipuçları
│   ├── shared/types.ts       # Paylaşılan tipler
│   └── App.tsx
├── scripts/
│   ├── build/                # dist, icon, exe kopya
│   ├── verify/               # Motor testleri
│   └── test/                 # Geliştirici testleri
├── public/                   # Statik dosyalar
└── Sara Vault.exe            # Portable çıktı (dist sonrası)
```

## Özellikler

- Resource klasörü veya tek/çoklu `.lua` / `.js` import
- Lua: rename (opsiyonel), string şifreleme, NUI/export koruması
- NUI JS: FiveM CEF uyumlu obfuscation
- Klasör modu → `Output/` (html + lua birlikte)

## Kullanım

1. **Sara Vault.exe** — çift tık
2. Üst kutu: **resource klasörü** sürükle veya tıkla
3. Alt buton: sadece **.lua / .js** (tek / çoklu)
4. **SHIELD** → `Output` klasörünü sunucuda kullan

## Geliştirici

```bash
npm install
npm run dev
npm run verify
npm run dist
```

## Not

Obfuscate sonrası dev FXServer’da test et. `config.lua`, `fxmanifest.lua` genelde shield etme.
