# Local Video Downloader — Project Documentation

> **Purpose:** Handoff doc for new chat sessions. This app is a **Tauri 2 + React + TypeScript** desktop GUI around **yt-dlp** and **ffmpeg** on Windows (paths assumed portable to other OSes with minor changes).

---

## 1. What it does

- Paste a video URL (YouTube, etc.) → **Fetch info** (`yt-dlp -J`) → preview title/thumbnail/duration.
- Choose **MP4 / MP3 / M4A**, resolution or audio kbps, optional **time clip** (`--download-sections`).
- **Queue**: sequential downloads; **pause / resume / cancel**; progress from yt-dlp stderr lines.
- **Settings**: download folder, filename template, defaults; optional **YouTube cookie file** (`--cookies`, see §5).
- **Playlist**: flat playlist fetch for metadata; optional enqueue all or per item.

---

## 2. Tech stack

| Layer | Technology |
|--------|------------|
| UI | React 19, Vite 7, TypeScript |
| Shell | Tauri 2 (Rust) |
| Plugins | `opener`, `dialog`, `notification` (JS + Rust) |
| Core CLIs | `yt-dlp`, `ffmpeg` on **PATH**; optional env **`YT_DLP`** = full path to `yt-dlp.exe` |

---

## 3. Repo layout (important files)

```
src/                    # React UI
  App.tsx               # Main UI, settings, queue, fetch, events
  types.ts              # TS mirrors of payloads / settings
src-tauri/
  src/
    lib.rs              # Tauri commands, settings JSON path, fetch_* invokes
    models.rs           # AppSettings, DownloadOptions, QueueTask, serde + camelCase
    queue.rs            # Worker thread, sequential queue, child process, events
    ytdlp.rs            # yt-dlp args, progress regex, fetch_info_json heuristics
    cookie_convert.rs   # JSON → Netscape for `--cookies`, loose JSON parse
  capabilities/default.json   # permissions: core, opener, dialog, notification
  tauri.conf.json
```

---

## 4. Run / build

**Prerequisites:** Rust + MSVC (Windows), **yt-dlp** and **ffmpeg** on PATH (or `YT_DLP`).

```bash
npm install
npm run tauri dev        # dev
npm run tauri build      # release
```

`cargo check` runs in `src-tauri/`.

---

## 5. Cookies / anti-bot

### Settings (file only)

- **Upload YouTube cookies** → `cookies_youtube_file` (Netscape `.txt` or extension JSON; JSON is converted to a temp Netscape file for yt-dlp).
- There is **no** `--cookies-from-browser` in the app; use an exported file only.

### Path → yt-dlp (`cookie_convert::resolve_cookies_path_for_ytdlp`)

- Non-empty path → `--cookies` to that file (`.json` converted to temp Netscape).
- Empty path → no `--cookies`.

### JSON → Netscape (`cookie_convert.rs`)

- Top-level `[{...}]` or `{ "cookies": [...] }`, loose parse for trailing junk, `HttpOnly` → `#HttpOnly_` prefix.
- Old settings key `cookiesFile` maps to `cookies_youtube_file` via serde alias.

---

## 6. yt-dlp invocation details

### Metadata fetch (`fetch_info_json` in `ytdlp.rs`)

- `--socket-timeout 25`, `--retries 2`
- **Playlist page** (`playlist?list=`): `--flat-playlist` to avoid huge `-J`.
- **Watch URL with `list=`:** `--no-playlist` for single-video metadata.
- Commands run in **`spawn_blocking`** (`lib.rs`) so the UI thread is not blocked for the whole subprocess.

### Download args (`build_ytdlp_args`)

- `-o` = `download_dir / template`
- MP4: merged `bestvideo`/`bestaudio` (AAC-friendly), `--merge-output-format mp4`, optional `Merger+ffmpeg` AAC encode (see `ytdlp.rs`)
- Audio: `-x`, `--audio-format`, `--audio-quality …K`
- Optional `--download-sections "*start-end"` when both times set
- Progress: `--newline --progress` (stderr parsed in `queue.rs`)

### Windows

- Subprocess: `CREATE_NO_WINDOW` (0x08000000) on `Command` where used.
- `lib.rs` `fetch_playlist_entries_blocking` needs `use std::os::windows::process::CommandExt` for `creation_flags`.

---

## 7. Tauri commands (invoke names, camelCase from frontend)

| Command | Role |
|---------|------|
| `load_settings` / `save_settings` | `app_config_dir/settings.json` |
| `fetch_media_json` | args: `url`, `cookiesYoutubeFile` |
| `fetch_playlist_entries` | args: `url`, `limit`, `cookiesYoutubeFile` |
| `tooling_status` | yt-dlp / ffmpeg presence |
| `enqueue_downloads` | `tasks: NewTaskPayload[]` |
| `queue_snapshot` | full queue |
| `cancel_task` / `pause_task` / `resume_task` | by `id` |

**Events (listen):** `queue:update`, `task:log`, `task:progress`, `task:completed` (notification from JS on completed).

---

## 8. Known limitations / ops notes

- **YouTube “Sign in / bot”:** depends on yt-dlp version, cookie freshness, IP, and **PO tokens** — see [PO Token Guide](https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide). App does not embed a PO provider; optional cookie **file** only (no browser DB mode).
- **Rust not in PATH** on first setup: user must install Rust before `tauri dev` works.
- **Completed task `filePath`:** currently stores **download directory**, not the final filename (template decides name on disk).

---

## 9. Product / bundle identifiers

- `package.json` name: `local-video-downloader`
- Tauri `identifier`: `com.junyi.local-video-downloader`
- Rust crate / lib: `local-video-downloader` / `local_video_downloader_lib`

---

## 10. Quick “new chat” prompt (copy-paste)

```
Read c:\Users\junyi\project\yt\PROJECT.md for architecture. Stack: Tauri 2 + React + yt-dlp + ffmpeg. Optional YouTube cookie file → `--cookies` (JSON loose-parse); no `--cookies-from-browser`. Continue from there.
```

---

*Last updated to match repo behavior at time of writing; if behavior drifts, update this file in the same PR as code changes.*
