#!/usr/bin/env node
/**
 * Dev/preview launcher with a Windows sandbox fallback.
 *
 * Some Windows hosts cannot initialise Chromium's OS sandbox (antivirus HIPS,
 * restricted tokens, broken AppContainer ACLs, ...). Electron then aborts with
 * STATUS_BREAKPOINT (0x80000003) before any application code runs, and
 * `electron-vite dev` exits with that code. A native `electron` app reproduces
 * the same crash, so it is an environment problem rather than an app bug.
 *
 * This launcher runs `electron-vite` normally first. Only when it exits with the
 * sandbox crash code does it retry once with `--noSandbox`, printing an explicit
 * warning. Sandboxed development stays the default: `pnpm dev:strict`.
 *
 * It also drops ELECTRON_RUN_AS_NODE, which some shells/terminal wrappers preset;
 * that variable makes Electron run as plain Node instead of launching the app.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SANDBOX_CRASH_CODES = new Set([0x80000003, 2147483651, -2147483645])
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const bin = join(root, 'node_modules', 'electron-vite', 'bin', 'electron-vite.js')

if (!existsSync(bin)) {
  console.error('[dev] 找不到 electron-vite，请先执行 pnpm install。')
  process.exit(1)
}

const invokedCommand = process.argv[2]
const command = invokedCommand === 'preview' ? 'preview' : 'dev'
const passthrough = process.argv.slice(
  invokedCommand === 'dev' || invokedCommand === 'preview' ? 3 : 2
)
const hasNoSandbox = process.argv.includes('--noSandbox')

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

function run(commandArgs) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [bin, ...commandArgs], {
      cwd: root,
      stdio: 'inherit',
      env
    })
    child.on('error', (error) => {
      console.error(`[dev] 启动 electron-vite 失败：${error.message}`)
      resolve({ code: 1, signal: null })
    })
    child.on('exit', (code, signal) => resolve({ code, signal }))
  })
}

const first = await run([command, ...passthrough])

if (first.signal) {
  process.exit(0)
}
if (first.code === 0 || hasNoSandbox || !SANDBOX_CRASH_CODES.has(first.code)) {
  process.exit(first.code ?? 1)
}

console.warn('')
console.warn('[dev] Electron 启动时触发 STATUS_BREAKPOINT (0x80000003)。')
console.warn(
  '[dev] 当前环境无法初始化 Chromium 沙箱：原生 Electron 应用同样崩溃，与本项目代码无关。'
)
console.warn('[dev] 即将以 --noSandbox 重新启动，仅用于本地开发/调试：')
console.warn(
  '[dev]   - 如需保留完整沙箱，请把本项目与 electron.exe 加入安全软件（如火绒 HIPS）白名单，'
)
console.warn('[dev]     然后在普通终端运行 `pnpm dev:strict`。')
console.warn('')

const retried = await run([command, ...passthrough, '--noSandbox'])
process.exit(retried.signal ? 0 : (retried.code ?? 1))
