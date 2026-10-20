/**
 * Database Backup and Restore Utility for MyAsset (better-sqlite3 WAL-safe)
 */
const path = require('path');
const fs = require('fs');
const { connect } = require('./database');

async function createBackup(customDestPath) {
    const db = connect();
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dest = customDestPath || path.join(backupDir, `myasset_backup_${timestamp}.sqlite`);

    console.log(`Starting online database backup to: ${dest}`);
    await db.backup(dest, {
        progress({ totalPages, remainingPages }) {
            const pct = Math.round(((totalPages - remainingPages) / totalPages) * 100);
            if (pct % 25 === 0) console.log(`Backup progress: ${pct}%`);
        }
    });

    console.log(`✅ Backup completed successfully: ${dest}`);
    return dest;
}

function verifyBackup(backupFilePath) {
    const Database = require('better-sqlite3');
    if (!fs.existsSync(backupFilePath)) {
        throw new Error(`Backup file does not exist: ${backupFilePath}`);
    }
    const testDb = new Database(backupFilePath, { readonly: true });
    const check = testDb.pragma('quick_check');
    testDb.close();
    const isValid = check && check.length > 0 && check[0].quick_check === 'ok';
    console.log(`Backup integrity check: ${isValid ? 'PASSED (ok)' : 'FAILED'}`);
    return isValid;
}

if (require.main === module) {
    createBackup()
        .then(dest => verifyBackup(dest))
        .then(() => process.exit(0))
        .catch(err => {
            console.error('Backup failed:', err);
            process.exit(1);
        });
}

module.exports = {
    createBackup,
    verifyBackup
};
