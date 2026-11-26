#!/usr/bin/env bash
set -euo pipefail

# CI 与发版前使用的 Playwright E2E 入口。
#
# - Playwright 启动的是生产构建产物 out/main/index.js，所以必须先 pnpm build
#   （verify action 里排在前面），这里只做存在性检查，避免静默跑到旧产物上。
# - 无头 Linux runner 没有 DISPLAY，Electron 建窗口会失败，需要用 xvfb 包一层。
#   本地已有图形会话时（DISPLAY 已设置）直接跑，不套 xvfb。
# - Xvfb 没有窗口管理器，脚本会在其中启动 openbox；否则 maximize/minimize
#   不会改变窗口状态，自绘标题栏用例会失败。
# - E2E_MOCK_CLOUD=1 让 cloud-workflow / transfer-progress / multipart-transfer /
#   account-management / credential-storage 使用内存 Mock Provider，无需真实云凭证。
# - runner 上没有系统 keyring，safeStorage 不可用。credential-storage 用例会真实
#   打开设置页开启内存密钥；其余用例由 launch.ts 把
#   allowInsecureCredentialStorage 预置进 userData，走的也是同一条代码路径。

if [[ ! -f out/main/index.js ]]; then
  echo "out/main/index.js 不存在，请先执行 pnpm build" >&2
  exit 1
fi

export E2E_MOCK_CLOUD=1

if [[ "$(uname -s)" == "Linux" && -z "${DISPLAY:-}" ]]; then
  # Xvfb 只提供显示服务器，不提供窗口管理器；没有 WM 时 Electron 的
  # maximize/minimize 不会真正改变窗口状态，自绘标题栏用例会失败。
  # 用 openbox 提供 EWMH 窗口状态管理，再等它注册到 root window。
  exec xvfb-run --auto-servernum --server-args="-screen 0 1280x1024x24" \
    bash -c '
      openbox --sm-disable >/tmp/openbox.log 2>&1 &
      if command -v xprop >/dev/null 2>&1; then
        for _ in $(seq 1 25); do
          xprop -root _NET_SUPPORTING_WM_CHECK >/dev/null 2>&1 && break
          sleep 0.2
        done
      else
        sleep 1
      fi
      exec pnpm exec playwright test
    '
fi

exec pnpm exec playwright test
