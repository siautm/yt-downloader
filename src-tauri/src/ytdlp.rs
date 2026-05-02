use crate::models::{DownloadOptions, OutputFormat};
use regex::Regex;
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x08000000;

fn apply_no_window(cmd: &mut Command) {
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
}

/// Optional `--cookies` from uploaded YouTube cookie file (`.txt` or `.json` → temp Netscape).
pub fn apply_cookies_file_to_cmd(cmd: &mut Command, cookies_youtube: &str) -> Result<(), String> {
    if let Some(pb) = crate::cookie_convert::resolve_cookies_path_for_ytdlp(cookies_youtube)? {
        cmd.arg("--cookies");
        cmd.arg(pb);
    }
    Ok(())
}

fn cookie_file_prefix_vec(cookies_youtube: &str) -> Result<Vec<String>, String> {
    if let Some(pb) = crate::cookie_convert::resolve_cookies_path_for_ytdlp(cookies_youtube)? {
        return Ok(vec![
            "--cookies".to_string(),
            pb.to_string_lossy().to_string(),
        ]);
    }
    Ok(vec![])
}

/// Walk from the running executable's directory upward and return the first existing
/// `tools/yt-dlp(.exe)` (repo / portable / NSIS layout next to the app).
fn resolve_bundled_ytdlp() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let mut dir = exe.parent()?.to_path_buf();
    for _ in 0..24 {
        #[cfg(windows)]
        let candidate = dir.join("tools").join("yt-dlp.exe");
        #[cfg(not(windows))]
        let candidate = dir.join("tools").join("yt-dlp");
        if candidate.is_file() {
            return Some(candidate);
        }
        let Some(parent) = dir.parent() else {
            break;
        };
        dir = parent.to_path_buf();
    }
    None
}

/// Same search as [`resolve_bundled_ytdlp`] for `tools/ffmpeg/bin/ffmpeg(.exe)` or `tools/ffmpeg(.exe)`.
fn resolve_bundled_ffmpeg() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let mut dir = exe.parent()?.to_path_buf();
    for _ in 0..24 {
        #[cfg(windows)]
        {
            let nested = dir.join("tools").join("ffmpeg").join("bin").join("ffmpeg.exe");
            if nested.is_file() {
                return Some(nested);
            }
            let flat = dir.join("tools").join("ffmpeg.exe");
            if flat.is_file() {
                return Some(flat);
            }
        }
        #[cfg(not(windows))]
        {
            let nested = dir.join("tools").join("ffmpeg").join("bin").join("ffmpeg");
            if nested.is_file() {
                return Some(nested);
            }
            let flat = dir.join("tools").join("ffmpeg");
            if flat.is_file() {
                return Some(flat);
            }
        }
        let Some(parent) = dir.parent() else {
            break;
        };
        dir = parent.to_path_buf();
    }
    None
}

pub fn resolve_ytdlp_binary() -> PathBuf {
    if let Ok(p) = std::env::var("YT_DLP") {
        let pb = PathBuf::from(p);
        if pb.exists() {
            return pb;
        }
    }
    if let Some(p) = resolve_bundled_ytdlp() {
        return p;
    }
    PathBuf::from("yt-dlp")
}

/// Resolved `ffmpeg` executable: env `FFMPEG`, then bundled `tools/…`, then `ffmpeg` on PATH.
pub fn resolve_ffmpeg_binary() -> PathBuf {
    if let Ok(p) = std::env::var("FFMPEG") {
        let pb = PathBuf::from(p);
        if pb.exists() {
            return pb;
        }
    }
    if let Some(p) = resolve_bundled_ffmpeg() {
        return p;
    }
    PathBuf::from("ffmpeg")
}

/// Directory to pass to yt-dlp `--ffmpeg-location` when `ffmpeg` is a concrete file (bundled / `FFMPEG`).
pub fn ffmpeg_location_dir_for_ytdlp() -> Option<PathBuf> {
    let p = resolve_ffmpeg_binary();
    if p.is_file() {
        p.parent().map(Path::to_path_buf)
    } else {
        None
    }
}

pub fn check_ytdlp(ytdlp: &Path) -> bool {
    let mut cmd = Command::new(ytdlp);
    cmd.arg("--version");
    apply_no_window(&mut cmd);
    cmd.output().map(|o| o.status.success()).unwrap_or(false)
}

pub fn check_ffmpeg() -> bool {
    let bin = resolve_ffmpeg_binary();
    let mut cmd = Command::new(&bin);
    cmd.arg("-version");
    apply_no_window(&mut cmd);
    cmd.output().map(|o| o.status.success()).unwrap_or(false)
}

