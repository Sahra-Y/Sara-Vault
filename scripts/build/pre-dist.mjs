import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const buildOut = path.join(root, 'build-output')

console.log('Sara Vault kapatılıyor (açıksa)...')
for (let attempt = 0; attempt < 3; attempt++) {
  try {
    execSync(
      'taskkill /F /IM "Sara Vault.exe" /T 2>nul & taskkill /F /IM "SaraVault-Portable.exe" /T 2>nul & taskkill /F /IM electron.exe /FI "WINDOWTITLE eq Sara Vault*" /T 2>nul',
      { stdio: 'ignore', shell: 'cmd.exe' },
    )
  } catch {
    /* zaten kapalı */
  }
  await new Promise((r) => setTimeout(r, 1200))
}

for (const name of [
  'Sara Vault.new.exe',
  'electron-log.txt',
  'debug.log',
  'dist-release',
  'release',
]) {
  const target = path.join(root, name)
  if (!fs.existsSync(target)) continue
  try {
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 3 })
    console.log('Temizlendi →', name)
  } catch {
    console.log('Atlandı →', name)
  }
}

if (fs.existsSync(buildOut)) {
  try {
    fs.rmSync(buildOut, { recursive: true, force: true, maxRetries: 8 })
    console.log('Eski build-output silindi.')
  } catch {
    const stale = path.join(root, `build-output-old-${Date.now()}`)
    try {
      fs.renameSync(buildOut, stale)
      fs.rmSync(stale, { recursive: true, force: true, maxRetries: 3 })
      console.log('build-output yeniden adlandırılıp silindi.')
    } catch {
      console.warn('\nUYARI: build-output kilitli — derleme yine deneniyor.')
      console.warn('Hata alırsan Görev Yöneticisi → tüm Sara Vault.exe kapat.\n')
    }
  }
}

console.log('Derlemeye hazır.\n')
