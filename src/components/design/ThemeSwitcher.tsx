import { useTheme, ThemeName } from "@/contexts/ThemeContext";
import { Palette, Check } from 'lucide-react';

interface ThemeSwitcherProps {
  onClose?: () => void;
}

export function ThemeSwitcher({ onClose }: ThemeSwitcherProps) {
  const { theme, themeName, setTheme } = useTheme();

  const themes: { name: ThemeName; label: string; preview: string[] }[] = [
    {
      name: 'modern-dark',
      label: 'Modern Dark',
      preview: ['#0f1419', '#3b82f6', '#8b5cf6'],
    },
    {
      name: 'slate-pro',
      label: 'Slate Professional',
      preview: ['#0f172a', '#06b6d4', '#6366f1'],
    },
    {
      name: 'warm-dark',
      label: 'Warm Dark',
      preview: ['#1a1614', '#f97316', '#eab308'],
    },
    {
      name: 'high-contrast',
      label: 'High Contrast',
      preview: ['#09090b', '#22c55e', '#3b82f6'],
    },
  ];

  const handleThemeChange = (name: ThemeName) => {
    setTheme(name);
    if (onClose) {
      setTimeout(onClose, 300);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Palette className="w-5 h-5" style={{ color: theme.colors.primary }} />
        <h3 className="font-semibold" style={{ color: theme.colors.text }}>
          Choose Theme
        </h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {themes.map((t) => (
          <button
            key={t.name}
            onClick={() => handleThemeChange(t.name)}
            className="relative p-4 rounded-lg transition-all border-2"
            style={{
              backgroundColor: theme.colors.card,
              borderColor:
                themeName === t.name ? theme.colors.primary : theme.colors.border,
            }}
          >
            {themeName === t.name && (
              <div
                className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                style={{ backgroundColor: theme.colors.primary }}
              >
                <Check className="w-3 h-3 text-white" />
              </div>
            )}
            <div className="flex items-center gap-3 mb-2">
              {t.preview.map((color, i) => (
                <div
                  key={i}
                  className="w-6 h-6 rounded-full"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="text-sm font-medium text-left" style={{ color: theme.colors.text }}>
              {t.label}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
