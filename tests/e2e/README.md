# E2E 测试说明

**CI 会运行 E2E。** GitHub Actions 的 `Verify` 阶段依次执行 lint → typecheck → 单元/组件测试 → 生产构建 → E2E（见 `.github/actions/verify/action.yml`）。CI 与 `Build & Release` 共用同一个 composite action，所以 E2E 失败会同时挡住日常 CI 和发版。

## 前置条件

1. 先执行生产构建：`pnpm build`（Playwright 启动的是 `out/main/index.js`）
2. 安装 Playwright 系统依赖：`pnpm exec playwright install-deps chromium`

   无需下载浏览器：Electron 用例用的是 `node_modules` 里的 Electron 二进制。无头 Linux 环境还需要 `xvfb`。

## 运行

```bash
pnpm test:e2e
```

带 Mock 云凭证跑完整流程（CI 用这个模式）：

```bash
E2E_MOCK_CLOUD=1 pnpm test:e2e
```

无头 Linux 下用统一入口，脚本会自动套 `xvfb` 并设置 `E2E_MOCK_CLOUD=1`：

```bash
bash scripts/ci-run-e2e.sh
```

## 测试范围

| 文件                               | 说明                                       |
| ---------------------------------- | ------------------------------------------ |
| `app-launch.spec.ts`               | 应用启动冒烟（无需云凭证）                 |
| `ui-navigation.spec.ts`            | 空状态、设置、帮助对话框导航（无需云凭证） |
| `settings-and-diagnostics.spec.ts` | 设置保存、诊断导出脱敏（无需云凭证）       |
| `cloud-workflow.spec.ts`           | 云存储完整流程（Mock 或七牛凭证）          |
| `transfer-progress.spec.ts`        | 上传/下载进度与速度展示（Mock 或七牛凭证） |

E2E 断言使用 `data-testid` 与稳定表单 `id`（如 `#name`），不依赖界面语言。
公共选择器见 `tests/e2e/helpers/locators.ts`。

## 云存储 E2E

### Mock 模式（推荐本地 / CI）

无需真实云凭证，使用内存 Mock Provider：

```bash
E2E_MOCK_CLOUD=1 pnpm test:e2e
```

### 真实七牛云

配置以下环境变量后运行完整上传/下载/删除流程：

- `E2E_QINIU_ACCESS_KEY`
- `E2E_QINIU_SECRET_KEY`
- `E2E_QINIU_BUCKET`
- `E2E_QINIU_REGION`（可选，如 `z0`）

未配置 Mock 且无凭证时 `cloud-workflow.spec.ts` 与 `transfer-progress.spec.ts` 自动跳过。

## 失败排查

CI 上失败会重试一次（`retries: 1`），trace 由 `trace: 'on-first-retry'` 录制。失败时 `test-results/` 与 `playwright-report/` 会作为 `e2e-report` artifact 上传，保留 7 天。
