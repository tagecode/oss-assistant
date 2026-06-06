# Changelog

本项目的所有重要变更均记录于此文件。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

## [1.0.0] - 2026-06-05

首个正式版本，交付跨平台桌面对象存储管理 MVP。

### Added

- **多云账户管理**：添加、编辑、删除账户，连接测试；凭证本地加密存储
- **云服务商支持**：七牛云 Kodo、阿里云 OSS、AWS S3、S3 兼容存储
- **存储桶浏览**：列出账户可访问的存储桶，展示名称、区域、创建时间
- **文件浏览**：按前缀模拟目录，面包屑导航、返回上级、刷新、虚拟滚动列表
- **文件操作**：上传（含拖拽）、下载、删除，支持多选与右键菜单
- **对象属性**：查看文件大小、存储类型、修改时间等元数据
- **任务中心**：上传/下载/删除任务队列，展示进度、速度、剩余时间，支持取消、重试与清理已完成记录
- **设置**：主题（跟随系统/亮色/暗色）、语言（中文/英文/跟随系统）、默认下载路径、传输并发数、日志保留天数、自动检查更新
- **帮助与诊断**：常见错误说明、服务商配置指引、脱敏诊断日志导出
- **安全基线**：`contextIsolation` 开启、`nodeIntegration` 关闭、IPC 白名单、日志脱敏
- **质量保障**：TypeScript 严格模式、ESLint、Prettier、单元/组件测试、Playwright E2E 测试
- **CI/CD**：GitHub Actions 持续集成与按 tag 自动构建多平台安装包（Windows / macOS / Linux）

### Security

- Access Key 与 Secret 不以明文写入本地持久化文件
- 诊断日志与错误提示经过脱敏处理，不包含明文密钥

[Unreleased]: https://github.com/tagecode/oss-assistant/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/tagecode/oss-assistant/releases/tag/v1.0.0
