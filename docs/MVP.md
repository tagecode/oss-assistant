# OSS 助手 MVP 功能清单与开发任务

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 基于 `docs/PRD.md` 交付一个可安装、可连接真实对象存储、可完成基础文件管理的跨平台桌面 MVP。

**Architecture:** MVP 采用 Electron 主进程承载系统能力、凭证保护、云 SDK 调用和传输任务队列；React 渲染进程负责账户、存储桶、文件列表、任务中心和设置界面。渲染进程通过 preload 暴露的类型化 IPC API 调用主进程能力，不直接访问 Node.js、文件系统或明文密钥。

**Tech Stack:** Electron、React、TypeScript、Vite、shadcn/ui、Tailwind CSS、TanStack Query、React Hook Form、Zod、Vitest、Playwright、electron-builder 或 Electron Forge。

---

## 1. MVP 范围

### 1.1 必须交付

- 账户管理：添加、编辑、删除、连接测试，凭证本地加密存储。
- 云服务支持：七牛云 Kodo 必须完整支持；阿里云 OSS 或 AWS S3 至少支持一个，用于验证多云抽象。
- 存储桶管理：列出账户可访问的存储桶，展示名称、区域、创建时间或访问状态。
- 文件浏览：按前缀模拟目录，支持面包屑、返回上级、刷新、分页或延迟加载。
- 文件操作：上传、下载、删除、批量选择、拖拽上传。
- 任务中心：展示上传/下载/删除任务状态，上传和下载必须展示进度条、百分比、速度、剩余时间、失败原因、取消和重试入口。
- 设置：主题、语言、默认下载路径、上传/下载并发数、日志保留天数、自动检查更新开关。
- 帮助与诊断：常见错误说明、服务商配置指引、脱敏诊断日志导出、应用版本信息。
- 安全基线：`contextIsolation` 开启、`nodeIntegration` 关闭、IPC 白名单、日志脱敏、生产 CSP。
- 质量验证：TypeScript 严格模式、ESLint、Prettier、核心单元测试、关键组件测试、关键路径端到端测试、跨平台安装包冒烟验证。

### 1.2 MVP 不做

- 创建或删除存储桶。
- 文件预览、云端编辑、搜索、分享链接。
- 团队协作、权限模板、审计后台。
- 插件系统、CLI、服务端 API。
- 同步盘能力、回收站策略、批量重命名/复制/移动。

### 1.3 MVP 成功标准

- 新用户能在 5 分钟内添加账户并完成首次上传。
- 七牛云能完成账户连接、存储桶浏览、对象浏览、上传、下载、删除。
- 至少第二个云服务商或 S3 兼容服务能完成账户连接、存储桶浏览和基础文件操作。
- 上传/下载不会阻塞界面，任务中心能持续展示进度。
- 明文 Secret 不出现在本地持久化文件、日志、诊断包或渲染进程状态中。

---

## 2. 推荐文件结构

```text
oss-assistant/
├── electron/
│   ├── main/
│   │   ├── index.ts
│   │   ├── window.ts
│   │   ├── security.ts
│   │   ├── ipc/
│   │   │   ├── account-ipc.ts
│   │   │   ├── storage-ipc.ts
│   │   │   ├── transfer-ipc.ts
│   │   │   └── settings-ipc.ts
│   │   ├── services/
│   │   │   ├── account-service.ts
│   │   │   ├── credential-service.ts
│   │   │   ├── settings-service.ts
│   │   │   ├── storage-service.ts
│   │   │   ├── transfer-service.ts
│   │   │   └── diagnostic-service.ts
│   │   └── providers/
│   │       ├── base-provider.ts
│   │       ├── qiniu-provider.ts
│   │       ├── aliyun-oss-provider.ts
│   │       └── s3-provider.ts
│   └── preload/
│       ├── index.ts
│       └── api-types.ts
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   └── providers.tsx
│   ├── components/
│   │   ├── ui/
│   │   ├── account/
│   │   ├── bucket/
│   │   ├── file-list/
│   │   ├── transfer/
│   │   ├── settings/
│   │   └── diagnostics/
│   ├── hooks/
│   ├── lib/
│   ├── stores/
│   ├── styles/
│   └── types/
├── tests/
│   ├── unit/
│   ├── component/
│   └── e2e/
└── docs/
```

