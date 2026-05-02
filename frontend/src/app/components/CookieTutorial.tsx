import { X, Cookie, ArrowRight, CheckCircle, Pin, MousePointer2 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface CookieTutorialProps {
  onClose: () => void;
}

export function CookieTutorial({ onClose }: CookieTutorialProps) {
  const { theme } = useTheme();
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
              style={{ backgroundColor: `${theme.colors.warning}20` }}
            >
              <Cookie className="w-5 h-5" style={{ color: theme.colors.warning }} />
            </div>
            <h2 className="text-xl font-bold" style={{ color: theme.colors.text }}>
              How to Import YouTube Cookies
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
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-88px)]">
          {/* Why Cookies */}
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-400 mb-2 flex items-center gap-2">
              <Cookie className="w-5 h-5" />
              Why do I need cookies?
            </h3>
            <p className="text-sm text-gray-300 mb-2">
              YouTube may require sign-in to access certain videos (age-restricted, private, or region-locked content).
              By importing your browser cookies, the downloader can access videos as if you're logged in.
            </p>
            <p className="text-xs text-gray-400">
              <strong>Note:</strong> Cookies are stored locally on your device and never shared.
            </p>
          </div>

          {/* Steps */}
          <div className="space-y-8">
            {/* Step 1 */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-semibold">
                  1
                </div>
                <h3 className="text-lg font-semibold">Search Chrome Extension Store</h3>
              </div>
              <div className="ml-11 space-y-3">
                <p className="text-sm text-gray-400">
                  Go to Google and search for <strong className="text-white">"chrome extension store"</strong>
                </p>
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg overflow-hidden">
                  <img
                    src="/src/imports/step1.png"
                    alt="Step 1: Search Chrome Extension Store"
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-semibold">
                  2
                </div>
                <h3 className="text-lg font-semibold">Install the Extension</h3>
              </div>
              <div className="ml-11 space-y-3">
                <p className="text-sm text-gray-400">
                  Search for <strong className="text-white">"get cookies.txt LOCALLY"</strong> and add it to Chrome
                </p>
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg overflow-hidden">
                  <img
                    src="/src/imports/step2.png"
                    alt="Step 2: Install Extension"
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-semibold">
                  3
                </div>
                <h3 className="text-lg font-semibold">Pin the Extension</h3>
              </div>
              <div className="ml-11 space-y-3">
                <p className="text-sm text-gray-400">
                  Click the Extensions icon (puzzle piece 🧩) in Chrome's toolbar, then click the <Pin className="w-3 h-3 inline" /> pin icon next to "Get cookies.txt LOCALLY" to pin it to your toolbar
                </p>
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg overflow-hidden p-4">
                  <img
                    src="/src/imports/step3.png"
                    alt="Step 3: Pin Extension"
                    className="w-auto max-w-sm mx-auto"
                  />
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-semibold">
                  4
                </div>
                <h3 className="text-lg font-semibold">Login to YouTube</h3>
              </div>
              <div className="ml-11 space-y-3">
                <p className="text-sm text-gray-400">
                  Go to YouTube.com and make sure you're logged in to your account
                </p>
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg overflow-hidden">
                  <img
                    src="/src/imports/step4.png"
                    alt="Step 4: Login to YouTube"
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {/* Step 5 */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-semibold">
                  5
                </div>
                <h3 className="text-lg font-semibold">Export Cookies</h3>
              </div>
              <div className="ml-11 space-y-3">
                <p className="text-sm text-gray-400">
                  Click the extension icon, then click the blue <strong className="text-white">"Export"</strong> button (top left)
                </p>
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg overflow-hidden">
                  <img
                    src="/src/imports/step5.png"
                    alt="Step 5: Export Cookies"
                    className="w-full"
                  />
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded p-3 text-xs text-gray-300">
                  <strong className="text-blue-400">Note:</strong> The cookies file will be downloaded to your Downloads folder. It should be named something like <code className="bg-black/30 px-1 rounded">youtube.com_cookies.txt</code>
                </div>
              </div>
            </div>

            {/* Step 6 */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center font-semibold">
                  6
                </div>
                <h3 className="text-lg font-semibold">Upload Cookies to Video Downloader</h3>
              </div>
              <div className="ml-11 space-y-3">
                <p className="text-sm text-gray-400">
                  In the Video Downloader app, go to Settings → YouTube Cookies File → Upload, then select the cookies file you just downloaded
                </p>
                <div className="flex items-center gap-2 text-green-400 text-sm">
                  <CheckCircle className="w-5 h-5" />
                  <span>You're all set! The app can now download restricted videos.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Security Note */}
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <h3 className="font-semibold text-red-400 mb-2">🔒 Security Notice</h3>
            <p className="text-sm text-gray-300">
              Your cookies contain authentication data. Never share your cookies file with anyone.
              The cookies are stored locally on your device and only used to download videos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
