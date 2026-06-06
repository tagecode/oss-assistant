# E2E 测试说明

> **CI 不运行 E2E。** GitHub Actions 仅执行 typecheck、单元/组件测试与生产构建。E2E 请在本地或发版前手动执行。

## 前置条件

1. 先执行生产构建：`pnpm build`
2. 安装 Playwright 系统依赖：`pnpm exec playwright install --with-deps`

## 运行

```bash
pnpm test:e2e
```

## 测试范围

| 文件                     | 说明                                         |
| ------------------------ | -------------------------------------------- |
| `app-launch.spec.ts`     | 应用启动冒烟（无需云凭证）                   |
| `ui-navigation.spec.ts`  | 空状态、设置、帮助对话框导航（无需云凭证）   |
| `settings-and-diagnostics.spec.ts` | 设置保存、诊断导出脱敏（无需云凭证） |
| `cloud-workflow.spec.ts` | 云存储完整流程（Mock 或七牛凭证） |

E2E 断言使用 `data-testid` 与稳定表单 `id`（如 `#name`），不依赖界面语言。
公共选择器见 `tests/e2e/helpers/locators.ts`。

## 云存储 E2E

### Mock 模式（推荐本地 / 发版前）

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

未配置 Mock 且无凭证时 `cloud-workflow.spec.ts` 自动跳过。