---

## 3. 开发任务拆分

### Task 1: 初始化 Electron + React 工程

**目标：** 建立可运行的桌面应用骨架，为后续安全、IPC、UI 和测试打基础。

**Files:**

- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `electron/main/index.ts`
- Create: `electron/main/window.ts`
- Create: `electron/preload/index.ts`
- Create: `electron/preload/api-types.ts`
- Create: `src/app/App.tsx`
- Create: `src/main.tsx`
- Create: `src/styles/globals.css`

- [ ] 创建 Electron + Vite + React + TypeScript 项目结构。
- [ ] 配置开发命令、构建命令、类型检查命令和测试命令。
- [ ] 创建主窗口并加载 Vite dev server 或生产构建产物。
- [ ] 创建 preload 入口，先暴露只读的 `app.getVersion()` API。
- [ ] 渲染进程展示基础应用壳：标题、左侧区域、主内容区域、底部状态栏。
- [ ] 运行 `pnpm typecheck`，预期无 TypeScript 错误。
- [ ] 运行 `pnpm dev`，预期桌面窗口可打开。

**验收标准：**

- 应用能在开发模式启动。
- 主进程、preload、渲染进程职责清晰分离。
- 渲染进程不依赖 Node.js 全局能力。

### Task 2: 配置 UI 体系和基础布局

**目标：** 建立符合 PRD 的 shadcn/ui + Tailwind CSS 桌面工具界面基础。

**Files:**

- Create: `components.json`
- Modify: `src/styles/globals.css`
- Modify: `src/app/App.tsx`
- Create: `src/components/layout/app-shell.tsx`
- Create: `src/components/layout/status-bar.tsx`
- Create: `src/components/layout/toolbar.tsx`

- [ ] 初始化 Tailwind CSS 和 shadcn/ui。
- [ ] 添加 MVP 必需组件：`button`、`input`、`select`、`form`、`dialog`、`sheet`、`table`、`dropdown-menu`、`alert-dialog`、`alert`、`tabs`、`badge`、`progress`、`skeleton`、`separator`。
- [ ] 实现主界面布局：左侧账户/存储桶区、右侧文件列表区、顶部工具栏、底部状态栏。
- [ ] 支持亮色、暗色、跟随系统三种主题入口。
- [ ] 所有图标按钮提供可访问名称。
- [ ] 运行 `pnpm lint`，预期无 lint 错误。

**验收标准：**

- UI 与 PRD 的三栏/两栏加详情区布局一致。
- 任务中心入口和状态栏入口预留完成。
- 基础空状态、加载状态、错误状态有统一视觉样式。

### Task 3: 建立 Electron 安全基线

**目标：** 在功能开发前固定桌面应用安全边界。

**Files:**

- Create: `electron/main/security.ts`
- Modify: `electron/main/window.ts`
- Modify: `electron/preload/index.ts`
- Modify: `electron/preload/api-types.ts`
- Create: `tests/unit/electron/security.test.ts`

- [ ] 在 `BrowserWindow` 中开启 `contextIsolation`。
- [ ] 在 `BrowserWindow` 中关闭 `nodeIntegration`。
- [ ] 禁止加载不可信远程页面。
- [ ] 配置生产环境 Content Security Policy。
- [ ] 定义 IPC channel 命名规范和白名单机制。
- [ ] 为 preload API 创建 TypeScript 类型。
- [ ] 添加单元测试验证窗口安全配置。
- [ ] 运行 `pnpm test tests/unit/electron/security.test.ts`，预期通过。

**验收标准：**

- 渲染进程无法直接访问 Node.js API。
- 所有后续系统能力都必须通过 preload 暴露。
- 安全配置有测试保护。

### Task 4: 定义领域类型与 Provider 抽象

**目标：** 建立多云对象存储统一接口，先不绑定具体服务商。

**Files:**

- Create: `src/types/storage.ts`
- Create: `electron/main/providers/base-provider.ts`
- Create: `electron/main/providers/provider-errors.ts`
- Create: `tests/unit/providers/base-provider.test.ts`

