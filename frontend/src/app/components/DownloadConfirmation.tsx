import { Download, X, CheckCircle2 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface DownloadConfirmationProps {
  title: string;
  format: string;
  quality: string;
  onConfirm: () => void;
  onCancel: () => void;
  dontShowAgain: boolean;
  onDontShowAgainChange: (value: boolean) => void;
}

export function DownloadConfirmation({
  title,
  format,
  quality,
  onConfirm,
  onCancel,
  dontShowAgain,
  onDontShowAgainChange,
}: DownloadConfirmationProps) {
  const { theme } = useTheme();

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div
        className="border-2 rounded-xl max-w-md w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200"
        style={{
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: theme.colors.border }}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${theme.colors.primary}20` }}
            >
              <Download className="w-5 h-5" style={{ color: theme.colors.primary }} />
            </div>
            <h2 className="text-lg font-bold" style={{ color: theme.colors.text }}>
              Add to Download Queue?
            </h2>
          </div>
          <button
            onClick={onCancel}
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
        <div className="p-6 space-y-4">
          <p className="text-sm font-medium" style={{ color: theme.colors.textSecondary }}>
            You're about to download the following video:
          </p>

          <div
            className="border-2 rounded-lg p-4 space-y-3"
            style={{
              backgroundColor: theme.colors.bgSecondary,
              borderColor: theme.colors.border,
            }}
          >
            <div>
              <div className="text-xs mb-1 font-semibold" style={{ color: theme.colors.textMuted }}>
                Title
              </div>
              <div className="text-sm font-semibold line-clamp-2" style={{ color: theme.colors.text }}>
                {title}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs mb-1 font-semibold" style={{ color: theme.colors.textMuted }}>
                  Format
                </div>
                <div
                  className="text-sm font-bold px-2 py-1 rounded inline-block"
                  style={{
                    color: theme.colors.primary,
                    backgroundColor: `${theme.colors.primary}20`,
                  }}
                >
                  {format}
                </div>
              </div>
              <div>
                <div className="text-xs mb-1 font-semibold" style={{ color: theme.colors.textMuted }}>
                  Quality
                </div>
                <div
                  className="text-sm font-bold px-2 py-1 rounded inline-block"
                  style={{
                    color: theme.colors.success,
                    backgroundColor: `${theme.colors.success}20`,
                  }}
                >
                  {quality}
                </div>
              </div>
            </div>
          </div>

          <div
            className="border rounded-lg p-3 flex items-start gap-3"
            style={{
              backgroundColor: `${theme.colors.primary}10`,
              borderColor: `${theme.colors.primary}30`,
            }}
          >
            <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: theme.colors.primary }} />
            <div className="text-xs" style={{ color: theme.colors.textSecondary }}>
              <p className="font-bold mb-1" style={{ color: theme.colors.primary }}>
                Download will start shortly
              </p>
              <p>The video will be added to the queue and processed sequentially. Monitor progress in the queue panel.</p>
            </div>
          </div>

          {/* Don't show again checkbox */}
          <label className="flex items-center gap-2 text-sm cursor-pointer hover:opacity-80 transition-opacity" style={{ color: theme.colors.textSecondary }}>
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => onDontShowAgainChange(e.target.checked)}
              className="w-4 h-4 rounded cursor-pointer"
              style={{ accentColor: theme.colors.primary }}
            />
            <span className="font-medium">Don't show this confirmation again</span>
          </label>
        </div>

        {/* Actions */}
        <div className="border-t p-5 flex items-center justify-end gap-3" style={{ borderColor: theme.colors.border }}>
          <button
            onClick={onCancel}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all hover:scale-105"
            style={{
              backgroundColor: theme.colors.cardHover,
              color: theme.colors.text,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all hover:scale-105 flex items-center gap-2 shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`,
              color: 'white',
            }}
          >
            <Download className="w-4 h-4" />
            Add to Queue
          </button>
        </div>
      </div>
    </div>
  );
}
