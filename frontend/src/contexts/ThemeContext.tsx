import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { ThemeName } from '../themes';
import { getTheme, applyTheme } from '../themes';
import { getApiUrl } from '../hooks/useApi';
import { ThemeContext } from './themeContext';

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const [currentTheme, setCurrentTheme] = useState<ThemeName>('default');
  const [isLoading, setIsLoading] = useState(true);

  // Load theme from backend on mount
  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const response = await fetch(getApiUrl('/api/settings'));
      if (response.ok) {
        const data = await response.json();
        const themeName = (data.theme as ThemeName) || 'default';
        setCurrentTheme(themeName);
        applyTheme(getTheme(themeName));
      }
    } catch (err) {
      console.error('Failed to load theme:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const setTheme = async (themeName: ThemeName) => {
    try {
      // Apply theme immediately for instant feedback
      setCurrentTheme(themeName);
      applyTheme(getTheme(themeName));

      // Save to backend
      const response = await fetch(getApiUrl('/api/settings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: themeName }),
      });

      if (!response.ok) {
        console.error('Failed to save theme');
      }
    } catch (err) {
      console.error('Failed to set theme:', err);
    }
  };

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
};