/// Build metadata JSON without pulling a full multi-video playlist (avoids UI "hang").
pub fn fetch_info_json(
    ytdlp: &Path,
    url: &str,
    cookies_youtube: &str,
) -> Result<String, String> {
    let mut cmd = Command::new(ytdlp);
    apply_cookies_file_to_cmd(&mut cmd, cookies_youtube)?;
    cmd.args([
        "-J",
        "--no-download",
        "--skip-download",
        "--no-warnings",
        "--no-progress",
        "--socket-timeout",
        "25",
        "--retries",
        "2",
    ]);
    let lower = url.to_lowercase();
    let is_youtube = lower.contains("youtube.com") || lower.contains("youtu.be/");
    let playlist_page = lower.contains("playlist?list=");
    if playlist_page {
        // Full `-J` on a playlist URL embeds every video → huge + very slow.
        cmd.arg("--flat-playlist");
    } else if is_youtube && lower.contains("list=") {
        // watch?v=…&list=… → user usually wants the one video, not the whole list metadata.
        cmd.arg("--no-playlist");
    }
    cmd.arg(url);
    apply_no_window(&mut cmd);
    let out = cmd
        .output()
        .map_err(|e| format!("Failed to run yt-dlp: {e}"))?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        let msg = err.trim();
        if msg.is_empty() {
            return Err("yt-dlp failed (no stderr)".to_string());
        }
        return Err(sanitize_ytdlp_error(msg));
    }
    String::from_utf8(out.stdout).map_err(|e| e.to_string())
}

/// Widen `--sub-langs` for Chinese so a 繁中-only stream still matches when the UI picked 简体 code.
fn expand_sub_langs_for_ytdlp(lang: &str) -> String {
    let t = lang.trim();
    if t.is_empty() {
        return String::new();
    }
    let l = t.to_ascii_lowercase().replace('_', "-");
    match l.as_str() {
        "zh-hans" | "zh-cn" | "cmn" => format!("{t},zh-Hant,zh-TW,zh-HK,zh-MO,zh"),
        "zh-hant" | "zh-tw" | "zh-hk" | "zh-mo" => format!("{t},zh-Hans,zh-CN,zh"),
        _ => t.to_string(),
    }
}

pub fn sanitize_ytdlp_error(raw: &str) -> String {
    let lines: Vec<&str> = raw.lines().filter(|l| !l.is_empty()).take(6).collect();
    if lines.is_empty() {
        return "Unknown yt-dlp error".to_string();
    }
    lines.join("\n")
}

/// UI progress segments: fixed total from the start (e.g. 1/3 … 3/3 for merged MP4).
///
/// - **MP3/M4A** (`-x`): one visible download/extract pass → **1**.
/// - **MP4** (`bestvideo+bestaudio` + merge): video download, audio download, merge → **3**.
/// - **MP4 + burn-in** (after yt-dlp): adds ffmpeg burn as **4**.
pub fn download_pipeline_phase_total(opts: &DownloadOptions) -> u8 {
    match opts.output_format {
        OutputFormat::Mp3 | OutputFormat::M4a => 1,
        OutputFormat::Mkv => 3,
        OutputFormat::Mp4 => {
            let burn = opts.burn_in_subtitles && !opts.subtitle_lang.trim().is_empty();
            if burn {
                4
            } else {
                3
            }
        }
    }
}

