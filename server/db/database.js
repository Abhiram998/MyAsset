const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const dbPath = process.env.DB_PATH || path.join(__dirname, 'myasset.sqlite');

let db;

function connect() {
    if (!db) {
        // Ensure directory exists
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        db = new Database(dbPath, { verbose: process.env.NODE_ENV === 'development' ? console.log : null });
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
    }
    return db;
}

function runMigrations() {
    const database = connect();
    // Initialize migrations table if it doesn't exist
    database.exec(`
        CREATE TABLE IF NOT EXISTS migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    if (fs.existsSync(migrationsDir)) {
        const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
        
        const getApplied = database.prepare('SELECT name FROM migrations').all();
        const appliedNames = new Set(getApplied.map(m => m.name));

        for (const file of files) {
            if (!appliedNames.has(file)) {
                console.log(`Applying migration: ${file}`);
                const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
                
                // Run inside a transaction
                const apply = database.transaction(() => {
                    database.exec(sql);
                    database.prepare('INSERT INTO migrations (name) VALUES (?)').run(file);
                });
                apply();
            }
        }
    }
}

module.exports = {
    connect,
    runMigrations
};
