import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { Cookie, Download, HelpCircle, Settings as SettingsIcon } from "lucide-react";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { VideoUrlCard } from "@/components/design/VideoUrlCard";
import { VideoPreviewCard } from "@/components/design/VideoPreviewCard";
import { DownloadOptionsPanel } from "@/components/design/DownloadOptionsPanel";
import { DownloadQueuePanel } from "@/components/design/DownloadQueuePanel";
import { SettingsModal } from "@/components/design/SettingsModal";
import { FormatGuide } from "@/components/design/FormatGuide";
import { CookieTutorial } from "@/components/design/CookieTutorial";
import { DownloadConfirmation } from "@/components/design/DownloadConfirmation";
import type { VideoInfo } from "@/design/videoTypes";
import type {
  AppSettings,
  DownloadOptions,
  NewTaskPayload,
  PlaylistEntryDto,
  QueueTask,
  ToolingStatus,
} from "@/types";
import {
  pickThumbnailUrlFromYtdlpJson,
  thumbnailNeedsBilibiliProxy,
} from "@/utils/pickThumbnailFromYtdlpJson";
import { formatClipDurationPlaceholder, maxVideoHeight } from "@/utils/ytFormats";
import { extractSubtitleLanguages, mergeSubtitleCodeKeys } from "@/utils/ytSubtitles";
function defaultOptions(settings: AppSettings): DownloadOptions {
  return {
    outputFormat: settings.defaultFormat,
    resolution: settings.defaultResolution,
    audioKbps: settings.defaultAudioKbps,
    timeStart: null,
    timeEnd: null,
    outputTemplate: settings.outputTemplate,
    downloadDir: settings.downloadDir,
    cookiesYoutubeFile: settings.cookiesYoutubeFile ?? "",
    subtitleLang: "",
    burnInSubtitles: Boolean(settings.burnInSubtitles),
  };
}

