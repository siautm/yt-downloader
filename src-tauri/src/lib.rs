mod cookie_convert;
mod ffmpeg_burn;
mod models;
mod queue;
mod thumb_proxy;
mod ytdlp;

use models::{AppSettings, NewTaskPayload};
use queue::DownloadEngine;
use serde::Serialize;
use std::fs;
use std::path::PathBuf;
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use tauri::{AppHandle, Manager, State};
use ytdlp::{
    check_ffmpeg, check_ytdlp, fetch_info_json, merge_playlist_entries, resolve_ffmpeg_binary,
    resolve_ytdlp_binary,
};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolingStatus {
    pub ytdlp_ok: bool,
    pub ffmpeg_ok: bool,
    pub ytdlp_path: String,
    pub ffmpeg_path: String,
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("settings.json"))
}

#[tauri::command]
fn load_settings(app: AppHandle) -> Result<AppSettings, String> {
    let path = settings_path(&app)?;
    if !path.exists() {
        return Ok(AppSettings::default());
    }
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&raw).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    let path = settings_path(&app)?;
    let raw = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(path, raw).map_err(|e| e.to_string())
}

#[tauri::command]
async fn fetch_media_json(url: String, cookies_youtube_file: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let bin = resolve_ytdlp_binary();
        if !check_ytdlp(&bin) {
            return Err(
                "yt-dlp not found. Put yt-dlp in a `tools` folder next to the app, install on PATH, or set YT_DLP."
                    .to_string(),
            );
        }
        fetch_info_json(&bin, &url, &cookies_youtube_file)
    })
    .await
    .map_err(|e| format!("fetch_media_json join: {e}"))?
}

fn fetch_playlist_entries_blocking(
    url: String,
    limit: u32,
    cookies_youtube_file: String,
) -> Result<Vec<PlaylistEntryDto>, String> {
    let bin = resolve_ytdlp_binary();
    if !check_ytdlp(&bin) {
        return Err(
            "yt-dlp not found. Use a `tools` folder next to the app, PATH, or set YT_DLP.".to_string(),
        );
    }
    let cap = limit.clamp(1, 500);
    let mut cmd = std::process::Command::new(&bin);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);
    ytdlp::apply_cookies_file_to_cmd(&mut cmd, &cookies_youtube_file)?;
    cmd.args([
        "-J",
        "--flat-playlist",
        "--no-download",
        "--skip-download",
        "--no-warnings",
        "--no-progress",
        "--socket-timeout",
        "25",
        "--retries",
        "2",
        "--playlist-items",
        &format!("1:{cap}"),
        &url,
    ]);
    let out = cmd
        .output()
        .map_err(|e| format!("Failed to run yt-dlp: {e}"))?;
    if !out.status.success() {
        return Err(ytdlp::sanitize_ytdlp_error(
            String::from_utf8_lossy(&out.stderr).trim(),
        ));
    }
    let json: serde_json::Value =
        serde_json::from_slice(&out.stdout).map_err(|e| e.to_string())?;
    let pairs = merge_playlist_entries(&json);
    Ok(pairs
        .into_iter()
        .map(|(title, url)| PlaylistEntryDto { title, url })
        .collect())
}

#[tauri::command]
async fn fetch_thumbnail_data_url(url: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || thumb_proxy::fetch_thumbnail_data_url(&url))
        .await
        .map_err(|e| format!("fetch_thumbnail join: {e}"))?
}

#[tauri::command]
async fn fetch_playlist_entries(
    url: String,
    limit: u32,
    cookies_youtube_file: String,
) -> Result<Vec<PlaylistEntryDto>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        fetch_playlist_entries_blocking(url, limit, cookies_youtube_file)
    })
    .await
    .map_err(|e| format!("fetch_playlist_entries join: {e}"))?
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistEntryDto {
    pub title: String,
    pub url: String,
}

#[tauri::command]
fn tooling_status() -> ToolingStatus {
    let bin = resolve_ytdlp_binary();
    let ff = resolve_ffmpeg_binary();
    ToolingStatus {
        ytdlp_ok: check_ytdlp(&bin),
        ffmpeg_ok: check_ffmpeg(),
        ytdlp_path: bin.to_string_lossy().to_string(),
        ffmpeg_path: ff.to_string_lossy().to_string(),
    }
}

#[tauri::command]
fn enqueue_downloads(
    app: AppHandle,
    engine: State<'_, DownloadEngine>,
    tasks: Vec<NewTaskPayload>,
) -> Result<(), String> {
    engine.ensure_worker(app.clone());
    engine.push_tasks(&app, tasks)
}

#[tauri::command]
fn queue_snapshot(engine: State<'_, DownloadEngine>) -> Vec<models::QueueTask> {
    engine.snapshot()
}

#[tauri::command]
fn cancel_task(app: AppHandle, engine: State<'_, DownloadEngine>, id: String) -> Result<(), String> {
    engine.cancel_task(&app, &id)
}

#[tauri::command]
fn pause_task(app: AppHandle, engine: State<'_, DownloadEngine>, id: String) -> Result<(), String> {
    engine.pause_task(&app, &id)
}

#[tauri::command]
fn resume_task(app: AppHandle, engine: State<'_, DownloadEngine>, id: String) -> Result<(), String> {
    engine.resume_task(&app, &id)
}

/// Open a file or folder in the system file manager (bypasses opener ACL issues on Windows).
#[tauri::command]
fn reveal_in_folder(path: String) -> Result<(), String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Empty path".to_string());
    }
    let p = std::path::Path::new(trimmed);
    if !p.exists() {
        return Err(format!("Path not found: {trimmed}"));
    }
    let p = p
        .canonicalize()
        .unwrap_or_else(|_| p.to_path_buf());

    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        std::process::Command::new("explorer")
            .creation_flags(CREATE_NO_WINDOW)
            .arg(&p)
            .spawn()
            .map_err(|e| format!("explorer: {e}"))?;
        return Ok(());
    }

    #[cfg(not(windows))]
    {
        #[cfg(target_os = "macos")]
        {
            std::process::Command::new("open")
                .arg(&p)
                .spawn()
                .map_err(|e| format!("open: {e}"))?;
            return Ok(());
        }
        #[cfg(all(unix, not(target_os = "macos")))]
        {
            std::process::Command::new("xdg-open")
                .arg(&p)
                .spawn()
                .map_err(|e| format!("xdg-open: {e}"))?;
            return Ok(());
        }
        #[cfg(not(unix))]
        {
            return Err("Opening folders is not supported on this platform.".to_string());
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .manage(DownloadEngine::new())
        .invoke_handler(tauri::generate_handler![
            load_settings,
            save_settings,
            fetch_media_json,
            fetch_thumbnail_data_url,
            fetch_playlist_entries,
            tooling_status,
            enqueue_downloads,
            queue_snapshot,
            cancel_task,
            pause_task,
            resume_task,
            reveal_in_folder,
        ])
        .setup(|app| {
            let h = app.handle().clone();
            let engine = app.state::<DownloadEngine>();
            engine.ensure_worker(h);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
