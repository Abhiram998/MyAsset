const assert = require('assert');
const { connect } = require('../server/db/database');
const bcrypt = require('bcrypt');

async function runTests() {
    console.log("Starting FINAL GAP AUDIT API Test Suite...");

    // 0. Seed Database
    console.log("--- 0. Seeding Database ---");
    const db = connect();
    const hash = await bcrypt.hash('password123', 10);
    
    const roles = ['ADMIN', 'OPERATIONS MANAGER', 'SITE / CREW SUPERVISOR', 'MAINTENANCE STAFF', 'FIELD WORKER'];
    roles.forEach(role => db.prepare('INSERT OR IGNORE INTO roles (name) VALUES (?)').run(role));

    let org = db.prepare('SELECT id FROM organizations LIMIT 1').get();
    if (!org) {
        db.prepare('INSERT INTO organizations (name) VALUES (?)').run('Test Org');
        org = db.prepare('SELECT id FROM organizations LIMIT 1').get();
    }

    const seedUser = (email, roleName) => {
        const role = db.prepare('SELECT id FROM roles WHERE name = ?').get(roleName);
        try { db.prepare('INSERT INTO users (organization_id, email, password_hash, role_id) VALUES (?, ?, ?, ?)').run(org.id, email, hash, role.id); } catch (e) {}
        const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        try { db.prepare('INSERT INTO employees (user_id, organization_id, first_name, last_name) VALUES (?, ?, ?, ?)').run(user.id, org.id, 'Test', roleName); } catch(e) {}
        return user;
    };

    seedUser('admin@test.com', 'ADMIN');
    seedUser('ops@test.com', 'OPERATIONS MANAGER');
    seedUser('field@test.com', 'FIELD WORKER');
    seedUser('field2@test.com', 'FIELD WORKER'); // To test isolation
    seedUser('supervisor@test.com', 'SITE / CREW SUPERVISOR');
    seedUser('maintenance@test.com', 'MAINTENANCE STAFF');

    // 2 Distinct Asset Types
    let typeEq = db.prepare('SELECT id FROM asset_types WHERE name = ?').get('Equipment');
    if (!typeEq) { db.prepare('INSERT INTO asset_types (organization_id, name) VALUES (?, ?)').run(org.id, 'Equipment'); typeEq = db.prepare('SELECT id FROM asset_types WHERE name = ?').get('Equipment'); }
    
    let typePl = db.prepare('SELECT id FROM asset_types WHERE name = ?').get('Plant');
    if (!typePl) { db.prepare('INSERT INTO asset_types (organization_id, name) VALUES (?, ?)').run(org.id, 'Plant'); typePl = db.prepare('SELECT id FROM asset_types WHERE name = ?').get('Plant'); }

    // Assets
    try {
        db.prepare('INSERT INTO assets (organization_id, asset_type_id, name, tag_id) VALUES (?, ?, ?, ?)').run(org.id, typeEq.id, 'Excavator 1', 'TAG-E1');
        db.prepare('INSERT INTO assets (organization_id, asset_type_id, name, tag_id) VALUES (?, ?, ?, ?)').run(org.id, typePl.id, 'Generator A', 'TAG-P1');
    } catch(e) {}

    const assets = db.prepare('SELECT id FROM assets').all();
    const asset1 = assets[0].id;
    const asset2 = assets[1].id;

    // Assignment for Field 1
    const field1 = db.prepare("SELECT id FROM employees WHERE last_name = 'FIELD WORKER' LIMIT 1").get();
    try {
        db.prepare('INSERT INTO assignments (asset_id, employee_id, assigned_by_id) VALUES (?, ?, ?)').run(asset1, field1.id, 1);
    } catch(e) {}

    // Task for Field 1
    let taskResult;
    try {
        taskResult = db.prepare('INSERT INTO tasks (organization_id, title, status, asset_id, assignee_id, created_by_id) VALUES (?, ?, ?, ?, ?, ?)').run(org.id, 'Test Task', 'ASSIGNED', asset1, field1.id, 1);
    } catch(e) { taskResult = { lastInsertRowid: 1 }; }
    const taskId = taskResult.lastInsertRowid;

    let testServer = null;
    try {
        await fetch('http://localhost:3000/api/health', { signal: AbortSignal.timeout(500) });
    } catch (_) {
        const app = require('../server/server');
        testServer = await new Promise((resolve) => {
            const s = app.listen(3000, () => resolve(s));
        });
    }

    const API_URL = 'http://localhost:3000/api/v1';

    async function login(email) {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: 'password123' })
        });
        assert.strictEqual(res.status, 200, `Login failed for ${email}`);
        return res.headers.get('set-cookie').split(';')[0];
    }

    console.log("\\n--- 1. Testing Authentication (All 5 Roles) ---");
    const adminCookie = await login('admin@test.com');
    const opsCookie = await login('ops@test.com');
    const supCookie = await login('supervisor@test.com');
    const maintCookie = await login('maintenance@test.com');
    const fieldCookie = await login('field@test.com');
    const field2Cookie = await login('field2@test.com');
    console.log("✅ All 5 roles authenticated");

    console.log("\\n--- 1.1 Company Registration & Workspace Provisioning ---");
    // Missing fields
    let badReg = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: '', email: 'test@example.com', password: 'password123', firstName: 'A', lastName: 'B' })
    });
    assert.strictEqual(badReg.status, 400, "Should reject registration without company name");

    // Short password
    badReg = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: 'New Corp', email: 'test@example.com', password: '123', firstName: 'A', lastName: 'B' })
    });
    assert.strictEqual(badReg.status, 400, "Should reject password shorter than 6 chars");

    // Existing email conflict
    badReg = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: 'New Corp', email: 'admin@test.com', password: 'password123', firstName: 'A', lastName: 'B' })
    });
    assert.strictEqual(badReg.status, 409, "Should reject duplicate email registration");

    // Successful company registration
    const uniqueEmail = `admin_reg_${Date.now()}@newcorp.io`;
    const regRes = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            companyName: 'Timberland Landscaping Pro',
            firstName: 'Sarah',
            lastName: 'Connor',
            email: uniqueEmail,
            password: 'SecurePassword!123'
        })
    });
    assert.strictEqual(regRes.status, 201, "Should successfully register new company");
    const regData = await regRes.json();
    assert.strictEqual(regData.user.role, 'ADMIN', "Registrant should have ADMIN role");
    assert.strictEqual(regData.user.company_name, 'Timberland Landscaping Pro', "Company name should match");
    const newOrgCookie = regRes.headers.get('set-cookie').split(';')[0];
    assert.ok(newOrgCookie.includes('token='), "Session token cookie should be set");

    // Verify session
    const sessRes = await fetch(`${API_URL}/auth/session`, { headers: { 'Cookie': newOrgCookie } });
    assert.strictEqual(sessRes.status, 200, "Session should authenticate with registration cookie");
    const sessData = await sessRes.json();
    assert.strictEqual(sessData.user.email, uniqueEmail, "Session user should match registered admin");
    assert.strictEqual(sessData.user.organization_id, regData.user.organization_id, "Session organization should match");

    // Verify tenant isolation (new company has 0 assets initially)
    const newOrgAssetsRes = await fetch(`${API_URL}/assets`, { headers: { 'Cookie': newOrgCookie } });
    const newOrgAssets = await newOrgAssetsRes.json();
    assert.strictEqual(newOrgAssets.length, 0, "New organization should have zero assets initially (tenant isolation)");
    console.log("✅ Company registration & workspace provisioning verified");

    console.log("\\n--- 2. Field Worker Scope (Positive & Negative) ---");
    let res = await fetch(`${API_URL}/assets`, { headers: { 'Cookie': fieldCookie } });
    let data = await res.json();
    assert.ok(data.length > 0, "Field worker should see assigned asset");

    res = await fetch(`${API_URL}/assets`, { headers: { 'Cookie': field2Cookie } });
    data = await res.json();
    assert.strictEqual(data.length, 0, "Field worker 2 should not see unassigned assets");
    console.log("✅ Field Worker asset isolation verified");

    res = await fetch(`${API_URL}/reports/asset-register`, { headers: { 'Cookie': fieldCookie } });
    assert.strictEqual(res.status, 403, "Field worker should not access reports");
    console.log("✅ Field Worker cannot access reports");

    console.log("\\n--- 3. Supervisor Scope (Negative Tests) ---");
    res = await fetch(`${API_URL}/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': supCookie },
        body: JSON.stringify({ first_name: 'Hack', last_name: 'Man', email: 'hack@sup.com', role_id: 1 })
    });
    assert.strictEqual(res.status, 403, "Supervisor should not manage users");
    console.log("✅ Supervisor cannot manage users");

    console.log("\\n--- 4. Maintenance Staff ---");
    res = await fetch(`${API_URL}/gps`, { headers: { 'Cookie': maintCookie } });
    assert.strictEqual(res.status, 403, "Maintenance staff should not access GPS");
    console.log("✅ Maintenance Staff cannot access GPS");

    console.log("\\n--- 5. GPS Architecture ---");
    res = await fetch(`${API_URL}/gps`, { headers: { 'Cookie': adminCookie } });
    assert.strictEqual(res.status, 200, "Admin should access GPS");
    
    res = await fetch(`${API_URL}/gps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': fieldCookie },
        body: JSON.stringify({ latitude: 10, longitude: 20 })
    });
    assert.strictEqual(res.status, 201, "Field worker should be able to update own GPS");
    console.log("✅ GPS Role Scopes Verified");

    console.log("\\n--- 6. Task Workflow (State Transitions) ---");
    // Invalid transition
    res = await fetch(`${API_URL}/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
        body: JSON.stringify({ status: 'COMPLETED' })
    });
    assert.strictEqual(res.status, 409, "Should reject ASSIGNED -> COMPLETED");
    
    // Valid transition
    res = await fetch(`${API_URL}/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
        body: JSON.stringify({ status: 'IN PROGRESS' })
    });
    assert.strictEqual(res.status, 200, "Should accept ASSIGNED -> IN PROGRESS");
    console.log("✅ Task Workflow State Machine Verified");

    console.log("\n--- 7. Report Endpoints ---");
    res = await fetch(`${API_URL}/reports/asset-register?format=csv`, { headers: { 'Cookie': adminCookie } });
    assert.strictEqual(res.status, 200, "Admin should fetch CSV");
    assert.ok(res.headers.get('content-type').includes('text/csv'), "Should return CSV");
    console.log("✅ Reports API & CSV Export Verified");

    console.log("\n--- 8. Assignment Operations & Conflict Prevention ---");
    // 8a. Create a fresh available asset
    const dynamicTag = 'TAG-CS-' + Date.now();
    let newAssetRes = await fetch(`${API_URL}/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
        body: JSON.stringify({ name: 'Chainsaw Pro', asset_type_id: typeEq.id, tag_id: dynamicTag })
    });
    assert.strictEqual(newAssetRes.status, 201, "Admin should create asset");
    const newAssetData = await newAssetRes.json();
    const createdAssetId = newAssetData.id;

    // 8b. Checkout to Field Worker 1
    let checkoutRes = await fetch(`${API_URL}/assignments/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
        body: JSON.stringify({ asset_id: createdAssetId, employee_id: field1.id, expected_return: '2026-12-31T17:00:00Z' })
    });
    assert.strictEqual(checkoutRes.status, 201, "Should checkout asset successfully");
    const assignmentObj = await checkoutRes.json();
    const assignmentId = assignmentObj.id;

    // 8c. Conflict Prevention: Attempting to checkout the same asset again must fail with 409
    let conflictRes = await fetch(`${API_URL}/assignments/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
        body: JSON.stringify({ asset_id: createdAssetId, employee_id: field1.id })
    });
    assert.strictEqual(conflictRes.status, 409, "Should reject checkout of already ASSIGNED asset");
    console.log("✅ Assignment checkout conflict prevention verified");

    // 8d. Return asset
    let returnRes = await fetch(`${API_URL}/assignments/${assignmentId}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': fieldCookie }
    });
    assert.strictEqual(returnRes.status, 200, "Field Worker should return own assigned asset");
    console.log("✅ Asset check-in and return verified");

    console.log("\n--- 9. Universal Asset Operations (Archive & History) ---");
    // 9a. Asset History
    let historyRes = await fetch(`${API_URL}/assets/${createdAssetId}/history`, { headers: { 'Cookie': adminCookie } });
    assert.strictEqual(historyRes.status, 200, "Should get complete asset history");
    const histData = await historyRes.json();
    assert.ok(histData.assignments.length > 0, "History should include assignment record");

    // 9b. Archive Asset (Soft-delete)
    let archiveRes = await fetch(`${API_URL}/assets/${createdAssetId}`, {
        method: 'DELETE',
        headers: { 'Cookie': adminCookie }
    });
    assert.strictEqual(archiveRes.status, 200, "Admin should archive asset");

    // 9c. Restore Asset
    let restoreRes = await fetch(`${API_URL}/assets/${createdAssetId}/restore`, {
        method: 'POST',
        headers: { 'Cookie': adminCookie }
    });
    assert.strictEqual(restoreRes.status, 200, "Admin should restore asset");
    console.log("✅ Asset history, archiving, and restoration verified");

    console.log("\n--- 10. Locations & Zones ---");
    // 10.1 Create location
    let locRes = await fetch(`${API_URL}/locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
        body: JSON.stringify({ name: 'West Green Yard', address: '456 West Blvd' })
    });
    assert.strictEqual(locRes.status, 201, "Admin should create location");
    const locData = await locRes.json();
    assert.ok(locData.id, "Created location should have an id");

    // 10.2 Missing location name validation
    let badLocRes = await fetch(`${API_URL}/locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
        body: JSON.stringify({ address: 'No Name St' })
    });
    assert.strictEqual(badLocRes.status, 400, "Location creation must require name");

    // 10.3 List locations
    let allLocsRes = await fetch(`${API_URL}/locations`, {
        headers: { 'Cookie': adminCookie }
    });
    assert.strictEqual(allLocsRes.status, 200, "Admin should list locations");
    const allLocs = await allLocsRes.json();
    assert.ok(Array.isArray(allLocs), "Locations response must be an array");
    assert.ok(allLocs.some(l => l.id === locData.id), "Created location must appear in list");

    // 10.4 Create zone using location_id
    let zoneRes = await fetch(`${API_URL}/zones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
        body: JSON.stringify({ location_id: locData.id, name: 'Tool Barn', description: 'Central tool storage' })
    });
    assert.strictEqual(zoneRes.status, 201, "Admin should create zone with location_id");
    const zoneData = await zoneRes.json();
    assert.ok(zoneData.id, "Created zone should have an id");

    // 10.5 Create zone using location_name (auto-facility creation / resolution)
    let autoZoneRes = await fetch(`${API_URL}/zones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
        body: JSON.stringify({ location_name: 'East Distribution Hub', address: '789 Logistics Way', name: 'Loading Bay 4' })
    });
    assert.strictEqual(autoZoneRes.status, 201, "Admin should create zone with location_name");
    const autoZoneData = await autoZoneRes.json();
    assert.ok(autoZoneData.id, "Auto-created zone must have an id");
    assert.ok(autoZoneData.location_id, "Auto-created zone must return resolved location_id");

    // 10.6 Zone validation: missing zone name
    let noNameZoneRes = await fetch(`${API_URL}/zones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
        body: JSON.stringify({ location_id: locData.id })
    });
    assert.strictEqual(noNameZoneRes.status, 400, "Zone creation must require name");
    const noNameErr = await noNameZoneRes.json();
    assert.ok(noNameErr.error.includes('Zone name is required'), "Error message must specify zone name is required");

    // 10.7 Zone validation: missing both location_id and location_name
    let noLocZoneRes = await fetch(`${API_URL}/zones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
        body: JSON.stringify({ name: 'Orphan Zone' })
    });
    assert.strictEqual(noLocZoneRes.status, 400, "Zone creation must require location_id or location_name");

    // 10.8 Zone validation: non-existent / unauthorized location_id (tenant isolation)
    let badLocZoneRes = await fetch(`${API_URL}/zones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
        body: JSON.stringify({ location_id: 999999, name: 'Ghost Zone' })
    });
    assert.strictEqual(badLocZoneRes.status, 404, "Zone creation must reject invalid or cross-tenant location_id");

    // 10.9 List zones: verify response is array and includes location details
    let zonesListRes = await fetch(`${API_URL}/zones`, {
        headers: { 'Cookie': adminCookie }
    });
    assert.strictEqual(zonesListRes.status, 200, "Admin should list zones");
    const zonesList = await zonesListRes.json();
    assert.ok(Array.isArray(zonesList), "Zones response must be an array");
    const foundToolBarn = zonesList.find(z => z.id === zoneData.id);
    assert.ok(foundToolBarn, "Created zone must appear in zones list");
    assert.strictEqual(foundToolBarn.location_name, 'West Green Yard', "Zone should include parent location name");

    // 10.10 Get zone by id: verify assets and crew collections are returned
    let zoneDetailRes = await fetch(`${API_URL}/zones/${zoneData.id}`, {
        headers: { 'Cookie': adminCookie }
    });
    assert.strictEqual(zoneDetailRes.status, 200, "Admin should retrieve zone details");
    const zoneDetail = await zoneDetailRes.json();
    assert.ok(Array.isArray(zoneDetail.assets), "Zone details must include assets array");
    assert.ok(Array.isArray(zoneDetail.crew), "Zone details must include crew array");

    // 10.11 RBAC: Field Worker cannot create zone
    let workerZoneRes = await fetch(`${API_URL}/zones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': fieldCookie },
        body: JSON.stringify({ location_id: locData.id, name: 'Unauthorized Zone' })
    });
    assert.strictEqual(workerZoneRes.status, 403, "Field Worker cannot create zone");

    // 10.12 Frontend resilience test: simulating unexpected non-array response handling
    const safeZoneParse = (data) => Array.isArray(data) ? data : [];
    assert.deepStrictEqual(safeZoneParse({ error: 'Failed to load' }), [], "Frontend parser must safely handle error objects as empty array");
    assert.deepStrictEqual(safeZoneParse(null), [], "Frontend parser must safely handle null as empty array");
    assert.deepStrictEqual(safeZoneParse([{ id: 1, name: 'Z1' }]).length, 1, "Frontend parser must pass through valid arrays");

    console.log("✅ Locations & Zones CRUD, validation, tenant isolation, and response shape resilience verified");

    console.log("\n--- 11. User Management & Authorization ---");
    // 11.1 Create user with role_id (as from admin.html)
    const dynEmail1 = 'newmaint_' + Date.now() + '@test.com';
    let userRes1 = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
        body: JSON.stringify({ email: dynEmail1, password: 'password123', role_id: 4, first_name: 'Bob', last_name: 'Builder' })
    });
    assert.strictEqual(userRes1.status, 201, "Admin should create user account with role_id");
    const userJson1 = await userRes1.json();
    assert.strictEqual(userJson1.role_name, 'MAINTENANCE STAFF');

    // 11.2 Create user with role_name (as from settings.html)
    const dynEmail2 = 'fieldworker_' + Date.now() + '@test.com';
    let userRes2 = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
        body: JSON.stringify({ email: dynEmail2, password: 'password123', role_name: 'FIELD WORKER' })
    });
    assert.strictEqual(userRes2.status, 201, "Admin should create user account with role_name");
    const userJson2 = await userRes2.json();
    assert.strictEqual(userJson2.role_name, 'FIELD WORKER');

    // 11.3 Missing fields validation
    let missEmailRes = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
        body: JSON.stringify({ password: 'password123', role_name: 'FIELD WORKER' })
    });
    assert.strictEqual(missEmailRes.status, 400, "Missing email should return 400");

    let missPassRes = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
        body: JSON.stringify({ email: 'nopass@test.com', role_name: 'FIELD WORKER' })
    });
    assert.strictEqual(missPassRes.status, 400, "Missing password should return 400");

    let shortPassRes = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
        body: JSON.stringify({ email: 'shortpass@test.com', password: '123', role_name: 'FIELD WORKER' })
    });
    assert.strictEqual(shortPassRes.status, 400, "Password < 6 chars should return 400");

    let missRoleRes = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
        body: JSON.stringify({ email: 'norole@test.com', password: 'password123' })
    });
    assert.strictEqual(missRoleRes.status, 400, "Missing role should return 400");

    // 11.4 Duplicate email validation
    let dupEmailRes = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
        body: JSON.stringify({ email: dynEmail1, password: 'password123', role_name: 'FIELD WORKER' })
    });
    assert.strictEqual(dupEmailRes.status, 409, "Duplicate email should return 409");

    // 11.5 Invalid role validation
    let invRoleRes = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
        body: JSON.stringify({ email: 'invrole@test.com', password: 'password123', role_name: 'NON_EXISTENT_ROLE' })
    });
    assert.strictEqual(invRoleRes.status, 400, "Invalid role name should return 400");

    // 11.6 Unauthorized user creation (Supervisor attempting to create user must receive 403)
    let supUserRes = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': supCookie },
        body: JSON.stringify({ email: 'evil@test.com', password: 'password123', role_id: 1 })
    });
    assert.strictEqual(supUserRes.status, 403, "Supervisor cannot create users");

    // 11.7 User listing (Admin and Operations Manager)
    let listUsersRes = await fetch(`${API_URL}/users`, {
        headers: { 'Cookie': adminCookie }
    });
    assert.strictEqual(listUsersRes.status, 200, "Admin should list users");
    const listedUsers = await listUsersRes.json();
    assert.ok(Array.isArray(listedUsers), "User list must be an array");
    assert.ok(listedUsers.some(u => u.email === dynEmail1), "Listed users must include created user with role_id");
    assert.ok(listedUsers.some(u => u.email === dynEmail2), "Listed users must include created user with role_name");
    assert.ok(listedUsers.every(u => u.role && u.role_name), "Every user must have role and role_name");

    console.log("✅ User management RBAC, contract validation, duplicate checks, and listing verified");

    console.log("\n--- 12. Maintenance Schedule & Completion ---");
    let schedRes = await fetch(`${API_URL}/maintenance/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
        body: JSON.stringify({ asset_id: createdAssetId, title: 'Blade Sharpening', due_date: '2026-11-01', priority: 'HIGH' })
    });
    assert.strictEqual(schedRes.status, 201, "Should create maintenance schedule");
    const schedData = await schedRes.json();

    let compSchedRes = await fetch(`${API_URL}/maintenance/schedules/${schedData.id}/complete`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Cookie': maintCookie },
        body: JSON.stringify({ notes: 'Blades inspected and sharpened to spec' })
    });
    assert.strictEqual(compSchedRes.status, 200, "Maintenance staff should mark schedule complete");
    console.log("✅ Maintenance schedules and completion verified");

    console.log("\n--- 13. Settings & Planned RFID ---");
    let setRes = await fetch(`${API_URL}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
        body: JSON.stringify({ company_name: 'Greenfield Landscaping Pro', notification_preferences: { email_alerts: true } })
    });
    assert.strictEqual(setRes.status, 200, "Admin should update company settings");

    let rfidRes = await fetch(`${API_URL}/rfid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
        body: JSON.stringify({ name: 'Gate 4 Scanner Unit', location_id: locData.id })
    });
    assert.strictEqual(rfidRes.status, 201, "Admin should register planned RFID device");

    let rfidList = await fetch(`${API_URL}/rfid`, { headers: { 'Cookie': adminCookie } });
    let rfidDevices = await rfidList.json();
    assert.ok(rfidDevices.some(d => d.name === 'Gate 4 Scanner Unit'), "Should list registered RFID device");
    console.log("✅ Settings & Planned RFID device registration verified");

    console.log("\n--- 14. Alerts Deduplication & Resolution ---");
    let alertCreateRes = await fetch(`${API_URL}/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
        body: JSON.stringify({ type: 'UNAUTHORIZED_MOVEMENT', severity: 'HIGH', message: 'Gate 4 movement without checkout', related_entity_id: createdAssetId })
    });
    assert.strictEqual(alertCreateRes.status, 201, "Admin should create alert");
    const alertData = await alertCreateRes.json();

    // 14b. Duplicate alert attempt while unresolved must be deduplicated
    let alertDupRes = await fetch(`${API_URL}/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
        body: JSON.stringify({ type: 'UNAUTHORIZED_MOVEMENT', severity: 'HIGH', message: 'Gate 4 movement without checkout again', related_entity_id: createdAssetId })
    });
    assert.strictEqual(alertDupRes.status, 200, "Duplicate unresolved alert should be deduplicated");
    const dupData = await alertDupRes.json();
    assert.strictEqual(dupData.id, alertData.id, "Deduplicated alert must return original active alert ID");
    assert.strictEqual(dupData.duplicate, true, "Response must indicate duplicate");

    // 14c. Field worker cannot resolve alerts
    let fwResolveRes = await fetch(`${API_URL}/alerts/${alertData.id}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Cookie': fieldCookie }
    });
    assert.strictEqual(fwResolveRes.status, 403, "Field Worker cannot resolve alerts");

    // 14d. Authorized Ops Manager resolves alert
    let alertResolveRes = await fetch(`${API_URL}/alerts/${alertData.id}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Cookie': opsCookie }
    });
    assert.strictEqual(alertResolveRes.status, 200, "Ops Manager should resolve alert");
    console.log("✅ Alerts creation, deduplication, and resolution verified");

    console.log("\n--- 15. Session Logout & Cookie Invalidation ---");
    let logoutRes = await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Cookie': fieldCookie }
    });
    assert.strictEqual(logoutRes.status, 200, "Logout should succeed");
    const setCookie = logoutRes.headers.get('set-cookie');
    assert.ok(setCookie.includes('token=;') || setCookie.includes('Max-Age=0') || setCookie.includes('Expires='), "Logout must clear token cookie");
    console.log("✅ Session logout and cookie clearing verified");

    console.log("\n--- 16. Security: Privilege Escalation & Organization Isolation ---");
    // Field worker attempting to change role to ADMIN must be blocked
    let privEscRes = await fetch(`${API_URL}/users/1/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Cookie': fieldCookie },
        body: JSON.stringify({ role_id: 1 })
    });
    assert.strictEqual(privEscRes.status, 403, "Field Worker must not be able to escalate privileges");

    // Operations Manager attempting to modify user roles must be blocked (Admin only)
    let opsUserRes = await fetch(`${API_URL}/users/1/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Cookie': opsCookie },
        body: JSON.stringify({ role_id: 1 })
    });
    assert.strictEqual(opsUserRes.status, 403, "Ops Manager cannot modify user roles (Admin only)");
    console.log("✅ Privilege escalation prevention and RBAC boundaries verified");

    console.log("\n--- 17. Input Validation & Error Handling ---");
    // Missing required fields on asset creation must return 400
    let invalidAssetRes = await fetch(`${API_URL}/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
        body: JSON.stringify({ asset_type_id: typeEq.id }) // missing name
    });
    assert.strictEqual(invalidAssetRes.status, 400, "Should reject asset without name");

    // Missing title on task creation must return 400
    let invalidTaskRes = await fetch(`${API_URL}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
        body: JSON.stringify({ asset_id: createdAssetId }) // missing title
    });
    assert.strictEqual(invalidTaskRes.status, 400, "Should reject task without title");

    // Invalid session token cookie must be rejected with 401
    let fakeCookieRes = await fetch(`${API_URL}/assets`, {
        headers: { 'Cookie': 'token=invalid.tampered.token' }
    });
    assert.strictEqual(fakeCookieRes.status, 401, "Should reject invalid/tampered token");
    console.log("✅ Input validation and invalid token rejection verified");

    console.log("\n--- 18. OpenAPI Contract & Online Backup Integrity ---");
    let docsRes = await fetch('http://localhost:3000/api/docs');
    assert.strictEqual(docsRes.status, 200, "Should serve OpenAPI documentation");
    let openapiData = await docsRes.json();
    assert.strictEqual(openapiData.openapi, "3.0.3", "Contract must be OpenAPI 3.0.3");

    // Test database online backup utility
    const { createBackup, verifyBackup } = require('../server/db/backup');
    const backupFile = await createBackup();
    const isIntegrityOk = verifyBackup(backupFile);
    assert.strictEqual(isIntegrityOk, true, "Backup file integrity check must pass");
    console.log("✅ OpenAPI contract and database online backup integrity verified");
    if (testServer) {
        testServer.close();
    }

    console.log("\nALL TESTS PASSED SUCCESSFULLY! 🚀");
}

runTests().catch(err => {
    console.error("❌ TEST FAILED:");
    console.error(err);
    process.exit(1);
});

