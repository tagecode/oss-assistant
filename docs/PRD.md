# OSS 助手 - 产品需求文档 (PRD)

## 1. 文档信息

| 项目     | 内容                                                     |
| -------- | -------------------------------------------------------- |
| 产品名称 | OSS 助手                                                 |
| 文档版本 | v2.0                                                     |
| 最后更新 | 2026-06-05                                               |
| 目标版本 | MVP                                                      |
| 技术方向 | Electron + React + TypeScript + shadcn/ui + Tailwind CSS |
| 适用范围 | 跨平台桌面端对象存储管理工具                             |

## 2. 产品概述

### 2.1 产品定位

OSS 助手是一款跨平台桌面应用，面向需要同时管理多家对象存储服务的个人开发者、运维人员和小型团队。产品通过统一的账户、存储桶和文件操作界面，降低多云对象存储管理成本，并提供安全、本地化、现代化的桌面使用体验。

### 2.2 核心价值

- **统一管理**：在一个桌面应用中管理七牛云 Kodo、阿里云 OSS、AWS S3 及兼容 S3 协议的对象存储。
- **高效操作**：支持文件浏览、上传、下载、删除、批量操作、拖拽上传和传输任务管理。
- **安全可控**：凭证仅保存在本机，渲染进程不直接接触敏感密钥，关键操作有明确确认和审计记录。
- **现代体验**：基于 React、shadcn/ui 和 Tailwind CSS 构建一致、可维护、支持亮暗主题的桌面界面。
- **跨平台发布**：基于 Electron 发布 Windows、macOS、Linux 客户端。

### 2.3 目标用户

- **开发人员**：上传静态资源、管理构建产物、下载日志或备份文件。
- **运维人员**：维护多个云账户和存储桶，执行批量文件管理任务。
- **内容创作者**：管理图片、视频、文档等媒体素材的云端存储。
- **小型团队**：希望以低学习成本统一管理多家云服务商资源。

### 2.4 产品边界

MVP 聚焦对象存储的日常管理，不提供团队协作、权限编排、云端编辑、同步盘、插件系统或服务端 SaaS 能力。所有账户数据、配置和操作日志默认保存在本地设备。

## 3. 技术栈与架构

### 3.1 核心技术栈

| 分层       | 技术选型                                | 说明                                                                       |
| ---------- | --------------------------------------- | -------------------------------------------------------------------------- |
| 桌面运行时 | Electron                                | 提供跨平台桌面窗口、系统能力、文件选择器、通知、加密能力和自动更新基础能力 |
| 前端框架   | React + TypeScript                      | 构建渲染进程 UI，提升类型安全和组件可维护性                                |
| 构建工具   | Vite                                    | 提供快速开发服务、生产构建和 Electron 前端资源打包                         |
| UI 体系    | shadcn/ui + Radix UI + Tailwind CSS     | 提供可复制、可定制、可访问的 React 组件和设计令牌                          |
| 图标       | lucide-react                            | 与 shadcn/ui 风格一致，适合桌面工具类产品                                  |
| 状态管理   | Zustand 或 Jotai                        | 管理轻量客户端状态，如当前账户、当前路径、设置面板状态                     |
| 异步数据   | TanStack Query                          | 管理云端列表、连接测试、文件任务状态、缓存和重试                           |
| 表单校验   | React Hook Form + Zod                   | 管理账户表单、设置表单和类型安全校验                                       |
| 数据持久化 | SQLite 或本地 JSON 配置                 | 存储账户元数据、偏好设置、传输记录和日志索引                               |
| 密钥保护   | Electron safeStorage / 系统密钥链适配   | 加密保存 Access Key、Secret Key 等敏感信息                                 |
| 打包发布   | electron-builder 或 Electron Forge      | 生成 Windows、macOS、Linux 安装包                                          |
| 质量工具   | ESLint + Prettier + Vitest + Playwright | 覆盖代码规范、单元测试、组件测试和端到端测试                               |

