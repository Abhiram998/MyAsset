const { connect, runMigrations } = require('../database');
const bcrypt = require('bcrypt');

function runSeed() {
    console.log('Running migrations first...');
    runMigrations();
    
    console.log('Seeding database...');
    const db = connect();

    // Check if roles already exist to avoid duplication
    const existingRoles = db.prepare('SELECT count(*) as count FROM roles').get();
    if (existingRoles.count > 0) {
        console.log('Database already seeded. Skipping.');
        return;
    }

    const insertRole = db.prepare('INSERT INTO roles (name, description) VALUES (?, ?)');
    insertRole.run('ADMIN', 'Full company access');
    insertRole.run('OPERATIONS MANAGER', 'Runs day-to-day operations');
    insertRole.run('SITE / CREW SUPERVISOR', 'Scoped to assigned sites/zones and crew');
    insertRole.run('MAINTENANCE STAFF', 'Focused on maintenance');
    insertRole.run('FIELD WORKER', 'Focused on assigned work');

    console.log('Roles seeded.');

    // Seed test organization
    const insertOrg = db.prepare('INSERT INTO organizations (name) VALUES (?)');
    const orgResult = insertOrg.run('MyAsset Test Org');
    const orgId = orgResult.lastInsertRowid;
    console.log('Test organization seeded.');

    // Seed Admin user
    const adminPassword = 'password123'; // Development only
    const saltRounds = 10;
    const passwordHash = bcrypt.hashSync(adminPassword, saltRounds);
    
    const adminRole = db.prepare('SELECT id FROM roles WHERE name = ?').get('ADMIN');
    
    const insertUser = db.prepare(`
        INSERT INTO users (organization_id, email, password_hash, role_id)
        VALUES (?, ?, ?, ?)
    `);
    
    const userResult = insertUser.run(orgId, 'admin@myasset.test', passwordHash, adminRole.id);
    const userId = userResult.lastInsertRowid;
    console.log(`Test Admin user seeded. Email: admin@myasset.test, Password: ${adminPassword}`);

    // Seed Admin employee profile
    const insertEmployee = db.prepare(`
        INSERT INTO employees (user_id, organization_id, first_name, last_name)
        VALUES (?, ?, ?, ?)
    `);
    insertEmployee.run(userId, orgId, 'Admin', 'User');

    // Create a base location and zone
    const insertLocation = db.prepare('INSERT INTO locations (organization_id, name, address) VALUES (?, ?, ?)');
    const locResult = insertLocation.run(orgId, 'HQ Site', '123 Main St');
    
    const insertZone = db.prepare('INSERT INTO zones (location_id, name, description) VALUES (?, ?, ?)');
    insertZone.run(locResult.lastInsertRowid, 'Zone A', 'Main working area');

    console.log('Seed complete.');
}

if (require.main === module) {
    runSeed();
}

module.exports = { runSeed };
