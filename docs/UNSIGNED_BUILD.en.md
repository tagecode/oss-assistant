# Unsigned build notice

This is an open-source project. Release packages are **not code-signed and not notarized by Apple**. Every installer is built by GitHub Actions from this repository and published on [GitHub Releases](https://github.com/tagecode/oss-assistant/releases).

Download only from the official Releases page, not from third-party mirrors.

## macOS

### First launch

Because the app is unsigned, macOS may show “Apple could not verify … is free of malware” or “cannot be opened because the developer cannot be verified”.

To open it:

1. Try to open the app normally. If macOS blocks it, open **System Settings → Privacy & Security**;
2. In the **Security** section, find the blocked-app notice and click **Open Anyway**;
3. Authenticate with your password, then click **Open** again.

On macOS 12–14, you can also Control-click the app and choose **Open**, then confirm **Open** in the dialog.

Do not disable Gatekeeper globally. The app only needs one confirmation on first launch.

### Auto-update

macOS auto-updates rely on the system validating the app's code signature. Auto-update **may fail** for unsigned builds. If an update fails or the app will not start after updating:

1. Download the latest `.dmg` from Releases;
2. Drag the app into **Applications**, replacing the old version;
3. User data (accounts and settings) lives in the system user directory and is kept across reinstalls.

## Windows

### First run

An unsigned installer may trigger SmartScreen's “Windows protected your PC” warning, with the publisher shown as “Unknown publisher”.

To continue:

1. Click **More info**;
2. Click **Run anyway**.

If your browser flags the download as uncommon, keep it only after confirming it came from this project's Releases page.

### Auto-update

Windows update packages are downloaded over HTTPS from GitHub Releases and verified against the SHA-512 in `latest.yml`. Being unsigned does not block the hash check, but SmartScreen may still warn about a new installer. If auto-update fails, download the latest installer manually.

## Linux

Make the AppImage executable before running it:

```bash
chmod +x oss-assistant-v*-linux-*.AppImage
./oss-assistant-v*-linux-*.AppImage
```

Install the deb package with your software center, or:

```bash
sudo apt install ./oss-assistant-v*-linux-*.deb
```

Linux does not show the same system-level unsigned-app warning as macOS/Windows. Verify the download source yourself.

## Security notes

Without a signature, the operating system cannot verify the publisher's identity. We recommend:

- downloading only from this project's GitHub Releases;
- checking the Release tag against the source commit;
- building from source in security-sensitive environments (see the README development instructions).

## Why the project does not sign

Code signing and Apple notarization require ongoing certificate costs and a signing pipeline. For a personal open-source project that is a recurring expense, so the project ships unsigned builds and documents the impact instead. Functional and security updates are still released normally.