### 3.2 云服务 SDK

| 服务商       | 首选接入方式                         | MVP 优先级 |
| ------------ | ------------------------------------ | ---------- |
| 七牛云 Kodo  | qiniu Node.js SDK 或兼容 S3 API      | P0         |
| 阿里云 OSS   | ali-oss                              | P1         |
| AWS S3       | @aws-sdk/client-s3                   | P1         |
| 兼容 S3 服务 | @aws-sdk/client-s3 + 自定义 endpoint | P2         |

MVP 必须优先完成七牛云；阿里云 OSS 与 AWS S3 至少完成其中一个，确保多云抽象层在真实场景中可验证。

### 3.3 进程职责

#### 3.3.1 主进程

- 管理应用生命周期、窗口创建、菜单、系统通知和自动更新。
- 负责本地文件系统访问、下载路径选择、拖拽文件路径解析。
- 负责凭证加密、解密和云服务 SDK 调用。
- 维护上传/下载任务队列，处理并发、取消、重试和错误归档。
- 通过受控 IPC 向渲染进程暴露最小必要能力。

#### 3.3.2 预加载脚本

- 使用 `contextBridge` 暴露类型明确的 API。
- 对 IPC 入参进行基础校验，禁止渲染进程直接访问 Node.js、文件系统和敏感凭证。
- 统一封装账户、存储桶、对象、任务、设置等接口。

#### 3.3.3 渲染进程

- 使用 React 构建账户管理、存储桶浏览、文件列表、任务中心和设置页面。
- 只处理展示状态和用户交互，不保存明文凭证。
- 通过 TanStack Query 调用预加载 API，并处理加载、空状态、错误状态和重试入口。

### 3.4 安全基线

- `contextIsolation` 必须开启。
- `nodeIntegration` 必须关闭。
- IPC channel 必须使用白名单和类型定义。
- 禁止在日志、错误提示、埋点或调试输出中记录 Access Key Secret。
- 所有云端请求必须使用 HTTPS，除非用户显式配置本地或私有兼容 S3 endpoint。
- 生产构建必须配置 Content Security Policy。

## 4. MVP 功能需求

### 4.1 账户管理

#### 4.1.1 添加账户

用户可以添加云服务账户，填写并保存以下信息：

- 账户名称。
- 服务商类型：七牛云、阿里云 OSS、AWS S3、兼容 S3。
- Access Key ID / Access Key。
- Access Key Secret / Secret Key。
- 区域、Endpoint 或 Bucket 域名等服务商特定配置。
- 是否启用路径样式访问、签名版本等兼容 S3 可选项。

验收标准：

- 必填字段校验清晰，错误信息能定位到具体字段。
- 保存前可执行连接测试。
- 凭证明文不在渲染进程持久化。
- 保存成功后账户出现在账户列表中。

#### 4.1.2 账户列表

- 展示账户名称、服务商、默认区域、最近连接状态和更新时间。
- 支持编辑账户元数据与凭证。
- 支持删除账户，删除前必须二次确认。
- 支持手动测试连接并展示结果。

### 4.2 存储桶管理

#### 4.2.1 列出存储桶

- 选择账户后显示该账户可访问的存储桶。
- 展示存储桶名称、区域、创建时间和访问状态。
- 加载失败时展示错误原因和重试按钮。

#### 4.2.2 浏览存储桶内容

- 支持按前缀模拟文件夹导航。
- 显示对象名称、大小、最后修改时间、存储类型和对象类型。
- 支持面包屑路径导航、返回上级、刷新当前路径。
- 支持分页或延迟加载，避免大目录一次性阻塞 UI。

### 4.3 文件操作

#### 4.3.1 上传

- 支持单文件、多文件和拖拽上传。
- 支持选择远端目标路径。
- 支持上传进度条展示，进度条需展示百分比、已上传大小、总大小、实时速度和预计剩余时间。
- 支持任务取消和失败重试。
- 大文件上传应采用分片或服务商推荐机制。

