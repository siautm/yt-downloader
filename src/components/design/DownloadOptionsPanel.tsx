import { useEffect, useMemo, useState } from "react";
import {
  Download,
  FileVideo,
  FileAudio,
  Music,
  HelpCircle,
  Sparkles,
  Subtitles,
  ChevronDown,
  ChevronUp,
  Check,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import type { OutputFormat } from "@/types";
import type { SubtitleAvailability } from "@/utils/ytSubtitles";
import { pickToggleSubtitleLang, groupPrimarySubtitleCodes, mergeSubtitleCodeKeys } from "@/utils/ytSubtitles";

const RESOLUTION_LADDER = [144, 240, 360, 480, 720, 1080, 1440, 2160, 4320] as const;
const AUDIO_KBPS = [128, 192, 320] as const;

interface DownloadOptionsPanelProps {
  outputFormat: OutputFormat;
  resolution: number;
  /** Max video height from yt-dlp formats; null = unknown, UI caps at 1080p ladder. */
  availableMaxHeight: number | null;
  audioKbps: number;
  timeStart: string | null;
  timeEnd: string | null;
  clipPlaceholderStart: string;
  clipPlaceholderEnd: string;
  onOutputFormat: (f: OutputFormat) => void;
  onResolution: (n: number) => void;
  onAudioKbps: (n: number) => void;
  onTimeStart: (v: string | null) => void;
  onTimeEnd: (v: string | null) => void;
  subtitleLang: string;
  onSubtitleLang: (v: string) => void;
  /** When Settings has “hard burn” enabled; download still uses soft mux + optional burn post-step. */
  hardBurnFromSettings: boolean;
  /** From yt-dlp `-J` `subtitles` / `automatic_captions` keys for the current video. */
  subtitleAvailability: SubtitleAvailability;
  onAddToQueue: () => void;
  onShowFormatGuide: () => void;
}

export function DownloadOptionsPanel({
  outputFormat,
  resolution,
  availableMaxHeight,
  audioKbps,
  timeStart,
  timeEnd,
  clipPlaceholderStart,
  clipPlaceholderEnd,
  onOutputFormat,
  onResolution,
  onAudioKbps,
  onTimeStart,
  onTimeEnd,
  subtitleLang,
  onSubtitleLang,
  hardBurnFromSettings,
  subtitleAvailability,
  onAddToQueue,
  onShowFormatGuide,
}: DownloadOptionsPanelProps) {
  const { theme } = useTheme();
  const [showOtherSubs, setShowOtherSubs] = useState(false);
  const [showExtraFormats, setShowExtraFormats] = useState(false);

  const mergedSubCodes = useMemo(
    () => mergeSubtitleCodeKeys(subtitleAvailability),
    [subtitleAvailability],
  );
  const groupedSubs = useMemo(() => groupPrimarySubtitleCodes(mergedSubCodes), [mergedSubCodes]);
  const selectedKey = subtitleLang.trim().toLowerCase();

  useEffect(() => {
    setShowOtherSubs(false);
  }, [mergedSubCodes.join("\u0001")]);

  useEffect(() => {
    if (outputFormat === "mkv") setShowExtraFormats(true);
  }, [outputFormat]);

  const resolutionCap = availableMaxHeight === null ? 1080 : availableMaxHeight;
  const resolutionChoices = RESOLUTION_LADDER.filter((r) => r <= resolutionCap);

  const primaryFormats: {
    value: OutputFormat;
    label: string;
    icon: typeof FileVideo;
    description: string;
    popular?: boolean;
  }[] = [
    { value: "mp4", label: "MP4 Video", icon: FileVideo, description: "Most compatible", popular: true },
    { value: "mp3", label: "MP3 Audio", icon: Music, description: "Universal audio", popular: true },
    { value: "m4a", label: "M4A Audio", icon: FileAudio, description: "AAC in M4A", popular: false },
  ];

  const extraFormats: {
    value: OutputFormat;
    label: string;
    icon: typeof FileVideo;
    description: string;
  }[] = [
    {
      value: "mkv",
      label: "MKV (Matroska)",
      icon: FileVideo,
      description: "Merged video+audio; soft subs embed well. Hard burn (Settings) is MP4-only.",
    },
  ];

  return (
    <div
      className="rounded-xl border-2 p-6 space-y-6 shadow-lg"
      style={{
        backgroundColor: theme.colors.card,
        borderColor: theme.colors.border,
      }}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold" style={{ color: theme.colors.text }}>
          Download options
        </h2>
        <button
          type="button"
          onClick={onShowFormatGuide}
          className="flex items-center gap-2 text-sm transition-all hover:scale-105"
          style={{ color: theme.colors.primary }}
        >
          <HelpCircle className="w-4 h-4" />
          Format guide
        </button>
      </div>

      <div>
        <label className="text-sm font-semibold mb-3 block" style={{ color: theme.colors.text }}>
          Format
        </label>
        <div className="grid grid-cols-3 gap-3">
          {primaryFormats.map(({ value, label, icon: Icon, description, popular }) => (
            <button
              type="button"
              key={value}
              onClick={() => onOutputFormat(value)}
              className="relative p-4 rounded-lg border-2 transition-all hover:scale-105 active:scale-95"
              style={{
                borderColor: outputFormat === value ? theme.colors.primary : theme.colors.border,
                backgroundColor:
                  outputFormat === value ? `${theme.colors.primary}15` : theme.colors.bgSecondary,
              }}
            >
              {popular && (
                <div
                  className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1"
                  style={{
                    backgroundColor: theme.colors.warning,
                    color: "white",
                  }}
                >
                  <Sparkles className="w-3 h-3" />
                  Popular
                </div>
              )}
              <Icon
                className="w-6 h-6 mx-auto mb-2"
                style={{
                  color: outputFormat === value ? theme.colors.primary : theme.colors.textMuted,
                }}
              />
              <div className="text-sm font-semibold" style={{ color: theme.colors.text }}>
                {label}
              </div>
              <div className="text-xs mt-1" style={{ color: theme.colors.textMuted }}>
                {description}
              </div>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowExtraFormats((v) => !v)}
          className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-all"
          style={{
            borderColor: theme.colors.border,
            color: theme.colors.textSecondary,
            backgroundColor: theme.colors.bgSecondary,
          }}
        >
          {showExtraFormats ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {showExtraFormats ? "Hide extra format" : "More formats"}
        </button>
        {showExtraFormats && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {extraFormats.map(({ value, label, icon: Icon, description }) => (
              <button
                type="button"
                key={value}
                onClick={() => onOutputFormat(value)}
                className="relative p-4 rounded-lg border-2 transition-all hover:scale-105 active:scale-95 text-left"
                style={{
                  borderColor: outputFormat === value ? theme.colors.primary : theme.colors.border,
                  backgroundColor:
                    outputFormat === value ? `${theme.colors.primary}15` : theme.colors.bgSecondary,
                }}
              >
                <Icon
                  className="w-6 h-6 mb-2"
                  style={{
                    color: outputFormat === value ? theme.colors.primary : theme.colors.textMuted,
                  }}
                />
                <div className="text-sm font-semibold" style={{ color: theme.colors.text }}>
                  {label}
                </div>
                <div className="text-xs mt-1" style={{ color: theme.colors.textMuted }}>
                  {description}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {outputFormat === "mp4" || outputFormat === "mkv" ? (
        <div>
          <label className="text-sm font-semibold mb-2 block" style={{ color: theme.colors.text }}>
            Max resolution
          </label>
          {availableMaxHeight !== null && (
            <p className="text-xs mb-3" style={{ color: theme.colors.textMuted }}>
              Detected streams up to {availableMaxHeight}p.
            </p>
          )}
          <div className="grid grid-cols-3 gap-2">
            {resolutionChoices.map((r) => (
              <button
                type="button"
                key={r}
                onClick={() => onResolution(r)}
                className="py-2.5 px-2 rounded-lg transition-all border-2 text-sm font-semibold hover:scale-105"
                style={{
                  backgroundColor: resolution === r ? theme.colors.primary : theme.colors.bgSecondary,
                  borderColor: resolution === r ? theme.colors.primary : theme.colors.border,
                  color: resolution === r ? "white" : theme.colors.textSecondary,
                }}
              >
                {r}p
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <label className="text-sm font-semibold mb-3 block" style={{ color: theme.colors.text }}>
            Audio bitrate
          </label>
          <div className="grid grid-cols-3 gap-2">
            {AUDIO_KBPS.map((k) => (
              <button
                type="button"
                key={k}
                onClick={() => onAudioKbps(k)}
                className="py-2.5 px-2 rounded-lg transition-all border-2 text-sm font-semibold hover:scale-105"
                style={{
                  backgroundColor: audioKbps === k ? theme.colors.primary : theme.colors.bgSecondary,
                  borderColor: audioKbps === k ? theme.colors.primary : theme.colors.border,
                  color: audioKbps === k ? "white" : theme.colors.textSecondary,
                }}
              >
                {k} kbps
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: theme.colors.text }}>
          <Subtitles className="w-4 h-4" style={{ color: theme.colors.primary }} />
          Subtitles (YouTube / yt-dlp)
        </label>
        <div
          className="rounded-xl border-2 p-4 mb-3"
          style={{
            borderStyle: subtitleLang.trim() ? "solid" : "dashed",
            borderColor: subtitleLang.trim() ? theme.colors.success : theme.colors.border,
            backgroundColor: subtitleLang.trim() ? `${theme.colors.success}12` : `${theme.colors.border}14`,
          }}
        >
          {subtitleLang.trim() ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-2 min-w-0">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${theme.colors.success}28` }}
                >
                  <Check className="w-5 h-5" style={{ color: theme.colors.success }} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold" style={{ color: theme.colors.text }}>
                    Selected:{" "}
                    <code className="font-mono text-sm px-1.5 py-0.5 rounded" style={{ backgroundColor: theme.colors.bgSecondary }}>
                      {subtitleLang.trim()}
                    </code>
                  </p>
                  <p className="text-xs mt-1" style={{ color: theme.colors.textSecondary }}>
                    {outputFormat !== "mp4" && outputFormat !== "mkv"
                      ? "Subtitles apply to video formats only; for audio formats yt-dlp may still save a subtitle file next to the output when possible."
                      : "Default: soft subtitles — muxed into the file as a separate track (VLC / mpv; some stock players ignore them)."}
                  </p>
                  {outputFormat === "mp4" && subtitleLang.trim() && (
                    <p className="text-xs mt-2 leading-snug" style={{ color: theme.colors.textMuted }}>
                      On PC, <strong style={{ color: theme.colors.text }}>VLC</strong> may not show embedded subs until you use{" "}
                      <strong style={{ color: theme.colors.text }}>Subtitle → Subtitle track</strong> and pick the track
                      (the subs are still inside the MP4; other phones/TV apps often auto-pick them). After each download this
                      app runs a quick ffmpeg pass to mark that track as <strong style={{ color: theme.colors.text }}>default</strong>{" "}
                      so VLC is more likely to turn it on without a sidecar <code className="text-[11px]">.srt</code>. Prefer{" "}
                      <strong style={{ color: theme.colors.text }}>MKV</strong> under &quot;More formats&quot; if you want the most reliable soft-sub experience on Windows.
                    </p>
                  )}
                  {outputFormat === "mp4" && hardBurnFromSettings && (
                    <p
                      className="text-xs mt-2 px-2 py-1.5 rounded-lg border"
                      style={{
                        borderColor: `${theme.colors.warning}55`,
                        backgroundColor: `${theme.colors.warning}12`,
                        color: theme.colors.textSecondary,
                      }}
                    >
                      <span className="font-semibold" style={{ color: theme.colors.warning }}>
                        Settings: hard burn on.
                      </span>{" "}
                      After download the app will re-encode video to draw subtitles (CPU-heavy). Turn off in Settings if
                      you only need soft subs.
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onSubtitleLang("")}
                className="shrink-0 text-xs font-semibold px-3 py-2 rounded-lg border-2 transition-all hover:scale-105"
                style={{
                  borderColor: theme.colors.border,
                  color: theme.colors.textSecondary,
                  backgroundColor: theme.colors.card,
                }}
              >
                Clear selection
              </button>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border-2"
                style={{ borderColor: theme.colors.border, color: theme.colors.textMuted }}
              >
                <Subtitles className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: theme.colors.textMuted }}>
                  No subtitle selected
                </p>
                <p className="text-xs mt-1" style={{ color: theme.colors.textMuted }}>
                  Pick <strong style={{ color: theme.colors.text }}>one</strong> language below (tap again to deselect). For
                  MP4, nothing is downloaded or embedded until you choose — the file will have{" "}
                  <strong style={{ color: theme.colors.text }}>no subtitle track</strong> if you leave this empty.
                </p>
              </div>
            </div>
          )}
        </div>
        <p className="text-xs mb-2" style={{ color: theme.colors.textMuted }}>
          Only one track. Green = manual, blue = auto (YouTube); a thick ring + check = your current choice.
        </p>
        {subtitleAvailability.manual.length > 0 || subtitleAvailability.auto.length > 0 ? (
          <div className="mb-3 rounded-lg border-2 p-3 space-y-3" style={{ borderColor: theme.colors.border }}>
            <p className="text-xs font-semibold" style={{ color: theme.colors.text }}>
              Detected subtitles
            </p>
            <p className="text-[10px] leading-relaxed" style={{ color: theme.colors.textMuted }}>
              Showing <strong style={{ color: theme.colors.text }}>English</strong>,{" "}
              <strong style={{ color: theme.colors.text }}>Mandarin (简体系)</strong>, and{" "}
              <strong style={{ color: theme.colors.text }}>Japanese</strong> first. Expand for all other codes.
            </p>

            {groupedSubs.english.length === 0 &&
              groupedSubs.mandarin.length === 0 &&
              groupedSubs.japanese.length === 0 &&
              groupedSubs.other.length > 0 && (
                <p className="text-[10px]" style={{ color: theme.colors.warning }}>
                  No English / Mandarin (简体) / Japanese keys in this response — open “other languages” below.
                </p>
              )}

            {groupedSubs.english.length > 0 && (
              <div>
                <div className="text-[10px] mb-1 font-semibold" style={{ color: theme.colors.textSecondary }}>
                  English
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {groupedSubs.english.map((code) => {
                    const inMan = subtitleAvailability.manual.includes(code);
                    const inAuto = subtitleAvailability.auto.includes(code);
                    const selected = selectedKey === code.toLowerCase();
                    return (
                      <button
                        type="button"
                        key={`sub-en-${code}`}
                        onClick={() => onSubtitleLang(pickToggleSubtitleLang(subtitleLang, code))}
                        className="text-[11px] px-2 py-1 rounded-md border-2 font-mono transition-all hover:scale-105 flex items-center gap-1"
                        style={{
                          borderColor: selected
                            ? theme.colors.primary
                            : inMan
                              ? `${theme.colors.success}66`
                              : `${theme.colors.primary}66`,
                          color: selected ? theme.colors.text : inMan ? theme.colors.success : theme.colors.primary,
                          backgroundColor: selected
                            ? `${theme.colors.primary}22`
                            : inMan
                              ? `${theme.colors.success}14`
                              : `${theme.colors.primary}14`,
                          boxShadow:
                            selected
                              ? `0 0 0 2px ${theme.colors.primary}55`
                              : inMan && inAuto
                                ? `inset 0 0 0 1px ${theme.colors.primary}55`
                                : undefined,
                        }}
                        title={`Select ${code}${inMan ? " · manual" : ""}${inAuto ? " · auto" : ""} (tap again to clear)`}
                      >
                        {selected ? <Check className="w-3 h-3 shrink-0" style={{ color: theme.colors.primary }} /> : null}
                        {code}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {groupedSubs.mandarin.length > 0 && (
              <div>
                <div className="text-[10px] mb-1 font-semibold" style={{ color: theme.colors.textSecondary }}>
                  中文（普通话 / 简体）
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {groupedSubs.mandarin.map((code) => {
                    const inMan = subtitleAvailability.manual.includes(code);
                    const inAuto = subtitleAvailability.auto.includes(code);
                    const selected = selectedKey === code.toLowerCase();
                    return (
                      <button
                        type="button"
                        key={`sub-zh-${code}`}
                        onClick={() => onSubtitleLang(pickToggleSubtitleLang(subtitleLang, code))}
                        className="text-[11px] px-2 py-1 rounded-md border-2 font-mono transition-all hover:scale-105 flex items-center gap-1"
                        style={{
                          borderColor: selected
                            ? theme.colors.primary
                            : inMan
                              ? `${theme.colors.success}66`
                              : `${theme.colors.primary}66`,
                          color: selected ? theme.colors.text : inMan ? theme.colors.success : theme.colors.primary,
                          backgroundColor: selected
                            ? `${theme.colors.primary}22`
                            : inMan
                              ? `${theme.colors.success}14`
                              : `${theme.colors.primary}14`,
                          boxShadow:
                            selected
                              ? `0 0 0 2px ${theme.colors.primary}55`
                              : inMan && inAuto
                                ? `inset 0 0 0 1px ${theme.colors.primary}55`
                                : undefined,
                        }}
                        title={`Select ${code}${inMan ? " · manual" : ""}${inAuto ? " · auto" : ""}`}
                      >
                        {selected ? <Check className="w-3 h-3 shrink-0" style={{ color: theme.colors.primary }} /> : null}
                        {code}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {groupedSubs.japanese.length > 0 && (
              <div>
                <div className="text-[10px] mb-1 font-semibold" style={{ color: theme.colors.textSecondary }}>
                  日本語
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {groupedSubs.japanese.map((code) => {
                    const inMan = subtitleAvailability.manual.includes(code);
                    const inAuto = subtitleAvailability.auto.includes(code);
                    const selected = selectedKey === code.toLowerCase();
                    return (
                      <button
                        type="button"
                        key={`sub-ja-${code}`}
                        onClick={() => onSubtitleLang(pickToggleSubtitleLang(subtitleLang, code))}
                        className="text-[11px] px-2 py-1 rounded-md border-2 font-mono transition-all hover:scale-105 flex items-center gap-1"
                        style={{
                          borderColor: selected
                            ? theme.colors.primary
                            : inMan
                              ? `${theme.colors.success}66`
                              : `${theme.colors.primary}66`,
                          color: selected ? theme.colors.text : inMan ? theme.colors.success : theme.colors.primary,
                          backgroundColor: selected
                            ? `${theme.colors.primary}22`
                            : inMan
                              ? `${theme.colors.success}14`
                              : `${theme.colors.primary}14`,
                          boxShadow:
                            selected
                              ? `0 0 0 2px ${theme.colors.primary}55`
                              : inMan && inAuto
                                ? `inset 0 0 0 1px ${theme.colors.primary}55`
                                : undefined,
                        }}
                        title={`Select ${code}${inMan ? " · manual" : ""}${inAuto ? " · auto" : ""}`}
                      >
                        {selected ? <Check className="w-3 h-3 shrink-0" style={{ color: theme.colors.primary }} /> : null}
                        {code}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {groupedSubs.other.length > 0 && (
              <div className="pt-1 border-t space-y-2" style={{ borderColor: theme.colors.border }}>
                {!showOtherSubs ? (
                  <button
                    type="button"
                    onClick={() => setShowOtherSubs(true)}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold border-2 transition-all hover:scale-[1.01]"
                    style={{
                      borderColor: theme.colors.border,
                      color: theme.colors.textSecondary,
                      backgroundColor: theme.colors.bgSecondary,
                    }}
                  >
                    <ChevronDown className="w-4 h-4" />
                    Other languages ({groupedSubs.other.length})
                  </button>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold" style={{ color: theme.colors.text }}>
                        All other languages
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowOtherSubs(false)}
                        className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md border"
                        style={{ borderColor: theme.colors.border, color: theme.colors.primary }}
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                        Show less
                      </button>
                    </div>
                    {subtitleAvailability.manual.some((c) => groupedSubs.other.includes(c)) && (
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <span
                          className="text-[10px] uppercase tracking-wide shrink-0"
                          style={{ color: theme.colors.textMuted }}
                        >
                          Manual
                        </span>
                        {subtitleAvailability.manual
                          .filter((c) => groupedSubs.other.includes(c))
                          .map((code) => {
                            const selected = selectedKey === code.toLowerCase();
                            return (
                              <button
                                type="button"
                                key={`sub-o-manual-${code}`}
                                onClick={() => onSubtitleLang(pickToggleSubtitleLang(subtitleLang, code))}
                                className="text-[11px] px-2 py-1 rounded-md border-2 font-mono transition-all hover:scale-105 flex items-center gap-1"
                                style={{
                                  borderColor: selected ? theme.colors.primary : `${theme.colors.success}55`,
                                  color: selected ? theme.colors.text : theme.colors.success,
                                  backgroundColor: selected ? `${theme.colors.primary}22` : `${theme.colors.success}12`,
                                  boxShadow: selected ? `0 0 0 2px ${theme.colors.primary}55` : undefined,
                                }}
                                title={`Select ${code}`}
                              >
                                {selected ? (
                                  <Check className="w-3 h-3 shrink-0" style={{ color: theme.colors.primary }} />
                                ) : null}
                                {code}
                              </button>
                            );
                          })}
                      </div>
                    )}
                    {subtitleAvailability.auto.some((c) => groupedSubs.other.includes(c)) && (
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <span
                          className="text-[10px] uppercase tracking-wide shrink-0"
                          style={{ color: theme.colors.textMuted }}
                        >
                          Auto (CC)
                        </span>
                        {subtitleAvailability.auto
                          .filter((c) => groupedSubs.other.includes(c))
                          .map((code) => {
                            const selected = selectedKey === code.toLowerCase();
                            return (
                              <button
                                type="button"
                                key={`sub-o-auto-${code}`}
                                onClick={() => onSubtitleLang(pickToggleSubtitleLang(subtitleLang, code))}
                                className="text-[11px] px-2 py-1 rounded-md border-2 font-mono transition-all hover:scale-105 flex items-center gap-1"
                                style={{
                                  borderColor: selected ? theme.colors.primary : `${theme.colors.primary}55`,
                                  color: selected ? theme.colors.text : theme.colors.primary,
                                  backgroundColor: selected ? `${theme.colors.primary}22` : `${theme.colors.primary}12`,
                                  boxShadow: selected ? `0 0 0 2px ${theme.colors.primary}55` : undefined,
                                }}
                                title={`Select ${code}`}
                              >
                                {selected ? (
                                  <Check className="w-3 h-3 shrink-0" style={{ color: theme.colors.primary }} />
                                ) : null}
                                {code}
                              </button>
                            );
                          })}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

          </div>
        ) : (
          <div className="space-y-2 mb-3">
            <p className="text-xs" style={{ color: theme.colors.textMuted }}>
              No subtitle list in fetch metadata. Enter a single yt-dlp language code if you still want one (e.g.{" "}
              <code className="text-[11px] opacity-90">en</code>, <code className="text-[11px] opacity-90">zh-Hans</code>
              ).
            </p>
            <input
              type="text"
              value={subtitleLang}
              onChange={(e) => onSubtitleLang(e.target.value.replace(/,/g, ""))}
              placeholder="One code only, e.g. zh-Hans"
              maxLength={32}
              className="w-full border-2 rounded-lg px-3 py-2 text-sm focus:outline-none font-mono"
              style={{
                backgroundColor: theme.colors.bgSecondary,
                borderColor: theme.colors.border,
                color: theme.colors.text,
              }}
            />
          </div>
        )}
      </div>

      <div>
        <label className="text-sm font-semibold mb-3 block" style={{ color: theme.colors.text }}>
          Time clip (optional)
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs mb-1 block" style={{ color: theme.colors.textMuted }}>
              Start
            </label>
            <input
              type="text"
              placeholder={clipPlaceholderStart}
              value={timeStart ?? ""}
              onChange={(e) =>
                onTimeStart(e.target.value.trim() ? e.target.value.trim() : null)
              }
              className="w-full border-2 rounded-lg px-3 py-2 text-sm focus:outline-none transition-all"
              style={{
                backgroundColor: theme.colors.bgSecondary,
                borderColor: theme.colors.border,
                color: theme.colors.text,
              }}
            />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: theme.colors.textMuted }}>
              End
            </label>
            <input
              type="text"
              placeholder={clipPlaceholderEnd}
              value={timeEnd ?? ""}
              onChange={(e) => onTimeEnd(e.target.value.trim() ? e.target.value.trim() : null)}
              className="w-full border-2 rounded-lg px-3 py-2 text-sm focus:outline-none transition-all"
              style={{
                backgroundColor: theme.colors.bgSecondary,
                borderColor: theme.colors.border,
                color: theme.colors.text,
              }}
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onAddToQueue}
        className="w-full py-4 rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-xl hover:scale-105 active:scale-95"
        style={{
          background: `linear-gradient(135deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`,
          color: "white",
          boxShadow: `0 10px 40px ${theme.colors.primary}40`,
        }}
      >
        <Download className="w-5 h-5" />
        Add to download queue
      </button>
    </div>
  );
}
