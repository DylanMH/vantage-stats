export type ThemeName = 'default' | 'orange' | 'cyber';

export interface Theme {
  name: ThemeName;
  displayName: string;
  colors: {
    // Backgrounds
    bgPrimary: string;
    bgSecondary: string;
    bgTertiary: string;
    bgHover: string;
    
    // Borders
    borderPrimary: string;
    borderSecondary: string;
    
    // Text
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    
    // Accents
    accentPrimary: string;
    accentSecondary: string;
    accentHover: string;
    
    // Status colors
    success: string;
    warning: string;
    error: string;
    info: string;
    
    // Chart colors
    chartScore: string;
    chartAccuracy: string;
    chartTTK: string;
    chartShots: string;
    chartHits: string;
  };
}

export const themes: Record<ThemeName, Theme> = {
  default: {
    name: 'default',
    displayName: 'Default Blue',
    colors: {
      // Backgrounds
      bgPrimary: '#0a0f1e',
      bgSecondary: '#0d1424',
      bgTertiary: '#1b2440',
      bgHover: '#111623',
      
      // Borders
      borderPrimary: '#1b2440',
      borderSecondary: '#2d3561',
      
      // Text
      textPrimary: '#ffffff',
      textSecondary: '#e5e7eb',
      textMuted: '#9aa4b2',
      
      // Accents
      accentPrimary: '#3b82f6',
      accentSecondary: '#2563eb',
      accentHover: '#1d4ed8',
      
      // Status colors
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6',
      
      // Chart colors
      chartScore: '#8b5cf6',
      chartAccuracy: '#10b981',
      chartTTK: '#f97316',
      chartShots: '#a855f7',
      chartHits: '#22c55e',
    },
  },
  
  orange: {
    name: 'orange',
    displayName: 'Orange Accent',
    colors: {
      // Backgrounds
      bgPrimary: '#0a0a0a',
      bgSecondary: '#151515',
      bgTertiary: '#1f1f1f',
      bgHover: '#252525',
      
      // Borders
      borderPrimary: '#2a2a2a',
      borderSecondary: '#3a3a3a',
      
      // Text
      textPrimary: '#ffffff',
      textSecondary: '#e5e5e5',
      textMuted: '#999999',
      
      // Accents (vibrant orange/red)
      accentPrimary: '#ff4500',
      accentSecondary: '#ff6b35',
      accentHover: '#cc3700',
      
      // Status colors
      success: '#00ff88',
      warning: '#ffaa00',
      error: '#ff3333',
      info: '#ff6b35',
      
      // Chart colors
      chartScore: '#ff4500',
      chartAccuracy: '#00ff88',
      chartTTK: '#ffaa00',
      chartShots: '#ff6b35',
      chartHits: '#00dd77',
    },
  },
  
  cyber: {
    name: 'cyber',
    displayName: 'Cyber Neon',
    colors: {
      // Backgrounds
      bgPrimary: '#000000',
      bgSecondary: '#0a0a0a',
      bgTertiary: '#141414',
      bgHover: '#1a1a1a',
      
      // Borders
      borderPrimary: '#1a1a1a',
      borderSecondary: '#2a2a2a',
      
      // Text
      textPrimary: '#ffffff',
      textSecondary: '#e0e0e0',
      textMuted: '#808080',
      
      // Accents (Neon cyan/magenta)
      accentPrimary: '#00ffff',
      accentSecondary: '#ff00ff',
      accentHover: '#00cccc',
      
      // Status colors
      success: '#00ff00',
      warning: '#ffff00',
      error: '#ff0066',
      info: '#00ffff',
      
      // Chart colors
      chartScore: '#00ffff',
      chartAccuracy: '#00ff00',
      chartTTK: '#ff00ff',
      chartShots: '#ff0099',
      chartHits: '#00ff88',
    },
  },
};

export const applyTheme = (theme: Theme): void => {
  const root = document.documentElement;
  
  Object.entries(theme.colors).forEach(([key, value]) => {
    // Convert camelCase to kebab-case for CSS variables
    const cssVar = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    root.style.setProperty(`--color-${cssVar}`, value);
  });
};

export const getTheme = (themeName: ThemeName): Theme => {
  return themes[themeName] || themes.default;
};
