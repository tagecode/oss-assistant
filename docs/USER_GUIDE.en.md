# OSS Assistant — User Guide

[中文用户指南](USER_GUIDE.md)

## Getting started

### 1. Install the app

Download the installer for your platform from the [Releases](https://github.com/tagecode/oss-assistant/releases) page:

- Windows: `oss-assistant-v{version}-win-x64-setup.exe`
- macOS: `oss-assistant-v{version}-mac-{arch}.dmg`
- Linux: `oss-assistant-v{version}-linux-{arch}.AppImage`

### 2. Add a cloud account

1. After launching the app, click **Add account**
2. Enter the account name, provider, Access Key ID, and Secret Key (use **Show** to temporarily reveal what you type)
3. Fill in the region or endpoint as required by your provider
4. Click **Test connection** to verify the credentials
5. Click **Save**

Supported providers:

| Provider           | Required fields                                      |
| ------------------ | ---------------------------------------------------- |
| Qiniu Kodo         | Access Key, Secret Key, region (z0 / z1 / z2)        |
| Alibaba Cloud OSS  | AccessKey ID, Secret, region                         |
| AWS S3             | Access Key ID, Secret, region                        |
| S3-compatible      | Access Key, Secret, endpoint, region                 |

### 3. Browse files

1. Select an account in the left sidebar
2. Choose a bucket
3. Double-click a folder to open it
4. Use the breadcrumb bar to go up a level

### 4. Upload files

- Click **Upload** on the toolbar to pick local files
- Or drag files into the file list area
- Track progress in the bottom status bar and the task center

### 5. Download files

1. Select the files you want to download
2. Click **Download** on the toolbar or choose **Download** from the context menu
3. Choose a local folder to save to

### 6. Delete files

1. Select the objects to delete
2. Click **Delete** or press `Delete`
3. Review the list in the confirmation dialog, then confirm

## Keyboard shortcuts

| Shortcut       | Action              |
| -------------- | ------------------- |
| `Ctrl/Cmd + U` | Upload              |
| `Ctrl/Cmd + D` | Download            |
| `Delete`       | Delete selection    |
| `F5`           | Refresh current dir |

## Task center

Open or close the task center sidebar in either way:

- Click the task list icon in the top bar (a badge shows the count when tasks are running)
- Click the task summary in the bottom status bar

In the task center you can:

- View upload/download progress, speed, and estimated time remaining
- See task status: queued, running, success, failed, cancelled
- Cancel running tasks
- Retry failed tasks
- Clear completed records

## Settings

Open **Settings** from the icon in the top-right corner to configure:

- Theme: system / light / dark
- Default download path
- Upload/download concurrency (1–10)
- Operation log retention (days)
- Auto-check for updates

## Help & diagnostics

Open **Help** from the icon in the top-right corner to:

- Read common error explanations
- View provider setup guides
- Export redacted diagnostic logs (for troubleshooting)

## Security

- Credentials are stored locally using OS encryption—not in plaintext
- Diagnostic logs and error messages are redacted
- Rotate your cloud Access Keys regularly

## FAQ

**Connection test failed?**
Verify the Access Key, that the region matches your bucket, and that the network can reach the provider.

**Uploads are slow?**
Increase concurrency in Settings; also check your network and provider rate limits.

**No buckets listed?**
Ensure the account has permission to list and read the buckets you expect.
