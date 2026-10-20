/**
 * SQLite to PostgreSQL Data Export & Migration Utility for MyAsset
 * 
 * Safely extracts operational data from the local SQLite database into
 * PostgreSQL-compatible SQL transactions with sequence synchronization
 * and foreign key preservation.
 * 
 * Usage:
 *   node server/db/export_sqlite_to_pg.js [output_file.sql]
 */
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DEFAULT_SQLITE_PATH = path.join(__dirname, 'myasset.sqlite');
const DEFAULT_OUTPUT_PATH = path.join(__dirname, 'export_to_postgres.sql');

const TABLES_IN_ORDER = [
    'organizations',
    'roles',
    'users',
    'employees',
    'locations',
    'zones',
    'employee_zones',
    'asset_types',
    'asset_custom_fields',
    'assets',
    'asset_custom_values',
    'assignments',
    'tasks',
    'task_checklists',
    'task_evidence',
    'maintenance_schedules',
    'maintenance_requests',
    'maintenance_records',
    'activity',
    'alerts',
    'gps_positions',
    'documents',
    'rfid_devices',
    'settings'
];

function sanitizeValue(val) {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return val.toString();
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    // String escaping for Postgres SQL literals
    const str = String(val).replace(/'/g, "''");
    return `'${str}'`;
}

function exportData(sqlitePath = DEFAULT_SQLITE_PATH, outputPath = DEFAULT_OUTPUT_PATH) {
    if (!fs.existsSync(sqlitePath)) {
        throw new Error(`Source SQLite database not found at: ${sqlitePath}`);
    }

    console.log(`Connecting to SQLite (read-only): ${sqlitePath}`);
    const db = new Database(sqlitePath, { readonly: true });

    let sqlDump = `-- ==============================================================================\n`;
    sqlDump += `-- MyAsset SQLite to PostgreSQL Data Migration Script\n`;
    sqlDump += `-- Generated on: ${new Date().toISOString()}\n`;
    sqlDump += `-- ==============================================================================\n\n`;
    sqlDump += `BEGIN;\n\n`;

    const summary = {};

    for (const table of TABLES_IN_ORDER) {
        // Check if table exists in SQLite
        const exists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table);
        if (!exists) {
            continue;
        }

        const rows = db.prepare(`SELECT * FROM ${table}`).all();
        summary[table] = rows.length;

        if (rows.length === 0) continue;

        sqlDump += `-- Table: ${table} (${rows.length} records)\n`;
        const columns = Object.keys(rows[0]);
        const colList = columns.map(c => `"${c}"`).join(', ');

        for (const row of rows) {
            const values = columns.map(col => sanitizeValue(row[col])).join(', ');
            sqlDump += `INSERT INTO ${table} (${colList}) VALUES (${values}) ON CONFLICT DO NOTHING;\n`;
        }

        // Check if table has 'id' column to sync sequence
        if (columns.includes('id')) {
            sqlDump += `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE(max(id), 1)) FROM ${table};\n`;
        }
        sqlDump += `\n`;
    }

    sqlDump += `COMMIT;\n`;

    fs.writeFileSync(outputPath, sqlDump, 'utf8');
    db.close();

    console.log(`\n✅ Data successfully exported to: ${outputPath}`);
    console.log('Record summary:');
    for (const [table, count] of Object.entries(summary)) {
        console.log(`  - ${table}: ${count} rows`);
    }

    return outputPath;
}

if (require.main === module) {
    const customOut = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : DEFAULT_OUTPUT_PATH;
    try {
        exportData(DEFAULT_SQLITE_PATH, customOut);
    } catch (err) {
        console.error('Export failed:', err.message);
        process.exit(1);
    }
}

module.exports = { exportData, TABLES_IN_ORDER };
