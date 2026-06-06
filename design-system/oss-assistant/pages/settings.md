# Page Override: 设置

> Overrides MASTER.md for settings page.

## Layout

- **Pattern:** 左侧导航 + 右侧内容区（或单页分组卡片）
- **Groups:**
  1. 外观：主题（跟随系统/亮色/暗色）
  2. 语言：中文/英文
  3. 传输：默认下载路径、并发数
  4. 日志：保留天数
  5. 更新：自动检查更新开关
  6. 关于：版本号、平台、Electron 版本

## Components

- 主题：Radio group with preview swatches
- 路径选择：Input + 浏览按钮
- 并发数：Slider (1-10) + 数值显示
- 开关：shadcn Switch
- 保存：底部固定保存按钮

## Visual

- 分组卡片间距 24px
- 每组标题 14px semibold，描述 12px muted
- 设置项行高 48px，label 左对齐，控件右对齐
