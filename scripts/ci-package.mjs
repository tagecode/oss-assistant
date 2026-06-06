import { spawnSync } from 'node:child_process'

const platform = process.env.CI_PLATFORM
const arch = process.env.CI_ARCH

if (!platform || !arch) {
  console.error('CI_PLATFORM and CI_ARCH are required')
  process.exit(1)
}

/** @param {string} command @param {string[]} args @returns {void} */
function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

console.log(`Packaging oss-assistant for ${platform}/${arch}`)

run('pnpm', ['exec', 'electron-vite', 'build'])

const builderArgs = [
  'exec',
  'electron-builder',
  '--publish',
  'never',
  '-c.directories.output=release'
]

if (platform === 'mac') {
  builderArgs.push('--mac', arch === 'arm64' ? '--arm64' : '--x64')
} else if (platform === 'win') {
  builderArgs.push('--win', '--x64')
} else if (platform === 'linux') {
  builderArgs.push(
    '--linux',
    arch === 'arm64' ? '--arm64' : '--x64',
    '-c.linux.target=AppImage',
    '-c.linux.target=deb'
  )
} else {
  console.error(`Unsupported CI_PLATFORM: ${platform}`)
  process.exit(1)
}

run('pnpm', builderArgs)

console.log('Package complete')
