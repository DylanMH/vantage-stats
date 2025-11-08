// backend/backfill.js
const fs = require('fs/promises');
const crypto = require('crypto');

function sha1(buf) { return crypto.createHash('sha1').update(buf).digest('hex'); }

async function backfillHashes(db) {
    const rows = await db.all(`SELECT id, path FROM runs WHERE hash IS NULL OR hash = ''`);
    let filled = 0, missing = 0;
    for (const r of rows) {
        try {
            const buf = await fs.readFile(r.path);
            const h = sha1(buf);
            await db.run(`UPDATE runs SET hash = ? WHERE id = ?`, [h, r.id]);
            filled++;
        } catch {
            missing++;
        }
    }
    return { filled, missing };
}

module.exports = { backfillHashes };
