# Page Override: 添加/编辑账户

> Overrides MASTER.md for account form dialog.

## Layout

- **Component:** shadcn Dialog, max-width 520px
- **Sections:**
  1. 基本信息：账户名称、服务商类型
  2. 凭证信息：Access Key ID、Secret Key（密码输入）
  3. 高级配置：区域、Endpoint、路径样式访问（可折叠）
  4. 操作区：测试连接 + 保存/取消

## Form Fields

| Field         | Type                              | Required   |
| ------------- | --------------------------------- | ---------- |
| 账户名称      | Input                             | ✓          |
| 服务商        | Select (七牛云/阿里云/AWS/S3兼容) | ✓          |
| Access Key ID | Input                             | ✓          |
| Secret Key    | Password Input                    | ✓          |
| 区域          | Input                             | 按服务商   |
| Endpoint      | Input                             | S3兼容必填 |

## States

- 测试连接中：按钮 loading + 禁用表单
- 测试成功：绿色 Alert + 勾选图标
- 测试失败：红色 Alert + 重试入口
- 字段错误：Input 红色边框 + 字段下方错误文案

## Security UX

- Secret Key 默认隐藏，提供显示/隐藏切换
- 编辑时 Secret 显示为 "••••••••" 占位，不预填明文
