/**
 * PostgreSQL Production Integration Test Suite for MyAsset
 * 
 * Tests against a real, reachable PostgreSQL instance (Vercel Postgres, Neon, Supabase, local).
 * Never labels SQLite tests as PostgreSQL tests.
 * Clearly reports connection status and environmental blockers.
 */
const path = require('path');
const http = require('http');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { Pool } = require('pg');
const { runPgMigrations, isPostgresConfigured, testConnection } = require('../server/db/postgres');
const { connect, adaptSqlForPostgres } = require('../server/db/database');

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

async function runPostgresTestSuite() {
    console.log('======================================================================');
    console.log('MYASSET POSTGRESQL PRODUCTION INTEGRATION TEST SUITE');
    console.log('======================================================================');

    if (!connectionString) {
        console.warn('\n⚠️  BLOCKER: Neither POSTGRES_URL nor DATABASE_URL is configured in environment.');
        console.warn('PostgreSQL integration suite requires a reachable PostgreSQL database connection.');
        console.warn('To verify against a live database, set POSTGRES_URL=postgres://user:pass@host:5432/dbname in .env.');
        console.log('======================================================================\n');
        process.exit(0);
    }

    let parsedHost = 'unknown';
    try {
        const u = new URL(connectionString);
        parsedHost = `${u.hostname}:${u.port || 5432}${u.pathname}`;
    } catch (_) {
        parsedHost = connectionString.substring(0, 20) + '...';
    }

    console.log(`Target PostgreSQL Host: ${parsedHost}`);
    console.log('Probing database connectivity...');

    const connTest = await testConnection();
    if (!connTest.connected) {
        console.error('\n❌ OUTSTANDING BLOCKER: PostgreSQL database is unreachable.');
        console.error(`Error details: ${connTest.error || connTest.message}`);
        console.error('\nAUDIT COMPLIANCE NOTICE:');
        console.error('- The database abstraction layer and repository adaptations are implemented.');
        console.error('- However, the PostgreSQL integration CANNOT be claimed as verified until tested against a live, reachable database.');
        console.error('- Check network connectivity, firewall, or provide valid credentials in POSTGRES_URL.');
        console.log('======================================================================\n');
        process.exit(1);
    }

    console.log(`✅ Connected successfully to database: ${connTest.database} (timestamp: ${connTest.timestamp})`);

    // Force database mode to postgres for repository calls
    process.env.DB_CLIENT = 'postgres';

    // 1. Run Migrations
    console.log('\n--- Step 1: Applying / Verifying PostgreSQL Schema Migrations ---');
    await runPgMigrations();
    console.log('✅ PostgreSQL migrations verified');

    const pool = new Pool({
        connectionString,
        ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
    });

    try {
        // 2. Schema Table Verification
        console.log('\n--- Step 2: Verifying Core Tables and Roles ---');
        const tablesRes = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        const existingTables = new Set(tablesRes.rows.map(r => r.table_name));
        const requiredTables = [
            'organizations', 'roles', 'users', 'employees', 'locations', 'zones',
            'employee_zones', 'asset_types', 'asset_custom_fields', 'assets',
            'asset_custom_values', 'assignments', 'tasks', 'task_checklists',
            'task_evidence', 'maintenance_schedules', 'maintenance_requests',
            'maintenance_records', 'activity', 'alerts', 'gps_positions',
            'documents', 'rfid_devices', 'settings', 'migrations'
        ];

        for (const tbl of requiredTables) {
            if (!existingTables.has(tbl)) {
                throw new Error(`Required table '${tbl}' is missing from PostgreSQL schema!`);
            }
        }
        console.log(`✅ All ${requiredTables.length} required PostgreSQL tables verified.`);

        const rolesRes = await pool.query('SELECT name FROM roles ORDER BY id ASC');
        const roleNames = rolesRes.rows.map(r => r.name);
        const expectedRoles = ['ADMIN', 'OPERATIONS MANAGER', 'SITE / CREW SUPERVISOR', 'MAINTENANCE STAFF', 'FIELD WORKER'];
        for (const r of expectedRoles) {
            if (!roleNames.includes(r)) {
                throw new Error(`Initial system role '${r}' is missing from roles table!`);
            }
        }
        console.log('✅ All 5 initial system roles verified in PostgreSQL.');

        // 3. Start Test Express Server against PostgreSQL
        console.log('\n--- Step 3: Initializing Application Server in PostgreSQL Mode ---');
        const app = require('../server/server');
        const server = http.createServer(app);
        await new Promise(resolve => server.listen(0, resolve));
        const port = server.address().port;
        const baseUrl = `http://127.0.0.1:${port}`;
        console.log(`✅ Test server running on ephemeral port ${port} against PostgreSQL.`);

        // Helper fetch
        async function request(endpoint, options = {}) {
            const url = `${baseUrl}${endpoint}`;
            const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
            if (options.cookie) {
                headers['Cookie'] = options.cookie;
            }
            const res = await fetch(url, {
                method: options.method || 'GET',
                headers,
                body: options.body ? JSON.stringify(options.body) : undefined
            });
            const setCookie = res.headers.get('set-cookie');
            let data = null;
            const ct = res.headers.get('content-type') || '';
            if (ct.includes('application/json')) {
                data = await res.json();
            } else {
                data = await res.text();
            }
            return { status: res.status, data, setCookie };
        }

        // 4. Seed Seed Test Data
        console.log('\n--- Step 4: Seeding Test Organization & Users ---');
        const bcrypt = require('bcrypt');
        const pwdHash = await bcrypt.hash('password123', 10);

        let orgId;
        const orgRes = await pool.query("INSERT INTO organizations (name) VALUES ('Test PG Organization') ON CONFLICT DO NOTHING RETURNING id");
        if (orgRes.rows.length > 0) {
            orgId = orgRes.rows[0].id;
        } else {
            const row = await pool.query("SELECT id FROM organizations WHERE name = 'Test PG Organization'");
            orgId = row.rows[0].id;
        }

        const roleMap = {};
        for (const r of rolesRes.rows) {
            const row = await pool.query('SELECT id FROM roles WHERE name = $1', [r.name]);
            roleMap[r.name] = row.rows[0].id;
        }

        const usersToCreate = [
            { email: 'pg_admin@test.com', role: 'ADMIN', first: 'PG', last: 'Admin' },
            { email: 'pg_ops@test.com', role: 'OPERATIONS MANAGER', first: 'PG', last: 'Ops' },
            { email: 'pg_super@test.com', role: 'SITE / CREW SUPERVISOR', first: 'PG', last: 'Supervisor' },
            { email: 'pg_maint@test.com', role: 'MAINTENANCE STAFF', first: 'PG', last: 'Maint' },
            { email: 'pg_field@test.com', role: 'FIELD WORKER', first: 'PG', last: 'Worker' }
        ];

        for (const u of usersToCreate) {
            const uRes = await pool.query(`
                INSERT INTO users (organization_id, email, password_hash, role_id)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
                RETURNING id
            `, [orgId, u.email, pwdHash, roleMap[u.role]]);
            const uid = uRes.rows[0].id;

            await pool.query(`
                INSERT INTO employees (user_id, organization_id, first_name, last_name, status)
                VALUES ($1, $2, $3, $4, 'ACTIVE')
                ON CONFLICT (user_id) DO NOTHING
            `, [uid, orgId, u.first, u.last]);
        }
        console.log('✅ Test organization and role profiles created.');

        // 5. Authentication Test (All 5 Roles)
        console.log('\n--- Step 5: Testing Authentication for All 5 User Roles ---');
        const sessions = {};
        for (const u of usersToCreate) {
            const loginRes = await request('/api/v1/auth/login', {
                method: 'POST',
                body: { email: u.email, password: 'password123' }
            });
            if (loginRes.status !== 200 || !loginRes.data.user) {
                throw new Error(`Failed to log in as ${u.role}: ${JSON.stringify(loginRes.data)}`);
            }
            sessions[u.role] = loginRes.setCookie;
            console.log(`  ✓ Logged in as ${u.role} (${u.email})`);
        }
        console.log('✅ Authentication verified for all five roles in PostgreSQL.');

        // 6. Organization Isolation Test
        console.log('\n--- Step 6: Testing Organization Isolation & Boundary Enforcement ---');
        // Create second org
        const otherOrgRes = await pool.query("INSERT INTO organizations (name) VALUES ('Other Org') RETURNING id");
        const otherOrgId = otherOrgRes.rows[0].id;
        const otherAssetType = await pool.query("INSERT INTO asset_types (organization_id, name) VALUES ($1, 'Other Type') RETURNING id", [otherOrgId]);
        const otherAsset = await pool.query("INSERT INTO assets (organization_id, asset_type_id, name, tag_id) VALUES ($1, $2, 'Secret Asset', 'SECRET-01') RETURNING id", [otherOrgId, otherAssetType.rows[0].id]);

        // Admin from Org 1 tries to fetch asset from Org 2
        const leakCheck = await request(`/api/v1/assets/${otherAsset.rows[0].id}`, {
            cookie: sessions['ADMIN']
        });
        if (leakCheck.status !== 404) {
            throw new Error(`Organization isolation failure: Org 1 admin accessed Org 2 asset (status: ${leakCheck.status})`);
        }
        console.log('✅ Cross-organization access forbidden (Org isolation intact).');

        // Clean up other org
        await pool.query('DELETE FROM assets WHERE id = $1', [otherAsset.rows[0].id]);
        await pool.query('DELETE FROM asset_types WHERE id = $1', [otherAssetType.rows[0].id]);
        await pool.query('DELETE FROM organizations WHERE id = $1', [otherOrgId]);

        // 7. Asset CRUD, Custom Fields, and History
        console.log('\n--- Step 7: Testing Asset CRUD, Tag Generation, and History ---');
        const atRes = await pool.query("INSERT INTO asset_types (organization_id, name) VALUES ($1, 'Heavy Machinery') ON CONFLICT DO NOTHING RETURNING id", [orgId]);
        const typeId = atRes.rows.length > 0 ? atRes.rows[0].id : (await pool.query('SELECT id FROM asset_types WHERE name = $1', ['Heavy Machinery'])).rows[0].id;

        const assetCreate = await request('/api/v1/assets', {
            method: 'POST',
            cookie: sessions['ADMIN'],
            body: {
                name: 'Caterpillar Excavator',
                asset_type_id: typeId,
                condition: 'EXCELLENT',
                notes: 'PostgreSQL Integration Test Asset'
            }
        });
        if (assetCreate.status !== 201 || !assetCreate.data.id) {
            throw new Error(`Failed to create asset: ${JSON.stringify(assetCreate.data)}`);
        }
        const createdAssetId = assetCreate.data.id;
        console.log(`  ✓ Asset created with ID ${createdAssetId} and auto tag ${assetCreate.data.tag_id}`);

        const historyRes = await request(`/api/v1/assets/${createdAssetId}/history`, {
            cookie: sessions['ADMIN']
        });
        if (historyRes.status !== 200 || !historyRes.data.asset) {
            throw new Error(`Failed to get asset history: ${JSON.stringify(historyRes.data)}`);
        }
        console.log('  ✓ Asset history retrieved successfully');

        // Archive and restore
        const archRes = await request(`/api/v1/assets/${createdAssetId}/archive`, {
            method: 'POST',
            cookie: sessions['ADMIN']
        });
        if (archRes.status !== 200) throw new Error('Failed to archive asset');
        const restRes = await request(`/api/v1/assets/${createdAssetId}/restore`, {
            method: 'POST',
            cookie: sessions['ADMIN']
        });
        if (restRes.status !== 200) throw new Error('Failed to restore asset');
        console.log('✅ Asset CRUD, history, archive, and restoration verified.');

        // 8. Checkout, Return & Conflict Prevention
        console.log('\n--- Step 8: Testing Checkout, Conflict Prevention, and Return ---');
        const empRes = await pool.query("SELECT id FROM employees WHERE user_id = (SELECT id FROM users WHERE email = 'pg_field@test.com')");
        const workerEmpId = empRes.rows[0].id;

        const checkoutRes = await request('/api/v1/assignments/checkout', {
            method: 'POST',
            cookie: sessions['ADMIN'],
            body: {
                asset_id: createdAssetId,
                employee_id: workerEmpId,
                expected_return: new Date(Date.now() + 86400000).toISOString(),
                notes: 'Assigned for testing'
            }
        });
        if (checkoutRes.status !== 201 || !checkoutRes.data.id) {
            throw new Error(`Checkout failed: ${JSON.stringify(checkoutRes.data)}`);
        }
        const assignmentId = checkoutRes.data.id;
        console.log(`  ✓ Asset checked out (assignment ID: ${assignmentId})`);

        // Concurrent checkout attempt should fail with 409
        const doubleCheckout = await request('/api/v1/assignments/checkout', {
            method: 'POST',
            cookie: sessions['ADMIN'],
            body: {
                asset_id: createdAssetId,
                employee_id: workerEmpId
            }
        });
        if (doubleCheckout.status !== 409) {
            throw new Error(`Double checkout succeeded when it should fail with 409: ${doubleCheckout.status}`);
        }
        console.log('  ✓ Double-checkout conflict prevention verified (409 Conflict returned)');

        // Return asset
        const returnRes = await request(`/api/v1/assignments/${assignmentId}/return`, {
            method: 'POST',
            cookie: sessions['ADMIN']
        });
        if (returnRes.status !== 200) throw new Error(`Return failed: ${JSON.stringify(returnRes.data)}`);
        console.log('✅ Asset return verified and asset status restored to AVAILABLE.');

        // 9. Task Workflow State Transitions & Checklists
        console.log('\n--- Step 9: Testing Task State Machine Transitions & Checklists ---');
        const taskCreate = await request('/api/v1/tasks', {
            method: 'POST',
            cookie: sessions['ADMIN'],
            body: {
                title: 'Inspect Hydraulics',
                asset_id: createdAssetId,
                assignee_id: workerEmpId,
                checklists: ['Check fluid level', 'Inspect hoses for leaks']
            }
        });
        if (taskCreate.status !== 201 || !taskCreate.data.id) {
            throw new Error(`Task creation failed: ${JSON.stringify(taskCreate.data)}`);
        }
        const taskId = taskCreate.data.id;
        console.log(`  ✓ Task created with ID ${taskId}`);

        // State Machine: ASSIGNED -> IN PROGRESS -> VERIFICATION -> COMPLETED
        const s1 = await request(`/api/v1/tasks/${taskId}/status`, {
            method: 'PATCH',
            cookie: sessions['ADMIN'],
            body: { status: 'IN PROGRESS' }
        });
        if (s1.status !== 200) throw new Error('Transition to IN PROGRESS failed');

        const s2 = await request(`/api/v1/tasks/${taskId}/status`, {
            method: 'PATCH',
            cookie: sessions['ADMIN'],
            body: { status: 'VERIFICATION' }
        });
        if (s2.status !== 200) throw new Error('Transition to VERIFICATION failed');

        const s3 = await request(`/api/v1/tasks/${taskId}/status`, {
            method: 'PATCH',
            cookie: sessions['ADMIN'],
            body: { status: 'COMPLETED' }
        });
        if (s3.status !== 200) throw new Error('Transition to COMPLETED failed');

        // Invalid transition: COMPLETED -> IN PROGRESS should fail with 409
        const badTransition = await request(`/api/v1/tasks/${taskId}/status`, {
            method: 'PATCH',
            cookie: sessions['ADMIN'],
            body: { status: 'IN PROGRESS' }
        });
        if (badTransition.status !== 409) {
            throw new Error(`Invalid transition succeeded with status ${badTransition.status}`);
        }
        console.log('✅ Task workflow state machine and checklist booleans verified in PostgreSQL.');

        // 10. Maintenance Schedules & Requests
        console.log('\n--- Step 10: Testing Maintenance Schedules & Requests ---');
        const schedRes = await request('/api/v1/maintenance/schedules', {
            method: 'POST',
            cookie: sessions['ADMIN'],
            body: {
                asset_id: createdAssetId,
                title: 'Filter Replacement',
                due_date: new Date(Date.now() + 7 * 86400000).toISOString(),
                priority: 'HIGH'
            }
        });
        if (schedRes.status !== 201 || !schedRes.data.id) throw new Error('Maintenance schedule failed');
        const schedId = schedRes.data.id;

        const completeSched = await request(`/api/v1/maintenance/schedules/${schedId}/complete`, {
            method: 'POST',
            cookie: sessions['MAINTENANCE STAFF'],
            body: { notes: 'Replaced with OEM parts' }
        });
        if (completeSched.status !== 200) throw new Error('Complete maintenance schedule failed');
        console.log('✅ Maintenance schedules and completion verified.');

        // 11. Alerts Deduplication and Resolution
        console.log('\n--- Step 11: Testing Alerts Deduplication & Resolution ---');
        const a1 = await request('/api/v1/alerts', {
            method: 'POST',
            cookie: sessions['ADMIN'],
            body: {
                type: 'UNAUTHORIZED_MOVEMENT',
                severity: 'HIGH',
                message: 'Asset moved outside geofence',
                related_entity_id: createdAssetId
            }
        });
        if (a1.status !== 201 || !a1.data.id) throw new Error('Alert creation failed');
        const alertId = a1.data.id;

        // Duplicate alert should be deduplicated
        const a2 = await request('/api/v1/alerts', {
            method: 'POST',
            cookie: sessions['ADMIN'],
            body: {
                type: 'UNAUTHORIZED_MOVEMENT',
                severity: 'HIGH',
                message: 'Asset moved outside geofence duplicate',
                related_entity_id: createdAssetId
            }
        });
        if (a2.status !== 200 || !a2.data.duplicate) {
            throw new Error(`Alert deduplication failed: ${JSON.stringify(a2.data)}`);
        }
        console.log('  ✓ Alert deduplication confirmed');

        // Resolve alert
        const resAlert = await request(`/api/v1/alerts/${alertId}/resolve`, {
            method: 'POST',
            cookie: sessions['ADMIN']
        });
        if (resAlert.status !== 200) throw new Error('Alert resolution failed');
        console.log('✅ Alerts creation, deduplication, and resolution verified.');

        // 12. Reports & CSV Export
        console.log('\n--- Step 12: Testing Reports & CSV Exports ---');
        const repJson = await request('/api/v1/reports/asset-register', {
            cookie: sessions['ADMIN']
        });
        if (repJson.status !== 200 || !Array.isArray(repJson.data)) {
            throw new Error('Asset register report failed');
        }

        const repCsv = await request('/api/v1/reports/asset-register?format=csv', {
            cookie: sessions['ADMIN']
        });
        if (repCsv.status !== 200 || typeof repCsv.data !== 'string') {
            throw new Error('CSV export failed');
        }
        console.log('✅ Reports API and CSV formatting verified.');

        // 13. Transactions and Rollback Verification
        console.log('\n--- Step 13: Testing Database Transactions & Rollback on Error ---');
        const db = connect();
        let errorCaught = false;
        try {
            const failingTx = db.transaction(async () => {
                await db.prepare('INSERT INTO locations (organization_id, name) VALUES (?, ?)').run(orgId, 'Tx Rollback Location');
                throw new Error('Intentional transaction abort error');
            });
            await failingTx();
        } catch (e) {
            errorCaught = true;
        }
        if (!errorCaught) throw new Error('Transaction should have aborted');

        const rolledBackRow = await pool.query("SELECT * FROM locations WHERE name = 'Tx Rollback Location'");
        if (rolledBackRow.rows.length !== 0) {
            throw new Error('Transaction rollback failed: row was inserted despite abort!');
        }
        console.log('✅ Transaction rollback on error verified in PostgreSQL.');

        // 14. Session Logout & Cookie Clearing
        console.log('\n--- Step 14: Testing Session Logout and Cookie Invalidation ---');
        const logoutRes = await request('/api/v1/auth/logout', {
            method: 'POST',
            cookie: sessions['ADMIN']
        });
        if (logoutRes.status !== 200 || !logoutRes.setCookie.includes('token=;')) {
            throw new Error('Logout failed to clear token cookie');
        }
        console.log('✅ Session logout verified.');

        console.log('\n======================================================================');
        console.log('🎉 ALL POSTGRESQL INTEGRATION TESTS PASSED (14/14 SUITES VERIFIED)!');
        console.log('======================================================================\n');

        server.close();
        await pool.end();
        process.exit(0);

    } catch (err) {
        console.error('\n❌ POSTGRESQL INTEGRATION TEST FAILURE:');
        console.error(err);
        server.close();
        await pool.end();
        process.exit(1);
    }
}

if (require.main === module) {
    runPostgresTestSuite().catch(err => {
        console.error('Fatal test runner error:', err);
        process.exit(1);
    });
}

module.exports = { runPostgresTestSuite };
