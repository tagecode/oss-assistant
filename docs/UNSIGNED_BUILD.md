# 未签名构建说明

本项目是开源项目，发布包**没有做代码签名，也没有做 Apple 公证**。所有安装包由 GitHub Actions 从本仓库源码构建，并发布在 [GitHub Releases](https://github.com/tagecode/oss-assistant/releases)。

请只从官方 Releases 页面下载安装包，不要使用来源不明的转载包。

## macOS

### 首次打开

未签名应用首次打开时，macOS 会提示“无法打开，因为 Apple 无法检查其是否包含恶意软件”或“无法验证开发者”。

处理方式：

1. 先尝试正常打开应用；如果被拦截，打开「系统设置 → 隐私与安全性」；
2. 在「安全性」区域找到被拦截的应用提示，点击「仍要打开」；
3. 输入系统密码确认，然后再次点击「打开」。

macOS 12–14 也可以按住 Control 点击应用图标，选择「打开」，再在弹窗中确认「打开」。

不要为了运行应用而全局关闭 Gatekeeper。应用只需要在首次启动时确认一次。

### 自动更新

macOS 的自动更新依赖系统对应用签名的校验。未签名构建的自动更新**可能失败**。如果设置中提示更新失败，或更新后无法启动：

1. 从 Releases 页面下载最新 `.dmg`；
2. 将应用拖入「应用程序」覆盖旧版本；
3. 用户数据（账户、设置）保存在系统用户目录，覆盖安装不会删除。

## Windows

### 首次运行

未签名程序可能触发 SmartScreen「Windows 已保护你的电脑」，发布者显示为“未知发布者”。

处理方式：

1. 点击提示中的「更多信息」；
2. 点击「仍要运行」。

如果安装包被浏览器标记为不常见下载，请在确认文件来自本项目 Releases 后选择保留。

### 自动更新

Windows 更新包通过 HTTPS 从 GitHub Releases 下载，并按 `latest.yml` 中的 SHA-512 校验完整性。未签名不会阻止哈希校验，但 SmartScreen 仍可能对新的安装包给出提示。如果自动更新失败，请手动下载最新安装包覆盖安装。

## Linux

AppImage 下载后需要添加可执行权限：

```bash
chmod +x oss-assistant-v*-linux-*.AppImage
./oss-assistant-v*-linux-*.AppImage
```

deb 包可使用软件中心安装，或执行：

```bash
sudo apt install ./oss-assistant-v*-linux-*.deb
```

Linux 不会像 macOS/Windows 那样对未签名应用给出系统级拦截提示。请自行确认下载来源。

## 安全说明

未签名意味着系统无法通过证书验证发布者身份。建议：

- 只从本项目的 GitHub Releases 下载；
- 核对 Release 的 tag 与源码提交；
- 对安全敏感的环境，直接从源码构建（见 README 的开发说明）。

## 为什么不做签名

代码签名和 Apple 公证需要持续购买开发者证书、维护签名流水线，对个人开源项目是一笔固定开销。本项目选择不签名，并在文档中明确说明影响；功能和安全更新仍会正常发布。
