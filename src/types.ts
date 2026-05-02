export type OutputFormat = "mp4" | "mkv" | "mp3" | "m4a";

export type TaskStatus =
  | "pending"
  | "downloading"
  | "paused"
  | "completed"
  | "error"
  | "cancelled";

export interface DownloadOptions {
  outputFormat: OutputFormat;
  resolution: number;
  audioKbps: number;
  timeStart: string | null;
  timeEnd: string | null;
  outputTemplate: string;
  downloadDir: string;
  cookiesYoutubeFile: string;
  /** One yt-dlp language code; empty = no subtitles. Embedded into MP4 when applicable. */
  subtitleLang: string;
  /** After download: ffmpeg draws subtitles on the picture (MP4 + subtitle only). */
  burnInSubtitles: boolean;
}

export interface QueueTask {
  id: string;
  url: string;
  title: string | null;
  status: TaskStatus;
  progress: number;
  speed: string;
  eta: string;
  /** yt-dlp may download video + audio in separate passes (e.g. 1/2 then 2/2). */
  downloadPhase?: number;
  downloadPhaseTotal?: number;
  filePath: string | null;
  error: string | null;
  options: DownloadOptions;
}

export interface AppSettings {
  defaultFormat: OutputFormat;
  defaultResolution: number;
  defaultAudioKbps: number;
  downloadDir: string;
  outputTemplate: string;
  cookiesYoutubeFile: string;
  /** Hard-burn subtitles (ffmpeg). Off by default; enable only in Settings after confirming the warning. */
  burnInSubtitles?: boolean;
}

export interface NewTaskPayload {
  url: string;
  title: string | null;
  options: DownloadOptions;
}

export interface ToolingStatus {
  ytdlpOk: boolean;
  ffmpegOk: boolean;
  ytdlpPath: string;
  ffmpegPath: string;
}

export interface PlaylistEntryDto {
  title: string;
  url: string;
}
