import { useState, useEffect } from "react";
import { useQuery, getApiUrl } from "../hooks/useApi";
import Toast from "../components/Toast";

// Extend Window type for Electron
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    require?: (module: string) => any;
  }
}

type Pack = {
  id: number;
  name: string;
  description?: string;
  game_focus?: string;
  task_count: number;
  created_at?: string;
};

type ToastMessage = {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
};

export default function Settings() {
  const [username, setUsername] = useState("Player");
  const [statsFolder, setStatsFolder] = useState("");
  const [playlistsFolder, setPlaylistsFolder] = useState("");
  const [notifications, setNotifications] = useState(true);
  const [autoGoals, setAutoGoals] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [editingFolder, setEditingFolder] = useState(false);
  const [tempFolder, setTempFolder] = useState("");
  const [isRescanning, setIsRescanning] = useState(false);
  
  // Load settings on mount
  useEffect(() => {
    loadSettings();
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
        setDarkMode(data.darkMode ?? true);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const saveSettings = async (updates: Partial<{username: string; statsFolder: string; playlistsFolder: string; autoGoals: boolean; notifications: boolean; darkMode: boolean}>) => {
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

  const handleToggleDarkMode = () => {
    const newValue = !darkMode;
    setDarkMode(newValue);
    saveSettings({ darkMode: newValue });
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
      message: '⚠️ WARNING: This will permanently delete ALL your data! Click Clear Data again within 5 seconds to confirm.', 
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

  // Pack management state
  const { data: packs } = useQuery<Pack[]>("packs", "/api/packs");
  const [showPackCreator, setShowPackCreator] = useState(false);
  const [packName, setPackName] = useState("");
  const [packDescription, setPackDescription] = useState("");
  const [packGame, setPackGame] = useState("");
  const [packTasks, setPackTasks] = useState("");

  const handleCreatePack = async () => {
    if (!packName.trim() || !packTasks.trim()) {
      alert("Please enter a pack name and at least one task");
      return;
    }

    const taskList = packTasks.split('\n')
      .map(task => task.trim())
      .filter(task => task.length > 0);

    try {
      const response = await fetch(getApiUrl('/api/packs'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: packName.trim(),
          description: packDescription.trim(),
          game_focus: packGame.trim() || 'Custom',
          tasks: taskList
        })
      });

      if (response.ok) {
        alert('Pack created successfully!');
        // Reset form and reload page to show new pack
        setPackName("");
        setPackDescription("");
        setPackGame("");
        setPackTasks("");
        setShowPackCreator(false);
        window.location.reload();
      } else {
        const error = await response.json();
        alert('Failed to create pack: ' + error.error);
      }
    } catch (err) {
      const error = err as Error;
      alert('Failed to create pack: ' + error.message);
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
        const response = await fetch(getApiUrl('/api/packs'), {
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

  const handleDeletePack = async (packId: number, packName: string) => {
    if (!confirm(`Are you sure you want to delete "${packName}"? This cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(getApiUrl(`/api/packs/${packId}`), {
        method: 'DELETE'
      });

      if (response.ok) {
        alert('Pack deleted successfully!');
        window.location.reload();
      } else {
        alert('Failed to delete pack');
      }
    } catch (err) {
      const error = err as Error;
      alert('Failed to delete pack: ' + error.message);
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
      <div className="bg-[#0d1424] border border-[#1b2440] rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 text-white">Profile Settings</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#9aa4b2] mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={handleUsernameBlur}
              className="w-full px-3 py-2 bg-[#1b2440] border border-[#2d3561] rounded-lg text-white placeholder-[#9aa4b2] focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Stats Folder Settings */}
      <div className="bg-[#0d1424] border border-[#1b2440] rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 text-white">Stats Folder</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#9aa4b2] mb-2">
              Current Stats Folder Path
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 bg-[#1b2440] border border-[#2d3561] rounded-lg text-white break-all">
                {statsFolder || 'Not set'}
              </div>
              <button
                onClick={handleEditFolder}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
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
                  className="w-full px-3 py-2 bg-[#1b2440] border border-[#2d3561] rounded-lg text-white placeholder-[#9aa4b2] focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="px-4 py-2 bg-[#1b2440] hover:bg-[#2d3561] text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#1b2440]">
              <p className="text-xs text-[#9aa4b2]">
                Path to your Kovaaks FPSAimTrainer\stats folder
              </p>
              <button
                onClick={handleRescan}
                disabled={isRescanning || !statsFolder}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
              >
                {isRescanning ? '🔄 Scanning...' : '🔄 Rescan Folder'}
              </button>
            </div>
            <p className="text-xs text-[#9aa4b2] mt-2">
              Click "Rescan Folder" to re-import all CSVs from this directory
            </p>
          </div>
        </div>
      </div>

      {/* Playlists Folder Settings */}
      <div className="bg-[#0d1424] border border-[#1b2440] rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 text-white">Playlists Folder</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#9aa4b2] mb-2">
              Current Playlists Folder Path
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 bg-[#1b2440] border border-[#2d3561] rounded-lg text-white break-all">
                {playlistsFolder || 'Not set (Optional)'}
              </div>
              <button
                onClick={handleEditPlaylistsFolder}
                className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
              >
                Browse
              </button>
            </div>
            <p className="text-xs text-[#9aa4b2] mt-2">
              Path to your Kovaaks playlist JSON files folder (used for importing playlists as packs)
            </p>
          </div>
        </div>
      </div>

      {/* Goal Settings */}
      <div className="bg-[#0d1424] border border-[#1b2440] rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 text-white">Goal Settings</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white">Auto-generate Goals</p>
              <p className="text-sm text-[#9aa4b2]">Automatically create goals based on your performance</p>
            </div>
            <button
              onClick={handleToggleAutoGoals}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoGoals ? "bg-blue-500" : "bg-[#1b2440]"
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
      <div className="bg-[#0d1424] border border-[#1b2440] rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 text-white">Notifications</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white">Goal Notifications</p>
              <p className="text-sm text-[#9aa4b2]">Get notified when you complete goals</p>
            </div>
            <button
              onClick={handleToggleNotifications}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                notifications ? "bg-blue-500" : "bg-[#1b2440]"
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

      {/* Appearance */}
      <div className="bg-[#0d1424] border border-[#1b2440] rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 text-white">Appearance</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white">Dark Mode</p>
              <p className="text-sm text-[#9aa4b2]">Use dark theme (currently always enabled)</p>
            </div>
            <button
              onClick={handleToggleDarkMode}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                darkMode ? "bg-blue-500" : "bg-[#1b2440]"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  darkMode ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Pack Management */}
      <div className="bg-[#0d1424] border border-[#1b2440] rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 text-white">Pack Management</h2>
        <div className="space-y-4">
          {packs && packs.length > 0 ? (
            packs.map(pack => (
              <div key={pack.id} className="bg-[#0f1320] border border-[#1d2230] rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white">{pack.name}</h3>
                    {pack.description && (
                      <p className="text-sm text-[#9aa4b2] mt-1">{pack.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-[#9aa4b2]">
                      {pack.game_focus && (
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded">
                          {pack.game_focus}
                        </span>
                      )}
                      <span>{pack.task_count} tasks</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeletePack(pack.id, pack.name)}
                    className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-[#9aa4b2]">
              <p>No custom packs yet. Create one below!</p>
            </div>
          )}
        </div>
      </div>

      {/* Data Management */}
      <div className="bg-[#0d1424] border border-[#1b2440] rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 text-white">Data Management</h2>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">Clear All Data</p>
                <p className="text-sm text-[#9aa4b2]">Delete all stored statistics and goals</p>
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
              ⚠️ CONFIRM: Yes, delete everything!
            </button>
          </div>
        </div>
      </div>

      {/* Pack Creation */}
      <div className="bg-[#0d1424] border border-[#1b2440] rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Create Custom Pack</h2>
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
              onClick={() => setShowPackCreator(!showPackCreator)}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {showPackCreator ? 'Cancel' : 'New Pack'}
            </button>
          </div>
        </div>
        
        {showPackCreator && (
          <div className="space-y-4 border-t border-[#1b2440] pt-4">
            <div>
              <label className="block text-sm font-medium text-[#9aa4b2] mb-2">
                Pack Name *
              </label>
              <input
                type="text"
                value={packName}
                onChange={(e) => setPackName(e.target.value)}
                placeholder="e.g., My Valorant Routine"
                className="w-full px-3 py-2 bg-[#1b2440] border border-[#2d3561] rounded-lg text-white placeholder-[#9aa4b2] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-[#9aa4b2] mb-2">
                Description
              </label>
              <input
                type="text"
                value={packDescription}
                onChange={(e) => setPackDescription(e.target.value)}
                placeholder="Optional description of your pack"
                className="w-full px-3 py-2 bg-[#1b2440] border border-[#2d3561] rounded-lg text-white placeholder-[#9aa4b2] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-[#9aa4b2] mb-2">
                Game Focus
              </label>
              <input
                type="text"
                value={packGame}
                onChange={(e) => setPackGame(e.target.value)}
                placeholder="e.g., Valorant, CS:GO, Custom"
                className="w-full px-3 py-2 bg-[#1b2440] border border-[#2d3561] rounded-lg text-white placeholder-[#9aa4b2] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-[#9aa4b2] mb-2">
                Task Names * (one per line)
              </label>
              <textarea
                value={packTasks}
                onChange={(e) => setPackTasks(e.target.value)}
                placeholder="Tile Frenzy&#10;1wall6targets TE&#10;Close Strafes&#10;Long Strafes"
                rows={6}
                className="w-full px-3 py-2 bg-[#1b2440] border border-[#2d3561] rounded-lg text-white placeholder-[#9aa4b2] focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
              <p className="text-xs text-[#9aa4b2] mt-1">
                Enter the exact task names as they appear in Kovaaks, one per line
              </p>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleCreatePack}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Create Pack
              </button>
              <button
                onClick={() => {
                  setShowPackCreator(false);
                  setPackName("");
                  setPackDescription("");
                  setPackGame("");
                  setPackTasks("");
                }}
                className="px-4 py-2 bg-[#1b2440] hover:bg-[#2d3561] text-white rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* About */}
      <div className="bg-[#0d1424] border border-[#1b2440] rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 text-white">About</h2>
        <div className="space-y-2 text-sm">
          <p className="text-[#9aa4b2]">
            <span className="font-medium text-white">Kovaaks Insight</span> v0.0.1
          </p>
          <p className="text-[#9aa4b2]">
            A comprehensive stat tracker for Kovaaks Aim Trainer with goals, coaching, and packs.
          </p>
          <p className="text-[#9aa4b2]">
            Built with Electron, React, and SQLite3.
          </p>
        </div>
      </div>
    </div>
  );
}
