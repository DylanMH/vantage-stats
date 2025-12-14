import { useState, useEffect, useCallback } from "react";
import { getApiUrl } from "../hooks/useApi";

type Pack = {
  id: number;
  name: string;
  description: string;
  game_focus: string;
  task_count: number;
};

type PackStats = {
  avg_accuracy: number;
  avg_score: number;
  avg_ttk: number;
  total_runs: number;
  tasks_played: number;
};

type CreatePackGoalModalProps = {
  onClose: () => void;
  onGoalCreated: () => void;
};

type Step = "selectPack" | "selectMetrics" | "setTarget" | "setDate";
type MetricType = "accuracy" | "score" | "ttk";

export default function CreatePackGoalModal({ onClose, onGoalCreated }: CreatePackGoalModalProps) {
  const [step, setStep] = useState<Step>("selectPack");
  const [packs, setPacks] = useState<Pack[]>([]);
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null);
  const [packStats, setPackStats] = useState<PackStats | null>(null);
  const [selectedMetrics, setSelectedMetrics] = useState<MetricType[]>([]);
  const [targetValues, setTargetValues] = useState<Record<MetricType, number>>({
    accuracy: 0,
    score: 0,
    ttk: 0
  });
  const [targetDate, setTargetDate] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  // Reset all state when modal opens
  const resetState = useCallback(() => {
    setStep("selectPack");
    setSelectedPack(null);
    setPackStats(null);
    setSelectedMetrics([]);
    setTargetValues({ accuracy: 0, score: 0, ttk: 0 });
    setTargetDate("");
    setError("");
  }, []);

  // Reset state when modal closes
  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  // Load packs on mount
  useEffect(() => {
    const fetchPacks = async () => {
      try {
        const response = await fetch(getApiUrl("/api/packs"));
        if (response.ok) {
          const data = await response.json();
          setPacks(data);
        }
      } catch (err) {
        console.error("Failed to load packs:", err);
        setError("Failed to load packs");
      }
    };
    fetchPacks();
  }, []);

  // Load pack stats when a pack is selected
  useEffect(() => {
    if (selectedPack) {
      const fetchStats = async () => {
        try {
          const response = await fetch(getApiUrl(`/api/packs/${selectedPack.id}/stats`));
          if (response.ok) {
            const data = await response.json();
            setPackStats(data);
          }
        } catch (err) {
          console.error("Failed to load pack stats:", err);
        }
      };
      fetchStats();
    }
  }, [selectedPack]);

  const handlePackSelect = (pack: Pack) => {
    setSelectedPack(pack);
    setStep("selectMetrics");
  };

  const handleMetricToggle = (metric: MetricType) => {
    setSelectedMetrics(prev => {
      if (prev.includes(metric)) {
        return prev.filter(m => m !== metric);
      } else {
        return [...prev, metric];
      }
    });
  };

  const handleNext = () => {
    if (step === "selectMetrics") {
      if (selectedMetrics.length === 0) {
        setError("Please select at least one metric");
        return;
      }
      setError("");
      setStep("setTarget");
    } else if (step === "setTarget") {
      // Validate target values
      for (const metric of selectedMetrics) {
        const targetVal = targetValues[metric];
        const currentVal = packStats?.[`avg_${metric}` as keyof PackStats] || 0;
        
        if (!targetVal || targetVal <= 0) {
          setError(`Please set a target value for ${metric}`);
          return;
        }
        
        // For TTK, lower is better - target must be LESS than current
        if (metric === 'ttk') {
          if (targetVal >= currentVal) {
            setError(`TTK target must be lower than current avg (${currentVal.toFixed(3)}s) - lower is better!`);
            return;
          }
        } else {
          // For accuracy and score, higher is better - target must be MORE than current
          if (targetVal <= currentVal) {
            setError(`${metric.charAt(0).toUpperCase() + metric.slice(1)} target must be higher than current avg (${formatStat(currentVal, metric)})`);
            return;
          }
        }
      }
      setError("");
      setStep("setDate");
    }
  };

  const handleBack = () => {
    if (step === "selectMetrics") {
      setStep("selectPack");
      setSelectedPack(null);
    } else if (step === "setTarget") {
      setStep("selectMetrics");
    } else if (step === "setDate") {
      setStep("setTarget");
    }
  };

  const handleCreate = async () => {
    if (!selectedPack || selectedMetrics.length === 0) return;

    setLoading(true);
    setError("");

    try {
      // Create goals for each selected metric
      for (const metric of selectedMetrics) {
        const title = `${selectedPack.name} - ${metric.toUpperCase()} Goal`;
        const currentVal = packStats?.[`avg_${metric}` as keyof PackStats] || 0;
        const targetVal = targetValues[metric];
        
        let description;
        if (metric === 'ttk') {
          description = `Improve avg ${metric} for all tasks from ${currentVal.toFixed(3)}s to ${targetVal.toFixed(3)}s`;
        } else {
          description = `Improve avg ${metric} for all tasks from ${currentVal.toFixed(1)} to ${targetVal.toFixed(1)}`;
        }

        const response = await fetch(getApiUrl("/api/goals/create"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description,
            goal_type: metric,
            target_value: targetVal,
            target_pack_id: selectedPack.id,
            target_date: targetDate || null,
            metrics: selectedMetrics
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to create ${metric} goal`);
        }
      }

      onGoalCreated();
    } catch (err) {
      console.error("Failed to create goal:", err);
      setError(err instanceof Error ? err.message : "Failed to create goal");
    } finally {
      setLoading(false);
    }
  };

  const formatStat = (value: number | undefined, metric: MetricType): string => {
    if (value === undefined || value === null) return "N/A";
    if (metric === "ttk") return `${value.toFixed(3)}s`;
    if (metric === "accuracy") return `${value.toFixed(1)}%`;
    return value.toFixed(0);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-theme-secondary border border-theme-primary rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">
            Create Pack Goal
            {selectedPack && ` - ${selectedPack.name}`}
          </h2>
          <button
            onClick={handleClose}
            className="text-theme-muted hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="bg-red-500 bg-opacity-20 border border-red-500 text-red-400 px-4 py-2 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* Step 1: Select Pack */}
        {step === "selectPack" && (
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Select a Pack</h3>
            {packs.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {packs.map(pack => (
                  <button
                    key={pack.id}
                    onClick={() => handlePackSelect(pack)}
                    className="w-full text-left bg-theme-tertiary hover:bg-theme-accent hover:bg-opacity-20 border border-theme-primary rounded-lg p-4 transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-white">{pack.name}</p>
                        {pack.description && (
                          <p className="text-sm text-theme-muted">{pack.description}</p>
                        )}
                        {pack.game_focus && (
                          <p className="text-xs text-theme-muted mt-1">{pack.game_focus}</p>
                        )}
                      </div>
                      <div className="text-sm text-theme-muted">
                        {pack.task_count} tasks
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="bg-theme-tertiary border border-theme-primary rounded-lg p-8 text-center">
                <p className="text-theme-muted">No packs available. Create a pack first!</p>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Select Metrics */}
        {step === "selectMetrics" && (
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Select Metrics to Track</h3>
            <p className="text-sm text-theme-muted mb-4">
              These metrics will be averaged across all tasks in the pack
            </p>
            <div className="space-y-4">
              {(["accuracy", "score", "ttk"] as MetricType[]).map(metric => (
                <button
                  key={metric}
                  onClick={() => handleMetricToggle(metric)}
                  className={`w-full text-left border rounded-lg p-5 transition-all ${
                    selectedMetrics.includes(metric)
                      ? "bg-theme-accent bg-opacity-20 border-theme-accent"
                      : "bg-theme-tertiary border-theme-primary hover:border-theme-accent"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      selectedMetrics.includes(metric)
                        ? "border-theme-accent bg-theme-accent"
                        : "border-theme-muted"
                    }`}>
                      {selectedMetrics.includes(metric) && (
                        <span className="text-white text-sm">✓</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-white capitalize">{metric}</p>
                      {packStats && (
                        <p className="text-sm text-theme-muted">
                          Current Avg: {formatStat(packStats[`avg_${metric}` as keyof PackStats], metric)}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleBack}
                className="px-4 py-2 bg-theme-tertiary text-white rounded-lg hover:bg-opacity-80 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleNext}
                className="flex-1 px-4 py-2 bg-theme-accent text-white rounded-lg hover:bg-opacity-80 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Set Target Values */}
        {step === "setTarget" && (
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Set Target Values</h3>
            <p className="text-sm text-theme-muted mb-4">
              Set the target average for all tasks in this pack
            </p>
            <div className="space-y-4">
              {selectedMetrics.map(metric => (
                <div key={metric} className="bg-theme-tertiary border border-theme-primary rounded-lg p-4">
                  <label className="block text-white font-medium mb-2 capitalize">
                    Average {metric} Goal
                  </label>
                  {packStats && (
                    <p className="text-sm text-theme-muted mb-3">
                      Current Avg: {formatStat(packStats[`avg_${metric}` as keyof PackStats], metric)}
                    </p>
                  )}
                  <input
                    type="number"
                    step={metric === "ttk" ? "0.001" : metric === "accuracy" ? "0.1" : "1"}
                    value={targetValues[metric] === 0 ? "" : targetValues[metric]}
                    onChange={(e) => {
                      const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                      if (!isNaN(val)) {
                        setTargetValues(prev => ({ ...prev, [metric]: val }));
                      }
                    }}
                    className="w-full border border-theme-primary rounded-lg px-4 py-3 focus:outline-none focus:border-theme-accent"
                    placeholder={`Enter target ${metric}${metric === "ttk" ? " (lower is better)" : ""}`}
                    style={{ backgroundColor: '#1a1a1a', color: '#ffffff' }}
                  />
                  {metric === "ttk" && (
                    <p className="text-xs text-yellow-400 mt-1">⚠️ Lower is better for TTK - set a target below your current avg</p>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleBack}
                className="px-4 py-2 bg-theme-tertiary text-white rounded-lg hover:bg-opacity-80 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleNext}
                className="flex-1 px-4 py-2 bg-theme-accent text-white rounded-lg hover:bg-opacity-80 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Set Date */}
        {step === "setDate" && (
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Set Target Date (Optional)</h3>
            <p className="text-theme-muted mb-4">
              When would you like to achieve this goal by?
            </p>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full border border-theme-primary rounded-lg px-4 py-3 focus:outline-none focus:border-theme-accent"
              style={{ backgroundColor: '#1a1a1a', color: '#ffffff', colorScheme: 'dark' }}
            />
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleBack}
                className="px-4 py-2 bg-theme-tertiary text-white rounded-lg hover:bg-opacity-80 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleCreate}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Creating..." : "Create Goal"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
