import { useState } from "react";
import SessionControl from "../components/sessions/SessionControl";
import SessionsList from "../components/sessions/SessionsList";
import QuickPresets from "../components/sessions/QuickPresets";
import ComparisonView from "../components/sessions/ComparisonView";
import ComparisonWizard from "../components/sessions/ComparisonWizard";
import SessionComparisonSelector from "../components/sessions/SessionComparisonSelector";
import QuickComparisonModal from "../components/sessions/QuickComparisonModal";
import type { ComparisonResult } from "../types/sessions";

export default function Sessions() {
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [quickCompareSessionId, setQuickCompareSessionId] = useState<number | null>(null);
  const [sessionsKey, setSessionsKey] = useState(0); // Key to force SessionsList refresh

  const handleComparisonRun = (result: ComparisonResult) => {
    setComparisonResult(result);
    setShowWizard(false);
  };

  const handleSessionEnd = () => {
    // Trigger SessionsList to refetch by changing its key
    setSessionsKey(prev => prev + 1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Sessions & Comparisons</h1>
          <p className="text-theme-muted mt-1">
            Track training sessions and compare performance across time periods
          </p>
        </div>
      </div>

      {/* Session Control */}
      <SessionControl onSessionEnd={handleSessionEnd} />

      {/* Persistent Session Comparison Selector */}
      <SessionComparisonSelector onComparisonComplete={handleComparisonRun} />

      {/* Quick Presets */}
      <div className="bg-theme-secondary border border-theme-primary rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Quick Comparisons</h2>
          <button
            onClick={() => setShowWizard(true)}
            className="px-4 py-2 bg-theme-accent hover:bg-theme-accent/80 text-white rounded-lg font-medium transition-colors"
          >
            Create Custom Comparison
          </button>
        </div>
        <QuickPresets onComparisonComplete={handleComparisonRun} />
      </div>

      {/* Comparison Result */}
      {comparisonResult && (
        <ComparisonView
          result={comparisonResult}
          onClose={() => setComparisonResult(null)}
          onRecompare={(newResult) => setComparisonResult(newResult)}
        />
      )}

      {/* Recent Sessions */}
      <SessionsList 
        key={sessionsKey}
        onCompare={(sessionId) => setQuickCompareSessionId(sessionId)} 
      />

      {/* Comparison Wizard Modal */}
      {showWizard && (
        <ComparisonWizard
          onClose={() => setShowWizard(false)}
          onComplete={handleComparisonRun}
        />
      )}

      {/* Quick Comparison Modal */}
      {quickCompareSessionId && (
        <QuickComparisonModal
          initialSessionId={quickCompareSessionId}
          onClose={() => setQuickCompareSessionId(null)}
          onComplete={handleComparisonRun}
        />
      )}
    </div>
  );
}
