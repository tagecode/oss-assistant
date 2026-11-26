# OSS 助手 - 发布检查清单

## 构建前

- [ ] `pnpm typecheck` 通过
- [ ] `pnpm lint` 无 error（CI Verify 阶段已包含）
- [ ] `pnpm test` 单元测试和组件测试通过
- [ ] `pnpm build` 生产构建成功
- [ ] 版本号已在 `package.json` 更新

## 安全验证

- [ ] 本地 `accounts.json` 不含明文 Secret
- [ ] 凭证文件 `credentials/vault.json` 为加密内容
- [ ] 无密钥环的 Linux 上默认**无法**保存账户并给出提示，「改用内存密钥保存」仅在用户显式勾选后生效
- [ ] 导出诊断包不含明文 Secret
- [ ] 渲染进程无法访问 Node.js API（`contextIsolation` 开启）

## 功能冒烟（每平台）

- [ ] 应用可正常启动
- [ ] 添加账户 + 连接测试
- [ ] 浏览存储桶和文件列表
- [ ] 上传单文件（含拖拽）
- [ ] 拖动标题栏可移动窗口，双击标题栏可最大化/还原
- [ ] 最小化、最大化/还原、关闭按钮行为正确，关闭后应用行为符合平台
- [ ] 设置/帮助/账户弹窗的关闭按钮可点击，长内容可在弹窗内滚动
- [ ] 上传 ≥100MB 大文件（走分片路径），完成后远端大小与本地一致
- [ ] 大文件上传中途取消，任务立即变为「已取消」，远端无残留分片
- [ ] 断网后上传失败，恢复网络点「重试」从已传分片继续，而不是从头开始
- [ ] 任务中心按状态筛选（成功/失败/进行中）结果正确
- [ ] 下载单文件，进度条正常
- [ ] 下载默认落到上次使用的目录，按住 `Shift` 点击「下载」可重新选择目录
- [ ] 删除文件，二次确认生效
- [ ] 任务中心显示进度/速度/剩余时间
- [ ] 设置保存后重启仍生效
- [ ] 诊断日志可导出

## 跨平台打包

```bash
# Windows
pnpm build:win

# macOS
pnpm build:mac

# Linux
pnpm build:linux
```

### Windows 10/11

- [ ] 安装包可安装
- [ ] 首次启动无报错
- [ ] 文件选择器、下载路径正常
- [ ] 窗口边缘可缩放；Windows 11 贴靠布局/多显示器 DPI 表现符合预期
- [ ] 未签名构建的 SmartScreen 提示已在 [未签名构建说明](UNSIGNED_BUILD.md) 和 Release notes 中说明

### macOS 12+

- [ ] DMG 可挂载安装
- [ ] 未签名构建的 Gatekeeper 提示可处理，且已在 [未签名构建说明](UNSIGNED_BUILD.md) 和 Release notes 中说明
- [ ] 自动更新失败时，手动下载 DMG 覆盖安装的路径可用
- [ ] 下载到用户目录权限正常
- [ ] 自定义窗口按钮、全屏/缩放行为符合预期

### Ubuntu 20.04+ / Linux

- [ ] AppImage 可执行
- [ ] deb 包可安装（如生成）
- [ ] 窗口边缘可缩放（GNOME/KDE），标题栏拖动与按钮行为正常

## E2E 测试（CI 已自动运行）

`Verify` 阶段会执行完整 E2E，发版前无需手动跑。以下命令用于本地复现：

```bash
pnpm build
pnpm exec playwright install-deps chromium
E2E_MOCK_CLOUD=1 pnpm test:e2e
# 无头 Linux：bash scripts/ci-run-e2e.sh
```

- [ ] CI 的 E2E 步骤通过（8 个 spec）
- [ ] 若 E2E 失败，下载构建产物中的 `e2e-report`（含 trace 与 HTML 报告）定位问题

## GitHub Actions

- [ ] `CI` workflow（push/PR）与 `Build & Release` 的 **Verify** 阶段步骤一致
- [ ] 打 tag `v*` 后 Release 产物已上传至 GitHub Releases

## 发布产物

- [ ] 安装包已上传至发布渠道
- [ ] Release Notes 已编写
- [ ] `docs/USER_GUIDE.md` 与版本功能一致
- [ ] GitHub Release 包含自动更新元数据（`latest.yml` / `latest-mac.yml` / `latest-linux.yml` / `latest-linux-arm64.yml` 及 `.blockmap`）
- [ ] `latest-mac.yml` 同时包含 x64 与 arm64 产物；Linux 各架构有对应 yml，且条目指向本架构安装包
- [ ] `electron-builder.yml` 中 `publish` 指向 `tagecode/oss-assistant`

## 回滚预案

- [ ] 保留上一版本安装包
- [ ] 确认用户数据目录独立（`userData`），升级不覆盖账户配置
