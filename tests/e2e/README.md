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

> **关于凭证加密**：CI runner 没有系统 keyring，`safeStorage` 不可用，保存账户时
> 凭证加密会直接抛错、账户表单永远提交不了。`launchApp` 会把
> `allowInsecureCredentialStorage` 预置进新建的 userData 目录，主进程启动时读到它
> 就降级为内存密钥。这与用户在设置页勾选「改用内存密钥保存」走的是同一条代码路径，
> 主进程里没有测试专用分支；有 keyring 的环境下该开关是空操作。
>
> 复用同一 `userDataDir` 重启的用例不预置，以免覆盖上一次运行持久化的设置。

## 测试范围

| 文件                               | 说明                                                   |
| ---------------------------------- | ------------------------------------------------------ |
| `app-launch.spec.ts`               | 应用启动冒烟（无需云凭证）                             |
| `window-chrome.spec.ts`            | 自绘标题栏、无边框窗口与最小化/最大化/还原（无需凭证） |
| `ui-navigation.spec.ts`            | 空状态、设置、帮助对话框导航（无需云凭证）             |
| `settings-and-diagnostics.spec.ts` | 设置保存、诊断导出脱敏（无需云凭证）                   |
| `credential-storage.spec.ts`       | 无 keyring 时设置页启用内存密钥、重启后仍可解密        |
| `cloud-workflow.spec.ts`           | 云存储完整流程（Mock 或七牛凭证）                      |
| `transfer-progress.spec.ts`        | 上传/下载进度与速度展示（Mock 或七牛凭证）             |
| `multipart-transfer.spec.ts`       | 分片上传、自动/手动断点续传、取消与状态筛选（仅 Mock） |

E2E 断言使用 `data-testid` 与稳定表单 `id`（如 `#name`），不依赖界面语言。
公共选择器见 `tests/e2e/helpers/locators.ts`。

## 云存储 E2E

### Mock 模式（推荐本地 / CI）

无需真实云凭证，使用内存 Mock Provider：

```bash
E2E_MOCK_CLOUD=1 pnpm test:e2e
```

Mock Provider 还支持几个仅测试用的开关：

- `E2E_MOCK_STEP_DELAY_MS`：小文件 5 段进度的每段间隔，默认 `50`。
- `E2E_MOCK_PART_DELAY_MS`：大文件每个分片的间隔，默认 `120`；取消用例把它调大，
  保证点击取消时上传仍在进行。
- 文件名包含 `e2e-retryable` 时，Mock 会在第 1 个分片后抛一次可重试错误；并且
  第二次尝试必须收到带分片的 checkpoint，否则直接失败，用来验证断点真的被复用。
- 文件名包含 `e2e-manual-retry` 时，Mock 会在第 1 个分片后抛不可重试错误：任务停在
  `failed` 但保留 checkpoint；用户点「重试」后同样必须带着 checkpoint 才能成功。

`launchApp` 会把 Electron 主进程环境里的 `ELECTRON_RUN_AS_NODE` 清掉：某些终端
或 CI 包装器会预设该变量，导致 Electron 退化成纯 Node 进程、Playwright 报
`Process failed to launch`。

### 真实七牛云

配置以下环境变量后运行完整上传/下载/删除流程：

- `E2E_QINIU_ACCESS_KEY`
- `E2E_QINIU_SECRET_KEY`
- `E2E_QINIU_BUCKET`
- `E2E_QINIU_REGION`（可选，如 `z0`）

未配置 Mock 且无凭证时 `cloud-workflow.spec.ts`、`transfer-progress.spec.ts` 与
`multipart-transfer.spec.ts` 自动跳过；`credential-storage.spec.ts` 需要 Mock
Provider 创建账户，未设置 `E2E_MOCK_CLOUD=1` 时也跳过。它只在没有系统密钥环的
环境执行（CI 的 headless Linux），因此本地 macOS 上通常是 skipped。

## 失败排查

CI 上失败会重试一次（`retries: 1`），trace 由 `trace: 'on-first-retry'` 录制。失败时 `test-results/` 与 `playwright-report/` 会作为 `e2e-report` artifact 上传，保留 7 天。