pub fn build_ytdlp_args(_ytdlp: &Path, url: &str, opts: &DownloadOptions) -> Result<Vec<String>, String> {
    let mut args: Vec<String> = cookie_file_prefix_vec(&opts.cookies_youtube_file)?;
    if let Some(dir) = ffmpeg_location_dir_for_ytdlp() {
        args.push("--ffmpeg-location".to_string());
        args.push(dir.to_string_lossy().to_string());
    }

    let out_dir = Path::new(&opts.download_dir);
    let template = if opts.output_template.trim().is_empty() {
        "%(title)s_%(height)sp.%(ext)s".to_string()
    } else {
        opts.output_template.clone()
    };
    let output = out_dir.join(&template);
    args.push("-o".to_string());
    args.push(output.to_string_lossy().to_string());

    match opts.output_format {
        OutputFormat::Mp4 => {
            // YouTube "bestaudio" is often Opus (webm); muxing Opus into MP4 breaks many players.
            // Prefer AAC in m4a (itag 140, etc.); Merger+ffmpeg still re-encodes to AAC so Opus
            // fallbacks become universally playable MP4 audio.
            args.push("-f".to_string());
            args.push(format!(
                "bestvideo[height<={0}]+bestaudio[ext=m4a]/bestvideo[height<={0}]+bestaudio/best[height<={0}]/bestvideo+bestaudio[ext=m4a]/bestvideo+bestaudio/best",
                opts.resolution
            ));
            args.push("--merge-output-format".to_string());
            args.push("mp4".to_string());
            // Align with yt-dlp `-t mp4` (merge + remux) so the final container is MP4 before
            // EmbedSubtitle and other postprocessors run.
            args.push("--remux-video".to_string());
            args.push("mp4".to_string());
            let abr = opts.audio_kbps.clamp(64, 320);
            args.push("--ppa".to_string());
            args.push(format!(
                "Merger+ffmpeg:-c:v copy -c:a aac -b:a {abr}k"
            ));
        }
        OutputFormat::Mkv => {
            args.push("-f".to_string());
            args.push(format!(
                "bestvideo[height<={0}]+bestaudio/best[height<={0}]/bestvideo+bestaudio/best",
                opts.resolution
            ));
            args.push("--merge-output-format".to_string());
            args.push("mkv".to_string());
        }
        OutputFormat::Mp3 => {
            args.push("-x".to_string());
            args.push("--audio-format".to_string());
            args.push("mp3".to_string());
            args.push("--audio-quality".to_string());
            args.push(format!("{}K", opts.audio_kbps));
        }
        OutputFormat::M4a => {
            args.push("-x".to_string());
            args.push("--audio-format".to_string());
            args.push("m4a".to_string());
            args.push("--audio-quality".to_string());
            args.push(format!("{}K", opts.audio_kbps));
        }
    }

    if let (Some(a), Some(b)) = (&opts.time_start, &opts.time_end) {
        let a = a.trim();
        let b = b.trim();
        if !a.is_empty() && !b.is_empty() {
            args.push("--download-sections".to_string());
            args.push(format!("*{a}-{b}"));
        }
    }

    let lang = opts.subtitle_lang.trim();
    if !lang.is_empty() {
        args.push("--write-subs".to_string());
        args.push("--write-auto-subs".to_string());
        args.push("--sub-langs".to_string());
        args.push(expand_sub_langs_for_ytdlp(lang));
        args.push("--convert-subs".to_string());
        args.push("srt".to_string());
        // Soft mux would delete sidecar `.srt`; burn-in reads that file after yt-dlp finishes.
        if matches!(opts.output_format, OutputFormat::Mp4 | OutputFormat::Mkv) && !opts.burn_in_subtitles {
            args.push("--embed-subs".to_string());
        }
    }

    args.push("--newline".to_string());
    args.push("--progress".to_string());
    args.push("--no-colors".to_string());

    // Match `fetch_info_json`: watch URL with `&list=` (e.g. Mix/Radio) otherwise
    // yt-dlp may hit `[youtube:tab]` for the playlist tab → HTTP 500 / internal errors.
    let lower = url.to_lowercase();
    let is_youtube = lower.contains("youtube.com") || lower.contains("youtu.be/");
    let playlist_page = lower.contains("playlist?list=");
    if is_youtube && !playlist_page && lower.contains("list=") {
        args.push("--no-playlist".to_string());
    }

    args.push(url.to_string());
    Ok(args)
}

pub struct ProgressLine {
    pub progress: f64,
    pub speed: String,
    pub eta: String,
}

/// `[download]  45.0% of ~ 123.45MiB at  1.23MiB/s ETA 00:45` — size may be `~ 100MiB` (old regex used `\S+` and only matched `~`).
fn parse_download_eta_form(line: &str) -> Option<ProgressLine> {
    static RE: once_cell::sync::Lazy<Regex> = once_cell::sync::Lazy::new(|| {
        Regex::new(r"\[download\]\s+([\d.]+)%\s+of\s+(.+?)\s+at\s+(\S+)(?:\s+ETA\s+(\S+))?").unwrap()
    });
    let c = RE.captures(line)?;
    let pct: f64 = c.get(1)?.as_str().parse().ok()?;
    let speed = c.get(3)?.as_str().to_string();
    let eta = c.get(4).map(|m| m.as_str().to_string()).unwrap_or_default();
    Some(ProgressLine {
        progress: pct,
        speed,
        eta,
    })
}

