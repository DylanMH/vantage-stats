// backend/config/cacheInitializer.js
// Initialize performance cache on server startup

const CacheManager = require('../services/cacheManager');

async function initializeCache(db) {
    console.log('🔄 Initializing performance cache...');
    
    try {
        const cacheManager = new CacheManager(db);
        await cacheManager.initializeCache();
        
        console.log('✅ Performance cache initialized successfully');
        return cacheManager;
    } catch (error) {
        console.error('❌ Failed to initialize cache:', error);
        throw error;
    }
}

module.exports = { initializeCache };