#### 4.3.2 下载

- 支持单文件和多文件批量下载。
- 支持选择本地保存目录。
- 支持冲突处理：覆盖、跳过、重命名。
- 支持下载进度条展示，进度条需展示百分比、已下载大小、总大小、实时速度和预计剩余时间。
- 下载失败时保留失败原因和重试入口。

#### 4.3.3 删除

- 支持单文件和多文件批量删除。
- 删除前必须展示对象数量、目标路径和不可恢复提示。
- 删除完成后刷新当前文件列表。
- 部分失败时展示成功数量、失败数量和失败对象列表。

#### 4.3.4 刷新与缓存

- 支持手动刷新当前账户、存储桶和目录。
- 文件操作成功后自动失效相关缓存。
- 列表缓存只用于提升体验，不作为最终数据源。

### 4.4 任务中心

- 展示上传、下载、删除等异步任务。
- 展示任务状态：等待中、进行中、成功、失败、已取消。
- 上传和下载任务必须展示可视化进度条；批量任务需同时展示单文件进度和整体进度。
- 支持按类型和状态过滤。
- 支持取消等待中或进行中的任务。
- 支持清理已完成任务记录。

### 4.5 设置

- 主题设置：跟随系统、亮色、暗色。
- 语言设置：中文、英文。
- 默认下载路径。
- 上传/下载并发数。
- 操作日志保留天数。
- 是否启动后自动检查更新。

### 4.6 帮助与诊断

- 提供常见错误说明和服务商配置指引。
- 提供导出诊断日志能力，导出前必须脱敏。
- 提供应用版本、运行平台、Electron 版本等基础信息。

## 5. 非功能需求

### 5.1 性能

- 应用冷启动到主窗口可交互时间应小于 3 秒。
- 1000 个对象以内的目录列表加载完成时间应小于 3 秒，具体耗时不包含云服务商网络异常。
- 文件列表渲染应支持虚拟滚动或分页，避免大目录卡顿。
- 上传和下载任务不得阻塞渲染进程交互。
- 并发传输数量可配置，默认值应兼顾稳定性和速度。

### 5.2 安全

- 凭证必须加密存储，优先使用系统级安全能力。
- 主进程负责云 SDK 调用，渲染进程不得直接持有明文 Secret。
- 删除、覆盖等不可逆操作必须二次确认。
- 日志、诊断包和错误提示必须脱敏。
- 本地配置文件权限应限制为当前用户可读写。

### 5.3 可用性

- 核心操作入口清晰，账户、存储桶、对象列表层级明确。
- 所有异步操作必须有加载状态、成功反馈和失败反馈。
- 空状态需要给出下一步建议，例如“添加账户”或“上传文件”。
- 支持常用快捷键和右键菜单。
- 桌面窗口支持合理的最小尺寸和响应式布局。

### 5.4 可访问性

- shadcn/ui 组件应保留 Radix UI 的键盘交互和 ARIA 语义。
- 所有图标按钮必须提供可访问名称。
- 焦点状态清晰可见。
- 错误提示不只依赖颜色表达。

### 5.5 兼容性

- Windows 10/11。
- macOS 12+。
- Ubuntu 20.04+ 及主流 Linux 发行版。
- 高 DPI 显示器下界面不应模糊或错位。

## 6. 用户界面与交互设计

### 6.1 信息架构

主界面采用三栏或两栏加详情区布局：

```text
+---------------------------------------------------------------+
| OSS 助手                         搜索/命令入口    设置  帮助 |
+------------------+--------------------------------------------+
| 账户              | 当前 Bucket / 当前路径                     |
| - 七牛云生产      +--------------------------------------------+
| - 阿里云测试      | 上传  下载  删除  刷新                     |
|                  +--------------------------------------------+
| 存储桶            | 名称              大小      修改时间  状态 |
| - assets-prod     | images/           -         2026-06-01     |
| - backup          | logo.png          28 KB     2026-06-02     |
|                  | archive.zip       120 MB    2026-06-03     |
+------------------+--------------------------------------------+
| 任务：2 个进行中 | 状态：已连接七牛云生产                      |
+---------------------------------------------------------------+
```

