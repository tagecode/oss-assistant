#!/usr/bin/env bash
set -euo pipefail

# CI 与发版前使用的 Playwright E2E 入口。
#
# - Playwright 启动的是生产构建产物 out/main/index.js，所以必须先 pnpm build
#   （verify action 里排在前面），这里只做存在性检查，避免静默跑到旧产物上。
# - 无头 Linux runner 没有 DISPLAY，Electron 建窗口会失败，需要用 xvfb 包一层。
#   本地已有图形会话时（DISPLAY 已设置）直接跑，不套 xvfb。
# - E2E_MOCK_CLOUD=1 让 cloud-workflow / transfer-progress 走内存 Mock Provider，
#   无需真实云凭证；其余用例本来就不需要凭证。
# - E2E_PLAIN_TEXT_ENCRYPTION=1 让主进程用内存密钥代替系统 keyring。runner 上没有
#   keyring，safeStorage 不可用，保存账户会直接抛错、表单提交不了。仅测试进程受影响。

if [[ ! -f out/main/index.js ]]; then
  echo "out/main/index.js 不存在，请先执行 pnpm build" >&2
  exit 1
fi

export E2E_MOCK_CLOUD=1
export E2E_PLAIN_TEXT_ENCRYPTION=1

if [[ "$(uname -s)" == "Linux" && -z "${DISPLAY:-}" ]]; then
  exec xvfb-run --auto-servernum --server-args="-screen 0 1280x1024x24" \
    pnpm exec playwright test
fi

exec pnpm exec playwright test
