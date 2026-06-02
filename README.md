# Sara Vault (SaraShield)

A desktop tool that locally encrypts and obfuscates FiveM **Lua** and **NUI JavaScript** files.

## Project Structure

```text
Sara Vault/
├── electron/                 # Desktop backend (Electron main)
│   ├── main.ts               # Window + IPC
│   ├── preload.ts            # Renderer bridge
│   ├── import/               # Folder / file import handling
│   │   ├── drop-utils.ts
│   │   └── paths.ts
│   └── shield/               # Encryption engine
│       ├── dispatch.ts       # Lua + JS dispatch routing
│       ├── lua/              # SaraShield (luaparse)
│       └── js/               # NUI (javascript-obfuscator)
├── src/                      # Frontend (React)
│   ├── components/
│   │   ├── brand/            # Logo
│   │   ├── import/           # Left panel
│   │   ├── files/            # File tree
│   │   └── shield/           # SHIELD bar + tooltips
│   ├── shared/types.ts       # Shared types
│   └── App.tsx
├── scripts/
│   ├── build/                # dist, icon, exe copy workflows
│   ├── verify/               # Engine tests
│   └── test/                 # Developer tests
├── public/                   # Static files
└── Sara Vault.exe            # Portable output (post-dist)
```

## Features

*   **Import Methods:** Support for importing full resource folders or single/multiple `.lua` and `.js` files.
*   **Lua Shielding:** Variable renaming (optional), string encryption, and NUI/export protection.
*   **NUI JS Obfuscation:** Fully compatible with FiveM's CEF (Chromium Embedded Framework).
*   **Folder Mode:** Outputs an organized `Output/` directory keeping `.html` and protected `.lua`/`.js` files structurally intact.

## Usage

1. Double-click to run **`Sara Vault.exe`**.
2. Drag and drop a **script resource folder** into the app, or click to browse.
3. *Alternatively*, select only specific **`.lua` / `.js`** files (single or multiple).
4. Click the **SHIELD** button.
5. Upload and use the generated **`Output`** folder on your live/dev server.

## Developer

```bash
npm install
npm run dev
npm run verify
npm run dist
```

## Important Note

Always test the obfuscated scripts on a development FXServer before pushing them to live. **Do not** shield `config.lua` or `fxmanifest.lua` files.