- [ ] 定义 `StorageProvider`、`AccountConfig`、`BucketInfo`、`StorageObject`、`TransferTask` 类型。
- [ ] 定义统一 Provider 接口：`testConnection`、`listBuckets`、`listObjects`、`uploadObject`、`downloadObject`、`deleteObjects`。
- [ ] 定义统一错误类型和服务商错误映射结构。
- [ ] 明确上传/下载进度回调参数：`transferredBytes`、`totalBytes`、`speedBytesPerSecond`、`estimatedRemainingSeconds`、`progressPercent`。
- [ ] 添加单元测试验证类型转换和错误映射。
- [ ] 运行 `pnpm test tests/unit/providers/base-provider.test.ts`，预期通过。

**验收标准：**

- 七牛云、阿里云 OSS、AWS S3 都能通过同一接口接入。
- 传输进度数据满足任务中心展示需要。

### Task 5: 实现本地设置与账户持久化

**目标：** 保存账户元数据和用户设置，但不保存明文 Secret。

**Files:**

- Create: `electron/main/services/settings-service.ts`
- Create: `electron/main/services/account-service.ts`
- Create: `electron/main/ipc/settings-ipc.ts`
- Create: `electron/main/ipc/account-ipc.ts`
- Modify: `electron/preload/api-types.ts`
- Modify: `electron/preload/index.ts`
- Create: `tests/unit/services/account-service.test.ts`
- Create: `tests/unit/services/settings-service.test.ts`

- [ ] 实现设置模型：主题、语言、默认下载路径、并发数、日志保留天数、自动检查更新。
- [ ] 实现账户元数据 CRUD。
- [ ] 账户数据字段包含名称、服务商、区域、endpoint、bucketDomain、pathStyleAccess、创建/更新时间。
- [ ] 设置和账户数据保存到应用用户数据目录。
- [ ] IPC 暴露 `listAccounts`、`createAccount`、`updateAccount`、`deleteAccount`、`getSettings`、`updateSettings`。
- [ ] 添加单元测试覆盖创建、更新、删除和默认设置。
- [ ] 运行 `pnpm test tests/unit/services`，预期通过。

**验收标准：**

- 重启应用后账户元数据和设置仍然存在。
- 账户元数据不包含明文 Secret。

### Task 6: 实现凭证加密与脱敏

**目标：** 保护 Access Key Secret，避免敏感信息进入 UI、日志和诊断包。

**Files:**

- Create: `electron/main/services/credential-service.ts`
- Create: `electron/main/services/redaction-service.ts`
- Modify: `electron/main/services/account-service.ts`
- Create: `tests/unit/services/credential-service.test.ts`
- Create: `tests/unit/services/redaction-service.test.ts`

- [ ] 使用 Electron `safeStorage` 或系统密钥链能力加密 Secret。
- [ ] 账户服务只保存 `encryptedSecretRef` 或加密结果引用。
- [ ] 实现敏感字段脱敏：Access Key Secret、Secret Key、Authorization、签名参数。
- [ ] 在错误对象和日志写入前执行脱敏。
- [ ] 添加测试验证本地账户数据不含明文 Secret。
- [ ] 添加测试验证脱敏函数覆盖常见 Secret 形态。
- [ ] 运行 `pnpm test tests/unit/services/credential-service.test.ts tests/unit/services/redaction-service.test.ts`，预期通过。

**验收标准：**

- 明文 Secret 不落盘。
- 诊断日志和错误消息不会泄露 Secret。

### Task 7: 实现账户管理 UI

**目标：** 用户可以添加、编辑、删除账户并测试连接。

**Files:**

- Create: `src/components/account/account-list.tsx`
- Create: `src/components/account/account-form-dialog.tsx`
- Create: `src/components/account/account-delete-dialog.tsx`
- Create: `src/hooks/use-accounts.ts`
- Modify: `src/app/App.tsx`
- Create: `tests/component/account/account-form-dialog.test.tsx`

