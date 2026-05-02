# Local Video Downloader

Desktop app (**Tauri 2** + **React 19** + **Rust**) that downloads video and audio using [**yt-dlp**](https://github.com/yt-dlp/yt-dlp) and **ffmpeg**. Works with YouTube, Bilibili, and any other site yt-dlp supports.

> This repository replaces the older **Node.js + Socket.io** prototype that used to live here. The current codebase is the Tauri desktop application only.

---

## Features

- Paste a URL → **Fetch info** (title, duration, uploader, thumbnail, max resolution).
- Formats: **MP4**, **MKV** (under “More formats”), **MP3**, **M4A**; resolution / audio bitrate; optional **time range** clip (`--download-sections`).
- **Queue**: sequential downloads, **pause / resume / cancel**, live log lines.
- **Soft subtitles** (muxed) or optional **burn-in** (ffmpeg re-encode); MP4 remux step helps **VLC** pick embedded subs.
- **Playlist** support (flat metadata; enqueue items).
- Optional **cookie file** (Netscape `.txt` or browser-extension JSON) for YouTube / Bilibili and similar sites.
- **Bilibili thumbnails** in the UI are loaded via an in-app HTTP fetch (correct `Referer`), so previews work behind CDN hotlink rules.
- Windows release can bundle **`tools/yt-dlp.exe`** and **`tools/ffmpeg/bin/`** so users do not need a global install (see [Bundled tools](#bundled-tools)).

---

## Download & install (end users)

1. Open [**Releases**](https://github.com/siautm/yt-downloader/releases) (publish your own builds from `npm run tauri build` if empty).
2. Run **`Local Video Downloader_*_x64-setup.exe`** (NSIS) or install the **MSI**.
3. The installer copies **`tools\yt-dlp.exe`** and **`tools\ffmpeg\bin\`** next to the app when those files were present on the machine that ran `tauri build` (see [Build from source](#build-from-source)).

**Portable use without installer:** copy **`local-video-downloader.exe`** together with the entire **`tools`** folder (same layout as in this repo: `tools\yt-dlp.exe`, `tools\ffmpeg\bin\ffmpeg.exe`, …).

---

## How to use

### 1. First launch

1. **Download folder** — Settings → choose where files should be saved (each PC has its own path; nothing is synced from another computer).
2. **Cookies (optional)** — If sites ask you to sign in or block bots, export cookies to a file and set **YouTube / site cookies** in Settings (the field is used for any site yt-dlp supports with `--cookies`, not only YouTube).
3. Check the header line **yt-dlp: OK · ffmpeg: OK**. Hover it to see which executables were resolved (bundled `tools\…` vs PATH).

### 2. Download a video

1. Paste the page URL (e.g. `https://www.youtube.com/watch?v=…` or `https://www.bilibili.com/video/BV…`).
2. Click **Fetch info** — wait for preview (may take up to ~25s on slow networks).
3. Choose format, resolution, optional subtitle language / clip range.
4. Confirm and **Add to queue** — watch progress and logs in the queue panel.

### 3. Settings that stay on *this* computer only

Cookie path, download directory, defaults, and theme are stored in your **local app config** (Tauri `app_config_dir`). They are **not** inside the installer and **not** migrated to another PC automatically.

---

## Bundled tools (Windows)

If this structure exists **next to the built `local-video-downloader.exe`** (or an ancestor directory while developing), the app prefers it over PATH:

| Path | Purpose |
|------|---------|
| `tools\yt-dlp.exe` | yt-dlp |
| `tools\ffmpeg\bin\ffmpeg.exe` | ffmpeg (merge, burn-in, remux) |

Override environment variables if needed: **`YT_DLP`**, **`FFMPEG`**.

`tauri.conf.json` **bundles** those paths into the NSIS/MSI output so end users get `tools\` without manual copy **when the build machine has the files at `../tools/...` relative to `src-tauri/`**.

---

## Build from source

**Requirements**

- [Node.js](https://nodejs.org/) 18+ (20+ recommended)
- [Rust](https://rustup.rs/) stable + **MSVC** (Visual Studio Build Tools) on Windows
- Before **`npm run tauri build`**, place **`tools/yt-dlp.exe`** and **`tools/ffmpeg/bin/`** (with `ffmpeg.exe` and any required DLLs) under the repo root, or the resource step may fail.

**Commands**

```bash
npm install
npm run tauri dev    # development
npm run tauri build  # release + NSIS + MSI under src-tauri/target/release/bundle/
```

**Checks**

```bash
cd src-tauri && cargo test && cargo check
```

---

## Developer documentation

See **[PROJECT.md](./PROJECT.md)** for module layout, `invoke` command names, yt-dlp flags, cookie conversion behaviour, and handoff notes for contributors.

---

## Replace the old GitHub repo with this project

You cannot “empty” the remote from this workspace without **git**; do the following **on your machine** (from this folder after `git` is configured).

### One-time: initialize git here

```powershell
cd c:\Users\junyi\project\yt
git init
git add .
git commit -m "Initial commit: Local Video Downloader (Tauri + yt-dlp)"
git branch -M main
```

### Connect to `siautm/yt-downloader` and push

If the GitHub repo **already has commits** you want to **fully replace** with this tree:

```powershell
git remote add origin https://github.com/siautm/yt-downloader.git
git push -u origin main --force
```

Use **`--force` only when** you intend to overwrite `main` on GitHub (collaborators and old history will be replaced). If the repo is **empty** or you use a **new branch**, a normal `git push -u origin main` is enough.

**Authentication:** GitHub no longer accepts account passwords for `git push`; use a [**Personal Access Token**](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) (HTTPS) or **SSH keys**.

### Optional: GitHub Releases

After a successful `npm run tauri build`, upload:

- `src-tauri\target\release\bundle\nsis\Local Video Downloader_0.1.0_x64-setup.exe`
- `src-tauri\target\release\bundle\msi\Local Video Downloader_0.1.0_x64_en-US.msi`

…and tag the commit (e.g. `v0.1.0`).

---

## Repository layout (short)

| Path | Role |
|------|------|
| `src/` | React UI (Vite, Tailwind 4) |
| `src-tauri/` | Tauri config, Rust (`queue`, `ytdlp`, `ffmpeg_burn`, `thumb_proxy`, …) |
| `tools/` | Optional local **yt-dlp** + **ffmpeg** binaries (Windows layout above) |

---

## Legal

Respect copyright and the terms of the sites you download from. This software is a frontend for **yt-dlp**; you are responsible for how you use it.

---

## Links

- Upstream extractor: [yt-dlp](https://github.com/yt-dlp/yt-dlp)  
- Shell: [Tauri 2](https://v2.tauri.app/)
