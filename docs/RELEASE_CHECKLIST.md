# OSS 助手 - 发布检查清单

## 构建前

- [ ] `pnpm typecheck` 通过
- [ ] `pnpm lint` 无 error
- [ ] `pnpm test` 单元测试和组件测试通过
- [ ] `pnpm build` 生产构建成功
- [ ] 版本号已在 `package.json` 更新

## 安全验证

- [ ] 本地 `accounts.json` 不含明文 Secret
- [ ] 凭证文件 `credentials/vault.json` 为加密内容
- [ ] 导出诊断包不含明文 Secret
- [ ] 渲染进程无法访问 Node.js API（`contextIsolation` 开启）

## 功能冒烟（每平台）

- [ ] 应用可正常启动
- [ ] 添加账户 + 连接测试
- [ ] 浏览存储桶和文件列表
- [ ] 上传单文件（含拖拽）
- [ ] 下载单文件，进度条正常
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

### macOS 12+

- [ ] DMG 可挂载安装
- [ ] Gatekeeper 提示可处理（如需公证需额外配置）
- [ ] 下载到用户目录权限正常

### Ubuntu 20.04+ / Linux

- [ ] AppImage 可执行
- [ ] deb 包可安装（如生成）

## E2E 测试（本地 / 发版前手动，CI 不跑）

```bash
pnpm build
pnpm exec playwright install --with-deps
E2E_MOCK_CLOUD=1 pnpm test:e2e
```

- [ ] `app-launch.spec.ts` 通过

## GitHub Actions

- [ ] `CI` workflow（push/PR）与 `Build & Release` 的 **Verify** 阶段步骤一致
- [ ] 打 tag `v*` 后 Release 产物已上传至 GitHub Releases

## 发布产物

- [ ] 安装包已上传至发布渠道
- [ ] Release Notes 已编写
- [ ] `docs/USER_GUIDE.md` 与版本功能一致
- [ ] GitHub Release 包含自动更新元数据（`latest.yml` / `latest-mac.yml` / `latest-linux.yml` 及 `.blockmap`）
- [ ] `electron-builder.yml` 中 `publish` 指向 `tagecode/oss-assistant`

## 回滚预案

- [ ] 保留上一版本安装包
- [ ] 确认用户数据目录独立（`userData`），升级不覆盖账户配置
