import { useState, useEffect } from "react";
import CloudDownloadIcon from "../icons/CloudDownloadIcon";
import DocumentIcon from "../icons/DocumentIcon";
import DownloadIcon from "../icons/DownloadIcon";

type UpdateInfo = {
  version: string;
  releaseNotes?: string;
  releaseName?: string;
  releaseDate?: string;
};

export default function UpdateDialog() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloading, setDownloading] = useState(false);

  const stripHtmlTags = (html: string): string => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  useEffect(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ipcRenderer } = require('electron');
      
      const handleUpdateAvailable = (_event: unknown, info: UpdateInfo) => {
        setUpdateInfo(info);
      };

      const handleUpdateDownloading = () => {
        setDownloading(true);
      };

      ipcRenderer.on('update-available', handleUpdateAvailable);
      ipcRenderer.on('update-downloading', handleUpdateDownloading);

      return () => {
        ipcRenderer.removeAllListeners('update-available');
        ipcRenderer.removeAllListeners('update-downloading');
      };
    } catch {
      // Not in Electron environment (dev mode in browser)
      console.log('Not running in Electron environment');
    }
  }, []);

  const handleInstall = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ipcRenderer } = require('electron');
      await ipcRenderer.invoke('download-update');
    } catch (e) {
      console.error('Failed to download update:', e);
    }
  };

  const handleClose = () => {
    setUpdateInfo(null);
    setDownloading(false);
  };

  if (!updateInfo) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-theme-secondary border-2 border-theme-accent rounded-lg max-w-2xl w-full shadow-2xl">
        <div className="bg-gradient-to-r from-theme-accent/20 to-theme-accent/10 border-b border-theme-accent/50 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-theme-accent rounded-full flex items-center justify-center">
              <CloudDownloadIcon className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Update Available</h2>
              <p className="text-sm text-theme-muted mt-1">
                Version {updateInfo.version} is ready to install
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {updateInfo.releaseNotes && (
            <div className="bg-theme-tertiary border border-theme-secondary rounded-lg p-4 max-h-64 overflow-y-auto">
              <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                <DocumentIcon />
                What's New
              </h3>
              <div className="text-sm text-theme-muted whitespace-pre-wrap">
                {stripHtmlTags(updateInfo.releaseNotes)}
              </div>
            </div>
          )}

          <div className="text-xs text-theme-muted text-center">
            <a
              href={`https://github.com/DylanMH/vantage-stats/releases/tag/v${updateInfo.version}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-theme-accent hover:text-theme-accent/80 underline transition-colors"
            >
              View full release notes on GitHub →
            </a>
          </div>

          {downloading && (
            <div className="bg-theme-tertiary border border-theme-secondary rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 border-2 border-theme-accent border-t-transparent rounded-full animate-spin" />
                <span className="text-white font-medium">Downloading update...</span>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-theme-primary p-6 flex items-center justify-end gap-3">
          <button
            onClick={handleClose}
            disabled={downloading}
            className="px-6 py-2.5 bg-theme-tertiary hover:bg-theme-primary border border-theme-secondary rounded-lg text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Not Now
          </button>
          <button
            onClick={handleInstall}
            disabled={downloading}
            className="px-6 py-2.5 bg-theme-accent hover:bg-theme-accent/80 rounded-lg text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {downloading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <DownloadIcon />
                Install & Restart
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
