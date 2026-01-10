import { useState } from "react";
import { jpost } from "../../hooks/useApi";
import type { RankedTask } from "../../types";

type PlaylistCreatorModalProps = {
  category: string;
  tasks: RankedTask[];
  onClose: () => void;
  onSuccess: (message: string) => void;
};

export function PlaylistCreatorModal({ category, tasks, onClose, onSuccess }: PlaylistCreatorModalProps) {
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [playlistName, setPlaylistName] = useState(`${category} Ranked Playlist`);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const toggleTask = (taskName: string) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(taskName)) {
      newSelected.delete(taskName);
    } else {
      newSelected.add(taskName);
    }
    setSelectedTasks(newSelected);
  };
  
  const selectAll = () => {
    setSelectedTasks(new Set(tasks.map(t => t.scenarioName)));
  };
  
  const deselectAll = () => {
    setSelectedTasks(new Set());
  };
  
  const handleCreate = async () => {
    if (selectedTasks.size === 0) {
      setError('Please select at least one task');
      return;
    }
    if (!playlistName.trim()) {
      setError('Please enter a playlist name');
      return;
    }
    
    setCreating(true);
    setError(null);
    
    try {
      const response = await jpost<{ success: boolean; filePath?: string; error?: string }>('/api/playlists/create', {
        playlistName: playlistName.trim(),
        scenarios: Array.from(selectedTasks)
      });
      
      if (response.success) {
        onSuccess(`Successfully created playlist: ${playlistName}\n\nLocation: ${response.filePath}`);
        onClose();
      } else {
        setError(response.error || 'Failed to create playlist');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create playlist');
    } finally {
      setCreating(false);
    }
  };
  
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="rounded-lg border max-w-2xl w-full max-h-[80vh] flex flex-col"
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          borderColor: 'var(--color-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            Create {category} Playlist
          </h2>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Select tasks to include in your Kovaak's playlist
          </p>
        </div>
        
        <div className="p-6 space-y-4 flex-1 overflow-hidden flex flex-col">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
              Playlist Name
            </label>
            <input
              type="text"
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
              className="w-full px-3 py-2 rounded border"
              style={{
                backgroundColor: 'var(--color-bg-tertiary)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-primary)'
              }}
            />
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              Select Tasks ({selectedTasks.size}/{tasks.length})
            </span>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="text-xs px-3 py-1 rounded"
                style={{
                  backgroundColor: 'var(--color-bg-tertiary)',
                  color: 'var(--color-text-primary)'
                }}
              >
                Select All
              </button>
              <button
                onClick={deselectAll}
                className="text-xs px-3 py-1 rounded"
                style={{
                  backgroundColor: 'var(--color-bg-tertiary)',
                  color: 'var(--color-text-primary)'
                }}
              >
                Deselect All
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {tasks.map((task) => (
              <label
                key={task.leaderboardId}
                className="flex items-center gap-3 p-3 rounded cursor-pointer hover:bg-opacity-80 transition-colors"
                style={{
                  backgroundColor: selectedTasks.has(task.scenarioName) 
                    ? 'var(--color-bg-tertiary)' 
                    : 'transparent',
                  border: '1px solid var(--color-border)'
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedTasks.has(task.scenarioName)}
                  onChange={() => toggleTask(task.scenarioName)}
                  className="w-4 h-4"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {task.scenarioName}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {task.userPlays > 0 ? `${task.userPlays} plays` : 'Not played yet'}
                  </div>
                </div>
              </label>
            ))}
          </div>
          
          {error && (
            <div className="p-3 rounded bg-red-500/10 border border-red-500/30">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </div>
        
        <div className="p-6 border-t flex justify-end gap-3" style={{ borderColor: 'var(--color-border)' }}>
          <button
            onClick={onClose}
            disabled={creating}
            className="px-4 py-2 rounded font-medium transition-colors"
            style={{
              backgroundColor: 'var(--color-bg-tertiary)',
              color: 'var(--color-text-primary)'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || selectedTasks.size === 0}
            className="px-4 py-2 rounded font-medium transition-colors disabled:opacity-50"
            style={{
              backgroundColor: '#8b5cf6',
              color: '#ffffff'
            }}
          >
            {creating ? 'Creating...' : 'Create Playlist'}
          </button>
        </div>
      </div>
    </div>
  );
}
