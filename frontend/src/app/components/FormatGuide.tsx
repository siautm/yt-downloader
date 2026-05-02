import { X, FileVideo, Music, Film, HardDrive, Gauge } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface FormatGuideProps {
  onClose: () => void;
}

export function FormatGuide({ onClose }: FormatGuideProps) {
  const { theme } = useTheme();
  const videoFormats = [
    {
      name: 'MP4',
      icon: FileVideo,
      quality: 'High',
      compatibility: 'Excellent',
      description: 'Most compatible video format. Works on all devices and platforms.',
      bestFor: 'General use, sharing, streaming',
      fileSize: 'Medium',
    },
    {
      name: 'WebM',
      icon: Film,
      quality: 'High',
      compatibility: 'Good',
      description: 'Open-source format with excellent compression. Mainly for web use.',
      bestFor: 'Web streaming, smaller file sizes',
      fileSize: 'Small',
    },
    {
      name: 'MKV',
      icon: FileVideo,
      quality: 'Highest',
      compatibility: 'Good',
      description: 'Container format supporting multiple audio/subtitle tracks.',
      bestFor: 'Archiving, movies with subtitles',
      fileSize: 'Large',
    },
  ];

  const audioFormats = [
    {
      name: 'MP3',
      icon: Music,
      quality: 'Good',
      compatibility: 'Excellent',
      description: 'Universal audio format. Works everywhere.',
      bestFor: 'Music libraries, podcasts, general use',
      fileSize: 'Small',
    },
    {
      name: 'M4A',
      icon: Music,
      quality: 'Better',
      compatibility: 'Excellent',
      description: 'AAC audio in MP4 container. Better quality than MP3 at same bitrate.',
      bestFor: 'Apple devices, high-quality audio',
      fileSize: 'Small',
    },
    {
      name: 'OPUS',
      icon: Music,
      quality: 'Best',
      compatibility: 'Good',
      description: 'Modern codec with superior quality. Excellent for low bitrates.',
      bestFor: 'High efficiency, voice recordings',
      fileSize: 'Very Small',
    },
  ];

  const resolutions = [
    {
      name: '2160p',
      label: '4K UHD',
      pixels: '3840 × 2160',
      estSize: '3-8 GB/hour',
      description: 'Ultra High Definition. Cinema quality.',
      icon: '🎬',
    },
    {
      name: '1440p',
      label: '2K QHD',
      pixels: '2560 × 1440',
      estSize: '2-5 GB/hour',
      description: 'Quad HD. Great for large screens.',
      icon: '📺',
    },
    {
      name: '1080p',
      label: 'Full HD (1K)',
      pixels: '1920 × 1080',
      estSize: '1-3 GB/hour',
      description: 'Full High Definition. Standard for most content.',
      icon: '💻',
    },
    {
      name: '720p',
      label: 'HD',
      pixels: '1280 × 720',
      estSize: '500 MB-1.5 GB/hour',
      description: 'High Definition. Good balance of quality and size.',
      icon: '📱',
    },
    {
      name: '480p',
      label: 'SD',
      pixels: '854 × 480',
      estSize: '300-700 MB/hour',
      description: 'Standard Definition. Smaller file size.',
      icon: '📲',
    },
    {
      name: '360p',
      label: 'Low',
      pixels: '640 × 360',
      estSize: '150-400 MB/hour',
      description: 'Lower quality. Minimal storage needed.',
      icon: '⚡',
    },
  ];

  const audioBitrates = [
    { bitrate: '320K', quality: 'Highest', size: '~2.4 MB/min', description: 'Near CD quality' },
    { bitrate: '256K', quality: 'High', size: '~1.9 MB/min', description: 'Excellent for music' },
    { bitrate: '192K', quality: 'Good', size: '~1.4 MB/min', description: 'Standard quality' },
    { bitrate: '128K', quality: 'Medium', size: '~1 MB/min', description: 'Acceptable for most' },
    { bitrate: '96K', quality: 'Low', size: '~0.7 MB/min', description: 'Voice/podcasts' },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div
        className="border-2 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
        style={{
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-6 border-b sticky top-0 z-10 backdrop-blur-sm"
          style={{
            backgroundColor: `${theme.colors.card}ee`,
            borderColor: theme.colors.border,
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`,
              }}
            >
              <HardDrive className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold" style={{ color: theme.colors.text }}>
              Format & Quality Guide
            </h2>
          </div>
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
        <div className="p-6 space-y-8 overflow-y-auto max-h-[calc(90vh-88px)]">
          {/* Video Formats */}
          <section>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileVideo className="w-5 h-5 text-blue-400" />
              Video Formats
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {videoFormats.map((format) => (
                <div
                  key={format.name}
                  className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <format.icon className="w-6 h-6 text-blue-400" />
                    <div>
                      <h4 className="font-semibold">{format.name}</h4>
                      <p className="text-xs text-gray-500">File size: {format.fileSize}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-400">{format.description}</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Quality:</span>
                      <span className="text-green-400">{format.quality}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Compatibility:</span>
                      <span className="text-blue-400">{format.compatibility}</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-gray-800">
                    <p className="text-xs text-gray-500">
                      <span className="font-medium text-gray-400">Best for:</span> {format.bestFor}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Audio Formats */}
          <section>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Music className="w-5 h-5 text-purple-400" />
              Audio Formats
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {audioFormats.map((format) => (
                <div
                  key={format.name}
                  className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <format.icon className="w-6 h-6 text-purple-400" />
                    <div>
                      <h4 className="font-semibold">{format.name}</h4>
                      <p className="text-xs text-gray-500">File size: {format.fileSize}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-400">{format.description}</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Quality:</span>
                      <span className="text-green-400">{format.quality}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Compatibility:</span>
                      <span className="text-blue-400">{format.compatibility}</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-gray-800">
                    <p className="text-xs text-gray-500">
                      <span className="font-medium text-gray-400">Best for:</span> {format.bestFor}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Video Resolutions */}
          <section>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Gauge className="w-5 h-5 text-orange-400" />
              Video Resolutions
            </h3>
            <div className="space-y-2">
              {resolutions.map((res) => (
                <div
                  key={res.name}
                  className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 flex items-center gap-4"
                >
                  <div className="text-3xl">{res.icon}</div>
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <div className="font-semibold">{res.name}</div>
                      <div className="text-xs text-gray-500">{res.label}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">{res.pixels}</div>
                      <div className="text-xs text-gray-600">pixels</div>
                    </div>
                    <div>
                      <div className="text-sm text-orange-400">{res.estSize}</div>
                      <div className="text-xs text-gray-600">estimated size</div>
                    </div>
                    <div className="text-sm text-gray-400">{res.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Audio Bitrates */}
          <section>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Music className="w-5 h-5 text-green-400" />
              Audio Bitrates
            </h3>
            <div className="space-y-2">
              {audioBitrates.map((audio) => (
                <div
                  key={audio.bitrate}
                  className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-6">
                    <div className="font-semibold text-lg w-16">{audio.bitrate}</div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-400">{audio.description}</span>
                      <span className="text-xs text-gray-600">•</span>
                      <span className="text-sm text-green-400">{audio.quality} quality</span>
                    </div>
                  </div>
                  <div className="text-sm text-orange-400">{audio.size}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Tips */}
          <section className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <h3 className="font-semibold text-blue-400 mb-2">💡 Quick Tips</h3>
            <ul className="space-y-1 text-sm text-gray-300">
              <li>• <strong>1080p (Full HD)</strong> is the best balance for most users</li>
              <li>• <strong>MP4</strong> video and <strong>MP3</strong> audio work on all devices</li>
              <li>• Higher resolution = better quality but larger file size</li>
              <li>• For music, <strong>256K or 320K</strong> provides excellent quality</li>
              <li>• Use <strong>720p or lower</strong> to save storage space</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