/// `[download] 100% of 1.23MiB in 00:05 at 100KiB/s` (no ETA token).
fn parse_download_in_form(line: &str) -> Option<ProgressLine> {
    static RE: once_cell::sync::Lazy<Regex> = once_cell::sync::Lazy::new(|| {
        Regex::new(r"\[download\]\s+([\d.]+)%\s+of\s+(.+?)\s+in\s+(\S+)\s+at\s+(\S+)").unwrap()
    });
    let c = RE.captures(line)?;
    let pct: f64 = c.get(1)?.as_str().parse().ok()?;
    let dur = c.get(3)?.as_str().to_string();
    let speed = c.get(4)?.as_str().to_string();
    Some(ProgressLine {
        progress: pct,
        speed,
        eta: format!("in {dur}"),
    })
}

fn parse_download_percent_only(line: &str) -> Option<ProgressLine> {
    static RE_TIGHT: once_cell::sync::Lazy<Regex> = once_cell::sync::Lazy::new(|| {
        Regex::new(r"\[download\]\s+([\d.]+)%").expect("regex")
    });
    static RE_LOOSE: once_cell::sync::Lazy<Regex> = once_cell::sync::Lazy::new(|| {
        Regex::new(r"\[download\][^\n]*?([\d.]+)\s*%").expect("regex")
    });
    let pct = RE_TIGHT
        .captures(line)
        .and_then(|c| c.get(1)?.as_str().parse().ok())
        .or_else(|| RE_LOOSE.captures(line).and_then(|c| c.get(1)?.as_str().parse().ok()))?;
    Some(ProgressLine {
        progress: pct,
        speed: String::new(),
        eta: String::new(),
    })
}

/// Parse yt-dlp `--progress` / `[download]` lines (stdout or stderr, `\n` or `\r` segments).
pub fn parse_download_progress_line(line: &str) -> Option<ProgressLine> {
    // `in … at` must run before `of … at … ETA` — otherwise `100% of 1.23MiB in 00:05 at 100KiB/s`
    // matches the ETA regex with `.+?` = `1.23MiB in 00:05` and `at` = the one before `100KiB/s`.
    parse_download_in_form(line)
        .or_else(|| parse_download_eta_form(line))
        .or_else(|| parse_download_percent_only(line))
}

#[cfg(test)]
mod download_progress_tests {
    use super::*;
    use crate::models::DownloadOptions;

    #[test]
    fn mp4_with_subtitle_lang_includes_embed_and_remux() {
        let opts = DownloadOptions {
            output_format: OutputFormat::Mp4,
            resolution: 720,
            audio_kbps: 128,
            time_start: None,
            time_end: None,
            output_template: "%(title)s.%(ext)s".to_string(),
            download_dir: "C:\\dl".to_string(),
            cookies_youtube_file: String::new(),
            subtitle_lang: "en".to_string(),
            burn_in_subtitles: false,
        };
        let args = build_ytdlp_args(Path::new("yt-dlp"), "https://youtu.be/x", &opts).unwrap();
        assert!(args.iter().any(|a| a == "--embed-subs"));
        assert!(args.iter().any(|a| a == "--remux-video"));
        assert!(args.contains(&"mp4".to_string()));
    }

    #[test]
    fn zh_hans_sub_langs_includes_traditional_fallback() {
        assert!(expand_sub_langs_for_ytdlp("zh-Hans").contains("zh-Hant"));
        assert!(expand_sub_langs_for_ytdlp("zh-CN").contains("zh-Hant"));
        let opts = DownloadOptions {
            output_format: OutputFormat::Mp4,
            resolution: 720,
            audio_kbps: 128,
            time_start: None,
            time_end: None,
            output_template: "%(title)s.%(ext)s".to_string(),
            download_dir: "C:\\dl".to_string(),
            cookies_youtube_file: String::new(),
            subtitle_lang: "zh-Hans".to_string(),
            burn_in_subtitles: false,
        };
        let args = build_ytdlp_args(Path::new("yt-dlp"), "https://youtu.be/x", &opts).unwrap();
        let i = args.iter().position(|a| a == "--sub-langs").unwrap();
        assert!(args[i + 1].contains("zh-Hant"));
    }