### 6.2 推荐组件

| 场景           | shadcn/ui 组件                           |
| -------------- | ---------------------------------------- |
| 主操作按钮     | `Button`                                 |
| 账户和设置表单 | `Form`、`Input`、`Select`、`Label`       |
| 文件列表       | `Table` 或虚拟列表组件 + shadcn 表格样式 |
| 右键操作       | `DropdownMenu`                           |
| 删除确认       | `AlertDialog`                            |
| 账户编辑       | `Dialog` 或 `Sheet`                      |
| 任务中心       | `Sheet`、`Tabs`、`Badge`、`Progress`     |
| 错误提示       | `Alert`                                  |
| 加载状态       | `Skeleton`                               |
| 命令入口       | `Command`                                |

### 6.3 交互规范

- 双击文件夹进入下级路径。
- 双击文件默认触发下载确认或打开详情，具体行为在设置中可配置。
- 右键菜单提供上传、下载、删除、复制路径、查看属性等操作。
- 支持 `Ctrl/Cmd + U` 上传、`Ctrl/Cmd + D` 下载、`Delete` 删除、`F5` 刷新。
- 批量操作时顶部操作区应展示已选数量。
- 长耗时任务进入任务中心，不以模态框阻塞用户继续浏览；主界面底部状态栏应显示当前活跃传输任务数量和整体进度入口。

### 6.4 视觉规范

- 默认采用清爽、低干扰的工具型界面风格。
- 使用 Tailwind CSS 设计令牌管理颜色、间距、圆角和阴影。
- 亮暗主题均需覆盖主界面、表单、弹窗、任务中心和错误状态。
- 图标使用 lucide-react，尺寸和线宽保持一致。
- 避免硬编码颜色，基础色应使用 `bg-background`、`text-foreground`、`border-border` 等主题变量。

## 7. 数据模型

### 7.1 账户配置

```ts
type StorageProvider = 'qiniu' | 'aliyun-oss' | 'aws-s3' | 's3-compatible'

interface AccountConfig {
  id: string
  name: string
  provider: StorageProvider
  accessKeyId: string
  encryptedSecretRef: string
  region?: string
  endpoint?: string
  bucketDomain?: string
  pathStyleAccess?: boolean
  createdAt: string
  updatedAt: string
  lastConnectedAt?: string
}
```

### 7.2 存储桶

```ts
interface BucketInfo {
  name: string
  region?: string
  createdAt?: string
  permission?: 'readonly' | 'readwrite' | 'unknown'
}
```

### 7.3 文件对象

```ts
interface StorageObject {
  key: string
  name: string
  prefix: string
  size: number
  lastModified?: string
  etag?: string
  storageClass?: string
  contentType?: string
  isDirectory: boolean
}
```

### 7.4 传输任务

```ts
type TransferType = 'upload' | 'download' | 'delete'
type TransferStatus = 'queued' | 'running' | 'success' | 'failed' | 'cancelled'

interface TransferTask {
  id: string
  type: TransferType
  status: TransferStatus
  accountId: string
  bucket: string
  objectKey: string
  localPath?: string
  totalBytes?: number
  transferredBytes?: number
  progressPercent?: number
  speedBytesPerSecond?: number
  estimatedRemainingSeconds?: number
  errorMessage?: string
  createdAt: string
  updatedAt: string
}
```

## 8. 错误处理

### 8.1 常见错误

