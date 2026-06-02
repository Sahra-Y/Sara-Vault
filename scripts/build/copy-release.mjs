import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const outDir = path.join(root, 'build-output')
const destExe = path.join(root, 'Sara Vault.exe')

const portableCandidates = fs
  .readdirSync(outDir)
  .filter((f) => f.endsWith('.exe') && !f.includes('Setup') && !f.includes('uninstaller'))

if (portableCandidates.length === 0) {
  console.error('Portable exe bulunamadı. Önce: npm run dist')
  process.exit(1)
}

const portableSrc = path.join(outDir, portableCandidates[0])

function removeSafe(target) {
  try {
    if (!fs.existsSync(target)) return
    const stat = fs.statSync(target)
    if (stat.isDirectory()) {
      fs.rmSync(target, { recursive: true, force: true, maxRetries: 3 })
    } else {
      fs.unlinkSync(target)
    }
    console.log('Kaldırıldı →', path.basename(target))
  } catch {
    console.log('Atlandı (açık olabilir) →', path.basename(target))
  }
}

/** Eski kurulum / ara dosyalar */
for (const name of [
  'Sara Vault.new.exe',
  'Sara Vault.bat',
  'Sara Vault Kurulum.exe',
  'electron-log.txt',
  'debug.log',
]) {
  removeSafe(path.join(root, name))
}
removeSafe(path.join(root, 'Sara Vault App'))
removeSafe(path.join(root, 'dist-release'))
removeSafe(path.join(root, 'release'))

function installPortableExe() {
  if (fs.existsSync(destExe)) {
    try {
      fs.unlinkSync(destExe)
    } catch {
      const staging = path.join(root, 'Sara Vault.new.exe')
      removeSafe(staging)
      fs.copyFileSync(portableSrc, staging)
      try {
        fs.unlinkSync(destExe)
      } catch {
        /* ignore */
      }
      fs.renameSync(staging, destExe)
      removeSafe(path.join(root, 'Sara Vault.new.exe'))
      return
    }
  }

  fs.copyFileSync(portableSrc, destExe)
  removeSafe(path.join(root, 'Sara Vault.new.exe'))
}

try {
  installPortableExe()
} catch (err) {
  console.error('\nHATA: Sara Vault.exe yazılamadı.')
  console.error('Program açıksa kapat, sonra tekrar: npm run dist')
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
}

if (!fs.existsSync(destExe)) {
  console.error('Sara Vault.exe oluşturulamadı.')
  process.exit(1)
}

console.log('Hazır →', destExe)
console.log('Boyut:', (fs.statSync(destExe).size / 1024 / 1024).toFixed(1), 'MB')
console.log('\nÇift tıkla: Sara Vault.exe (tek dosya, güncelleme = üzerine yazılır).')
