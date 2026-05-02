import { Pause, Play, X, CheckCircle, Loader2, AlertCircle, Download, FolderOpen } from "lucide-react";
import type { QueueTask, TaskStatus } from "@/types";
import { useTheme } from "@/contexts/ThemeContext";

interface DownloadQueuePanelProps {
  tasks: QueueTask[];
  logLines: Record<string, string[]>;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onOpenFolder: (path: string) => void;
}

type VisualStatus = "pending" | "downloading" | "completed" | "failed" | "paused";

function toVisualStatus(s: TaskStatus): VisualStatus {
  if (s === "error" || s === "cancelled") return "failed";
  return s as VisualStatus;
}

function formatLabel(t: QueueTask): string {
  const f = t.options.outputFormat;
  return f.toUpperCase();
}

function qualityLabel(t: QueueTask): string {
  const sub = t.options.subtitleLang?.trim();
  const subBit = sub ? ` · sub:${sub}` : "";
  const burn = t.options.burnInSubtitles ? " · burn" : "";
  if (t.options.outputFormat === "mp4" || t.options.outputFormat === "mkv") {
    return `${t.options.resolution}p${subBit}${burn}`;
  }
  return `${t.options.audioKbps} kbps${subBit}${burn}`;
}

export function DownloadQueuePanel({
  tasks,
  logLines,
  onPause,
  onResume,
  onCancel,
  onOpenFolder,
}: DownloadQueuePanelProps) {
  const { theme } = useTheme();

  const iconFor = (vs: VisualStatus) => {
    switch (vs) {
      case "downloading":
        return <Download className="w-4 h-4" style={{ color: theme.colors.primary }} />;
      case "completed":
        return <CheckCircle className="w-4 h-4" style={{ color: theme.colors.success }} />;
      case "failed":
        return <AlertCircle className="w-4 h-4" style={{ color: theme.colors.error }} />;
      case "paused":
        return <Pause className="w-4 h-4" style={{ color: theme.colors.warning }} />;
      default:
        return <div className="w-4 h-4 rounded-full border-2" style={{ borderColor: theme.colors.border }} />;
    }
  };

  const labelFor = (vs: VisualStatus, task?: QueueTask) => {
    switch (vs) {
      case "pending":
        return "Pending";
      case "downloading": {
        const tot = task?.downloadPhaseTotal ?? 1;
        const cur = task?.downloadPhase ?? 1;
        if (tot > 1) return `Downloading (${cur}/${tot})`;
        return "Downloading";
      }
      case "completed":
        return "Completed";
      case "failed":
        return "Stopped / error";
      case "paused":
        return "Paused";
    }
  };

  return (
    <div
      className="rounded-xl border-2 p-6 lg:sticky lg:top-24 shadow-lg"
      style={{
        backgroundColor: theme.colors.card,
        borderColor: theme.colors.border,
      }}
    >
      <h2 className="text-lg font-bold mb-5" style={{ color: theme.colors.text }}>
        Download queue
      </h2>

      {tasks.length === 0 ? (
        <div className="text-center py-12" style={{ color: theme.colors.textMuted }}>
          <div
            className="w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${theme.colors.primary}10` }}
          >
            <Download className="w-8 h-8" style={{ color: theme.colors.primary }} />
          </div>
          <p className="text-sm font-medium">No downloads yet</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
          {tasks.map((task) => {
            const vs = toVisualStatus(task.status);
            return (
              <div
                key={task.id}
                className="rounded-lg border-2 p-4 space-y-3 transition-all hover:scale-[1.01]"
                style={{
                  backgroundColor: theme.colors.bgSecondary,
                  borderColor: theme.colors.border,
                }}
              >
                <div className="flex items-start gap-3">
                  {iconFor(vs)}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold truncate" style={{ color: theme.colors.text }}>
                      {task.title ?? task.url}
                    </h3>
                    <p className="text-xs truncate mt-0.5" style={{ color: theme.colors.textMuted }}>
                      {task.url}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className="text-xs px-2 py-0.5 rounded font-medium"
                        style={{
                          backgroundColor: `${theme.colors.primary}20`,
                          color: theme.colors.primary,
                        }}
                      >
                        {formatLabel(task)}
                      </span>
                      <span className="text-xs" style={{ color: theme.colors.textMuted }}>
                        •
                      </span>
                      <span className="text-xs font-medium" style={{ color: theme.colors.textMuted }}>
                        {qualityLabel(task)}
                      </span>
                    </div>
                  </div>
                  {(task.status === "pending" ||
                    task.status === "downloading" ||
                    task.status === "paused") && (
                    <button
                      type="button"
                      onClick={() => onCancel(task.id)}
                      className="p-1 rounded transition-all hover:scale-110"
                      style={{
                        backgroundColor: `${theme.colors.error}20`,
                        color: theme.colors.error,
                      }}
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {(task.status === "downloading" || task.status === "paused") && (
                  <div>
                    <div className="flex items-center gap-2 text-xs mb-2">
                      {task.status === "downloading" && (
                        <Loader2
                          className="w-5 h-5 shrink-0 animate-spin"
                          style={{ color: theme.colors.primary }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="font-medium" style={{ color: theme.colors.textSecondary }}>
                          {labelFor(vs, task)}
                          {task.status === "downloading" && task.speed ? ` · ${task.speed}` : ""}
                          {task.status === "downloading" && task.eta ? ` · ETA ${task.eta}` : ""}
                          {task.status === "downloading" && task.progress <= 0 && !task.speed && (
                            <span style={{ color: theme.colors.textMuted }}> · yt-dlp running…</span>
                          )}
                        </span>
                      </div>
                      {task.progress > 0 && (
                        <span className="font-bold shrink-0" style={{ color: theme.colors.primary }}>
                          {Math.round(task.progress)}%
                        </span>
                      )}
                    </div>
                    <div
                      className="w-full rounded-full h-2 overflow-hidden relative"
                      style={{ backgroundColor: theme.colors.border }}
                    >
                      {task.status === "downloading" && task.progress <= 0 ? (
                        <div
                          className="queue-indeterminate-fill h-full"
                          style={{
                            background: `linear-gradient(90deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`,
                          }}
                        />
                      ) : (
                        <div
                          className="h-full transition-all duration-300 rounded-full"
                          style={{
                            width: `${Math.min(100, Math.max(0, task.progress))}%`,
                            background:
                              task.status === "paused"
                                ? theme.colors.warning
                                : `linear-gradient(90deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`,
                          }}
                        />
                      )}
                    </div>
                  </div>
                )}

                {(task.status === "completed" ||
                  task.status === "error" ||
                  task.status === "cancelled" ||
                  task.status === "pending") && (
                  <div className="text-xs">
                    <span
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold"
                      style={{
                        backgroundColor:
                          task.status === "completed"
                            ? `${theme.colors.success}20`
                            : task.status === "pending"
                              ? `${theme.colors.border}`
                              : `${theme.colors.error}20`,
                        color:
                          task.status === "completed"
                            ? theme.colors.success
                            : task.status === "pending"
                              ? theme.colors.textMuted
                              : theme.colors.error,
                      }}
                    >
                      {task.status === "cancelled"
                        ? "Cancelled"
                        : task.status === "error"
                          ? "Error"
                          : labelFor(vs, task)}
                    </span>
                  </div>
                )}

                {task.error && (
                  <pre className="text-xs whitespace-pre-wrap break-words" style={{ color: theme.colors.error }}>
                    {task.error}
                  </pre>
                )}

                {task.status === "downloading" && (
                  <button
                    type="button"
                    onClick={() => onPause(task.id)}
                    className="w-full py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all hover:scale-105"
                    style={{
                      backgroundColor: `${theme.colors.warning}20`,
                      color: theme.colors.warning,
                    }}
                  >
                    <Pause className="w-3 h-3" />
                    Pause
                  </button>
                )}
                {task.status === "paused" && (
                  <button
                    type="button"
                    onClick={() => onResume(task.id)}
                    className="w-full py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all hover:scale-105"
                    style={{
                      background: `linear-gradient(135deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`,
                      color: "white",
                    }}
                  >
                    <Play className="w-3 h-3" />
                    Resume
                  </button>
                )}

                {task.status === "completed" && task.filePath && (
                  <button
                    type="button"
                    onClick={() => onOpenFolder(task.filePath!)}
                    className="w-full py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all hover:scale-105"
                    style={{
                      backgroundColor: `${theme.colors.primary}20`,
                      color: theme.colors.primary,
                    }}
                  >
                    <FolderOpen className="w-3 h-3" />
                    Open folder
                  </button>
                )}

                {logLines[task.id]?.length ? (
                  <details className="text-xs">
                    <summary style={{ color: theme.colors.textMuted }}>yt-dlp log</summary>
                    <pre className="mt-2 max-h-32 overflow-auto text-[10px] leading-snug" style={{ color: theme.colors.textSecondary }}>
                      {logLines[task.id].slice(-30).join("\n")}
                    </pre>
                  </details>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