| 场景           | 用户提示                         | 处理方式                       |
| -------------- | -------------------------------- | ------------------------------ |
| 网络不可用     | 网络连接失败，请检查网络后重试   | 提供重试入口，记录网络错误     |
| 认证失败       | 凭证无效，请检查 Access Key 配置 | 引导用户编辑账户并重新测试连接 |
| 权限不足       | 当前账户没有执行该操作的权限     | 展示操作类型和目标对象         |
| 对象不存在     | 文件可能已被删除或移动           | 提供刷新列表入口               |
| 传输中断       | 传输失败，可稍后重试             | 保留任务记录和失败原因         |
| 本地路径不可写 | 无法写入所选目录，请更换保存路径 | 重新打开目录选择器             |
| 服务商限流     | 请求过于频繁，请稍后重试         | 指数退避重试并提示用户         |

### 8.2 处理原则

- 用户提示使用明确、可执行的语言。
- 技术细节写入脱敏日志，不直接暴露给普通用户。
- 可恢复错误提供重试，不可恢复错误说明原因。
- 批量操作允许部分成功，并清楚展示失败项。

## 9. 项目结构建议

```text
oss-assistant/
├── electron/
│   ├── main/
│   │   ├── index.ts
│   │   ├── window.ts
│   │   ├── ipc/
│   │   ├── services/
│   │   │   ├── account-service.ts
│   │   │   ├── storage-service.ts
│   │   │   ├── transfer-service.ts
│   │   │   └── credential-service.ts
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
│   ├── components/
│   │   ├── ui/
│   │   ├── account/
│   │   ├── bucket/
│   │   ├── file-list/
│   │   └── transfer/
│   ├── hooks/
│   ├── lib/
│   ├── stores/
│   ├── styles/
│   └── types/
├── tests/
│   ├── unit/
│   ├── component/
│   └── e2e/
├── docs/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── components.json
└── README.md
```

## 10. 开发里程碑

### 10.1 阶段一：应用基础框架（Week 1-2）

- 初始化 Electron + Vite + React + TypeScript 项目。
- 配置 Tailwind CSS、shadcn/ui、主题变量和基础布局。
- 建立主进程、预加载脚本、渲染进程的类型化 IPC 通道。
- 完成窗口管理、应用菜单、基础设置存储。

### 10.2 阶段二：账户与安全能力（Week 3-4）

- 实现账户 CRUD。
- 实现凭证加密存储和脱敏展示。
- 实现连接测试。
- 建立云服务 Provider 抽象接口。

### 10.3 阶段三：七牛云与文件浏览（Week 5-6）

- 完成七牛云 Provider。
- 实现存储桶列表、对象列表、路径导航和刷新。
- 实现文件列表 UI、空状态、错误状态和加载状态。
- 完成基础日志和诊断信息。

### 10.4 阶段四：文件传输与任务中心（Week 7-8）

- 实现上传、下载、删除。
- 实现任务队列、进度展示、取消和失败重试。
- 支持批量操作和拖拽上传。
- 补齐主要异常场景处理。

### 10.5 阶段五：多云扩展与发布准备（Week 9-10）

- 完成阿里云 OSS 或 AWS S3 Provider。
- 完成跨平台打包配置。
- 完成关键路径测试和安装包验证。
- 整理用户文档、发布说明和 MVP 验收报告。

## 11. 验收标准

### 11.1 功能验收

- 支持添加、编辑、删除和测试云服务账户。
- 支持七牛云完整浏览和基础文件操作。
- 至少支持一个额外云服务商或 S3 兼容服务。
- 支持上传、下载、删除、刷新和批量选择。
- 支持任务中心展示上传/下载进度条、传输速度、预计剩余时间、失败原因和重试入口。

### 11.2 体验验收

- 新用户能在 5 分钟内完成账户添加和首次上传。
- 核心操作不超过 3 次点击。
- 空状态、错误状态、加载状态完整。
- 亮色和暗色主题均可用。
- 常用快捷键和右键菜单可用。

### 11.3 质量验收

