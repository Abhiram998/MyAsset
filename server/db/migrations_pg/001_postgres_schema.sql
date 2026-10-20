-- ==============================================================================
-- MyAsset PostgreSQL Production Schema (Vercel Postgres / Neon Compatible)
-- Replicates full SQLite schema (001_initial_schema.sql + 002_schema_enhancements.sql)
-- Preserves all constraints, foreign keys, indexes, and default values.
-- ==============================================================================

-- 1. Organizations
CREATE TABLE IF NOT EXISTS organizations (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Roles
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT
);

-- 3. Users (Authentication)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Employees (Personnel directory & operational profiles)
CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    status TEXT DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. Locations (Physical operational facilities / sites)
CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. Zones (Sub-areas inside locations)
CREATE TABLE IF NOT EXISTS zones (
    id SERIAL PRIMARY KEY,
    location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT
);

-- 7. Zone Assignments (Supervisor / Crew zone coverage)
CREATE TABLE IF NOT EXISTS employee_zones (
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    zone_id INTEGER NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    PRIMARY KEY (employee_id, zone_id)
);

-- 8. Asset Types
CREATE TABLE IF NOT EXISTS asset_types (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    name TEXT NOT NULL
);

-- 9. Asset Custom Fields
CREATE TABLE IF NOT EXISTS asset_custom_fields (
    id SERIAL PRIMARY KEY,
    asset_type_id INTEGER NOT NULL REFERENCES asset_types(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    field_type TEXT NOT NULL,
    is_required BOOLEAN DEFAULT FALSE
);

-- 10. Assets
CREATE TABLE IF NOT EXISTS assets (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    asset_type_id INTEGER NOT NULL REFERENCES asset_types(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    tag_id TEXT UNIQUE,
    status TEXT DEFAULT 'AVAILABLE',
    zone_id INTEGER REFERENCES zones(id) ON DELETE SET NULL,
    parent_asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL,
    condition TEXT DEFAULT 'GOOD',
    notes TEXT,
    serial_number TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    archived_at TIMESTAMPTZ
);

-- 11. Asset Custom Values
CREATE TABLE IF NOT EXISTS asset_custom_values (
    asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    field_id INTEGER NOT NULL REFERENCES asset_custom_fields(id) ON DELETE CASCADE,
    value TEXT,
    PRIMARY KEY (asset_id, field_id)
);

-- 12. Asset Assignments (Checkouts & Returns)
CREATE TABLE IF NOT EXISTS assignments (
    id SERIAL PRIMARY KEY,
    asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    assigned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    returned_at TIMESTAMPTZ,
    assigned_by_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    expected_return TIMESTAMPTZ,
    notes TEXT
);

-- 13. Operational Tasks
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'ASSIGNED',
    asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL,
    assignee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    zone_id INTEGER REFERENCES zones(id) ON DELETE SET NULL,
    due_date TIMESTAMPTZ,
    created_by_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- 14. Task Checklists
CREATE TABLE IF NOT EXISTS task_checklists (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    item_text TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ
);

-- 15. Task Evidence Photos
CREATE TABLE IF NOT EXISTS task_evidence (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 16. Maintenance Schedules (Preventive)
CREATE TABLE IF NOT EXISTS maintenance_schedules (
    id SERIAL PRIMARY KEY,
    asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'UPCOMING',
    due_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    priority TEXT DEFAULT 'MEDIUM',
    notes TEXT,
    completed_at TIMESTAMPTZ
);

-- 17. Maintenance Requests (Corrective)
CREATE TABLE IF NOT EXISTS maintenance_requests (
    id SERIAL PRIMARY KEY,
    asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    reporter_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    description TEXT NOT NULL,
    priority TEXT DEFAULT 'MEDIUM',
    status TEXT DEFAULT 'OPEN',
    assigned_staff_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    resolution_notes TEXT,
    completed_at TIMESTAMPTZ
);

-- 18. Maintenance History Records
CREATE TABLE IF NOT EXISTS maintenance_records (
    id SERIAL PRIMARY KEY,
    asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    staff_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    request_id INTEGER REFERENCES maintenance_requests(id) ON DELETE SET NULL,
    schedule_id INTEGER REFERENCES maintenance_schedules(id) ON DELETE SET NULL,
    notes TEXT,
    completed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 19. Activity Audit Log
CREATE TABLE IF NOT EXISTS activity (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL,
    task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
    zone_id INTEGER REFERENCES zones(id) ON DELETE SET NULL,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 20. Alerts
CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    type TEXT NOT NULL,
    severity TEXT NOT NULL,
    message TEXT NOT NULL,
    related_entity_id INTEGER,
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ
);

-- 21. GPS Positions
CREATE TABLE IF NOT EXISTS gps_positions (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    accuracy REAL,
    status TEXT DEFAULT 'LIVE',
    recorded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 22. Documents
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    related_entity_type TEXT NOT NULL,
    related_entity_id INTEGER NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    uploaded_by_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    uploaded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 23. RFID Devices
CREATE TABLE IF NOT EXISTS rfid_devices (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'PLANNED',
    last_seen TIMESTAMPTZ
);

-- 24. Organization Settings
CREATE TABLE IF NOT EXISTS settings (
    organization_id INTEGER PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    notification_preferences TEXT
);

-- 25. Database Migrations Tracking
CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- Performance Indexes (replicated from Migration 002)
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_assets_org_status ON assets(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_assignments_asset ON assignments(asset_id, returned_at);
CREATE INDEX IF NOT EXISTS idx_assignments_emp ON assignments(employee_id, returned_at);
CREATE INDEX IF NOT EXISTS idx_tasks_org_status ON tasks(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id, status);
CREATE INDEX IF NOT EXISTS idx_alerts_org_resolved ON alerts(organization_id, is_resolved);
CREATE INDEX IF NOT EXISTS idx_activity_org ON activity(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_maint_sched_asset ON maintenance_schedules(asset_id, status);
CREATE INDEX IF NOT EXISTS idx_maint_req_asset ON maintenance_requests(asset_id, status);

-- ==============================================================================
-- Default System Roles Seed
-- ==============================================================================
INSERT INTO roles (name, description) VALUES
    ('ADMIN', 'Full company access'),
    ('OPERATIONS MANAGER', 'Runs day-to-day operations'),
    ('SITE / CREW SUPERVISOR', 'Scoped to assigned sites/zones and crew'),
    ('MAINTENANCE STAFF', 'Focused on maintenance'),
    ('FIELD WORKER', 'Focused on assigned work')
ON CONFLICT (name) DO NOTHING;
