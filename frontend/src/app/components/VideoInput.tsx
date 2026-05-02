import { useState } from 'react';
import { Link, Loader2 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface VideoInputProps {
  onFetch: (url: string) => void;
}

export function VideoInput({ onFetch }: VideoInputProps) {
  const { theme } = useTheme();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFetch = () => {
    if (!url.trim()) return;
    setLoading(true);
    onFetch(url);
    setTimeout(() => setLoading(false), 800);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFetch();
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
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Link
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
            style={{ color: theme.colors.textMuted }}
          />
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="https://youtube.com/watch?v=..."
            className="w-full border-2 rounded-lg px-10 py-3.5 text-sm focus:outline-none focus:ring-2 transition-all"
            style={{
              backgroundColor: theme.colors.bgSecondary,
              borderColor: theme.colors.border,
              color: theme.colors.text,
            }}
          />
        </div>
        <button
          onClick={handleFetch}
          disabled={loading || !url.trim()}
          className="px-6 py-3.5 rounded-lg font-semibold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
          style={{
            background: loading || !url.trim() ? theme.colors.cardHover : `linear-gradient(135deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`,
            color: 'white',
          }}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Fetching...
            </>
          ) : (
            'Fetch Info'
          )}
        </button>
      </div>
      <div className="flex items-center justify-between mt-3">
        <p className="text-xs" style={{ color: theme.colors.textMuted }}>
          Supports YouTube, Vimeo, Twitter, and 1000+ sites via yt-dlp
        </p>
      </div>
    </div>
  );
}
