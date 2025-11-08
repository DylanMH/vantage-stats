import { createContext } from 'react';
import type { ThemeName } from '../themes';

export interface ThemeContextType {
  currentTheme: ThemeName;
  setTheme: (theme: ThemeName) => Promise<void>;
  isLoading: boolean;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
