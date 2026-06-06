import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const buildDir = path.join(root, 'build')
const source = path.join(buildDir, 'icon.png')

if (!fs.existsSync(source)) {
  console.error('Missing build/icon.png (1024x1024 source image required)')
  process.exit(1)
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

console.log('Generating platform icons from build/icon.png ...')
run('npx', ['--yes', 'icon-gen', '-i', source, '-o', buildDir, '-r'])

const renamePairs = [
  ['app.ico', 'icon.ico'],
  ['app.icns', 'icon.icns']
]

for (const [from, to] of renamePairs) {
  const src = path.join(buildDir, from)
  const dest = path.join(buildDir, to)
  if (!fs.existsSync(src)) {
    console.error(`Expected generated file missing: ${from}`)
    process.exit(1)
  }
  fs.copyFileSync(src, dest)
  fs.unlinkSync(src)
}

fs.copyFileSync(source, path.join(root, 'resources', 'icon.png'))

const rendererPublic = path.join(root, 'src', 'renderer', 'public')
fs.mkdirSync(rendererPublic, { recursive: true })
const favicon32 = path.join(buildDir, 'favicon-32.png')
if (fs.existsSync(favicon32)) {
  fs.copyFileSync(favicon32, path.join(rendererPublic, 'icon.png'))
}

for (const name of fs.readdirSync(buildDir)) {
  if (name.startsWith('favicon')) {
    fs.unlinkSync(path.join(buildDir, name))
  }
}

console.log('Done:')
console.log('  build/icon.png              (Linux / electron-builder source, 1024×1024)')
console.log('  build/icon.ico              (Windows installer & executable)')
console.log('  build/icon.icns             (macOS DMG & app bundle)')
console.log('  resources/icon.png          (Linux window icon at runtime)')
console.log('  src/renderer/public/icon.png (renderer favicon)')
