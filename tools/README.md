# Bundled CLIs (local only — not committed to GitHub)

GitHub rejects files **> 100 MB**. Put binaries here on your machine before `npm run tauri build`:

| Path | Source |
|------|--------|
| `yt-dlp.exe` | [yt-dlp releases](https://github.com/yt-dlp/yt-dlp/releases) (Windows `yt-dlp.exe`) |
| `ffmpeg/bin/ffmpeg.exe` (+ any DLLs your build needs) | [gyan.dev FFmpeg builds](https://www.gyan.dev/ffmpeg/builds/) or [BtbN](https://github.com/BtbN/FFmpeg-Builds/releases) — use a **smaller** build if possible |

Layout:

```
tools/
  yt-dlp.exe
  ffmpeg/
    bin/
      ffmpeg.exe
      ffprobe.exe   # optional, if needed by your ffmpeg build
```

The app resolves these automatically; see root **README.md**.
