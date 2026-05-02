import { useState } from 'react';
import { Download, FileVideo, FileAudio, Music, ChevronDown, ChevronUp, Film, HelpCircle, Sparkles } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface DownloadOptionsProps {
  selectedFormat: string;
  selectedQuality: string;
  timeClip: { start: string; end: string };
  onFormatChange: (format: string) => void;
  onQualityChange: (quality: string) => void;
  onTimeClipChange: (clip: { start: string; end: string }) => void;
  onDownload: () => void;
  onShowFormatGuide: () => void;
}

export function DownloadOptions({
  selectedFormat,
  selectedQuality,
  timeClip,
  onFormatChange,
  onQualityChange,
  onTimeClipChange,
  onDownload,
  onShowFormatGuide,
}: DownloadOptionsProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { theme } = useTheme();

  const basicFormats = [
    { value: 'mp4', label: 'MP4 Video', icon: FileVideo, description: 'Most compatible', popular: true },
    { value: 'mp3', label: 'MP3 Audio', icon: Music, description: 'Universal audio', popular: true },
    { value: 'm4a', label: 'M4A Audio', icon: FileAudio, description: 'Better quality', popular: false },
  ];

  const advancedFormats = [
    { value: 'webm', label: 'WebM Video', icon: Film, description: 'Smaller size', popular: false },
    { value: 'mkv', label: 'MKV Video', icon: FileVideo, description: 'High quality', popular: false },
    { value: 'opus', label: 'OPUS Audio', icon: Music, description: 'Best efficiency', popular: false },
  ];

  const allFormats = showAdvanced ? [...basicFormats, ...advancedFormats] : basicFormats;

  const videoQualities = [
    { value: '2160p', label: '4K UHD', info: '3840×2160' },
    { value: '1440p', label: '2K QHD', info: '2560×1440' },
    { value: '1080p', label: 'Full HD (1K)', info: '1920×1080' },
    { value: '720p', label: 'HD', info: '1280×720' },
    { value: '480p', label: 'SD', info: '854×480' },
    { value: '360p', label: 'Low', info: '640×360' },
  ];

  const audioQualities = [
    { value: '320K', label: 'Highest', info: '~2.4 MB/min' },
    { value: '256K', label: 'High', info: '~1.9 MB/min' },
    { value: '192K', label: 'Good', info: '~1.4 MB/min' },
    { value: '128K', label: 'Medium', info: '~1 MB/min' },
    { value: '96K', label: 'Low', info: '~0.7 MB/min' },
  ];

  const isVideoFormat = ['mp4', 'webm', 'mkv'].includes(selectedFormat);
  const qualities = isVideoFormat ? videoQualities : audioQualities;

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
          Download Options
        </h2>
        <button
          onClick={onShowFormatGuide}
          className="flex items-center gap-2 text-sm transition-all hover:scale-105"
          style={{ color: theme.colors.primary }}
        >
          <HelpCircle className="w-4 h-4" />
          Format Guide
        </button>
      </div>

      {/* Format Selection */}
      <div>
        <label className="text-sm font-semibold mb-3 block" style={{ color: theme.colors.text }}>
          Format
        </label>
        <div className="grid grid-cols-3 gap-3">
          {allFormats.map(({ value, label, icon: Icon, description, popular }) => (
            <button
              key={value}
              onClick={() => onFormatChange(value)}
              className="relative p-4 rounded-lg border-2 transition-all hover:scale-105 active:scale-95"
              style={{
                borderColor: selectedFormat === value ? theme.colors.primary : theme.colors.border,
                backgroundColor: selectedFormat === value ? `${theme.colors.primary}15` : theme.colors.bgSecondary,
              }}
            >
              {popular && (
                <div
                  className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1"
                  style={{
                    backgroundColor: theme.colors.warning,
                    color: 'white',
                  }}
                >
                  <Sparkles className="w-3 h-3" />
                  Popular
                </div>
              )}
              <Icon
                className="w-6 h-6 mx-auto mb-2"
                style={{ color: selectedFormat === value ? theme.colors.primary : theme.colors.textMuted }}
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
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="mt-3 w-full py-2 text-sm flex items-center justify-center gap-2 transition-all hover:opacity-80"
          style={{ color: theme.colors.textMuted }}
        >
          {showAdvanced ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Show Less
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              Show Advanced Formats
            </>
          )}
        </button>
      </div>

      {/* Quality Selection */}
      <div>
        <label className="text-sm font-semibold mb-3 block" style={{ color: theme.colors.text }}>
          {isVideoFormat ? 'Resolution' : 'Bitrate'}
        </label>
        <div className="grid grid-cols-3 gap-3">
          {qualities.map(({ value, label, info }) => (
            <button
              key={value}
              onClick={() => onQualityChange(value)}
              className="py-3 px-3 rounded-lg transition-all border-2 hover:scale-105 active:scale-95"
              style={{
                backgroundColor: selectedQuality === value ? theme.colors.primary : theme.colors.bgSecondary,
                borderColor: selectedQuality === value ? theme.colors.primary : theme.colors.border,
                color: selectedQuality === value ? 'white' : theme.colors.textSecondary,
              }}
            >
              <div className="font-bold text-sm">{value}</div>
              <div className="text-xs opacity-90 mt-0.5">{label}</div>
              <div className="text-xs opacity-75 mt-0.5">{info}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Time Clip */}
      <div>
        <label className="text-sm font-semibold mb-3 block" style={{ color: theme.colors.text }}>
          Time Clip (Optional)
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs mb-1 block" style={{ color: theme.colors.textMuted }}>
              Start Time
            </label>
            <input
              type="text"
              placeholder="00:00:00"
              value={timeClip.start}
              onChange={(e) => onTimeClipChange({ ...timeClip, start: e.target.value })}
              className="w-full border-2 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-all"
              style={{
                backgroundColor: theme.colors.bgSecondary,
                borderColor: theme.colors.border,
                color: theme.colors.text,
              }}
            />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: theme.colors.textMuted }}>
              End Time
            </label>
            <input
              type="text"
              placeholder="00:05:30"
              value={timeClip.end}
              onChange={(e) => onTimeClipChange({ ...timeClip, end: e.target.value })}
              className="w-full border-2 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-all"
              style={{
                backgroundColor: theme.colors.bgSecondary,
                borderColor: theme.colors.border,
                color: theme.colors.text,
              }}
            />
          </div>
        </div>
      </div>

      {/* Download Button */}
      <button
        onClick={onDownload}
        className="w-full py-4 rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-xl hover:scale-105 active:scale-95"
        style={{
          background: `linear-gradient(135deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`,
          color: 'white',
          boxShadow: `0 10px 40px ${theme.colors.primary}40`,
        }}
      >
        <Download className="w-5 h-5" />
        Add to Queue
      </button>
    </div>
  );
}
