/**
 * PostgreSQL Database Adapter for MyAsset
 * Designed for Serverless Environments (Vercel Postgres, Neon, Supabase)
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

function getConnectionString() {
    return process.env.POSTGRES_URL || process.env.DATABASE_URL;
}

let pool = null;

function isPostgresConfigured() {
    const conn = getConnectionString();
    return Boolean(conn && (conn.startsWith('postgres://') || conn.startsWith('postgresql://')) && !conn.includes('hostname:5432'));
}

function getPool() {
    const connectionString = getConnectionString();
    if (!isPostgresConfigured()) {
        throw new Error(
            'CRITICAL: PostgreSQL connection string is missing or unconfigured. ' +
            'Please set POSTGRES_URL or DATABASE_URL in your environment or Vercel Project Settings.'
        );
    }

    if (!pool) {
        pool = new Pool({
            connectionString,
            ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000
        });

        pool.on('error', (err) => {
            console.error('Unexpected error on idle PostgreSQL client:', err);
        });
    }

    return pool;
}

async function query(text, params = []) {
    const clientPool = getPool();
    const start = Date.now();
    const res = await clientPool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
        console.log('Executed query', { text, duration, rows: res.rowCount });
    }
    return res;
}

async function testConnection() {
    if (!isPostgresConfigured()) {
        return { connected: false, message: 'POSTGRES_URL / DATABASE_URL not set' };
    }
    try {
        const res = await query('SELECT NOW() as current_time, current_database() as db_name');
        return {
            connected: true,
            database: res.rows[0].db_name,
            timestamp: res.rows[0].current_time
        };
    } catch (err) {
        return { connected: false, error: err.message };
    }
}

async function runPgMigrations() {
    if (!isPostgresConfigured()) {
        throw new Error('Cannot run PostgreSQL migrations: connection string not configured');
    }
    
    const clientPool = getPool();
    const schemaPath = path.join(__dirname, 'migrations_pg', '001_postgres_schema.sql');
    
    if (!fs.existsSync(schemaPath)) {
        throw new Error(`Postgres schema file not found at: ${schemaPath}`);
    }

    console.log('Applying PostgreSQL migrations from:', schemaPath);
    const sql = fs.readFileSync(schemaPath, 'utf8');

    const client = await clientPool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`
            CREATE TABLE IF NOT EXISTS migrations (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
        const migrationCheck = await client.query('SELECT name FROM migrations WHERE name = $1', ['001_postgres_schema.sql']);
        const userTableCheck = await client.query("SELECT to_regclass('public.users') AS tbl");
        const usersExist = userTableCheck.rows[0] && userTableCheck.rows[0].tbl !== null;

        if (migrationCheck.rows.length === 0 || !usersExist) {
            console.log('Applying PostgreSQL migrations from:', schemaPath);
            await client.query(sql);
            await client.query(`
                INSERT INTO migrations (name) VALUES ('001_postgres_schema.sql')
                ON CONFLICT (name) DO NOTHING;
            `);
            console.log('✅ PostgreSQL migrations applied successfully');
        } else {
            console.log('✅ PostgreSQL migrations already applied and verified');
        }
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ PostgreSQL migration failed:', err);
        throw err;
    } finally {
        client.release();
    }
}

module.exports = {
    isPostgresConfigured,
    getPool,
    query,
    testConnection,
    runPgMigrations
};
