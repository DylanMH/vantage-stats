import { useContext } from 'react';
import { PracticeModeContext } from '../contexts/PracticeModeContext';

export function usePracticeMode() {
  const context = useContext(PracticeModeContext);
  if (context === undefined) {
    throw new Error('usePracticeMode must be used within a PracticeModeProvider');
  }
  return context;
}
