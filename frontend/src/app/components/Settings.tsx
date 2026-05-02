import { useState } from 'react';
import { X, Folder, File, Cookie, HelpCircle, Bell } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { ThemeSwitcher } from './ThemeSwitcher';

interface SettingsProps {
  onClose: () => void;
  onShowCookieTutorial: () => void;
  skipConfirmation: boolean;
  onSkipConfirmationChange: (value: boolean) => void;
}

export function Settings({ onClose, onShowCookieTutorial, skipConfirmation, onSkipConfirmationChange }: SettingsProps) {
  const [hasCookies, setHasCookies] = useState(false);
  const { theme } = useTheme();
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className="border rounded-xl max-w-2xl w-full max-h-[85vh] overflow-hidden shadow-2xl"
        style={{
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-6 border-b"
          style={{ borderColor: theme.colors.border }}
        >
          <h2 className="text-xl font-bold" style={{ color: theme.colors.text }}>
            Settings
          </h2>
          <button
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

        {/* Content */}
        <div className="p-6 space-y-8 overflow-y-auto max-h-[calc(85vh-160px)]">
          {/* Theme Section */}
          <ThemeSwitcher />
          {/* Download Location */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold mb-3" style={{ color: theme.colors.text }}>
              <Folder className="w-4 h-4" style={{ color: theme.colors.primary }} />
              Download Location
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value="C:\Users\Downloads\Videos"
                readOnly
                className="flex-1 border rounded-lg px-4 py-2.5 text-sm"
                style={{
                  backgroundColor: theme.colors.bgSecondary,
                  borderColor: theme.colors.border,
                  color: theme.colors.textSecondary,
                }}
              />
              <button
                className="px-4 py-2.5 rounded-lg text-sm font-medium transition-all hover:scale-105"
                style={{
                  backgroundColor: theme.colors.primary,
                  color: 'white',
                }}
              >
                Browse
              </button>
            </div>
          </div>

          {/* Filename Template */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold mb-3" style={{ color: theme.colors.text }}>
              <File className="w-4 h-4" style={{ color: theme.colors.primary }} />
              Filename Template
            </label>
            <input
              type="text"
              value="%(title)s.%(ext)s"
              className="w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all"
              style={{
                backgroundColor: theme.colors.bgSecondary,
                borderColor: theme.colors.border,
                color: theme.colors.textSecondary,
              }}
            />
            <p className="text-xs mt-2" style={{ color: theme.colors.textMuted }}>
              Available: %(title)s, %(uploader)s, %(upload_date)s, %(ext)s
            </p>
          </div>

          {/* YouTube Cookies */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="flex items-center gap-2 text-sm font-semibold" style={{ color: theme.colors.text }}>
                <Cookie className="w-4 h-4" style={{ color: theme.colors.primary }} />
                YouTube Cookies File
              </label>
              <button
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
                placeholder="No file selected"
                value={hasCookies ? "youtube_cookies.txt" : ""}
                readOnly
                className="flex-1 border rounded-lg px-4 py-2.5 text-sm"
                style={{
                  backgroundColor: theme.colors.bgSecondary,
                  borderColor: theme.colors.border,
                  color: theme.colors.textSecondary,
                }}
              />
              <button
                onClick={() => setHasCookies(!hasCookies)}
                className="px-4 py-2.5 rounded-lg text-sm font-medium transition-all hover:scale-105"
                style={{
                  backgroundColor: theme.colors.cardHover,
                  color: theme.colors.text,
                }}
              >
                Upload
              </button>
            </div>
            {!hasCookies && (
              <div
                className="mt-3 border rounded-lg p-3 flex items-start gap-3"
                style={{
                  backgroundColor: `${theme.colors.warning}10`,
                  borderColor: `${theme.colors.warning}30`,
                }}
              >
                <Cookie className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: theme.colors.warning }} />
                <div className="text-xs" style={{ color: theme.colors.textSecondary }}>
                  <p className="font-semibold mb-1" style={{ color: theme.colors.warning }}>
                    No cookies uploaded
                  </p>
                  <p className="mb-2">Some videos may require YouTube cookies (age-restricted, private, or region-locked).</p>
                  <button
                    onClick={onShowCookieTutorial}
                    className="underline hover:opacity-80 font-medium"
                    style={{ color: theme.colors.primary }}
                  >
                    Learn how to export cookies →
                  </button>
                </div>
              </div>
            )}
            {hasCookies && (
              <p className="text-xs mt-2 flex items-center gap-1" style={{ color: theme.colors.success }}>
                <span className="font-bold">✓</span> Cookies loaded. You can now download restricted videos.
              </p>
            )}
          </div>

          {/* Notifications */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold mb-3" style={{ color: theme.colors.text }}>
              <Bell className="w-4 h-4" style={{ color: theme.colors.primary }} />
              Notifications
            </label>
            <label
              className="flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-all hover:scale-[1.02]"
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
                  Add to queue without showing confirmation dialog
                </div>
              </div>
              <input
                type="checkbox"
                checked={skipConfirmation}
                onChange={(e) => onSkipConfirmationChange(e.target.checked)}
                className="w-5 h-5 rounded cursor-pointer"
                style={{
                  accentColor: theme.colors.primary,
                }}
              />
            </label>
          </div>

          {/* Default Format */}
          <div>
            <label className="text-sm font-semibold mb-3 block" style={{ color: theme.colors.text }}>
              Default Format
            </label>
            <select
              className="w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
              style={{
                backgroundColor: theme.colors.bgSecondary,
                borderColor: theme.colors.border,
                color: theme.colors.textSecondary,
              }}
            >
              <option>MP4 Video (1080p)</option>
              <option>MP4 Video (720p)</option>
              <option>MP3 Audio (320K)</option>
              <option>M4A Audio (256K)</option>
            </select>
          </div>

          {/* Concurrent Downloads */}
          <div>
            <label className="text-sm font-semibold mb-3 block" style={{ color: theme.colors.text }}>
              Max Concurrent Downloads
            </label>
            <input
              type="number"
              value="1"
              min="1"
              max="5"
              className="w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
              style={{
                backgroundColor: theme.colors.bgSecondary,
                borderColor: theme.colors.border,
                color: theme.colors.textSecondary,
              }}
            />
            <p className="text-xs mt-2" style={{ color: theme.colors.textMuted }}>
              Downloads run sequentially by default for stability
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-6" style={{ borderColor: theme.colors.border }}>
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg text-sm font-medium transition-all hover:scale-105"
              style={{
                backgroundColor: theme.colors.cardHover,
                color: theme.colors.text,
              }}
            >
              Cancel
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg text-sm font-medium transition-all hover:scale-105"
              style={{
                background: `linear-gradient(135deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`,
                color: 'white',
              }}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