- [ ] 使用 React Hook Form + Zod 实现账户表单校验。
- [ ] 支持服务商类型选择：七牛云、阿里云 OSS、AWS S3、兼容 S3。
- [ ] 根据服务商显示必要配置字段。
- [ ] 保存前支持连接测试。
- [ ] 删除账户使用 `AlertDialog` 二次确认。
- [ ] 账户列表展示名称、服务商、区域、最近连接状态和更新时间。
- [ ] 添加组件测试覆盖必填校验、保存、删除确认。
- [ ] 运行 `pnpm test tests/component/account/account-form-dialog.test.tsx`，预期通过。

**验收标准：**

- 新用户能从空状态进入添加账户流程。
- 表单错误清晰定位到字段。
- 删除操作不会误触发。

### Task 8: 实现七牛云 Provider

**目标：** 七牛云作为 MVP P0 服务商，完成连接、存储桶、对象和基础文件操作。

**Files:**

- Create: `electron/main/providers/qiniu-provider.ts`
- Modify: `electron/main/services/storage-service.ts`
- Create: `tests/unit/providers/qiniu-provider.test.ts`

- [ ] 实现七牛云连接测试。
- [ ] 实现七牛云存储桶列表。
- [ ] 实现对象列表，支持 prefix、delimiter、分页或 marker。
- [ ] 实现单文件上传并回传进度。
- [ ] 实现单文件下载并回传进度。
- [ ] 实现单个和批量对象删除。
- [ ] 将七牛云错误转换为统一错误类型。
- [ ] 使用 mock SDK 或测试替身覆盖 Provider 行为。
- [ ] 运行 `pnpm test tests/unit/providers/qiniu-provider.test.ts`，预期通过。

**验收标准：**

- 使用真实七牛云测试账户时可完成完整 MVP 文件操作。
- 进度回调能驱动任务中心进度条。

### Task 9: 实现存储桶与文件浏览 UI

**目标：** 用户能选择账户、浏览存储桶、进入目录、查看对象列表并刷新。

**Files:**

- Create: `electron/main/services/storage-service.ts`
- Create: `electron/main/ipc/storage-ipc.ts`
- Create: `src/hooks/use-buckets.ts`
- Create: `src/hooks/use-objects.ts`
- Create: `src/components/bucket/bucket-list.tsx`
- Create: `src/components/file-list/file-browser.tsx`
- Create: `src/components/file-list/file-table.tsx`
- Create: `src/components/file-list/path-breadcrumb.tsx`
- Create: `tests/component/file-list/file-browser.test.tsx`

- [ ] IPC 暴露 `listBuckets`、`listObjects`、`refreshObjects`。
- [ ] 存储桶列表展示名称、区域、创建时间和访问状态。
- [ ] 文件列表展示名称、大小、最后修改时间、存储类型、对象类型。
- [ ] 支持面包屑路径导航、返回上级、刷新当前路径。
- [ ] 支持加载状态、空状态、错误状态和重试按钮。
- [ ] 支持分页或延迟加载，避免一次性加载大目录。
- [ ] 添加组件测试覆盖路径导航、空状态、错误重试。
- [ ] 运行 `pnpm test tests/component/file-list/file-browser.test.tsx`，预期通过。

**验收标准：**

- 1000 个对象以内目录列表在正常网络下 3 秒内展示。
- 文件浏览交互不会阻塞 UI。

### Task 10: 实现传输任务队列

**目标：** 上传、下载、删除统一进入任务系统，支持进度、取消、失败重试和并发控制。

**Files:**

- Create: `electron/main/services/transfer-service.ts`
- Create: `electron/main/ipc/transfer-ipc.ts`
- Modify: `electron/preload/api-types.ts`
- Create: `tests/unit/services/transfer-service.test.ts`

- [ ] 定义任务状态：`queued`、`running`、`success`、`failed`、`cancelled`。
- [ ] 实现上传任务创建、执行、进度更新、取消和失败重试。
- [ ] 实现下载任务创建、执行、进度更新、取消和失败重试。
- [ ] 实现删除任务创建、执行和部分失败结果记录。
- [ ] 支持可配置并发数。
- [ ] 通过 IPC 推送任务状态变化给渲染进程。
- [ ] 添加单元测试覆盖队列顺序、并发限制、进度更新、取消、失败重试。
- [ ] 运行 `pnpm test tests/unit/services/transfer-service.test.ts`，预期通过。

**验收标准：**

