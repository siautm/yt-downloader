import { Pause, Play, X, CheckCircle, Loader2, AlertCircle, Download } from 'lucide-react';
import { QueueTask } from '../App';
import { useTheme } from '../contexts/ThemeContext';

interface DownloadQueueProps {
  tasks: QueueTask[];
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
}

export function DownloadQueue({ tasks, onPause, onResume, onCancel }: DownloadQueueProps) {
  const { theme } = useTheme();
  const getStatusIcon = (status: QueueTask['status'], theme: any) => {
    switch (status) {
      case 'downloading':
        return <Loader2 className="w-4 h-4 animate-spin" style={{ color: theme.colors.primary }} />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" style={{ color: theme.colors.success }} />;
      case 'failed':
        return <AlertCircle className="w-4 h-4" style={{ color: theme.colors.error }} />;
      case 'paused':
        return <Pause className="w-4 h-4" style={{ color: theme.colors.warning }} />;
      default:
        return <div className="w-4 h-4 rounded-full border-2" style={{ borderColor: theme.colors.border }} />;
    }
  };

  const getStatusText = (status: QueueTask['status']) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'downloading':
        return 'Downloading';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      case 'paused':
        return 'Paused';
    }
  };

  return (
    <div
      className="rounded-xl border-2 p-6 sticky top-24 shadow-lg"
      style={{
        backgroundColor: theme.colors.card,
        borderColor: theme.colors.border,
      }}
    >
      <h2 className="text-lg font-bold mb-5" style={{ color: theme.colors.text }}>
        Download Queue
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
          {tasks.map((task) => (
            <div
              key={task.id}
              className="rounded-lg border-2 p-4 space-y-3 transition-all hover:scale-[1.02]"
              style={{
                backgroundColor: theme.colors.bgSecondary,
                borderColor: theme.colors.border,
              }}
            >
              <div className="flex items-start gap-3">
                {getStatusIcon(task.status, theme)}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold truncate" style={{ color: theme.colors.text }}>
                    {task.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className="text-xs px-2 py-0.5 rounded font-medium"
                      style={{
                        backgroundColor: `${theme.colors.primary}20`,
                        color: theme.colors.primary,
                      }}
                    >
                      {task.format}
                    </span>
                    <span className="text-xs" style={{ color: theme.colors.textMuted }}>
                      •
                    </span>
                    <span className="text-xs font-medium" style={{ color: theme.colors.textMuted }}>
                      {task.quality}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => onCancel(task.id)}
                  className="p-1 rounded transition-all hover:scale-110"
                  style={{
                    backgroundColor: `${theme.colors.error}20`,
                    color: theme.colors.error,
                  }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Progress Bar */}
              {(task.status === 'downloading' || task.status === 'paused') && (
                <div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-medium" style={{ color: theme.colors.textSecondary }}>
                      {getStatusText(task.status)}
                    </span>
                    <span className="font-bold" style={{ color: theme.colors.primary }}>
                      {Math.round(task.progress)}%
                    </span>
                  </div>
                  <div
                    className="w-full rounded-full h-2 overflow-hidden"
                    style={{ backgroundColor: `${theme.colors.border}` }}
                  >
                    <div
                      className="h-full transition-all duration-300 rounded-full"
                      style={{
                        width: `${task.progress}%`,
                        background:
                          task.status === 'paused'
                            ? theme.colors.warning
                            : `linear-gradient(90deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Status Badge */}
              {(task.status === 'completed' || task.status === 'failed' || task.status === 'pending') && (
                <div className="text-xs">
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold"
                    style={{
                      backgroundColor:
                        task.status === 'completed'
                          ? `${theme.colors.success}20`
                          : task.status === 'failed'
                          ? `${theme.colors.error}20`
                          : `${theme.colors.border}`,
                      color:
                        task.status === 'completed'
                          ? theme.colors.success
                          : task.status === 'failed'
                          ? theme.colors.error
                          : theme.colors.textMuted,
                    }}
                  >
                    {getStatusText(task.status)}
                  </span>
                </div>
              )}

              {/* Controls */}
              {task.status === 'downloading' && (
                <button
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
              {task.status === 'paused' && (
                <button
                  onClick={() => onResume(task.id)}
                  className="w-full py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all hover:scale-105"
                  style={{
                    background: `linear-gradient(135deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`,
                    color: 'white',
                  }}
                >
                  <Play className="w-3 h-3" />
                  Resume
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

