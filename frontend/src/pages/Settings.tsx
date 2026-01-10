import { useState, useEffect } from "react";
import { useQuery, getApiUrl } from "../hooks/useApi";
import Toast from "../components/feedback/Toast";
import ConfirmDialog from "../components/feedback/ConfirmDialog";
import { useTheme } from "../hooks/useTheme";
import { themes } from "../themes";
import type { ThemeName } from "../themes";

// Extend Window type for Electron
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    require?: (module: string) => any;
  }
}

import type { Playlist } from "../types";
import type { ToastMessage } from "../types";

export default function Settings() {
  const { currentTheme, setTheme } = useTheme();
  const [username, setUsername] = useState("Player");
  const [statsFolder, setStatsFolder] = useState("");
  const [playlistsFolder, setPlaylistsFolder] = useState("");
  const [notifications, setNotifications] = useState(true);
  const [autoGoals, setAutoGoals] = useState(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [editingFolder, setEditingFolder] = useState(false);
  const [tempFolder, setTempFolder] = useState("");
  const [isRescanning, setIsRescanning] = useState(false);
  const [appVersion, setAppVersion] = useState<string>('');
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    playlistId: number;
    playlistName: string;
  }>({ isOpen: false, playlistId: 0, playlistName: '' });
  
  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    const loadAppVersion = async () => {
      try {
        const electron = window.require?.('electron') as unknown as {
          ipcRenderer?: { invoke?: (channel: string) => Promise<unknown> };
        };
        const version = await electron?.ipcRenderer?.invoke?.('get-app-version');
        if (typeof version === 'string') {
          setAppVersion(version);
        }
      } catch {
        // Ignore: not running in Electron
      }
    };

    loadAppVersion();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch(getApiUrl('/api/settings'));
      if (response.ok) {
        const data = await response.json();
        setUsername(data.username || 'Player');
        setStatsFolder(data.statsFolder || '');
        setPlaylistsFolder(data.playlistsFolder || '');
        setAutoGoals(data.autoGoals ?? true);
        setNotifications(data.notifications ?? true);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const checkForUpdates = async () => {
    try {
      const electron = window.require?.('electron') as unknown as {
        ipcRenderer?: { invoke?: (channel: string) => Promise<unknown> };
      };

      if (!electron?.ipcRenderer?.invoke) {
        setToast({ message: 'Update checks are only available in the desktop app', type: 'info' });
        return;
      }

      setToast({ message: 'Checking for updates…', type: 'info' });
      const result = await electron.ipcRenderer.invoke('check-for-updates');

      if (typeof result === 'object' && result != null && 'ok' in result) {
        const ok = (result as { ok?: boolean }).ok;
        if (ok) {
          setToast({ message: 'Update check started. If an update is available you will be prompted.', type: 'success' });
        } else {
          const reason = (result as { reason?: string }).reason;
          if (reason === 'not_packaged') {
            setToast({ message: 'Update checks are not available in dev mode. Use the installed app to check updates.', type: 'info' });
          } else {
            setToast({ message: 'Update check failed. Please try again later.', type: 'error' });
          }
        }
      } else {
        setToast({ message: 'Update check started. If an update is available you will be prompted.', type: 'success' });
      }
    } catch {
      setToast({ message: 'Update check failed. Please try again later.', type: 'error' });
    }
  };

  const saveSettings = async (updates: Partial<{username: string; statsFolder: string; playlistsFolder: string; autoGoals: boolean; notifications: boolean}>) => {
    try {
      const response = await fetch(getApiUrl('/api/settings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (response.ok) {
        setToast({ message: 'Settings saved successfully', type: 'success' });
      } else {
        setToast({ message: 'Failed to save settings', type: 'error' });
      }
    } catch {
      setToast({ message: 'Failed to save settings', type: 'error' });
    }
  };

  const handleUsernameBlur = () => {
    if (username.trim()) {
      saveSettings({ username: username.trim() });
    }
  };

  const handleToggleAutoGoals = () => {
    const newValue = !autoGoals;
    setAutoGoals(newValue);
    saveSettings({ autoGoals: newValue });
  };

  const handleToggleNotifications = () => {
    const newValue = !notifications;
    setNotifications(newValue);
    saveSettings({ notifications: newValue });
  };

  const handleEditFolder = async () => {
    // Check if running in Electron
    if (window.require) {
      try {
        const { ipcRenderer } = window.require('electron');
        const folder = await ipcRenderer.invoke('pick-folder');
        if (folder) {
          setTempFolder(folder);
          saveSettings({ statsFolder: folder });
          setStatsFolder(folder);
        }
      } catch (err) {
        console.error('Failed to open folder picker:', err);
        // Fall back to manual edit
        setTempFolder(statsFolder);
        setEditingFolder(true);
      }
    } else {
      // Fall back to manual edit if not in Electron
      setTempFolder(statsFolder);
      setEditingFolder(true);
    }
  };

  const handleSaveFolder = () => {
    saveSettings({ statsFolder: tempFolder });
    setStatsFolder(tempFolder);
    setEditingFolder(false);
  };

  const handleCancelEditFolder = () => {
    setTempFolder("");
    setEditingFolder(false);
  };

  const handleEditPlaylistsFolder = async () => {
    // Check if running in Electron
    if (window.require) {
      try {
        const { ipcRenderer } = window.require('electron');
        const folder = await ipcRenderer.invoke('pick-folder');
        if (folder) {
          saveSettings({ playlistsFolder: folder });
          setPlaylistsFolder(folder);
        }
      } catch (err) {
        console.error('Failed to open folder picker:', err);
      }
    }
  };

  const handleClearData = async () => {
    // Show warning toast first
    setToast({ 
      message: 'WARNING: This will permanently delete ALL your data! Click Clear Data again within 5 seconds to confirm.', 
      type: 'warning' 
    });
    
    // Wait for user to click again
    const confirmButton = document.getElementById('confirm-clear-data');
    if (confirmButton) {
      confirmButton.style.display = 'block';
      
      // Hide after 5 seconds
      setTimeout(() => {
        if (confirmButton) {
          confirmButton.style.display = 'none';
        }
      }, 5000);
    }
  };

  const handleConfirmClearData = async () => {
    try {
      const response = await fetch(getApiUrl('/api/settings/clear-data'), {
        method: 'POST'
      });
      
      if (response.ok) {
        setToast({ message: 'All data cleared successfully', type: 'success' });
        // Hide confirm button
        const confirmButton = document.getElementById('confirm-clear-data');
        if (confirmButton) {
          confirmButton.style.display = 'none';
        }
        // Reload page after short delay
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setToast({ message: 'Failed to clear data', type: 'error' });
      }
    } catch {
      setToast({ message: 'Failed to clear data', type: 'error' });
    }
  };

  const handleRescan = async () => {
    if (!statsFolder) {
      setToast({ message: 'Stats folder not configured', type: 'error' });
      return;
    }

    setIsRescanning(true);
    setToast({ message: 'Scanning folder for CSVs...', type: 'info' });

    try {
      const response = await fetch(getApiUrl('/api/settings/rescan'), {
        method: 'POST'
      });

      if (response.ok) {
        const result = await response.json();
        setToast({ 
          message: result.message || 'Rescan complete!', 
          type: 'success' 
        });
      } else {
        const error = await response.json();
        setToast({ message: error.error || 'Rescan failed', type: 'error' });
      }
    } catch {
      setToast({ message: 'Failed to rescan folder', type: 'error' });
    } finally {
      setIsRescanning(false);
    }
  };

  // Playlist management state
  const { data: playlists } = useQuery<Playlist[]>("playlists", "/api/playlists");
  const [showPlaylistCreator, setShowPlaylistCreator] = useState(false);
  const [playlistName, setPlaylistName] = useState("");
  const [playlistDescription, setPlaylistDescription] = useState("");
  const [playlistGame, setPlaylistGame] = useState("");
  const [playlistTasks, setPlaylistTasks] = useState("");

  const openLatestRelease = () => {
    const url = 'https://github.com/DylanMH/vantage-stats/releases/latest';
    try {
      const w = window as unknown as { require?: (moduleName: string) => unknown };
      const electron = w.require?.('electron') as unknown as {
        shell?: { openExternal?: (targetUrl: string) => void };
      };
      electron?.shell?.openExternal?.(url);
    } catch {
      // Fallback for non-electron contexts
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCreatePlaylist = async () => {
    if (!playlistName.trim() || !playlistTasks.trim()) {
      alert("Please enter a playlist name and at least one task");
      return;
    }

    const taskList = playlistTasks.split('\n')
      .map(task => task.trim())
      .filter(task => task.length > 0);

    try {
      const response = await fetch(getApiUrl('/api/playlists'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: playlistName.trim(),
          description: playlistDescription.trim(),
          game_focus: playlistGame.trim() || 'Custom',
          tasks: taskList
        })
      });

      if (response.ok) {
        alert('Playlist created successfully!');
        // Reset form and reload page to show new playlist
        setPlaylistName("");
        setPlaylistDescription("");
        setPlaylistGame("");
        setPlaylistTasks("");
        setShowPlaylistCreator(false);
        window.location.reload();
      } else {
        const error = await response.json();
        alert('Failed to create playlist: ' + error.error);
      }
    } catch (err) {
      const error = err as Error;
      alert('Failed to create playlist: ' + error.message);
    }
  };

  const handleImportPlaylist = async () => {
    if (!playlistsFolder) {
      setToast({ message: 'Please set your playlists folder first', type: 'error' });
      return;
    }

    // Check if running in Electron
    if (window.require) {
      try {
        const { ipcRenderer } = window.require('electron');
        
        // Open file picker for JSON file
        const result = await ipcRenderer.invoke('pick-playlist-json');
        
        if (!result) {
          return; // User canceled
        }
        
        if (result.error) {
          setToast({ message: `Error reading playlist: ${result.error}`, type: 'error' });
          return;
        }
        
        const playlistData = result.data;
        
        // Extract playlist name and task names from JSON
        // Kovaak's playlist structure: { "playlistName": "...", "scenarioList": [{ "scenario_name": "...", "play_Count": 2 }, ...] }
        const playlistName = playlistData.playlistName || playlistData.name || 'Imported Playlist';
        const scenarioList = playlistData.scenarioList || playlistData.scenarios || [];
        
        if (!Array.isArray(scenarioList) || scenarioList.length === 0) {
          setToast({ message: 'No scenarios found in playlist', type: 'error' });
          return;
        }
        
        // Extract scenario names from objects
        const taskNames = scenarioList.map((scenario: { scenario_name?: string; name?: string }) => 
          scenario.scenario_name || scenario.name || ''
        ).filter((name: string) => name.length > 0);
        
        if (taskNames.length === 0) {
          setToast({ message: 'No valid scenario names found in playlist', type: 'error' });
          return;
        }
        
        // Create pack with extracted data
        const response = await fetch(getApiUrl('/api/playlists'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: playlistName,
            description: `Imported from Kovaak's playlist`,
            game_focus: 'Mixed',
            tasks: taskNames
          })
        });
        
        if (response.ok) {
          setToast({ message: `Successfully imported playlist: ${playlistName}`, type: 'success' });
          setTimeout(() => window.location.reload(), 1500);
        } else {
          const error = await response.json();
          setToast({ message: `Failed to import: ${error.error}`, type: 'error' });
        }
      } catch (err) {
        const error = err as Error;
        console.error('Import error:', error);
        setToast({ message: `Import failed: ${error.message}`, type: 'error' });
      }
    } else {
      setToast({ message: 'File import only works in desktop app', type: 'error' });
    }
  };

  const handleDeletePlaylist = (playlistId: number, playlistName: string) => {
    setConfirmDialog({ isOpen: true, playlistId, playlistName });
  };

  const confirmDeletePlaylist = async () => {
    const { playlistId } = confirmDialog;
    setConfirmDialog({ isOpen: false, playlistId: 0, playlistName: '' });

    try {
      const response = await fetch(getApiUrl(`/api/playlists/${playlistId}`), {
        method: 'DELETE'
      });

      if (response.ok) {
        setToast({ message: 'Playlist deleted successfully!', type: 'success' });
        window.location.reload();
      } else {
        setToast({ message: 'Failed to delete playlist', type: 'error' });
      }
    } catch (err) {
      const error = err as Error;
      setToast({ message: `Failed to delete playlist: ${error.message}`, type: 'error' });
    }
  };

  return (
    <div className="space-y-4">
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)}
        />
      )}

      {/* Profile Settings */}
      <div className="bg-theme-secondary border border-theme-primary rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 text-white">Profile Settings</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-theme-muted mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={handleUsernameBlur}
              className="w-full px-3 py-2 bg-theme-tertiary border border-theme-secondary rounded-lg text-theme-primary placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Stats Folder Settings */}
      <div className="bg-theme-secondary border border-theme-primary rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 text-white">Stats Folder</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-theme-muted mb-2">
              Current Stats Folder Path
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 bg-theme-tertiary border border-theme-secondary rounded-lg text-white break-all">
                {statsFolder || 'Not set'}
              </div>
              <button
                onClick={handleEditFolder}
                className="px-4 py-2 bg-theme-accent bg-theme-accent-hover text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
              >
                Browse
              </button>
            </div>
            {editingFolder && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={tempFolder}
                  onChange={(e) => setTempFolder(e.target.value)}
                  placeholder="Enter stats folder path"
                  className="w-full px-3 py-2 bg-theme-tertiary border border-theme-secondary rounded-lg text-theme-primary placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveFolder}
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleCancelEditFolder}
                    className="px-4 py-2 bg-theme-tertiary hover:bg-theme-secondary text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-theme-primary">
              <p className="text-xs text-theme-muted">
                Path to your Kovaaks FPSAimTrainer\stats folder
              </p>
              <button
                onClick={handleRescan}
                disabled={isRescanning || !statsFolder}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
              >
                {isRescanning ? 'Scanning...' : 'Rescan Folder'}
              </button>
            </div>
            <p className="text-xs text-theme-muted mt-2">
              Click "Rescan Folder" to re-import all CSVs from this directory
            </p>
          </div>
        </div>
      </div>

      {/* Playlists Folder Settings */}
      <div className="bg-theme-secondary border border-theme-primary rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 text-white">Playlists Folder</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-theme-muted mb-2">
              Current Playlists Folder Path
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 bg-theme-tertiary border border-theme-secondary rounded-lg text-white break-all">
                {playlistsFolder || 'Not set (Optional)'}
              </div>
              <button
                onClick={handleEditPlaylistsFolder}
                className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
              >
                Browse
              </button>
            </div>
            <p className="text-xs text-theme-muted mt-2">
              Path to your Kovaaks playlist JSON files folder (used for importing playlists)
            </p>
          </div>
        </div>
      </div>

      {/* Theme Settings */}
      <div className="bg-theme-secondary border border-theme-primary rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 text-white">Theme</h2>
        <div className="space-y-4">
          <p className="text-sm text-theme-muted mb-4">
            Choose your preferred visual theme
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.values(themes).map((theme) => (
              <button
                key={theme.name}
                onClick={() => setTheme(theme.name as ThemeName)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  currentTheme === theme.name
                    ? 'border-theme-accent bg-theme-tertiary'
                    : 'border-theme-secondary bg-theme-secondary hover:border-theme-primary'
                }`}
              >
                <div className="text-left">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {theme.displayName}
                  </h3>
                  
                  {/* Theme preview circles */}
                  <div className="flex gap-2 mb-3">
                    <div 
                      className="w-8 h-8 rounded-full border border-white/20" 
                      style={{ backgroundColor: theme.colors.accentPrimary }}
                      title="Primary Accent"
                    />
                    <div 
                      className="w-8 h-8 rounded-full border border-white/20" 
                      style={{ backgroundColor: theme.colors.chartScore }}
                      title="Score"
                    />
                    <div 
                      className="w-8 h-8 rounded-full border border-white/20" 
                      style={{ backgroundColor: theme.colors.chartAccuracy }}
                      title="Accuracy"
                    />
                    <div 
                      className="w-8 h-8 rounded-full border border-white/20" 
                      style={{ backgroundColor: theme.colors.chartTTK }}
                      title="TTK"
                    />
                  </div>
                  
                  {currentTheme === theme.name && (
                    <div className="text-sm text-theme-accent font-medium">
                      ✓ Active
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Goal Settings */}
      <div className="bg-theme-secondary border border-theme-primary rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 text-white">Goal Settings</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white">Auto-generate Goals</p>
              <p className="text-sm text-theme-muted">Automatically create goals based on your performance</p>
            </div>
            <button
              onClick={handleToggleAutoGoals}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoGoals ? "bg-theme-accent" : "bg-theme-tertiary"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoGoals ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="bg-theme-secondary border border-theme-primary rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 text-white">Notifications</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white">Goal Notifications</p>
              <p className="text-sm text-theme-muted">Get notified when you complete goals</p>
            </div>
            <button
              onClick={handleToggleNotifications}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                notifications ? "bg-theme-accent" : "bg-theme-tertiary"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  notifications ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Playlist Management */}
      <div className="bg-theme-secondary border border-theme-primary rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 text-white">Playlist Management</h2>
        <div className="space-y-4">
          {playlists && playlists.length > 0 ? (
            playlists.map(playlist => (
              <div key={playlist.id} className="bg-theme-hover border border-theme-secondary rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white">{playlist.name}</h3>
                    {playlist.description && (
                      <p className="text-sm text-theme-muted mt-1">{playlist.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-theme-muted">
                      {playlist.game_focus && (
                        <span className="px-2 py-1 bg-theme-accent/20 text-theme-accent rounded">
                          {playlist.game_focus}
                        </span>
                      )}
                      <span>{playlist.task_count} tasks</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeletePlaylist(playlist.id, playlist.name)}
                    className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-theme-muted">
              <p>No custom playlists yet. Create one below!</p>
            </div>
          )}
        </div>
      </div>

      {/* Data Management */}
      <div className="bg-theme-secondary border border-theme-primary rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 text-white">Data Management</h2>
        <div className="space-y-4">
          {/* Export Data */}
          <div className="border-b border-theme-primary pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">Export Your Data</p>
                <p className="text-sm text-theme-muted">Backup all your stats to JSON or CSV format</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={async () => {
                    try {
                      const response = await fetch(getApiUrl('/api/export/json'), { method: 'POST' });
                      if (response.ok) {
                        const result = await response.json();
                        setToast({ 
                          message: `Exported ${result.stats.total_runs} runs to: ${result.path}`, 
                          type: 'success' 
                        });
                      } else {
                        setToast({ message: 'Export failed', type: 'error' });
                      }
                    } catch {
                      setToast({ message: 'Export failed', type: 'error' });
                    }
                  }}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  📥 Export JSON
                </button>
                <button 
                  onClick={async () => {
                    try {
                      const response = await fetch(getApiUrl('/api/export/csv'), { method: 'POST' });
                      if (response.ok) {
                        const result = await response.json();
                        setToast({ 
                          message: `Exported ${result.stats.total_runs} runs to CSV: ${result.path}`, 
                          type: 'success' 
                        });
                      } else {
                        setToast({ message: 'CSV export failed', type: 'error' });
                      }
                    } catch {
                      setToast({ message: 'CSV export failed', type: 'error' });
                    }
                  }}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  📊 Export CSV
                </button>
              </div>
            </div>
            <p className="text-xs text-theme-muted mt-2">
              Exports saved to: AppData\Roaming\vantage-stats\exports\
            </p>
          </div>

          {/* Clear Data */}
          <div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">Clear All Data</p>
                <p className="text-sm text-theme-muted">Delete all stored statistics and goals</p>
              </div>
              <button 
                onClick={handleClearData}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Clear Data
              </button>
            </div>
            <button
              id="confirm-clear-data"
              onClick={handleConfirmClearData}
              className="mt-3 px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg text-sm font-medium transition-colors w-full"
              style={{ display: 'none' }}
            >
CONFIRM: Yes, delete everything!
            </button>
          </div>
        </div>
      </div>

      {/* Playlist Creation */}
      <div className="bg-theme-secondary border border-theme-primary rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Create Custom Playlist</h2>
          <div className="flex gap-2">
            <button
              onClick={handleImportPlaylist}
              disabled={!playlistsFolder}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
              title={!playlistsFolder ? 'Please set playlists folder in settings first' : 'Import Kovaak\'s playlist JSON'}
            >
              📥 Import Playlist
            </button>
            <button
              onClick={() => setShowPlaylistCreator(!showPlaylistCreator)}
              className="px-4 py-2 bg-theme-accent bg-theme-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
            >
              {showPlaylistCreator ? 'Cancel' : 'New Playlist'}
            </button>
          </div>
        </div>
        
        {showPlaylistCreator && (
          <div className="space-y-4 border-t border-theme-primary pt-4">
            <div>
              <label className="block text-sm font-medium text-theme-muted mb-2">
                Playlist Name *
              </label>
              <input
                type="text"
                value={playlistName}
                onChange={(e) => setPlaylistName(e.target.value)}
                placeholder="e.g., My Valorant Routine"
                className="w-full px-3 py-2 bg-theme-tertiary border border-theme-secondary rounded-lg text-theme-primary placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-theme-muted mb-2">
                Description
              </label>
              <input
                type="text"
                value={playlistDescription}
                onChange={(e) => setPlaylistDescription(e.target.value)}
                placeholder="Optional description of your playlist"
                className="w-full px-3 py-2 bg-theme-tertiary border border-theme-secondary rounded-lg text-theme-primary placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-theme-muted mb-2">
                Game Focus
              </label>
              <input
                type="text"
                value={playlistGame}
                onChange={(e) => setPlaylistGame(e.target.value)}
                placeholder="e.g., Valorant, CS:GO, Custom"
                className="w-full px-3 py-2 bg-theme-tertiary border border-theme-secondary rounded-lg text-theme-primary placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-theme-muted mb-2">
                Task Names * (one per line)
              </label>
              <textarea
                value={playlistTasks}
                onChange={(e) => setPlaylistTasks(e.target.value)}
                placeholder="Tile Frenzy&#10;1wall6targets TE&#10;Close Strafes&#10;Long Strafes"
                rows={6}
                className="w-full px-3 py-2 bg-theme-tertiary border border-theme-secondary rounded-lg text-theme-primary placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
              <p className="text-xs text-theme-muted mt-1">
                Enter the exact task names as they appear in Kovaaks, one per line
              </p>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleCreatePlaylist}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Create Playlist
              </button>
              <button
                onClick={() => {
                  setShowPlaylistCreator(false);
                  setPlaylistName("");
                  setPlaylistDescription("");
                  setPlaylistGame("");
                  setPlaylistTasks("");
                }}
                className="px-4 py-2 bg-theme-tertiary hover:bg-theme-secondary text-white rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* About */}
      <div className="bg-theme-secondary border border-theme-primary rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 text-white">About</h2>
        <div className="space-y-3 space-x-3 text-sm">
          <p className="text-theme-muted">
            <span className="font-medium text-white">Vantage Stats</span>{appVersion ? ` v${appVersion}` : ''}
          </p>
          <button
            type="button"
            onClick={checkForUpdates}
            className="text-left text-theme-accent hover:underline text-sm"
          >
            Check for updates
          </button>
          <button
            type="button"
            onClick={openLatestRelease}
            className="text-left text-theme-accent hover:underline text-sm"
          >
            View latest release on GitHub
          </button>
          <p className="text-theme-muted">
            A comprehensive performance tracker for FPS Aim Trainers with goals, session tracking, and advanced analytics.
          </p>
          <p className="text-theme-muted">
            Built with Electron, React, and SQLite3.
          </p>
          <div className="mt-4 pt-4 border-t border-theme-primary">
            <p className="text-xs text-theme-muted leading-relaxed">
              <span className="font-medium text-white">Disclaimer:</span> Vantage Stats is an independent, community-created tool and is not affiliated with, endorsed by, or associated with Kovaak's FPS Aim Trainer, Aim Lab, or any other FPS training software. All trademarks belong to their respective owners.
            </p>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title="Delete Playlist"
        message={`Are you sure you want to delete "${confirmDialog.playlistName}"? This cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDeletePlaylist}
        onCancel={() => setConfirmDialog({ isOpen: false, playlistId: 0, playlistName: '' })}
        danger={true}
      />
    </div>
  );
}