- 上传/下载不阻塞渲染进程。
- 进度条数据持续更新。
- 失败任务保留失败原因并可重试。

### Task 11: 实现上传、下载、删除 UI

**目标：** 在文件浏览界面完成核心文件操作。

**Files:**

- Create: `src/components/file-list/file-actions-toolbar.tsx`
- Create: `src/components/file-list/file-context-menu.tsx`
- Create: `src/components/file-list/delete-objects-dialog.tsx`
- Create: `src/components/transfer/transfer-center.tsx`
- Create: `src/components/transfer/transfer-task-row.tsx`
- Create: `src/hooks/use-transfers.ts`
- Create: `tests/component/transfer/transfer-center.test.tsx`
- Create: `tests/component/file-list/file-actions-toolbar.test.tsx`

- [ ] 支持工具栏上传、下载、删除、刷新。
- [ ] 支持右键菜单上传、下载、删除、复制路径、查看属性。
- [ ] 支持拖拽文件到当前路径上传。
- [ ] 下载时打开本地目录选择器。
- [ ] 文件名冲突时支持覆盖、跳过、重命名。
- [ ] 删除前展示对象数量、目标路径和不可恢复提示。
- [ ] 任务中心使用 `Progress` 展示上传/下载百分比。
- [ ] 任务行展示已传输大小、总大小、实时速度、预计剩余时间、状态、取消和重试按钮。
- [ ] 底部状态栏展示活跃任务数量和整体进度入口。
- [ ] 添加组件测试覆盖进度展示、取消、重试、删除确认。
- [ ] 运行 `pnpm test tests/component/transfer tests/component/file-list`，预期通过。

**验收标准：**

- 单文件和批量上传/下载都能看到进度条。
- 长耗时任务进入任务中心，不阻塞继续浏览。
- 删除操作有明确二次确认。

### Task 12: 实现设置、帮助与诊断

**目标：** 交付 MVP 必需的用户配置和问题排查能力。

**Files:**

- Create: `src/components/settings/settings-dialog.tsx`
- Create: `src/components/diagnostics/help-dialog.tsx`
- Create: `electron/main/services/diagnostic-service.ts`
- Create: `electron/main/ipc/diagnostic-ipc.ts`
- Create: `tests/unit/services/diagnostic-service.test.ts`
- Create: `tests/component/settings/settings-dialog.test.tsx`

- [ ] 设置界面支持主题、语言、默认下载路径、并发数、日志保留天数、自动检查更新。
- [ ] 帮助界面展示常见错误说明和服务商配置指引。
- [ ] 诊断导出包含应用版本、系统信息、Electron 版本、脱敏日志。
- [ ] 导出诊断包前执行敏感信息脱敏。
- [ ] 添加单元测试验证诊断包不包含 Secret。
- [ ] 添加组件测试验证设置保存和读取。
- [ ] 运行 `pnpm test tests/unit/services/diagnostic-service.test.ts tests/component/settings/settings-dialog.test.tsx`，预期通过。

**验收标准：**

- 用户可调整核心偏好设置。
- 诊断导出可用于排查问题且不泄露敏感信息。

### Task 13: 接入第二个服务商

**目标：** 接入阿里云 OSS 或 AWS S3，验证多云抽象不是只为七牛云定制。

**Files:**

- Create: `electron/main/providers/aliyun-oss-provider.ts` 或 `electron/main/providers/s3-provider.ts`
- Modify: `electron/main/providers/base-provider.ts`
- Modify: `src/components/account/account-form-dialog.tsx`
- Create: `tests/unit/providers/aliyun-oss-provider.test.ts` 或 `tests/unit/providers/s3-provider.test.ts`

- [ ] 选择一个第二服务商作为 MVP P1：阿里云 OSS 或 AWS S3。
- [ ] 实现连接测试。
- [ ] 实现存储桶列表。
- [ ] 实现对象列表。
- [ ] 实现上传、下载、删除。
- [ ] 将服务商特定字段接入账户表单。
- [ ] 将服务商错误映射为统一错误类型。
- [ ] 添加 Provider 单元测试。
- [ ] 运行对应 Provider 测试，预期通过。

**验收标准：**

