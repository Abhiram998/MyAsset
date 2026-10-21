/**
 * MyAsset Database Adapter
 * Seamlessly routes queries to PostgreSQL in production (Vercel) or SQLite for local development.
 * Enforces fail-fast validation in production so persistent data is never lost.
 */
const Database = require('better-sqlite3');
const { Pool } = require('pg');
const { AsyncLocalStorage } = require('async_hooks');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Automatically parse Postgres int8 (bigint/count) as JavaScript numbers to match SQLite
const pg = require('pg');
pg.types.setTypeParser(20, val => parseInt(val, 10));

let sqliteDb = null;
let pgPool = null;
const txStorage = new AsyncLocalStorage();

function getDatabaseMode() {
    const isProduction = process.env.NODE_ENV === 'production';
    const forcePostgres = process.env.DB_CLIENT === 'postgres' || process.env.USE_POSTGRES === 'true';

    if (isProduction || forcePostgres) {
        const postgresUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
        if (!postgresUrl || (!postgresUrl.startsWith('postgres://') && !postgresUrl.startsWith('postgresql://'))) {
            throw new Error(
                'FATAL: Production / PostgreSQL mode requires POSTGRES_URL or DATABASE_URL. ' +
                'SQLite cannot be used as permanent storage in Vercel serverless functions (read-only filesystem). ' +
                'Aborting startup to prevent silent data loss.'
            );
        }
        return 'postgres';
    }

    return 'sqlite';
}

function isPostgresConfigured() {
    try {
        return getDatabaseMode() === 'postgres';
    } catch (e) {
        return false;
    }
}

function getPgPool() {
    const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('PostgreSQL connection string is required but missing.');
    }
    if (!pgPool) {
        pgPool = new Pool({
            connectionString,
            ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000
        });
        pgPool.on('error', (err) => {
            console.error('Unexpected error on idle PostgreSQL client:', err);
        });
    }
    return pgPool;
}

function getSqliteDb() {
    if (!sqliteDb) {
        const dbPath = process.env.DB_PATH || path.join(__dirname, 'myasset.sqlite');
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        sqliteDb = new Database(dbPath, {
            verbose: process.env.NODE_ENV === 'development' ? console.log : null
        });
        sqliteDb.pragma('journal_mode = WAL');
        sqliteDb.pragma('foreign_keys = ON');
    }
    return sqliteDb;
}

function replacePlaceholders(sql) {
    let inString = false;
    let paramIndex = 1;
    let result = '';
    for (let i = 0; i < sql.length; i++) {
        const char = sql[i];
        if (char === "'") {
            if (inString && sql[i + 1] === "'") {
                result += "''";
                i++;
                continue;
            }
            inString = !inString;
            result += char;
        } else if (char === '?' && !inString) {
            result += `$${paramIndex++}`;
        } else {
            result += char;
        }
    }
    return result;
}

function adaptSqlForPostgres(sql) {
    let converted = sql;

    // 1. strftime('%Y-%m', col) -> to_char(col, 'YYYY-MM')
    converted = converted.replace(/strftime\s*\(\s*'%Y-%m'\s*,\s*([^)]+)\)/gi, (m, col) => `to_char(${col.trim()}, 'YYYY-MM')`);

    // 2. datetime('now', '+/- N days') -> (NOW() +/- INTERVAL 'N days')
    converted = converted.replace(/datetime\s*\(\s*'now'\s*,\s*'([+-]?\d+)\s*days'\s*\)/gi, (m, days) => {
        const sign = days.startsWith('+') ? '+' : (days.startsWith('-') ? '-' : '+');
        const num = Math.abs(parseInt(days, 10));
        return `(NOW() ${sign} INTERVAL '${num} days')`;
    });

    // 3. datetime('now') -> NOW()
    converted = converted.replace(/datetime\s*\(\s*'now'\s*\)/gi, 'NOW()');

    // 4. date('now') -> CURRENT_DATE
    converted = converted.replace(/date\s*\(\s*'now'\s*\)/gi, 'CURRENT_DATE');

    // 5. date(col) -> CAST(col AS DATE)
    converted = converted.replace(/date\s*\(\s*([^)]+)\s*\)/gi, (m, col) => `CAST(${col.trim()} AS DATE)`);

    // 6. GROUP_CONCAT(col, sep) -> STRING_AGG(col, sep)
    converted = converted.replace(/group_concat\s*\(\s*([^,)]+)\s*,\s*('[^']*')\s*\)/gi, (m, expr, sep) => `string_agg(${expr.trim()}, ${sep.trim()})`);
    converted = converted.replace(/group_concat\s*\(\s*([^)]+)\s*\)/gi, (m, expr) => `string_agg(${expr.trim()}, ',')`);

    // 7. INSERT OR IGNORE INTO -> INSERT INTO ... ON CONFLICT DO NOTHING
    if (/\binsert\s+or\s+ignore\s+into\b/i.test(converted)) {
        converted = converted.replace(/\binsert\s+or\s+ignore\s+into\b/gi, 'INSERT INTO');
        if (!/\bon\s+conflict\b/i.test(converted)) {
            converted += ' ON CONFLICT DO NOTHING';
        }
    }

    // 8. Boolean comparisons: is_resolved = 0/1, is_completed = 0/1, is_required = 0/1
    converted = converted.replace(/\b(is_resolved|is_completed|is_required)\s*=\s*0\b/gi, '$1 = FALSE');
    converted = converted.replace(/\b(is_resolved|is_completed|is_required)\s*=\s*1\b/gi, '$1 = TRUE');
    converted = converted.replace(/\b(is_resolved|is_completed|is_required)\s*!=\s*0\b/gi, '$1 = TRUE');
    converted = converted.replace(/\b(is_resolved|is_completed|is_required)\s*!=\s*1\b/gi, '$1 = FALSE');

    // 9. Boolean literals in INSERT statements
    converted = converted.replace(/(is_completed|is_resolved|is_required)\s*\)\s*VALUES\s*\((.*?)(,\s*)0(\s*\))/gi, '$1) VALUES ($2$3FALSE$4');
    converted = converted.replace(/(is_completed|is_resolved|is_required)\s*\)\s*VALUES\s*\((.*?)(,\s*)1(\s*\))/gi, '$1) VALUES ($2$3TRUE$4');

    // 10. Parameter placeholders (? -> $1, $2, ...)
    converted = replacePlaceholders(converted);

    // 11. INSERT ... RETURNING id
    if (/^\s*insert\s+into\b/i.test(converted) && !/\breturning\b/i.test(converted)) {
        if (/\binsert\s+into\s+settings\b/i.test(converted)) {
            converted += ' RETURNING organization_id as id';
        } else if (/\binsert\s+into\s+(employee_zones|asset_custom_values)\b/i.test(converted)) {
            converted += ' RETURNING 1 as id';
        } else {
            converted += ' RETURNING id';
        }
    }

    return converted;
}

