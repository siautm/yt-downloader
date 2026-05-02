import { useState } from "react";
import { X, Folder, File, Cookie, HelpCircle, Bell, AlertTriangle } from "lucide-react";
import type { AppSettings, OutputFormat } from "@/types";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeSwitcher } from "@/components/design/ThemeSwitcher";

const RESOLUTIONS = [144, 240, 360, 480, 720, 1080] as const;
const AUDIO_KBPS = [128, 192, 320] as const;

interface SettingsModalProps {
  onClose: () => void;
  onShowCookieTutorial: () => void;
  settings: AppSettings;
  persistSettings: (next: AppSettings) => Promise<void>;
  onPickFolder: () => void;
  onPickCookies: () => void;
  skipConfirmation: boolean;
  onSkipConfirmationChange: (v: boolean) => void;
}

export function SettingsModal({
  onClose,
  onShowCookieTutorial,
  settings,
  persistSettings,
  onPickFolder,
  onPickCookies,
  skipConfirmation,
  onSkipConfirmationChange,
}: SettingsModalProps) {
  const { theme } = useTheme();
  const [burnConfirmOpen, setBurnConfirmOpen] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className="border rounded-xl max-w-2xl w-full max-h-[85vh] overflow-hidden shadow-2xl"
        style={{
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        }}
      >
        <div
          className="flex items-center justify-between p-6 border-b"
          style={{ borderColor: theme.colors.border }}
        >
          <h2 className="text-xl font-bold" style={{ color: theme.colors.text }}>
            Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg transition-all hover:scale-110"
            style={{
              backgroundColor: theme.colors.cardHover,
              color: theme.colors.textSecondary,
            }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-8 overflow-y-auto max-h-[calc(85vh-160px)]">
          <ThemeSwitcher />

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold mb-3" style={{ color: theme.colors.text }}>
              <Folder className="w-4 h-4" style={{ color: theme.colors.primary }} />
              Download folder
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                readOnly
                value={settings.downloadDir || "(not set)"}
                className="flex-1 border rounded-lg px-4 py-2.5 text-sm"
                style={{
                  backgroundColor: theme.colors.bgSecondary,
                  borderColor: theme.colors.border,
                  color: theme.colors.textSecondary,
                }}
              />
              <button
                type="button"
                onClick={() => void onPickFolder()}
                className="px-4 py-2.5 rounded-lg text-sm font-medium transition-all hover:scale-105"
                style={{
                  backgroundColor: theme.colors.primary,
                  color: "white",
                }}
              >
                Browse
              </button>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold mb-3" style={{ color: theme.colors.text }}>
              <File className="w-4 h-4" style={{ color: theme.colors.primary }} />
              Filename template
            </label>
            <input
              type="text"
              value={settings.outputTemplate}
              onChange={(e) => void persistSettings({ ...settings, outputTemplate: e.target.value })}
              className="w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all"
              style={{
                backgroundColor: theme.colors.bgSecondary,
                borderColor: theme.colors.border,
                color: theme.colors.textSecondary,
              }}
            />
            <p className="text-xs mt-2" style={{ color: theme.colors.textMuted }}>
              e.g. %(title)s_%(height)sp.%(ext)s
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="flex items-center gap-2 text-sm font-semibold" style={{ color: theme.colors.text }}>
                <Cookie className="w-4 h-4" style={{ color: theme.colors.primary }} />
                YouTube cookies (anti-bot)
              </label>
              <button
                type="button"
                onClick={onShowCookieTutorial}
                className="flex items-center gap-1 text-xs transition-colors hover:opacity-80"
                style={{ color: theme.colors.primary }}
              >
                <HelpCircle className="w-3 h-3" />
                How to import?
              </button>
            </div>
            <div className="flex gap-3">
              <input
                type="text"
                readOnly
                placeholder="No file selected"
                value={settings.cookiesYoutubeFile}
                className="flex-1 border rounded-lg px-4 py-2.5 text-sm"
                style={{
                  backgroundColor: theme.colors.bgSecondary,
                  borderColor: theme.colors.border,
                  color: theme.colors.textSecondary,
                }}
              />
              <button
                type="button"
                onClick={() => void onPickCookies()}
                className="px-4 py-2.5 rounded-lg text-sm font-medium transition-all hover:scale-105"
                style={{
                  backgroundColor: theme.colors.cardHover,
                  color: theme.colors.text,
                }}
              >
                Upload
              </button>
              <button
                type="button"
                onClick={() => void persistSettings({ ...settings, cookiesYoutubeFile: "" })}
                className="px-4 py-2.5 rounded-lg text-sm font-medium transition-all hover:scale-105 border"
                style={{
                  borderColor: theme.colors.border,
                  color: theme.colors.textSecondary,
                }}
              >
                Clear
              </button>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold mb-3" style={{ color: theme.colors.text }}>
              <Bell className="w-4 h-4" style={{ color: theme.colors.primary }} />
              Queue
            </label>
            <label
              className="flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-all hover:scale-[1.01]"
              style={{
                backgroundColor: theme.colors.bgSecondary,
                borderColor: theme.colors.border,
              }}
            >
              <div>
                <div className="text-sm font-medium" style={{ color: theme.colors.text }}>
                  Skip download confirmation
                </div>
                <div className="text-xs mt-0.5" style={{ color: theme.colors.textMuted }}>
                  Add to queue without confirmation dialog
                </div>
              </div>
              <input
                type="checkbox"
                checked={skipConfirmation}
                onChange={(e) => onSkipConfirmationChange(e.target.checked)}
                className="w-5 h-5 rounded cursor-pointer"
                style={{ accentColor: theme.colors.primary }}
              />
            </label>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold mb-3" style={{ color: theme.colors.text }}>
              <AlertTriangle className="w-4 h-4" style={{ color: theme.colors.warning }} />
              Hard subtitles (burn into video)
            </label>
            <label
              className="flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-all hover:scale-[1.01]"
              style={{
                backgroundColor: theme.colors.bgSecondary,
                borderColor: theme.colors.border,
              }}
            >
              <div>
                <div className="text-sm font-medium" style={{ color: theme.colors.text }}>
                  Enable hard subtitle burn-in
                </div>
                <div className="text-xs mt-0.5" style={{ color: theme.colors.textMuted }}>
                  Off by default. When on, MP4 + subtitle downloads re-encode the whole video with ffmpeg (high CPU,
                  longer time). Soft subtitles stay the default mux unless this is on.
                </div>
              </div>
              <input
                type="checkbox"
                checked={Boolean(settings.burnInSubtitles)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setBurnConfirmOpen(true);
                  } else {
                    void persistSettings({ ...settings, burnInSubtitles: false });
                  }
                }}
                className="w-5 h-5 rounded cursor-pointer"
                style={{ accentColor: theme.colors.primary }}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="block text-sm font-semibold" style={{ color: theme.colors.text }}>
              Default format
              <select
                className="mt-2 w-full border rounded-lg px-3 py-2 text-sm"
                style={{
                  backgroundColor: theme.colors.bgSecondary,
                  borderColor: theme.colors.border,
                  color: theme.colors.textSecondary,
                }}
                value={settings.defaultFormat}
                onChange={(e) =>
                  void persistSettings({
                    ...settings,
                    defaultFormat: e.target.value as OutputFormat,
                  })
                }
              >
                <option value="mp4">mp4</option>
                <option value="mkv">mkv</option>
                <option value="mp3">mp3</option>
                <option value="m4a">m4a</option>
              </select>
            </label>
            <label className="block text-sm font-semibold" style={{ color: theme.colors.text }}>
              Default resolution
              <select
                className="mt-2 w-full border rounded-lg px-3 py-2 text-sm"
                style={{
                  backgroundColor: theme.colors.bgSecondary,
                  borderColor: theme.colors.border,
                  color: theme.colors.textSecondary,
                }}
                value={settings.defaultResolution}
                onChange={(e) =>
                  void persistSettings({
                    ...settings,
                    defaultResolution: Number(e.target.value),
                  })
                }
              >
                {RESOLUTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}p
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold" style={{ color: theme.colors.text }}>
              Default audio kbps
              <select
                className="mt-2 w-full border rounded-lg px-3 py-2 text-sm"
                style={{
                  backgroundColor: theme.colors.bgSecondary,
                  borderColor: theme.colors.border,
                  color: theme.colors.textSecondary,
                }}
                value={settings.defaultAudioKbps}
                onChange={(e) =>
                  void persistSettings({
                    ...settings,
                    defaultAudioKbps: Number(e.target.value),
                  })
                }
              >
                {AUDIO_KBPS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="border-t p-6 flex justify-end" style={{ borderColor: theme.colors.border }}>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg text-sm font-medium transition-all hover:scale-105"
            style={{
              background: `linear-gradient(135deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`,
              color: "white",
            }}
          >
            Done
          </button>
        </div>
      </div>

      {burnConfirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70">
          <div
            className="max-w-md w-full rounded-xl border-2 p-6 shadow-2xl"
            style={{
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.warning,
            }}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="burn-warn-title"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" style={{ color: theme.colors.warning }} />
              <div>
                <h3 id="burn-warn-title" className="font-bold text-lg" style={{ color: theme.colors.text }}>
                  Turn on hard subtitles?
                </h3>
                <p className="text-sm mt-2 leading-relaxed" style={{ color: theme.colors.textSecondary }}>
                  Each affected download will <strong style={{ color: theme.colors.text }}>re-encode the entire video</strong>{" "}
                  to draw text on every frame. Expect <strong style={{ color: theme.colors.text }}>high CPU use</strong>, fan
                  noise, and longer waits — similar to exporting from an editor, not a quick remux.
                </p>
                <p className="text-sm mt-2" style={{ color: theme.colors.textMuted }}>
                  Soft subtitles (default) stay compatible with VLC and many players without this cost.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                className="px-4 py-2 rounded-lg text-sm font-medium border"
                style={{ borderColor: theme.colors.border, color: theme.colors.text }}
                onClick={() => setBurnConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{
                  backgroundColor: theme.colors.warning,
                  color: "#0f172a",
                }}
                onClick={() => {
                  void persistSettings({ ...settings, burnInSubtitles: true });
                  setBurnConfirmOpen(false);
                }}
              >
                I understand — enable
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