- 第二服务商能通过同一 UI 完成基础对象管理。
- 不需要为第二服务商复制一套 UI。

### Task 14: 完成关键路径端到端测试

**目标：** 证明 MVP 主流程可用，防止发布前回归。

**Files:**

- Create: `tests/e2e/account-to-upload.spec.ts`
- Create: `tests/e2e/file-transfer.spec.ts`
- Create: `tests/e2e/settings-and-diagnostics.spec.ts`
- Modify: `package.json`

- [ ] 配置 Playwright Electron 测试启动方式。
- [ ] 编写“添加账户 -> 测试连接 -> 浏览存储桶 -> 上传文件”的端到端测试。
- [ ] 编写“下载文件 -> 展示进度 -> 完成任务”的端到端测试。
- [ ] 编写“删除文件 -> 二次确认 -> 刷新列表”的端到端测试。
- [ ] 编写“设置保存 -> 重启后读取”的端到端测试。
- [ ] 编写“导出诊断日志 -> 不包含 Secret”的端到端测试。
- [ ] 运行 `pnpm test:e2e`，预期关键路径通过。

**验收标准：**

- MVP 核心用户路径有自动化测试覆盖。
- 失败时能定位到具体页面或流程。

### Task 15: 打包发布与跨平台冒烟验证

**目标：** 生成 MVP 安装包，并验证主流平台可启动、可连接、可执行基础操作。

**Files:**

- Create: `electron-builder.yml` 或 `forge.config.ts`
- Modify: `package.json`
- Create: `docs/RELEASE_CHECKLIST.md`
- Create: `docs/USER_GUIDE.md`

- [ ] 配置 Windows、macOS、Linux 打包目标。
- [ ] 配置应用图标、应用名称、版本号和产物目录。
- [ ] 生产构建启用 CSP 和安全配置。
- [ ] 编写发布检查清单。
- [ ] 编写用户指南：添加账户、浏览文件、上传、下载、删除、诊断导出。
- [ ] 运行 `pnpm build`，预期构建成功。
- [ ] 运行 `pnpm package`，预期生成安装包。
- [ ] 在 Windows 10/11 完成冒烟验证。
- [ ] 在 macOS 12+ 完成冒烟验证。
- [ ] 在 Ubuntu 20.04+ 或主流 Linux 发行版完成冒烟验证。

**验收标准：**

- 三个平台安装包可生成。
- 安装后应用可启动，基础流程可用。
- 发布文档足够新用户完成首次上传。

---

## 4. 推荐实施顺序

1. Task 1-3：先完成工程骨架、UI 基线和 Electron 安全基线。
2. Task 4-6：完成领域模型、Provider 抽象、账户持久化和凭证保护。
3. Task 7-9：完成账户 UI、七牛云接入、存储桶和文件浏览。
4. Task 10-11：完成传输任务队列、上传/下载/删除和任务中心。
5. Task 12：补齐设置、帮助、诊断。
6. Task 13：接入第二服务商，验证多云扩展能力。
7. Task 14-15：补齐端到端测试、打包发布和跨平台冒烟验证。

---

## 5. MVP 总体验收清单

- [ ] `pnpm typecheck` 通过。
- [ ] `pnpm lint` 通过。
- [ ] `pnpm test` 通过。
- [ ] `pnpm test:e2e` 关键路径通过。
- [ ] `pnpm build` 通过。
- [ ] `pnpm package` 可生成安装包。
- [ ] 七牛云账户能连接成功。
- [ ] 第二服务商或 S3 兼容账户能连接成功。
- [ ] 可浏览存储桶和对象列表。
- [ ] 可上传单文件、多文件和拖拽文件。
- [ ] 上传任务有进度条、速度、剩余时间、取消和失败重试。
- [ ] 可下载单文件和多文件。
- [ ] 下载任务有进度条、速度、剩余时间、取消和失败重试。
- [ ] 可删除单文件和多文件，删除前有二次确认。
- [ ] 应用重启后账户元数据和设置仍存在。
- [ ] 本地持久化文件不包含明文 Secret。
- [ ] 日志和诊断包不包含明文 Secret。
- [ ] Windows、macOS、Linux 至少完成一次安装包冒烟验证。
