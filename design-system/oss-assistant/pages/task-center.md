# Page Override: 任务中心

> Overrides MASTER.md for transfer task panel.

## Layout

- **Component:** shadcn Sheet，从右侧滑出，宽度 480px
- **Header:** 标题 + 清理已完成按钮
- **Filters:** Tabs（全部/上传/下载/删除）+ 状态 Badge 过滤
- **Task List:** 可滚动列表，每项包含：
  - 类型图标（Upload/Download/Trash Lucide）
  - 文件名 + 目标路径
  - 状态 Badge（等待/进行中/成功/失败/已取消）
  - Progress 进度条（上传/下载）
  - 速度 + 预计剩余时间
  - 取消/重试按钮

## Progress Display

```
[████████░░░░░░░░] 52%
128 MB / 245 MB · 2.4 MB/s · 剩余 48s
```

## Colors

| Status | Badge Color     |
| ------ | --------------- |
| 等待中 | `#64748B` slate |
| 进行中 | `#3B82F6` blue  |
| 成功   | `#22C55E` green |
| 失败   | `#EF4444` red   |
| 已取消 | `#94A3B8` muted |
