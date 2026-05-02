import { Clock, User } from "lucide-react";
import type { VideoInfo } from "@/design/videoTypes";
import { useTheme } from "@/contexts/ThemeContext";

interface VideoPreviewCardProps {
  videoInfo: VideoInfo;
  /** Max height from yt-dlp formats (e.g. 720, 2160). */
  maxStreamHeight?: number | null;
}

export function VideoPreviewCard({ videoInfo, maxStreamHeight }: VideoPreviewCardProps) {
  const { theme } = useTheme();
  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className="rounded-xl border-2 overflow-hidden shadow-lg hover:shadow-xl transition-all"
      style={{
        backgroundColor: theme.colors.card,
        borderColor: theme.colors.border,
      }}
    >
      <div className="relative aspect-video" style={{ backgroundColor: theme.colors.bgSecondary }}>
        <img src={videoInfo.thumbnail} alt="" className="w-full h-full object-cover" />
        <div className="absolute bottom-3 right-3 flex flex-col items-end gap-2">
          {typeof maxStreamHeight === "number" && maxStreamHeight > 0 && (
            <div
              className="px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg backdrop-blur-sm"
              style={{
                backgroundColor: `${theme.colors.primary}dd`,
                color: "white",
              }}
            >
              Up to {maxStreamHeight}p
            </div>
          )}
          <div
            className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg backdrop-blur-sm"
            style={{
              backgroundColor: `${theme.colors.card}ee`,
              color: theme.colors.text,
            }}
          >
            <Clock className="w-3.5 h-3.5" />
            {formatDuration(videoInfo.duration)}
          </div>
        </div>
      </div>
      <div className="p-5">
        <h3 className="font-bold text-lg mb-3" style={{ color: theme.colors.text }}>
          {videoInfo.title}
        </h3>
        <div className="flex items-center gap-2 text-sm" style={{ color: theme.colors.textMuted }}>
          <User className="w-4 h-4" style={{ color: theme.colors.primary }} />
          <span>{videoInfo.uploader}</span>
        </div>
      </div>
    </div>
  );
}