- TypeScript 严格模式无类型错误。
- ESLint 和 Prettier 检查通过。
- 核心服务和 Provider 抽象有单元测试。
- 账户表单、文件列表、任务中心有组件测试。
- 账户添加到文件上传的关键路径有端到端测试。
- 生产包在 Windows、macOS、Linux 至少各完成一次冒烟验证。

### 11.4 安全验收

- 明文 Secret 不出现在本地持久化文件中。
- 明文 Secret 不出现在日志、诊断包和错误提示中。
- 渲染进程无法直接访问 Node.js API。
- 删除和覆盖操作均有二次确认。

## 12. 风险与应对

### 12.1 多云 API 差异

不同服务商在鉴权、分片上传、目录前缀、分页和元数据字段上存在差异。

应对措施：

- 抽象统一的 `StorageProvider` 接口。
- 每个 Provider 保留服务商特定配置和错误映射。
- 以七牛云为首个完整实现，再用第二个服务商验证抽象合理性。

### 12.2 Electron 安全风险

桌面应用同时具备 Web UI 和本地系统能力，若边界不清晰会放大安全风险。

应对措施：

- 严格隔离主进程和渲染进程。
- 最小化 preload API。
- 禁止远程加载不可信页面。
- 对所有 IPC 入参做校验。

### 12.3 大文件传输稳定性

大文件上传和下载可能受到网络波动、服务商限流、本地磁盘权限影响。

应对措施：

- 使用分片上传或服务商推荐的大文件接口。
- 支持失败重试、任务取消和失败原因保留。
- 并发数可配置，并设置合理默认值。

### 12.4 跨平台发布差异

不同系统在路径、权限、签名、公证和自动更新上有差异。

应对措施：

- 发布流程中分别验证 Windows、macOS、Linux 安装包。
- 尽早引入打包和冒烟测试。
- 将平台差异封装在主进程服务中。

## 13. 后续迭代方向

### 13.1 功能增强

- 创建和删除存储桶。
- 文件预览：图片、视频、文本、PDF。
- 高级搜索和过滤。
- 生成临时访问链接或公开链接。
- 批量重命名、复制、移动。
- 操作历史和回收站策略。

### 13.2 效率提升

- 命令面板。
- 常用路径收藏。
- 最近访问账户和存储桶。
- 本地缓存和增量刷新。
- 大目录虚拟滚动优化。

### 13.3 企业能力

- 团队共享配置。
- 审计日志。
- 权限模板。
- 批量账户导入。
- CLI 和自动化脚本接口。

### 13.4 服务商扩展

- 腾讯云 COS。
- 华为云 OBS。
- 百度云 BOS。
- MinIO。
- Cloudflare R2。

## 14. 参考资料

- [Electron Documentation](https://www.electronjs.org/docs/latest)
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)
- [React Documentation](https://react.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Vite Documentation](https://vite.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Documentation](https://ui.shadcn.com/docs)
- [Radix UI Documentation](https://www.radix-ui.com/primitives)
- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [七牛云对象存储文档](https://developer.qiniu.com/kodo)
- [阿里云 OSS Node.js SDK](https://github.com/ali-sdk/ali-oss)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)

## 15. 词汇表

| 术语             | 说明                                             |
| ---------------- | ------------------------------------------------ |
| OSS              | Object Storage Service，对象存储服务             |
| Bucket           | 存储桶，对象存储中的顶级容器                     |
| Object           | 对象，对象存储中的文件或目录前缀                 |
| Prefix           | 前缀，用于模拟目录结构                           |
| Access Key       | 访问密钥，用于云服务 API 认证                    |
| Endpoint         | 服务端点，对象存储 API 的访问地址                |
| IPC              | Inter-Process Communication，Electron 进程间通信 |
| Main Process     | Electron 主进程，负责系统能力和窗口生命周期      |
| Renderer Process | Electron 渲染进程，负责 React 用户界面           |
| Preload          | Electron 预加载脚本，用于安全暴露受控 API        |
| MVP              | Minimum Viable Product，最小可行产品             |
