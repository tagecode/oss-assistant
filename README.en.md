# OSS Assistant

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/tagecode/oss-assistant/actions/workflows/ci.yml/badge.svg)](https://github.com/tagecode/oss-assistant/actions/workflows/ci.yml)

[中文 README](README.md)

A cross-platform desktop app for object storage management. Manage accounts, buckets, and files for Qiniu Kodo, Alibaba Cloud OSS, AWS S3, and S3-compatible services in one place—with upload, download, delete, and transfer progress tracking.

## Features

- **Multi-cloud in one app** — Qiniu Kodo, Alibaba Cloud OSS, AWS S3, S3-compatible storage
- **Account management** — Add, edit, and remove accounts; connection test; credentials encrypted locally
- **File browser** — Bucket list, folder navigation, breadcrumbs, virtual scrolling for large directories
- **File transfers** — Upload (including drag-and-drop), download, delete; multi-select and context menu
- **Task center** — Live progress, speed, and ETA; cancel, retry, and clear completed tasks
- **Settings** — Theme, Chinese/English UI, default download path, transfer concurrency, log retention
- **Help & diagnostics** — Common errors, provider setup guides, redacted diagnostic log export
- **Security** — Renderer isolation, IPC allowlist, no plaintext secrets on disk

## Supported platforms

| Platform      | Package format              |
| ------------- | --------------------------- |
| Windows 10/11 | `.exe` (NSIS installer)     |
| macOS 12+     | `.dmg`                      |
| Linux         | `.AppImage`, `.deb`         |

## Download

Get installers for your platform from [Releases](https://github.com/tagecode/oss-assistant/releases).

| Platform | Example filename                              |
| -------- | --------------------------------------------- |
| Windows  | `oss-assistant-v1.0.0-win-x64-setup.exe`        |
| macOS    | `oss-assistant-v1.0.0-mac-arm64.dmg`            |
| Linux    | `oss-assistant-v1.0.0-linux-x64.AppImage`       |

For detailed usage, see the [User Guide](docs/USER_GUIDE.en.md).

## Screenshots

<!-- Add screenshots after release -->
<!-- ![Main window](docs/images/screenshot-main.png) -->

## Tech stack

- **Desktop**: Electron + electron-vite
- **Frontend**: React 19, TypeScript, Tailwind CSS, shadcn/ui
- **State & forms**: TanStack Query, Zustand, React Hook Form, Zod
- **Cloud SDKs**: qiniu, ali-oss, @aws-sdk/client-s3
- **Testing**: Vitest, Testing Library, Playwright
- **Packaging**: electron-builder

## Development

### Requirements

- Node.js 20+
- pnpm 9+

### Install dependencies

```bash
pnpm install
```

### Run locally

```bash
pnpm dev
```

### Build

```bash
# Typecheck + production build
pnpm build

# Platform packages (run build first)
pnpm build:win    # Windows
pnpm build:mac    # macOS
pnpm build:linux  # Linux
```

### Code quality

```bash
pnpm typecheck   # TypeScript
pnpm lint        # ESLint
pnpm format      # Prettier
```

### Tests

```bash
pnpm test              # Unit + component tests (runs in CI)
pnpm test:unit         # Main-process unit tests only
pnpm test:component    # Renderer component tests only
```

**CI pipeline**: typecheck → unit/component tests → production build (E2E not included).

**E2E (local / before release, manual)**:

```bash
pnpm build
pnpm exec playwright install --with-deps
E2E_MOCK_CLOUD=1 pnpm test:e2e
```

See [tests/e2e/README.md](tests/e2e/README.md) for details.

## Project layout

```text
oss-assistant/
├── src/
│   ├── main/           # Electron main process: IPC, services, cloud providers
│   ├── preload/        # Preload script and typed API
│   ├── renderer/       # React UI
│   └── shared/         # Types shared by main and renderer
├── tests/
│   ├── unit/           # Unit tests
│   ├── component/      # Component tests
│   └── e2e/            # Playwright end-to-end tests
├── .github/workflows/  # CI and release workflows
└── docs/               # Product docs and user guide
```

## Auto-update

The app uses [electron-updater](https://www.electron.build/auto-update) to check and download updates from GitHub Releases:

- Update feed: `https://github.com/tagecode/oss-assistant/releases`
- Config: `electron-builder.yml` and `dev-app-update.yml` (`provider: github`)
- With “Auto-check for updates” enabled in Settings, the app checks for new releases on startup

> macOS auto-update requires `.zip` packages and `latest-mac.yml` on the Release; CI uploads these with each build.

## Release

Push a tag that matches `package.json` to trigger GitHub Actions build and publish:

```bash
git tag v1.0.0
git push origin v1.0.0
```

See [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md) before releasing.

## Security

- Cloud credentials are stored locally using OS encryption—not written in plaintext to config files
- The renderer talks to the main process only through allowlisted preload APIs; it cannot access Node.js directly
- Exported diagnostic logs are redacted and do not contain Access Key / Secret Key values
- Protect the app data directory on your machine and rotate cloud access keys regularly

## Contributing

Issues and pull requests are welcome. Before submitting:

1. Ensure `pnpm typecheck`, `pnpm lint`, and `pnpm test` all pass
2. Add tests for new features or fixes when applicable
3. Follow existing code style and project structure

## Documentation

- [User Guide](docs/USER_GUIDE.en.md)
- [Release checklist](docs/RELEASE_CHECKLIST.md)
- [Changelog](CHANGELOG.md)

## License

This project is licensed under the [MIT License](LICENSE).
