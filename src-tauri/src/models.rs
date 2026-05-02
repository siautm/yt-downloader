use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub default_format: OutputFormat,
    pub default_resolution: u32,
    pub default_audio_kbps: u32,
    pub download_dir: String,
    pub output_template: String,
    /// Netscape `.txt` or extension JSON for `--cookies` (no in-app browser cookie mode).
    #[serde(default, alias = "cookiesFile")]
    pub cookies_youtube_file: String,
    /// Hard-burn subtitles (ffmpeg). Off by default; only exposed in Settings with a warning.
    #[serde(default)]
    pub burn_in_subtitles: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            default_format: OutputFormat::Mp4,
            default_resolution: 1080,
            default_audio_kbps: 192,
            download_dir: String::new(),
            output_template: "%(title)s_%(height)sp.%(ext)s".to_string(),
            cookies_youtube_file: String::new(),
            burn_in_subtitles: false,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum OutputFormat {
    Mp4,
    Mkv,
    Mp3,
    M4a,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TaskStatus {
    Pending,
    Downloading,
    Paused,
    Completed,
    Error,
    Cancelled,
}

fn default_subtitle_lang() -> String {
    String::new()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadOptions {
    pub output_format: OutputFormat,
    pub resolution: u32,
    pub audio_kbps: u32,
    pub time_start: Option<String>,
    pub time_end: Option<String>,
    pub output_template: String,
    pub download_dir: String,
    #[serde(default, alias = "cookiesFile")]
    pub cookies_youtube_file: String,
    /// Single yt-dlp language code; empty = no subtitles. When set with MP4, also `--embed-subs`.
    #[serde(
        default = "default_subtitle_lang",
        alias = "subtitleLangs",
        alias = "subtitle_langs"
    )]
    pub subtitle_lang: String,
    /// After download: ffmpeg hard-burn subtitles into MP4 (re-encode). MP4 + non-empty `subtitle_lang` only.
    #[serde(default)]
    pub burn_in_subtitles: bool,
}

fn default_download_phase() -> u8 {
    1
}

fn default_download_phase_total() -> u8 {
    1
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueueTask {
    pub id: String,
    pub url: String,
    pub title: Option<String>,
    pub status: TaskStatus,
    pub progress: f64,
    pub speed: String,
    pub eta: String,
    /// yt-dlp may download video+audio in two passes; 1/2 vs 2/2 for UI.
    #[serde(default = "default_download_phase")]
    pub download_phase: u8,
    #[serde(default = "default_download_phase_total")]
    pub download_phase_total: u8,
    pub file_path: Option<String>,
    pub error: Option<String>,
    pub options: DownloadOptions,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewTaskPayload {
    pub url: String,
    pub title: Option<String>,
    pub options: DownloadOptions,
}
