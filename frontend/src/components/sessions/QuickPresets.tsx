import { useState } from "react";
import type { ComparisonResult } from "../../types";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

type Preset = {
  label: string;
  left: string | { type: string; hours: number; hoursAgo: number };
  right: string | { type: string; hours: number; hoursAgo: number };
};

const presets: Preset[] = [
  { label: 'Yesterday vs Today', left: 'yesterday', right: 'today' },
  { label: 'Last Week vs This Week', left: 'lastWeek', right: 'thisWeek' },
  { label: 'Last Month vs This Month', left: 'lastMonth', right: 'thisMonth' },
  { label: 'Last 2h vs Previous 2h', left: { type: 'relative', hours: 2, hoursAgo: 2 }, right: { type: 'relative', hours: 2, hoursAgo: 0 } },
  { label: 'Last 4h vs Previous 4h', left: { type: 'relative', hours: 4, hoursAgo: 4 }, right: { type: 'relative', hours: 4, hoursAgo: 0 } },
];

type QuickPresetsProps = {
  onComparisonComplete: (result: ComparisonResult) => void;
};

export default function QuickPresets({ onComparisonComplete }: QuickPresetsProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handlePresetClick = async (preset: Preset) => {
    setLoading(preset.label);
    try {
      const response = await fetch(`${API_URL}/api/comparisons/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          left: preset.left,
          right: preset.right,
          taskScope: 'all'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to run comparison');
      }

      const result = await response.json();
      onComparisonComplete(result);
    } catch (error) {
      console.error('Error running comparison:', error);
      alert('Failed to run comparison');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
      {presets.map((preset) => (
        <button
          key={preset.label}
          onClick={() => handlePresetClick(preset)}
          disabled={loading === preset.label}
          className="px-4 py-3 bg-theme-tertiary hover:bg-theme-primary border border-theme-primary rounded-lg text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading === preset.label ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Loading...
            </span>
          ) : (
            preset.label
          )}
        </button>
      ))}
    </div>
  );
}
