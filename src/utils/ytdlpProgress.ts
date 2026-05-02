/** Match yt-dlp `[download] …%` progress lines (keep in sync with `parse_download_progress_line` in Rust). */

export interface ParsedDownloadProgress {
  progress: number;
  speed: string;
  eta: string;
}

const RE_ETA = /^\[download\]\s+([\d.]+)%\s+of\s+(.+?)\s+at\s+(\S+)(?:\s+ETA\s+(\S+))?/;
const RE_IN = /^\[download\]\s+([\d.]+)%\s+of\s+(.+?)\s+in\s+(\S+)\s+at\s+(\S+)/;
const RE_PCT = /^\[download\]\s+([\d.]+)%/;
const RE_PCT_LOOSE = /\[download\][^\n]*?([\d.]+)\s*%/;

export function parseYtDlpDownloadProgressLine(line: string): ParsedDownloadProgress | null {
  const s = line.trim();
  if (!s.startsWith("[download]")) return null;

  // Same order as Rust: `in … at` before `of … at … ETA` (avoid mis-parsing completed lines).
  let m = RE_IN.exec(s);
  if (m) {
    const progress = Number(m[1]);
    if (!Number.isFinite(progress)) return null;
    const dur = m[3] ?? "";
    return {
      progress,
      speed: m[4] ?? "",
      eta: dur ? `in ${dur}` : "",
    };
  }

  m = RE_ETA.exec(s);
  if (m) {
    const progress = Number(m[1]);
    if (!Number.isFinite(progress)) return null;
    return {
      progress,
      speed: m[3] ?? "",
      eta: (m[4] ?? "").trim(),
    };
  }

  m = RE_PCT.exec(s);
  if (!m) m = RE_PCT_LOOSE.exec(s);
  if (m) {
    const progress = Number(m[1]);
    if (!Number.isFinite(progress)) return null;
    return { progress, speed: "", eta: "" };
  }

  return null;
}
