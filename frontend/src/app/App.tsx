import { useState } from 'react';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { VideoInput } from './components/VideoInput';
import { VideoPreview } from './components/VideoPreview';
import { DownloadOptions } from './components/DownloadOptions';
import { DownloadQueue } from './components/DownloadQueue';
import { Settings } from './components/Settings';
import { FormatGuide } from './components/FormatGuide';
import { CookieTutorial } from './components/CookieTutorial';
import { DownloadConfirmation } from './components/DownloadConfirmation';
import { Settings as SettingsIcon, Download, Cookie, HelpCircle } from 'lucide-react';

export interface VideoInfo {
  title: string;
  thumbnail: string;
  duration: number;
  uploader: string;
  formats: Array<{
    format_id: string;
    resolution: string;
    ext: string;
  }>;
}

export interface QueueTask {
  id: string;
  title: string;
  url: string;
  format: string;
  quality: string;
  status: 'pending' | 'downloading' | 'completed' | 'failed' | 'paused';
  progress: number;
}

function AppContent() {
  const { theme } = useTheme();
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [queue, setQueue] = useState<QueueTask[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showFormatGuide, setShowFormatGuide] = useState(false);
  const [showCookieTutorial, setShowCookieTutorial] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [skipConfirmation, setSkipConfirmation] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState('mp4');
  const [selectedQuality, setSelectedQuality] = useState('1080p');
  const [timeClip, setTimeClip] = useState({ start: '', end: '' });

  const handleFetchVideo = (url: string) => {
    // Mock video info based on sample URL
    setTimeout(() => {
      setVideoInfo({
        title: 'Sample Video - Amazing Nature Documentary 4K',
        thumbnail: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=450&fit=crop',
        duration: 3845,
        uploader: 'Nature Channel',
        formats: [
          { format_id: '1', resolution: '2160p', ext: 'mp4' },
          { format_id: '2', resolution: '1080p', ext: 'mp4' },
          { format_id: '3', resolution: '720p', ext: 'mp4' },
          { format_id: '4', resolution: '480p', ext: 'mp4' },
        ],
      });
    }, 800);
  };

  const handleDownloadClick = () => {
    if (!videoInfo) return;

    if (skipConfirmation) {
      executeDownload();
    } else {
      setShowConfirmation(true);
    }
  };

  const executeDownload = () => {
    if (!videoInfo) return;

    const newTask: QueueTask = {
      id: Date.now().toString(),
      title: videoInfo.title,
      url: 'sample-url',
      format: selectedFormat.toUpperCase(),
      quality: selectedQuality,
      status: 'pending',
      progress: 0,
    };

    setQueue([...queue, newTask]);
    setShowConfirmation(false);

    // Simulate download progress
    setTimeout(() => {
      setQueue(prev => prev.map(task =>
        task.id === newTask.id ? { ...task, status: 'downloading' as const } : task
      ));

      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          setQueue(prev => prev.map(task =>
            task.id === newTask.id
              ? { ...task, status: 'completed' as const, progress: 100 }
              : task
          ));
        } else {
          setQueue(prev => prev.map(task =>
            task.id === newTask.id ? { ...task, progress } : task
          ));
        }
      }, 500);
    }, 1000);
  };

  const handlePauseTask = (id: string) => {
    setQueue(prev => prev.map(task =>
      task.id === id && task.status === 'downloading'
        ? { ...task, status: 'paused' as const }
        : task
    ));
  };

  const handleResumeTask = (id: string) => {
    setQueue(prev => prev.map(task =>
      task.id === id && task.status === 'paused'
        ? { ...task, status: 'downloading' as const }
        : task
    ));
  };

  const handleCancelTask = (id: string) => {
    setQueue(prev => prev.filter(task => task.id !== id));
  };

  const handleFormatChange = (format: string) => {
    setSelectedFormat(format);
    // Auto-adjust quality based on format
    const isVideoFormat = ['mp4', 'webm', 'mkv'].includes(format);
    if (isVideoFormat) {
      setSelectedQuality('1080p');
    } else {
      setSelectedQuality('256K');
    }
  };

  return (
    <div
      className="min-h-screen transition-colors duration-300"
      style={{
        backgroundColor: theme.colors.bg,
        color: theme.colors.text,
      }}
    >
      {/* Header */}
      <header
        className="border-b px-6 py-5 backdrop-blur-sm sticky top-0 z-40"
        style={{
          backgroundColor: `${theme.colors.card}dd`,
          borderColor: theme.colors.border,
        }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`,
              }}
            >
              <Download className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-bold text-xl" style={{ color: theme.colors.text }}>
              Video Downloader
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCookieTutorial(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all hover:scale-105 border"
              style={{
                color: theme.colors.warning,
                backgroundColor: `${theme.colors.warning}10`,
                borderColor: `${theme.colors.warning}30`,
              }}
              title="Learn how to import YouTube cookies"
            >
              <Cookie className="w-4 h-4" />
              <span className="hidden sm:inline font-medium">Cookie Help</span>
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-lg transition-all hover:scale-105"
              style={{
                backgroundColor: theme.colors.cardHover,
                color: theme.colors.textSecondary,
              }}
              title="Settings"
            >
              <SettingsIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Input & Preview */}
          <div className="lg:col-span-2 space-y-6">
            <VideoInput onFetch={handleFetchVideo} />

            {/* Helpful Tips Banner - shows when no video is loaded */}
            {!videoInfo && (
              <div
                className="rounded-xl p-6 border-2"
                style={{
                  background: `linear-gradient(135deg, ${theme.colors.gradientFrom}15, ${theme.colors.gradientTo}15)`,
                  borderColor: `${theme.colors.primary}30`,
                }}
              >
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: theme.colors.text }}>
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${theme.colors.primary}20` }}
                  >
                    <HelpCircle className="w-4 h-4" style={{ color: theme.colors.primary }} />
                  </div>
                  Quick Start Guide
                </h3>
                <div className="space-y-3 text-sm" style={{ color: theme.colors.textSecondary }}>
                  <div className="flex items-start gap-3">
                    <span
                      className="font-bold w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0"
                      style={{
                        backgroundColor: theme.colors.primary,
                        color: 'white',
                      }}
                    >
                      1
                    </span>
                    <p>Paste any video URL above and click "Fetch Info" to preview</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span
                      className="font-bold w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0"
                      style={{
                        backgroundColor: theme.colors.secondary,
                        color: 'white',
                      }}
                    >
                      2
                    </span>
                    <p>Choose your preferred format and quality before downloading</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span
                      className="font-bold w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0"
                      style={{
                        backgroundColor: theme.colors.warning,
                        color: 'white',
                      }}
                    >
                      3
                    </span>
                    <div className="flex-1">
                      <p className="mb-2">Having trouble with restricted videos?</p>
                      <button
                        onClick={() => setShowCookieTutorial(true)}
                        className="inline-flex items-center gap-2 underline font-medium hover:opacity-80 transition-opacity"
                        style={{ color: theme.colors.warning }}
                      >
                        <Cookie className="w-4 h-4" />
                        Learn how to import YouTube cookies →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {videoInfo && (
              <>
                <VideoPreview videoInfo={videoInfo} />
                <DownloadOptions
                  selectedFormat={selectedFormat}
                  selectedQuality={selectedQuality}
                  timeClip={timeClip}
                  onFormatChange={handleFormatChange}
                  onQualityChange={setSelectedQuality}
                  onTimeClipChange={setTimeClip}
                  onDownload={handleDownloadClick}
                  onShowFormatGuide={() => setShowFormatGuide(true)}
                />
              </>
            )}
          </div>

          {/* Right Column - Queue */}
          <div className="lg:col-span-1">
            <DownloadQueue
              tasks={queue}
              onPause={handlePauseTask}
              onResume={handleResumeTask}
              onCancel={handleCancelTask}
            />
          </div>
        </div>
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <Settings
          onClose={() => setShowSettings(false)}
          onShowCookieTutorial={() => {
            setShowSettings(false);
            setShowCookieTutorial(true);
          }}
          skipConfirmation={skipConfirmation}
          onSkipConfirmationChange={setSkipConfirmation}
        />
      )}

      {/* Format Guide Modal */}
      {showFormatGuide && (
        <FormatGuide onClose={() => setShowFormatGuide(false)} />
      )}

      {/* Cookie Tutorial Modal */}
      {showCookieTutorial && (
        <CookieTutorial onClose={() => setShowCookieTutorial(false)} />
      )}

      {/* Download Confirmation */}
      {showConfirmation && videoInfo && (
        <DownloadConfirmation
          title={videoInfo.title}
          format={selectedFormat.toUpperCase()}
          quality={selectedQuality}
          onConfirm={executeDownload}
          onCancel={() => setShowConfirmation(false)}
          dontShowAgain={skipConfirmation}
          onDontShowAgainChange={setSkipConfirmation}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}