function flattenParams(params) {
    if (params.length === 1 && Array.isArray(params[0])) {
        return params[0];
    }
    return params;
}

class DatabaseAdapter {
    get isPostgres() {
        return getDatabaseMode() === 'postgres';
    }

    getMode() {
        return getDatabaseMode();
    }

    prepare(sql) {
        if (this.isPostgres) {
            return {
                get: async (...params) => this.get(sql, ...params),
                all: async (...params) => this.all(sql, ...params),
                run: async (...params) => this.run(sql, ...params)
            };
        }
        const db = getSqliteDb();
        return db.prepare(sql);
    }

    async get(sql, ...params) {
        if (this.isPostgres) {
            const client = txStorage.getStore() || getPgPool();
            const adaptedSql = adaptSqlForPostgres(sql);
            const flat = flattenParams(params);
            const res = await client.query(adaptedSql, flat);
            return res.rows[0] !== undefined ? res.rows[0] : undefined;
        }
        const db = getSqliteDb();
        return db.prepare(sql).get(...flattenParams(params));
    }

    async all(sql, ...params) {
        if (this.isPostgres) {
            const client = txStorage.getStore() || getPgPool();
            const adaptedSql = adaptSqlForPostgres(sql);
            const flat = flattenParams(params);
            const res = await client.query(adaptedSql, flat);
            return res.rows;
        }
        const db = getSqliteDb();
        return db.prepare(sql).all(...flattenParams(params));
    }

    async run(sql, ...params) {
        if (this.isPostgres) {
            const client = txStorage.getStore() || getPgPool();
            const adaptedSql = adaptSqlForPostgres(sql);
            const flat = flattenParams(params);
            const res = await client.query(adaptedSql, flat);
            return {
                changes: res.rowCount,
                lastInsertRowid: res.rows[0]?.id
            };
        }
        const db = getSqliteDb();
        return db.prepare(sql).run(...flattenParams(params));
    }

    async exec(sql) {
        if (this.isPostgres) {
            const client = txStorage.getStore() || getPgPool();
            return await client.query(sql);
        }
        const db = getSqliteDb();
        return db.exec(sql);
    }

    transaction(fn) {
        if (this.isPostgres) {
            return async (...args) => {
                const client = await getPgPool().connect();
                try {
                    await client.query('BEGIN');
                    let result;
                    await txStorage.run(client, async () => {
                        result = await fn(...args);
                    });
                    await client.query('COMMIT');
                    return result;
                } catch (err) {
                    await client.query('ROLLBACK');
                    throw err;
                } finally {
                    client.release();
                }
            };
        }
        const db = getSqliteDb();
        if (fn && fn.constructor && fn.constructor.name === 'AsyncFunction') {
            return async (...args) => {
                db.exec('BEGIN');
                try {
                    const result = await fn(...args);
                    db.exec('COMMIT');
                    return result;
                } catch (err) {
                    db.exec('ROLLBACK');
                    throw err;
                }
            };
        }
        return db.transaction(fn);
    }

    pragma(p) {
        if (!this.isPostgres) {
            const db = getSqliteDb();
            return db.pragma(p);
        }
        return null;
    }

    backup(...args) {
        if (!this.isPostgres) {
            return getSqliteDb().backup(...args);
        }
        throw new Error('Online SQLite backup is only available in SQLite mode.');
    }
}

const adapterInstance = new DatabaseAdapter();

function connect() {
    return adapterInstance;
}

async function runMigrations() {
    if (getDatabaseMode() === 'postgres') {
        const { runPgMigrations } = require('./postgres');
        return await runPgMigrations();
    }

    const database = getSqliteDb();
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
                console.log(`Applying SQLite migration: ${file}`);
                const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
                const apply = database.transaction(() => {
                    database.exec(sql);
                    database.prepare('INSERT INTO migrations (name) VALUES (?)').run(file);
                });
                apply();
            }
        }
    }
}

async function testConnection() {
    if (getDatabaseMode() === 'postgres') {
        const { testConnection } = require('./postgres');
        return await testConnection();
    }
    try {
        const db = getSqliteDb();
        const row = db.prepare('SELECT 1 as ok').get();
        return { connected: row.ok === 1, database: 'sqlite' };
    } catch (err) {
        return { connected: false, error: err.message };
    }
}

module.exports = {
    connect,
    runMigrations,
    testConnection,
    isPostgresConfigured,
    getDatabaseMode,
    adaptSqlForPostgres,
    replacePlaceholders
};