    #[test]
    fn pipeline_phase_totals_match_format() {
        let mp4_soft = DownloadOptions {
            output_format: OutputFormat::Mp4,
            resolution: 720,
            audio_kbps: 128,
            time_start: None,
            time_end: None,
            output_template: "%(title)s.%(ext)s".to_string(),
            download_dir: "C:\\dl".to_string(),
            cookies_youtube_file: String::new(),
            subtitle_lang: "en".to_string(),
            burn_in_subtitles: false,
        };
        assert_eq!(download_pipeline_phase_total(&mp4_soft), 3);

        let mp4_burn = DownloadOptions {
            burn_in_subtitles: true,
            subtitle_lang: "en".to_string(),
            ..mp4_soft.clone()
        };
        assert_eq!(download_pipeline_phase_total(&mp4_burn), 4);

        let mp3 = DownloadOptions {
            output_format: OutputFormat::Mp3,
            resolution: 720,
            audio_kbps: 192,
            time_start: None,
            time_end: None,
            output_template: "%(title)s.%(ext)s".to_string(),
            download_dir: "C:\\dl".to_string(),
            cookies_youtube_file: String::new(),
            subtitle_lang: String::new(),
            burn_in_subtitles: false,
        };
        assert_eq!(download_pipeline_phase_total(&mp3), 1);

        let mkv = DownloadOptions {
            output_format: OutputFormat::Mkv,
            resolution: 1080,
            audio_kbps: 192,
            time_start: None,
            time_end: None,
            output_template: "%(title)s.%(ext)s".to_string(),
            download_dir: "C:\\dl".to_string(),
            cookies_youtube_file: String::new(),
            subtitle_lang: "en".to_string(),
            burn_in_subtitles: false,
        };
        assert_eq!(download_pipeline_phase_total(&mkv), 3);
    }

    #[test]
    fn mkv_build_includes_embed_subs_when_lang_set() {
        let opts = DownloadOptions {
            output_format: OutputFormat::Mkv,
            resolution: 1080,
            audio_kbps: 192,
            time_start: None,
            time_end: None,
            output_template: "%(title)s.%(ext)s".to_string(),
            download_dir: "C:\\dl".to_string(),
            cookies_youtube_file: String::new(),
            subtitle_lang: "en".to_string(),
            burn_in_subtitles: false,
        };
        let args = build_ytdlp_args(Path::new("yt-dlp"), "https://youtu.be/x", &opts).unwrap();
        assert!(args.iter().any(|a| a == "--embed-subs"));
        assert!(args.contains(&"mkv".to_string()));
    }

    #[test]
    fn mp4_burn_in_skips_embed_subs() {
        let opts = DownloadOptions {
            output_format: OutputFormat::Mp4,
            resolution: 720,
            audio_kbps: 128,
            time_start: None,
            time_end: None,
            output_template: "%(title)s.%(ext)s".to_string(),
            download_dir: "C:\\dl".to_string(),
            cookies_youtube_file: String::new(),
            subtitle_lang: "en".to_string(),
            burn_in_subtitles: true,
        };
        let args = build_ytdlp_args(Path::new("yt-dlp"), "https://youtu.be/x", &opts).unwrap();
        assert!(!args.iter().any(|a| a == "--embed-subs"));
        assert!(args.iter().any(|a| a == "--write-subs"));
    }

    #[test]
    fn eta_form_with_tilde_size() {
        let line = "[download]  45.0% of ~ 123.45MiB at  1.23MiB/s ETA 00:45";
        let p = parse_download_progress_line(line).unwrap();
        assert!((p.progress - 45.0).abs() < f64::EPSILON);
        assert_eq!(p.speed, "1.23MiB/s");
        assert_eq!(p.eta, "00:45");
    }

    #[test]
    fn in_form_no_eta_token() {
        let line = "[download] 100% of 1.23MiB in 00:05 at 100KiB/s";
        let p = parse_download_progress_line(line).unwrap();
        assert!((p.progress - 100.0).abs() < f64::EPSILON);
        assert_eq!(p.speed, "100KiB/s");
        assert!(p.eta.starts_with("in "));
    }
}

pub fn merge_playlist_entries(value: &Value) -> Vec<(String, String)> {
    let mut out = Vec::new();
    if let Some(entries) = value.get("entries").and_then(|e| e.as_array()) {
        for e in entries {
            if e.is_null() {
                continue;
            }
            let title = e
                .get("title")
                .and_then(|t| t.as_str())
                .unwrap_or("Untitled")
                .to_string();
            let url = e
                .get("url")
                .and_then(|u| u.as_str())
                .map(|s| s.to_string())
                .or_else(|| {
                    e.get("webpage_url")
                        .and_then(|u| u.as_str())
                        .map(|s| s.to_string())
                })
                .or_else(|| {
                    let id = e.get("id")?.as_str()?;
                    let ie = e
                        .get("ie_key")
                        .and_then(|k| k.as_str())
                        .or_else(|| value.get("ie_key").and_then(|k| k.as_str()))
                        .unwrap_or("");
                    if ie.contains("Youtube") || ie.contains("youtube") {
                        Some(format!("https://www.youtube.com/watch?v={id}"))
                    } else {
                        None
                    }
                });
            if let Some(u) = url {
                out.push((title, u));
            }
        }
    }
    out
}