const PLACEHOLDER_THUMB =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect fill="#1a1f2e" width="100%" height="100%"/><text x="50%" y="50%" fill="#64748b" font-family="sans-serif" font-size="18" text-anchor="middle">No thumbnail</text></svg>`,
  );

function AppShell() {
  const { theme } = useTheme();
  const [url, setUrl] = useState("");
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [tooling, setTooling] = useState<ToolingStatus | null>(null);
  const [queue, setQueue] = useState<QueueTask[]>([]);
  const [busyMeta, setBusyMeta] = useState(false);
  const [metaJson, setMetaJson] = useState<string | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [playlistEntries, setPlaylistEntries] = useState<PlaylistEntryDto[] | null>(null);
  /** `list=` on watch / youtu.be URL — fetch playlist only after user expands. */
  const [deferredListId, setDeferredListId] = useState<string | null>(null);
  const [playlistFromWatchExpanded, setPlaylistFromWatchExpanded] = useState(false);
  const [playlistBusy, setPlaylistBusy] = useState(false);
  const [playlistLoadError, setPlaylistLoadError] = useState<string | null>(null);
  const [logLines, setLogLines] = useState<Record<string, string[]>>({});
  const [opts, setOpts] = useState<DownloadOptions | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [showFormatGuide, setShowFormatGuide] = useState(false);
  const [showCookieTutorial, setShowCookieTutorial] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [skipConfirmation, setSkipConfirmation] = useState(false);
  /** Bilibili CDN thumbnails fetched in Rust (Referer); `null` = not loaded yet or not used. */
  const [bilibiliThumbDataUrl, setBilibiliThumbDataUrl] = useState<string | null>(null);

  const refreshTooling = useCallback(async () => {
    setTooling(await invoke<ToolingStatus>("tooling_status"));
  }, []);

  const refreshQueue = useCallback(async () => {
    setQueue(await invoke<QueueTask[]>("queue_snapshot"));
  }, []);

  useEffect(() => {
    void (async () => {
      const s = await invoke<AppSettings>("load_settings");
      const merged: AppSettings = {
        ...s,
        cookiesYoutubeFile:
          s.cookiesYoutubeFile ?? (s as { cookiesFile?: string }).cookiesFile ?? "",
        burnInSubtitles: Boolean(s.burnInSubtitles),
      };
      setSettings(merged);
      setOpts(defaultOptions(merged));
    })();
    void refreshTooling();
    void refreshQueue();

    const unsubs: (() => void)[] = [];
    listen<QueueTask[]>("queue:update", (e) => setQueue(e.payload)).then((u) => unsubs.push(u));
    listen<{ id: string; line: string }>("task:log", (e) => {
      const { id, line } = e.payload;
      setLogLines((prev) => {
        const cur = prev[id] ?? [];
        return { ...prev, [id]: [...cur, line].slice(-400) };
      });
    }).then((u) => unsubs.push(u));
    listen<{ id: string; title: string }>("task:completed", (e) => {
      void refreshQueue();
      void sendNotification({ title: "Download complete", body: e.payload.title });
    }).then((u) => unsubs.push(u));

    void (async () => {
      let granted = await isPermissionGranted();
      if (!granted) {
        const p = await requestPermission();
        granted = p === "granted";
      }
    })();

    return () => {
      unsubs.forEach((f) => f());
    };
  }, [refreshQueue, refreshTooling]);

  const parsedMeta = useMemo(() => {
    if (!metaJson) return null;
    try {
      return JSON.parse(metaJson) as Record<string, unknown>;
    } catch {
      return null;
    }
  }, [metaJson]);

  const isPlaylistMeta = useMemo(() => {
    const t = parsedMeta?.["_type"];
    if (t === "playlist") return true;
    const ent = parsedMeta?.["entries"];
    return Array.isArray(ent) && ent.length > 1;
  }, [parsedMeta]);

  const availableMaxHeight = useMemo(() => maxVideoHeight(parsedMeta), [parsedMeta]);

  const subtitleAvailability = useMemo(() => extractSubtitleLanguages(parsedMeta), [parsedMeta]);

  useEffect(() => {
    if (availableMaxHeight === null) return;
    setOpts((o) => {
      if (!o || (o.outputFormat !== "mp4" && o.outputFormat !== "mkv")) return o;
      if (o.resolution > availableMaxHeight) return { ...o, resolution: availableMaxHeight };
      return o;
    });
  }, [availableMaxHeight, metaJson]);

  const videoTitle = useMemo(() => {
    if (!parsedMeta) return null;
    const t = parsedMeta["title"];
    return typeof t === "string" ? t : null;
  }, [parsedMeta]);

  const thumbRaw = useMemo(
    () => (parsedMeta ? pickThumbnailUrlFromYtdlpJson(parsedMeta) : null),
    [parsedMeta],
  );

  useEffect(() => {
    let cancelled = false;
    setBilibiliThumbDataUrl(null);
    if (!thumbRaw || !thumbnailNeedsBilibiliProxy(thumbRaw)) {
      return () => {
        cancelled = true;
      };
    }
    void (async () => {
      try {
        const dataUrl = await invoke<string>("fetch_thumbnail_data_url", { url: thumbRaw });
        if (!cancelled) setBilibiliThumbDataUrl(dataUrl);
      } catch {
        if (!cancelled) setBilibiliThumbDataUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [thumbRaw]);

  const thumbnailForPreview = useMemo(() => {
    if (!thumbRaw) return PLACEHOLDER_THUMB;
    if (thumbnailNeedsBilibiliProxy(thumbRaw)) {
      return bilibiliThumbDataUrl ?? PLACEHOLDER_THUMB;
    }
    return thumbRaw;
  }, [thumbRaw, bilibiliThumbDataUrl]);

  const durationSec = useMemo(() => {
    if (!parsedMeta) return null;
    const d = parsedMeta["duration"];
    return typeof d === "number" ? d : null;
  }, [parsedMeta]);

  const clipPlaceholders = useMemo(() => {
    if (durationSec !== null && durationSec > 0) {
      return {
        start: "00:00",
        end: formatClipDurationPlaceholder(durationSec),
      };
    }
    return { start: "0:00 or seconds", end: "MM:SS or seconds" };
  }, [durationSec]);

  const uploader = useMemo(() => {
    if (!parsedMeta) return null;
    const u = parsedMeta["uploader"] ?? parsedMeta["channel"];
    return typeof u === "string" ? u : null;
  }, [parsedMeta]);

  const videoInfo = useMemo((): VideoInfo | null => {
    if (!parsedMeta || !videoTitle) return null;
    return {
      title: videoTitle,
      thumbnail: thumbnailForPreview,
      duration: durationSec ?? 0,
      uploader: uploader ?? "Unknown",
    };
  }, [parsedMeta, videoTitle, thumbnailForPreview, durationSec, uploader]);

  async function persistSettings(next: AppSettings) {
    const normalized: AppSettings = {
      ...next,
      cookiesYoutubeFile: next.cookiesYoutubeFile ?? "",
      burnInSubtitles: Boolean(next.burnInSubtitles),
    };
    setSettings(normalized);
    await invoke("save_settings", { settings: normalized });
    setOpts((o) => {
      if (!o) return defaultOptions(normalized);
      return {
        ...o,
        outputFormat: normalized.defaultFormat,
        resolution: normalized.defaultResolution,
        audioKbps: normalized.defaultAudioKbps,
        outputTemplate: normalized.outputTemplate,
        downloadDir: normalized.downloadDir || o.downloadDir,
        cookiesYoutubeFile: normalized.cookiesYoutubeFile,
        burnInSubtitles: Boolean(normalized.burnInSubtitles),
      };
    });
  }

  async function pickCookiesYoutube() {
    const selected = await open({
      multiple: false,
      filters: [{ name: "YouTube cookies (txt / json)", extensions: ["txt", "cookies", "json"] }],
    });
    if (selected === null || !settings) return;
    const path = typeof selected === "string" ? selected : selected[0];
    await persistSettings({ ...settings, cookiesYoutubeFile: path });
    setOpts((o) => (o ? { ...o, cookiesYoutubeFile: path } : o));
  }

  async function pickFolder() {
    const selected = await open({ directory: true, multiple: false });
    if (selected === null || !settings) return;
    const path = typeof selected === "string" ? selected : selected[0];
    await persistSettings({ ...settings, downloadDir: path });
    setOpts((o) => (o ? { ...o, downloadDir: path } : o));
  }

  function clearCurrentLink() {
    setUrl("");
    setMetaJson(null);
    setMetaError(null);
    setPlaylistEntries(null);
    setDeferredListId(null);
    setPlaylistFromWatchExpanded(false);
    setPlaylistLoadError(null);
    setPlaylistBusy(false);
    setBusyMeta(false);
    setOpts((o) =>
      o
        ? {
            ...o,
            timeStart: null,
            timeEnd: null,
            subtitleLang: "",
            burnInSubtitles: Boolean(settings?.burnInSubtitles),
          }
        : o,
    );
  }

  async function fetchMetadata() {
    setBusyMeta(true);
    setMetaError(null);
    setMetaJson(null);
    setPlaylistEntries(null);
    setDeferredListId(null);
    setPlaylistFromWatchExpanded(false);
    setPlaylistLoadError(null);
    setPlaylistBusy(false);
    const trimmed = url.trim();
    try {
      const cty = settings?.cookiesYoutubeFile ?? "";
      const j = await invoke<string>("fetch_media_json", {
        url: trimmed,
        cookiesYoutubeFile: cty,
      });
      setMetaJson(j);
      const parsed = JSON.parse(j) as { _type?: string; entries?: unknown[] } & Record<
        string,
        unknown
      >;
      // Do not wipe subtitle on every fetch: users often re-fetch then queue; only drop if
      // this result's metadata lists languages and the selection is absent for this title.
      setOpts((o) => {
        if (!o) return o;
        const cur = o.subtitleLang.trim();
        if (!cur) return o;
        const av = extractSubtitleLanguages(parsed);
        const keys = mergeSubtitleCodeKeys(av);
        if (keys.length === 0) return o;
        const norm = (s: string) => s.trim().toLowerCase();
        const still = keys.some((k) => norm(k) === norm(cur));
        return {
          ...o,
          subtitleLang: still ? o.subtitleLang : "",
          burnInSubtitles: still ? o.burnInSubtitles : Boolean(settings?.burnInSubtitles),
        };
      });
      const lower = trimmed.toLowerCase();
      const playlistPage = lower.includes("youtube.com") && lower.includes("playlist?list=");
      const listMatch = trimmed.match(/[?&]list=([^&]+)/i);
      const listParam = listMatch?.[1]?.trim() ?? null;
      const ytHost = /youtube\.com|youtu\.be/i.test(trimmed);
      const watchStyle =
        ytHost &&
        (/[?&]v=[^&]+/i.test(trimmed) || /youtu\.be\//i.test(trimmed) || /\/watch\?/i.test(trimmed));
      const deferPlaylist = Boolean(listParam && ytHost && !playlistPage && watchStyle);
      if (deferPlaylist && listParam) {
        setDeferredListId(listParam);
      }

      const multiPlaylist =
        parsed._type === "playlist" ||
        (Array.isArray(parsed.entries) && parsed.entries.length > 1);
      if (multiPlaylist) {
        const entries = await invoke<PlaylistEntryDto[]>("fetch_playlist_entries", {
          url: trimmed,
          limit: 200,
          cookiesYoutubeFile: cty,
        });
        setPlaylistEntries(entries);
      }
    } catch (e) {
      setMetaError(String(e));
    } finally {
      setBusyMeta(false);
    }
  }

  async function loadDeferredPlaylist() {
    if (!deferredListId || !settings) return;
    setPlaylistBusy(true);
    setPlaylistLoadError(null);
    try {
      const plUrl = `https://www.youtube.com/playlist?list=${encodeURIComponent(deferredListId)}`;
      const entries = await invoke<PlaylistEntryDto[]>("fetch_playlist_entries", {
        url: plUrl,
        limit: 200,
        cookiesYoutubeFile: settings.cookiesYoutubeFile ?? "",
      });
      setPlaylistEntries(entries);
      setPlaylistFromWatchExpanded(true);
    } catch (e) {
      setPlaylistLoadError(String(e));
    } finally {
      setPlaylistBusy(false);
    }
  }

  function buildPayloadsForEnqueue(targetUrl: string, title: string | null): NewTaskPayload[] {
    if (!opts) return [];
    return [{ url: targetUrl, title, options: { ...opts } }];
  }

  async function runEnqueueCurrent() {
    if (!opts?.downloadDir) {
      setMetaError("Choose a download folder in Settings first.");
      return;
    }
    await invoke("enqueue_downloads", {
      tasks: buildPayloadsForEnqueue(url.trim(), videoTitle),
    });
    await refreshQueue();
    setShowConfirmation(false);
  }

  function handleAddToQueueClick() {
    if (!videoInfo || !opts?.downloadDir) {
      setMetaError("Choose a download folder in Settings first.");
      return;
    }
    if (skipConfirmation) {
      void runEnqueueCurrent();
    } else {
      setShowConfirmation(true);
    }
  }

  async function enqueuePlaylistAll() {
    if (!opts?.downloadDir || !playlistEntries?.length) return;
    const tasks: NewTaskPayload[] = playlistEntries.map((e) => ({
      url: e.url,
      title: e.title,
      options: { ...opts },
    }));
    await invoke("enqueue_downloads", { tasks });
    await refreshQueue();
  }

  async function openReveal(path: string) {
    try {
      await invoke("reveal_in_folder", { path });
    } catch (e) {
      console.error("reveal_in_folder", e);
    }
  }

  if (!settings || !opts) {
    return (
      <div
        className="min-h-screen flex items-center justify-center text-lg"
        style={{ backgroundColor: theme.colors.bg, color: theme.colors.text }}
      >
        Loading…
      </div>
    );
  }

  const confirmFormat = opts.outputFormat.toUpperCase();
  const confirmQuality =
    opts.outputFormat === "mp4" || opts.outputFormat === "mkv"
      ? `${opts.resolution}p`
      : `${opts.audioKbps}K`;

  return (
    <div
      className="min-h-screen transition-colors duration-300"
      style={{
        backgroundColor: theme.colors.bg,
        color: theme.colors.text,
      }}
    >
      <header
        className="border-b px-6 py-5 backdrop-blur-sm sticky top-0 z-40"
        style={{
          backgroundColor: `${theme.colors.card}dd`,
          borderColor: theme.colors.border,
        }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`,
              }}
            >
              <Download className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-xl" style={{ color: theme.colors.text }}>
                Local Video Downloader
              </h1>
              {tooling && (
                <p
                  className="text-xs mt-0.5 cursor-default"
                  style={{ color: theme.colors.textMuted }}
                  title={`yt-dlp: ${tooling.ytdlpPath}\nffmpeg: ${tooling.ffmpegPath}`}
                >
                  yt-dlp: {tooling.ytdlpOk ? "OK" : "missing"} · ffmpeg: {tooling.ffmpegOk ? "OK" : "missing"}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCookieTutorial(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all hover:scale-105 border"
              style={{
                color: theme.colors.warning,
                backgroundColor: `${theme.colors.warning}10`,
                borderColor: `${theme.colors.warning}30`,
              }}
            >
              <Cookie className="w-4 h-4" />
              <span className="hidden sm:inline font-medium">Cookie help</span>
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="p-2 rounded-lg transition-all hover:scale-105"
              style={{
                backgroundColor: theme.colors.cardHover,
                color: theme.colors.textSecondary,
              }}
              title="Settings"
            >
              <SettingsIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <VideoUrlCard
              url={url}
              onUrlChange={setUrl}
              onFetch={() => void fetchMetadata()}
              onClear={clearCurrentLink}
              loading={busyMeta}
            />
            {metaError && (
              <pre
                className="text-sm whitespace-pre-wrap rounded-lg border-2 p-4"
                style={{
                  borderColor: theme.colors.error,
                  color: theme.colors.error,
                  backgroundColor: `${theme.colors.error}10`,
                }}
              >
                {metaError}
              </pre>
            )}

            {!videoInfo && (
              <div
                className="rounded-xl p-6 border-2"
                style={{
                  background: `linear-gradient(135deg, ${theme.colors.gradientFrom}15, ${theme.colors.gradientTo}15)`,
                  borderColor: `${theme.colors.primary}30`,
                }}
              >
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: theme.colors.text }}>
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${theme.colors.primary}20` }}
                  >
                    <HelpCircle className="w-4 h-4" style={{ color: theme.colors.primary }} />
                  </div>
                  Quick start
                </h3>
                <div className="space-y-3 text-sm" style={{ color: theme.colors.textSecondary }}>
                  <p>1. Paste a URL and click Fetch info.</p>
                  <p>2. Choose format / resolution (or audio bitrate) and optional time clip.</p>
                  <p>3. Set download folder in Settings, then Add to download queue.</p>
                </div>
              </div>
            )}

            {videoInfo && (
              <>
                <VideoPreviewCard videoInfo={videoInfo} maxStreamHeight={availableMaxHeight} />
                <DownloadOptionsPanel
                  outputFormat={opts.outputFormat}
                  resolution={opts.resolution}
                  availableMaxHeight={availableMaxHeight}
                  audioKbps={opts.audioKbps}
                  timeStart={opts.timeStart}
                  timeEnd={opts.timeEnd}
                  clipPlaceholderStart={clipPlaceholders.start}
                  clipPlaceholderEnd={clipPlaceholders.end}
                  onOutputFormat={(f) =>
                    setOpts({
                      ...opts,
                      outputFormat: f,
                      burnInSubtitles: f === "mp4" ? opts.burnInSubtitles : false,
                    })
                  }
                  onResolution={(n) => setOpts({ ...opts, resolution: n })}
                  onAudioKbps={(n) => setOpts({ ...opts, audioKbps: n })}
                  onTimeStart={(v) => setOpts({ ...opts, timeStart: v })}
                  onTimeEnd={(v) => setOpts({ ...opts, timeEnd: v })}
                  subtitleLang={opts.subtitleLang}
                  onSubtitleLang={(v) =>
                    setOpts({
                      ...opts,
                      subtitleLang: v,
                      burnInSubtitles: v.trim()
                        ? opts.burnInSubtitles
                        : Boolean(settings.burnInSubtitles),
                    })
                  }
                  hardBurnFromSettings={Boolean(settings.burnInSubtitles)}
                  subtitleAvailability={subtitleAvailability}
                  onAddToQueue={handleAddToQueueClick}
                  onShowFormatGuide={() => setShowFormatGuide(true)}
                />
                {deferredListId && !playlistFromWatchExpanded && (
                  <div
                    className="rounded-xl border-2 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    style={{
                      backgroundColor: theme.colors.card,
                      borderColor: `${theme.colors.primary}55`,
                    }}
                  >
                    <div>
                      <h3 className="font-bold text-sm" style={{ color: theme.colors.text }}>
                        Playlist found
                      </h3>
                      <p className="text-xs mt-1" style={{ color: theme.colors.textMuted }}>
                        This link includes list <code className="text-[11px] opacity-90">{deferredListId}</code>.
                        Expand to load titles, then add individual videos with the options above.
                      </p>
                      {playlistLoadError && (
                        <pre
                          className="text-xs mt-2 whitespace-pre-wrap"
                          style={{ color: theme.colors.error }}
                        >
                          {playlistLoadError}
                        </pre>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={playlistBusy}
                      onClick={() => void loadDeferredPlaylist()}
                      className="shrink-0 px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50"
                      style={{
                        background: `linear-gradient(135deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`,
                        color: "white",
                      }}
                    >
                      {playlistBusy ? "Loading…" : "Expand playlist"}
                    </button>
                  </div>
                )}
                {playlistEntries && playlistEntries.length > 0 && (isPlaylistMeta || playlistFromWatchExpanded) && (
                  <div
                    className="rounded-xl border-2 p-5 space-y-3"
                    style={{
                      backgroundColor: theme.colors.card,
                      borderColor: theme.colors.border,
                    }}
                  >
                    <h3 className="font-bold" style={{ color: theme.colors.text }}>
                      Playlist ({playlistEntries.length} items, first 200 loaded)
                    </h3>
                    <button
                      type="button"
                      onClick={() => void enqueuePlaylistAll()}
                      className="px-4 py-2 rounded-lg text-sm font-semibold"
                      style={{
                        background: `linear-gradient(135deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`,
                        color: "white",
                      }}
                    >
                      Enqueue all
                    </button>
                    <div className="max-h-48 overflow-y-auto space-y-2 text-sm">
                      {playlistEntries.slice(0, 200).map((p) => (
                        <div key={p.url} className="flex justify-between gap-2 items-center">
                          <span className="truncate" style={{ color: theme.colors.textSecondary }}>
                            {p.title}
                          </span>
                          <button
                            type="button"
                            className="text-xs shrink-0 px-2 py-1 rounded border"
                            style={{ borderColor: theme.colors.border, color: theme.colors.primary }}
                            onClick={() =>
                              void invoke("enqueue_downloads", {
                                tasks: buildPayloadsForEnqueue(p.url, p.title),
                              }).then(() => refreshQueue())
                            }
                          >
                            Add to download queue
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="lg:col-span-1">
            <DownloadQueuePanel
              tasks={queue}
              logLines={logLines}
              onPause={(id) => void invoke("pause_task", { id })}
              onResume={(id) => void invoke("resume_task", { id })}
              onCancel={(id) => void invoke("cancel_task", { id })}
              onOpenFolder={(p) => void openReveal(p)}
            />
          </div>
        </div>
      </main>

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onShowCookieTutorial={() => {
            setShowSettings(false);
            setShowCookieTutorial(true);
          }}
          settings={settings}
          persistSettings={persistSettings}
          onPickFolder={() => void pickFolder()}
          onPickCookies={() => void pickCookiesYoutube()}
          skipConfirmation={skipConfirmation}
          onSkipConfirmationChange={setSkipConfirmation}
        />
      )}

      {showFormatGuide && <FormatGuide onClose={() => setShowFormatGuide(false)} />}
      {showCookieTutorial && <CookieTutorial onClose={() => setShowCookieTutorial(false)} />}

      {showConfirmation && videoInfo && (
        <DownloadConfirmation
          title={videoInfo.title}
          format={confirmFormat}
          quality={confirmQuality}
          onConfirm={() => void runEnqueueCurrent()}
          onCancel={() => setShowConfirmation(false)}
          dontShowAgain={skipConfirmation}
          onDontShowAgainChange={setSkipConfirmation}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}
