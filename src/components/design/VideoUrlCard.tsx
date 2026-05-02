import { Link, Loader2, Eraser } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

interface VideoUrlCardProps {
  url: string;
  onUrlChange: (url: string) => void;
  onFetch: () => void;
  onClear?: () => void;
  loading: boolean;
}

export function VideoUrlCard({ url, onUrlChange, onFetch, onClear, loading }: VideoUrlCardProps) {
  const { theme } = useTheme();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onFetch();
    }
  };

  return (
    <div
      className="rounded-xl border-2 p-6 shadow-lg"
      style={{
        backgroundColor: theme.colors.card,
        borderColor: theme.colors.border,
      }}
    >
      <h2 className="text-lg font-bold mb-4" style={{ color: theme.colors.text }}>
        Enter Video URL
      </h2>
      <div className="flex gap-3 flex-wrap sm:flex-nowrap">
        <div className="flex-1 relative min-w-[12rem]">
          <Link
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
            style={{ color: theme.colors.textMuted }}
          />
          <input
            type="text"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://youtube.com/watch?v=..."
            className="w-full border-2 rounded-lg px-10 py-3.5 text-sm focus:outline-none focus:ring-2 transition-all"
            style={{
              backgroundColor: theme.colors.bgSecondary,
              borderColor: theme.colors.border,
              color: theme.colors.text,
            }}
          />
        </div>
        <div className="flex gap-2 shrink-0">
          {onClear && (
            <button
              type="button"
              onClick={() => onClear()}
              disabled={loading || !url.trim()}
              className="px-4 py-3.5 rounded-lg font-semibold transition-all flex items-center gap-2 border-2 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
              style={{
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.bgSecondary,
                color: theme.colors.textSecondary,
              }}
              title="Clear URL and fetched info"
            >
              <Eraser className="w-4 h-4" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onFetch()}
            disabled={loading || !url.trim()}
            className="px-6 py-3.5 rounded-lg font-semibold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
            style={{
              background:
                loading || !url.trim()
                  ? theme.colors.cardHover
                  : `linear-gradient(135deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`,
              color: "white",
            }}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Fetching…
              </>
            ) : (
              "Fetch info"
            )}
          </button>
        </div>
      </div>
      <p className="text-xs mt-3" style={{ color: theme.colors.textMuted }}>
        Supports YouTube and other sites via yt-dlp (fetch may take up to ~25s).
      </p>
    </div>
  );
}
