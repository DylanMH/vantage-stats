// electron/modules/dataLocation.js
// Bootstrap system to track where user's data is stored

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// Bootstrap file in AppData - just tells us where the real data is
const BOOTSTRAP_FILE = path.join(app.getPath('userData'), 'data-location.json');

/**
 * Get the data directory from bootstrap file
 * Returns null if not set (first run)
 */
function getDataDirectory() {
    try {
        if (fs.existsSync(BOOTSTRAP_FILE)) {
            const bootstrap = JSON.parse(fs.readFileSync(BOOTSTRAP_FILE, 'utf-8'));
            return bootstrap.dataDirectory;
        }
    } catch (error) {
        console.error('Error reading data location:', error);
    }
    return null;
}

/**
 * Set the data directory in bootstrap file
 * Creates the directory structure if needed
 */
function setDataDirectory(dataDir) {
    try {
        // Ensure the directory exists
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        // Create subdirectories
        const dataSubDir = path.join(dataDir, 'data');
        const backupsDir = path.join(dataSubDir, 'backups');
        const exportsDir = path.join(dataDir, 'exports');

        [dataSubDir, backupsDir, exportsDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });

        // Save bootstrap file
        const bootstrap = { dataDirectory: dataDir };
        fs.writeFileSync(BOOTSTRAP_FILE, JSON.stringify(bootstrap, null, 2), 'utf-8');

        console.log(`📁 Data directory set to: ${dataDir}`);
        return true;
    } catch (error) {
        console.error('Error setting data directory:', error);
        return false;
    }
}

/**
 * Get config file path (in data directory, not AppData)
 */
function getConfigPath() {
    const dataDir = getDataDirectory();
    if (!dataDir) {
        return null;
    }
    return path.join(dataDir, 'config.json');
}

/**
 * Read config from data directory
 */
function readConfig() {
    try {
        const configPath = getConfigPath();
        if (!configPath) {
            return null;
        }

        if (fs.existsSync(configPath)) {
            return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        }
    } catch (error) {
        console.error('Error reading config:', error);
    }
    return null;
}

/**
 * Write config to data directory
 */
function writeConfig(config) {
    try {
        const configPath = getConfigPath();
        if (!configPath) {
            throw new Error('Data directory not set');
        }

        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
        console.log(`💾 Config saved to: ${configPath}`);
        return true;
    } catch (error) {
        console.error('Error writing config:', error);
        return false;
    }
}

/**
 * Check if this is a first-time setup (no bootstrap file)
 */
function isFirstRun() {
    return !fs.existsSync(BOOTSTRAP_FILE);
}

module.exports = {
    getDataDirectory,
    setDataDirectory,
    getConfigPath,
    readConfig,
    writeConfig,
    isFirstRun
};
