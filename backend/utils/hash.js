// backend/utils/hash.js
// Centralized hashing utilities for file deduplication

const crypto = require('crypto');
const fs = require('fs/promises');

/**
 * Generate SHA1 hash from buffer
 */
function sha1(buf) {
    return crypto.createHash('sha1').update(buf).digest('hex');
}

/**
 * Generate SHA1 hash from file contents
 * Used for CSV deduplication
 */
async function hashFile(filePath) {
    const buf = await fs.readFile(filePath);
    return sha1(buf);
}

module.exports = {
    sha1,
    hashFile
};
