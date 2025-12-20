import { useState } from "react";
import type { ComparisonResult, Session, TaskScope, WindowDefinition } from "../../types/sessions";
import { useQuery } from "../../hooks/useApi";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

type ComparisonWizardProps = {
  onClose: () => void;
  onComplete: (result: ComparisonResult) => void;
};

type Step = 'type' | 'windows' | 'review';
type CompareType = 'sessions' | 'timeframes' | 'relative';

export default function ComparisonWizard({ onClose, onComplete }: ComparisonWizardProps) {
  const [step, setStep] = useState<Step>('type');
  const [compareType, setCompareType] = useState<CompareType>('timeframes');
  const [leftWindow, setLeftWindow] = useState<WindowDefinition>('yesterday');
  const [rightWindow, setRightWindow] = useState<WindowDefinition>('today');
  const taskScope: TaskScope = 'all'; // Always use 'all' task scope
  const [loading, setLoading] = useState(false);
  const [blockHours, setBlockHours] = useState(2);

  const { data: sessions } = useQuery<Session[]>('sessions', '/api/sessions');
  const completedSessions = sessions?.filter(s => s.is_active === 0) || [];

  const handleRunComparison = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/comparisons/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          left: leftWindow,
          right: rightWindow,
          taskScope
        })
      });

      if (!response.ok) {
        throw new Error('Failed to run comparison');
      }

      const result = await response.json();
      onComplete(result);
    } catch (error) {
      console.error('Error running comparison:', error);
      alert('Failed to run comparison');
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 'type':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white mb-4">Choose Comparison Type</h3>
            <div className="space-y-3">
              <button
                onClick={() => {
                  setCompareType('sessions');
                  setStep('windows');
                }}
                className="w-full text-left p-4 bg-theme-tertiary hover:bg-theme-primary border border-theme-secondary hover:border-theme-accent rounded-lg transition-colors"
              >
                <div className="font-semibold text-white mb-1">Compare Two Sessions</div>
                <div className="text-sm text-theme-muted">Pick from your saved manual sessions</div>
              </button>

              <button
                onClick={() => {
                  setCompareType('timeframes');
                  setStep('windows');
                }}
                className="w-full text-left p-4 bg-theme-tertiary hover:bg-theme-primary border border-theme-secondary hover:border-theme-accent rounded-lg transition-colors"
              >
                <div className="font-semibold text-white mb-1">Compare Two Time Frames</div>
                <div className="text-sm text-theme-muted">Choose relative or absolute time windows</div>
              </button>

              <button
                onClick={() => {
                  setCompareType('relative');
                  setStep('windows');
                }}
                className="w-full text-left p-4 bg-theme-tertiary hover:bg-theme-primary border border-theme-secondary hover:border-theme-accent rounded-lg transition-colors"
              >
                <div className="font-semibold text-white mb-1">Compare Recent Time Blocks</div>
                <div className="text-sm text-theme-muted">Last X hours vs previous X hours</div>
              </button>
            </div>
          </div>
        );

      case 'windows':
        if (compareType === 'sessions') {
          return (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white mb-4">Select Sessions</h3>
              
              <div>
                <label className="block text-sm font-medium text-white mb-2">Left Session</label>
                <select
                  value={typeof leftWindow === 'object' && 'sessionId' in leftWindow ? leftWindow.sessionId : ''}
                  onChange={(e) => setLeftWindow({ type: 'session', sessionId: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 bg-theme-tertiary border border-theme-secondary rounded-lg text-white focus:border-theme-accent focus:outline-none"
                >
                  <option value="">Select a session...</option>
                  {completedSessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.is_practice === 1 ? '🎯 ' : ''}{session.name || `Session ${session.id}`} - {new Date(session.started_at).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Right Session</label>
                <select
                  value={typeof rightWindow === 'object' && 'sessionId' in rightWindow ? rightWindow.sessionId : ''}
                  onChange={(e) => setRightWindow({ type: 'session', sessionId: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 bg-theme-tertiary border border-theme-secondary rounded-lg text-white focus:border-theme-accent focus:outline-none"
                >
                  <option value="">Select a session...</option>
                  {completedSessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.is_practice === 1 ? '🎯 ' : ''}{session.name || `Session ${session.id}`} - {new Date(session.started_at).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => setStep('review')}
                disabled={!leftWindow || !rightWindow}
                className="w-full px-4 py-2 bg-theme-accent hover:bg-theme-accent/80 disabled:bg-theme-accent/50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                Next: Review
              </button>
            </div>
          );
        } else if (compareType === 'timeframes') {
          return (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white mb-4">Select Time Frames</h3>
              
              <div>
                <label className="block text-sm font-medium text-white mb-2">Left Window</label>
                <select
                  value={typeof leftWindow === 'string' ? leftWindow : 'custom'}
                  onChange={(e) => setLeftWindow(e.target.value)}
                  className="w-full px-4 py-2 bg-theme-tertiary border border-theme-secondary rounded-lg text-white focus:border-theme-accent focus:outline-none"
                >
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="thisWeek">This Week</option>
                  <option value="lastWeek">Last Week</option>
                  <option value="thisMonth">This Month</option>
                  <option value="lastMonth">Last Month</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Right Window</label>
                <select
                  value={typeof rightWindow === 'string' ? rightWindow : 'custom'}
                  onChange={(e) => setRightWindow(e.target.value)}
                  className="w-full px-4 py-2 bg-theme-tertiary border border-theme-secondary rounded-lg text-white focus:border-theme-accent focus:outline-none"
                >
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="thisWeek">This Week</option>
                  <option value="lastWeek">Last Week</option>
                  <option value="thisMonth">This Month</option>
                  <option value="lastMonth">Last Month</option>
                </select>
              </div>

              <button
                onClick={() => setStep('review')}
                className="w-full px-4 py-2 bg-theme-accent hover:bg-theme-accent/80 text-white rounded-lg font-medium transition-colors"
              >
                Next: Review
              </button>
            </div>
          );
        } else {
          // Relative time blocks
          return (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white mb-4">Select Time Blocks</h3>
              
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Compare: Last {blockHours} hours vs Previous {blockHours} hours
                </label>
                <input
                  type="range"
                  min="1"
                  max="24"
                  value={blockHours}
                  onChange={(e) => {
                    const hours = parseInt(e.target.value);
                    setBlockHours(hours);
                    setLeftWindow({ type: 'relative', hours, hoursAgo: hours });
                    setRightWindow({ type: 'relative', hours, hoursAgo: 0 });
                  }}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-theme-muted mt-1">
                  <span>1h</span>
                  <span>24h</span>
                </div>
              </div>

              <div className="bg-theme-tertiary border border-theme-secondary rounded-lg p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-theme-muted">Left Window:</span>
                    <span className="text-white font-medium">{blockHours * 2} to {blockHours} hours ago</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-theme-muted">Right Window:</span>
                    <span className="text-white font-medium">Last {blockHours} hours</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setStep('review')}
                className="w-full px-4 py-2 bg-theme-accent hover:bg-theme-accent/80 text-white rounded-lg font-medium transition-colors"
              >
                Next: Review
              </button>
            </div>
          );
        }

      case 'review':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white mb-4">Review & Run</h3>
            
            <div className="bg-theme-tertiary border border-theme-secondary rounded-lg p-4">
              <div>
                <span className="text-sm text-theme-muted block mb-1">Comparison Type:</span>
                <span className="text-white font-medium capitalize">{compareType}</span>
              </div>
            </div>

            <button
              onClick={handleRunComparison}
              disabled={loading}
              className="w-full px-4 py-3 bg-theme-accent hover:bg-theme-accent/80 disabled:bg-theme-accent/50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Running Comparison...
                </span>
              ) : (
                'Run Comparison'
              )}
            </button>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-theme-secondary border border-theme-primary rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-theme-secondary border-b border-theme-primary p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Create Comparison</h2>
            <p className="text-sm text-theme-muted mt-1">
              Step {step === 'type' ? '1' : step === 'windows' ? '2' : '3'} of 3
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-theme-muted hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {renderStepContent()}

          {step === 'windows' && (
            <button
              onClick={() => setStep('type')}
              className="mt-4 px-4 py-2 text-theme-muted hover:text-white transition-colors"
            >
              ← Back
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
