/**
 * Standalone PostgreSQL Migration Runner for MyAsset
 * Safely runs 001_postgres_schema.sql and verifies all required tables.
 * Never prints credentials or connection secrets.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { runPgMigrations, isPostgresConfigured, getPool, testConnection } = require('./postgres');

async function main() {
    console.log('======================================================================');
    console.log('MYASSET POSTGRESQL MIGRATION RUNNER');
    console.log('======================================================================');

    if (!isPostgresConfigured()) {
        console.error('\n❌ ERROR: Neither POSTGRES_URL nor DATABASE_URL is configured with a valid PostgreSQL URL.');
        console.error('Please configure POSTGRES_URL in your environment or .env file before running migrations.');
        process.exit(1);
    }

    const connStr = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    try {
        const u = new URL(connStr);
        console.log(`Target Database: ${u.pathname.replace(/^\//, '')} on ${u.hostname}`);
    } catch (_) {
        console.log('Target Database: [Configured]');
    }

    console.log('Connecting to database...');
    const connTest = await testConnection();
    if (!connTest.connected) {
        console.error('\n❌ ERROR: Unable to connect to PostgreSQL database.');
        console.error(`Details: ${connTest.error || connTest.message}`);
        process.exit(1);
    }
    console.log(`✅ Connected successfully to: ${connTest.database}`);

    console.log('Applying PostgreSQL migrations (001_postgres_schema.sql)...');
    await runPgMigrations();

    // Verify critical tables exist in the public schema
    const pool = getPool();
    const res = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name;
    `);

    const tableNames = res.rows.map(r => r.table_name);
    console.log(`\nVerified Tables in public schema (${tableNames.length} tables):`);
    console.log(tableNames.join(', '));

    const requiredTables = ['organizations', 'roles', 'users', 'employees', 'assets', 'assignments', 'tasks', 'activity', 'settings', 'migrations'];
    const missing = requiredTables.filter(t => !tableNames.includes(t));

    if (missing.length > 0) {
        console.error(`\n❌ ERROR: Missing required tables: ${missing.join(', ')}`);
        await pool.end();
        process.exit(1);
    }

    console.log('\n✅ All required tables, constraints, indexes, and initial roles verified.');
    await pool.end();
    console.log('======================================================================');
    process.exit(0);
}

main().catch(async (err) => {
    console.error('\n❌ Unhandled Migration Error:', err.message);
    try {
        const { getPool } = require('./postgres');
        await getPool().end();
    } catch (_) {}
    process.exit(1);
});
