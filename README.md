# OSS 助手

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/tagecode/oss-assistant/actions/workflows/ci.yml/badge.svg)](https://github.com/tagecode/oss-assistant/actions/workflows/ci.yml)

一款跨平台的对象存储管理工具桌面应用。在一个应用中管理七牛云、阿里云 OSS、AWS S3 及 S3 兼容服务的账户、存储桶与文件，支持上传、下载、删除与任务进度追踪。

## 功能特性

- **多云统一管理** — 七牛云 Kodo、阿里云 OSS、AWS S3、S3 兼容存储
- **账户管理** — 添加 / 编辑 / 删除账户，连接测试，凭证本地加密保存
- **文件浏览** — 存储桶列表、目录导航、面包屑、虚拟滚动，大目录流畅浏览
- **文件传输** — 上传（含拖拽）、下载、删除，批量选择与右键操作
- **任务中心** — 实时进度、速度、剩余时间，支持取消、重试与清理记录
- **个性化设置** — 主题、中英文界面、默认下载路径、传输并发、日志保留
- **帮助与诊断** — 常见错误说明、配置指引、脱敏诊断日志导出
- **安全设计** — 渲染进程隔离、IPC 白名单、密钥不明文落盘

## 支持的平台

| 平台 | 安装包格式 |
| ---- | ---------- |
| Windows 10/11 | `.exe`（NSIS 安装程序） |
| macOS 12+ | `.dmg` |
| Linux | `.AppImage`、`.deb` |

## 下载

在 [Releases](https://github.com/tagecode/oss-assistant/releases) 页面下载对应平台的安装包。

| 平台 | 文件名示例 |
| ---- | ---------- |
| Windows | `oss-assistant-v1.0.0-win-x64-setup.exe` |
| macOS | `oss-assistant-v1.0.0-mac-arm64.dmg` |
| Linux | `oss-assistant-v1.0.0-linux-x64.AppImage` |

详细使用说明见 [用户指南](docs/USER_GUIDE.md)。

## 截图

<!-- 发布后可补充应用截图 -->
<!-- ![主界面](docs/images/screenshot-main.png) -->

## 技术栈

- **桌面框架**：Electron + electron-vite
- **前端**：React 19、TypeScript、Tailwind CSS、shadcn/ui
- **状态与表单**：TanStack Query、Zustand、React Hook Form、Zod
- **云 SDK**：qiniu、ali-oss、@aws-sdk/client-s3
- **测试**：Vitest、Testing Library、Playwright
- **打包**：electron-builder

## 开发

### 环境要求

- Node.js 20+
- pnpm 9+

### 安装依赖

```bash
pnpm install
```

### 本地开发

```bash
pnpm dev
```

### 构建

```bash
# 类型检查 + 生产构建
pnpm build

# 按平台打包（需先 build）
pnpm build:win    # Windows
pnpm build:mac    # macOS
pnpm build:linux  # Linux
```

### 代码质量

```bash
pnpm typecheck   # TypeScript 类型检查
pnpm lint        # ESLint
pnpm format      # Prettier 格式化
```

### 测试

```bash
pnpm test              # 单元测试 + 组件测试（CI 会跑）
pnpm test:unit         # 仅主进程单元测试
pnpm test:component    # 仅渲染进程组件测试
```

**CI 流水线**：typecheck → 单元/组件测试 → 生产构建（不含 E2E）。

**E2E（本地 / 发版前手动）**：

```bash
pnpm build
pnpm exec playwright install --with-deps
E2E_MOCK_CLOUD=1 pnpm test:e2e
```

说明见 [tests/e2e/README.md](tests/e2e/README.md)。

## 项目结构

```text
oss-assistant/
├── src/
│   ├── main/           # Electron 主进程：IPC、服务、云 Provider
│   ├── preload/        # 预加载脚本与类型化 API
│   ├── renderer/       # React 界面
│   └── shared/         # 主进程与渲染进程共享类型
├── tests/
│   ├── unit/           # 单元测试
│   ├── component/      # 组件测试
│   └── e2e/            # Playwright 端到端测试
├── .github/workflows/  # CI 与 Release 流水线
└── docs/               # 产品文档与用户指南
```

## 自动更新

应用通过 [electron-updater](https://www.electron.build/auto-update) 从 GitHub Releases 检测并下载更新：

- 更新源：`https://github.com/tagecode/oss-assistant/releases`
- 配置见 `electron-builder.yml` 与 `dev-app-update.yml`（`provider: github`）
- 设置中开启「自动检查更新」后，启动时会查询最新 Release

> macOS 自动更新需要 Release 中包含 `.zip` 安装包及 `latest-mac.yml`；当前 CI 已随构建产物一并上传。

## 发布

推送符合 `package.json` 版本的 tag 即可触发 GitHub Actions 自动构建并发布：

```bash
git tag v1.0.0
git push origin v1.0.0
```

发布前检查清单见 [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md)。

## 安全说明

- 云账户凭证使用系统加密能力保存在本机，不以明文写入配置文件
- 渲染进程通过 preload 暴露的白名单 API 与主进程通信，无法直接访问 Node.js
- 导出的诊断日志经过脱敏，不包含 Access Key / Secret Key
- 请妥善保管本机用户目录下的应用数据，并定期轮换云厂商 Access Key

## 参与贡献

欢迎提交 Issue 与 Pull Request。贡献前请确保：

1. `pnpm typecheck`、`pnpm lint`、`pnpm test` 均通过
2. 新功能或修复附带相应测试（如适用）
3. 遵循项目现有的代码风格与目录结构

## 相关文档

- [用户指南](docs/USER_GUIDE.md)
- [发布检查清单](docs/RELEASE_CHECKLIST.md)
- [变更日志](CHANGELOG.md)

## 许可证

本项目采用 [MIT License](LICENSE) 开源。
