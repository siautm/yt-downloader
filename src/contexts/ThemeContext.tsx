import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ThemeName = 'modern-dark' | 'slate-pro' | 'warm-dark' | 'high-contrast';

export interface Theme {
  name: string;
  colors: {
    bg: string;
    bgSecondary: string;
    card: string;
    cardHover: string;
    border: string;
    borderLight: string;
    text: string;
    textSecondary: string;
    textMuted: string;
    primary: string;
    primaryHover: string;
    secondary: string;
    accent: string;
    success: string;
    warning: string;
    error: string;
    gradientFrom: string;
    gradientTo: string;
  };
}

const themes: Record<ThemeName, Theme> = {
  'modern-dark': {
    name: 'Modern Dark',
    colors: {
      bg: '#0f1419',
      bgSecondary: '#1a1f2e',
      card: '#1a1f2e',
      cardHover: '#252a3a',
      border: '#2d3548',
      borderLight: '#3d4558',
      text: '#ffffff',
      textSecondary: '#e5e7eb',
      textMuted: '#9ca3af',
      primary: '#3b82f6',
      primaryHover: '#2563eb',
      secondary: '#8b5cf6',
      accent: '#a78bfa',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      gradientFrom: '#3b82f6',
      gradientTo: '#8b5cf6',
    },
  },
  'slate-pro': {
    name: 'Slate Professional',
    colors: {
      bg: '#0f172a',
      bgSecondary: '#1e293b',
      card: '#1e293b',
      cardHover: '#334155',
      border: '#334155',
      borderLight: '#475569',
      text: '#f1f5f9',
      textSecondary: '#e2e8f0',
      textMuted: '#94a3b8',
      primary: '#06b6d4',
      primaryHover: '#0891b2',
      secondary: '#6366f1',
      accent: '#818cf8',
      success: '#14b8a6',
      warning: '#f59e0b',
      error: '#f43f5e',
      gradientFrom: '#06b6d4',
      gradientTo: '#6366f1',
    },
  },
  'warm-dark': {
    name: 'Warm Dark',
    colors: {
      bg: '#1a1614',
      bgSecondary: '#252220',
      card: '#252220',
      cardHover: '#2f2b28',
      border: '#3d3935',
      borderLight: '#4d4945',
      text: '#fef3e2',
      textSecondary: '#f5e6d3',
      textMuted: '#a8968a',
      primary: '#f97316',
      primaryHover: '#ea580c',
      secondary: '#eab308',
      accent: '#fbbf24',
      success: '#84cc16',
      warning: '#f59e0b',
      error: '#ef4444',
      gradientFrom: '#f97316',
      gradientTo: '#eab308',
    },
  },
  'high-contrast': {
    name: 'High Contrast',
    colors: {
      bg: '#09090b',
      bgSecondary: '#18181b',
      card: '#18181b',
      cardHover: '#27272a',
      border: '#3f3f46',
      borderLight: '#52525b',
      text: '#fafafa',
      textSecondary: '#f4f4f5',
      textMuted: '#a1a1aa',
      primary: '#22c55e',
      primaryHover: '#16a34a',
      secondary: '#3b82f6',
      accent: '#60a5fa',
      success: '#22c55e',
      warning: '#eab308',
      error: '#ef4444',
      gradientFrom: '#22c55e',
      gradientTo: '#3b82f6',
    },
  },
};

interface ThemeContextType {
  theme: Theme;
  themeName: ThemeName;
  setTheme: (name: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>(() => {
    try {
      const saved = localStorage.getItem('theme');
      return (saved as ThemeName) || 'modern-dark';
    } catch {
      return 'modern-dark';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('theme', themeName);
    } catch {
      // Ignore localStorage errors
    }
  }, [themeName]);

  const theme = themes[themeName];

  return (
    <ThemeContext.Provider value={{ theme, themeName, setTheme: setThemeName }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
