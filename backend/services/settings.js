// backend/services/settings.js
// Helper functions for managing app settings

async function getSetting(db, key, defaultValue = null) {
    try {
        const row = await db.get(`SELECT value FROM app_settings WHERE key = ?`, [key]);
        return row ? row.value : defaultValue;
    } catch (error) {
        console.error(`Error getting setting ${key}:`, error);
        return defaultValue;
    }
}

async function setSetting(db, key, value) {
    try {
        await db.run(`
            INSERT INTO app_settings (key, value, updated_at)
            VALUES (?, ?, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = datetime('now')
        `, [key, String(value)]);
        return true;
    } catch (error) {
        console.error(`Error setting ${key}:`, error);
        return false;
    }
}

async function getSettingBoolean(db, key, defaultValue = false) {
    const value = await getSetting(db, key);
    if (value === null) return defaultValue;
    return value === 'true' || value === '1';
}

async function getSettingNumber(db, key, defaultValue = 0) {
    const value = await getSetting(db, key);
    if (value === null) return defaultValue;
    return parseFloat(value) || defaultValue;
}

module.exports = {
    getSetting,
    setSetting,
    getSettingBoolean,
    getSettingNumber
};
