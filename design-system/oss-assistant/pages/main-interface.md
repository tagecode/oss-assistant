# Page Override: 主界面

> Overrides MASTER.md for the main file browser layout.

## Layout

- **Pattern:** 三栏桌面布局（账户侧栏 + 存储桶侧栏 + 文件列表主区）
- **Window:** 最小宽度 1024px，推荐 1280×800
- **Structure:**
  - 顶栏：应用标题、命令面板入口（⌘K）、设置、帮助
  - 左栏 1（200px）：账户列表，带连接状态指示点
  - 左栏 2（220px）：存储桶列表
  - 主区：面包屑 + 工具栏 + 文件表格
  - 底栏：任务摘要 + 连接状态

## Colors (Dark Mode Default)

| Element          | Value                        |
| ---------------- | ---------------------------- |
| Sidebar bg       | `#1E293B`                    |
| Main bg          | `#0F172A`                    |
| Border           | `#334155`                    |
| Active item      | `#22C55E` accent left border |
| Status connected | `#22C55E`                    |
| Status error     | `#EF4444`                    |

## Components

- Sidebar: shadcn Sidebar
- File list: shadcn Table with checkbox column
- Toolbar: Button group (上传/下载/删除/刷新)
- Breadcrumb: custom with Lucide ChevronRight
- Status bar: fixed bottom, 32px height

## Interactions

- 双击文件夹进入下级
- 右键菜单：上传、下载、删除、复制路径
- 选中文件后工具栏显示已选数量
- 拖拽文件到主区触发上传
