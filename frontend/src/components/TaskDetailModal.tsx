import { useState, useEffect } from "react";
import { getApiUrl } from "../hooks/useApi";

type TaskDetail = {
  id: number;
  task_name: string;
  accuracy: number | null;
  score: number | null;
  shots: number | null;
  hits: number | null;
  duration: number | null;
  avg_ttk: number | null;
  played_at: string;
};

type TaskDetailModalProps = {
  isOpen: boolean;
  onClose: () => void;
  taskName: string;
};

export default function TaskDetailModal({ isOpen, onClose, taskName }: TaskDetailModalProps) {
  const [taskDetails, setTaskDetails] = useState<TaskDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && taskName) {
      fetchTaskDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, taskName]);

  const fetchTaskDetails = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(getApiUrl(`/api/runs?task=${encodeURIComponent(taskName)}&limit=50`));
      if (response.ok) {
        const data = await response.json();
        setTaskDetails(data);
      } else {
        setError('Failed to fetch task details');
      }
    } catch {
      setError('Error fetching task details');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0d1424] border border-[#1b2440] rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-[#1b2440]">
          <h2 className="text-xl font-bold text-white">Task Details: {taskName}</h2>
          <button
            onClick={onClose}
            className="text-[#9aa4b2] hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="text-center py-8 text-[#9aa4b2]">Loading...</div>
          ) : error ? (
            <div className="text-center py-8 text-red-400">{error}</div>
          ) : taskDetails.length === 0 ? (
            <div className="text-center py-8 text-[#9aa4b2]">No detailed data available for this task.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="[&>th]:text-left [&>th]:py-3 [&>th]:px-4 [&>th]:border-b [&>th]:border-[#1d2230] text-[#9aa4b2]">
                    <th>Date & Time</th>
                    <th>Accuracy</th>
                    <th>Score</th>
                    <th>Shots</th>
                    <th>Hits</th>
                    <th>Duration</th>
                    <th>Avg TTK</th>
                  </tr>
                </thead>
                <tbody className="[&>tr:hover]:bg-[#111623] [&>tr>td]:py-3 [&>tr>td]:px-4 [&>tr>td]:border-b [&>tr>td]:border-[#1d2230]">
                  {taskDetails.map((detail, index) => (
                    <tr key={index}>
                      <td className="whitespace-nowrap text-white">
                        {new Date(detail.played_at).toLocaleDateString()} {new Date(detail.played_at).toLocaleTimeString()}
                      </td>
                      <td className={`font-medium ${
                        detail.accuracy !== null && detail.accuracy >= 80 ? "text-green-400" : 
                        detail.accuracy !== null && detail.accuracy >= 60 ? "text-yellow-400" : 
                        detail.accuracy !== null ? "text-red-400" : "text-[#9aa4b2]"
                      }`}>
                        {detail.accuracy !== null ? `${detail.accuracy.toFixed(1)}%` : "—"}
                      </td>
                      <td className="text-blue-400 font-medium">
                        {detail.score !== null ? detail.score.toLocaleString() : "—"}
                      </td>
                      <td className="text-purple-400">
                        {detail.shots !== null ? detail.shots.toLocaleString() : "—"}
                      </td>
                      <td className="text-green-400">
                        {detail.hits !== null ? detail.hits.toLocaleString() : "—"}
                      </td>
                      <td className="text-orange-400">
                        {detail.duration !== null ? `${detail.duration.toFixed(1)}s` : "—"}
                      </td>
                      <td className="text-cyan-400">
                        {detail.avg_ttk !== null ? `${detail.avg_ttk.toFixed(3)}s` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#1b2440] flex justify-between items-center">
          <div className="text-sm text-[#9aa4b2]">
            Showing {taskDetails.length} recent runs
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
