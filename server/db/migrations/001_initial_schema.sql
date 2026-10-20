-- Organizations
CREATE TABLE organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Roles
CREATE TABLE roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE, -- 'ADMIN', 'OPERATIONS MANAGER', 'SITE / CREW SUPERVISOR', 'MAINTENANCE STAFF', 'FIELD WORKER'
    description TEXT
);

-- Users (Authentication)
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id),
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- Employees (Profile/Business data)
CREATE TABLE employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE, -- Can be NULL if employee doesn't have login yet
    organization_id INTEGER NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    status TEXT DEFAULT 'ACTIVE', -- ACTIVE, IDLE, OFFLINE
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- Locations (Sites)
CREATE TABLE locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- Zones (Sub-areas in locations)
CREATE TABLE zones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    FOREIGN KEY (location_id) REFERENCES locations(id)
);

-- Zone Assignments (Which employee is assigned to which zone, mostly for Supervisors/Crew)
CREATE TABLE employee_zones (
    employee_id INTEGER NOT NULL,
    zone_id INTEGER NOT NULL,
    PRIMARY KEY (employee_id, zone_id),
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (zone_id) REFERENCES zones(id)
);

-- Asset Types
CREATE TABLE asset_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- Asset Custom Fields Schema
CREATE TABLE asset_custom_fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_type_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    field_type TEXT NOT NULL, -- TEXT, NUMBER, DATE, BOOLEAN
    is_required BOOLEAN DEFAULT 0,
    FOREIGN KEY (asset_type_id) REFERENCES asset_types(id)
);

-- Assets
CREATE TABLE assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL,
    asset_type_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    tag_id TEXT UNIQUE, -- The generated QR/NFC identifier
    status TEXT DEFAULT 'AVAILABLE', -- AVAILABLE, ASSIGNED, IN_MAINTENANCE, MISSING
    zone_id INTEGER,
    parent_asset_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id),
    FOREIGN KEY (asset_type_id) REFERENCES asset_types(id),
    FOREIGN KEY (zone_id) REFERENCES zones(id),
    FOREIGN KEY (parent_asset_id) REFERENCES assets(id)
);

-- Asset Custom Values
CREATE TABLE asset_custom_values (
    asset_id INTEGER NOT NULL,
    field_id INTEGER NOT NULL,
    value TEXT,
    PRIMARY KEY (asset_id, field_id),
    FOREIGN KEY (asset_id) REFERENCES assets(id),
    FOREIGN KEY (field_id) REFERENCES asset_custom_fields(id)
);

-- Asset Assignments
CREATE TABLE assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    returned_at DATETIME,
    assigned_by_id INTEGER NOT NULL,
    FOREIGN KEY (asset_id) REFERENCES assets(id),
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (assigned_by_id) REFERENCES users(id)
);

-- Tasks
CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'ASSIGNED', -- ASSIGNED, IN PROGRESS, VERIFICATION, COMPLETED
    asset_id INTEGER,
    assignee_id INTEGER,
    zone_id INTEGER,
    due_date DATETIME,
    created_by_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    FOREIGN KEY (organization_id) REFERENCES organizations(id),
    FOREIGN KEY (asset_id) REFERENCES assets(id),
    FOREIGN KEY (assignee_id) REFERENCES employees(id),
    FOREIGN KEY (zone_id) REFERENCES zones(id),
    FOREIGN KEY (created_by_id) REFERENCES users(id)
);

-- Task Checklists
CREATE TABLE task_checklists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    item_text TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT 0,
    completed_at DATETIME,
    FOREIGN KEY (task_id) REFERENCES tasks(id)
);

-- Task Evidence (Photos)
CREATE TABLE task_evidence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id)
);

-- Maintenance Schedules
CREATE TABLE maintenance_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'UPCOMING', -- UPCOMING, DUE SOON, OVERDUE, COMPLETED
    due_date DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (asset_id) REFERENCES assets(id)
);

-- Maintenance Requests
CREATE TABLE maintenance_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL,
    reporter_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    priority TEXT DEFAULT 'MEDIUM',
    status TEXT DEFAULT 'OPEN', -- OPEN, IN PROGRESS, COMPLETED
    assigned_staff_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolution_notes TEXT,
    completed_at DATETIME,
    FOREIGN KEY (asset_id) REFERENCES assets(id),
    FOREIGN KEY (reporter_id) REFERENCES employees(id),
    FOREIGN KEY (assigned_staff_id) REFERENCES employees(id)
);

-- Maintenance Records (History)
CREATE TABLE maintenance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL,
    staff_id INTEGER NOT NULL,
    request_id INTEGER,
    schedule_id INTEGER,
    notes TEXT,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (asset_id) REFERENCES assets(id),
    FOREIGN KEY (staff_id) REFERENCES employees(id),
    FOREIGN KEY (request_id) REFERENCES maintenance_requests(id),
    FOREIGN KEY (schedule_id) REFERENCES maintenance_schedules(id)
);

-- Activity Log
CREATE TABLE activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL,
    employee_id INTEGER, -- WHO
    action TEXT NOT NULL, -- WHAT (e.g., 'STARTED_TASK', 'SCANNED_ASSET', 'CREATED_MAINTENANCE_REQUEST')
    asset_id INTEGER, -- RELATED ASSET
    task_id INTEGER, -- RELATED TASK
    zone_id INTEGER, -- WHERE
    details TEXT, -- REASON/EVIDENCE/NOTES
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, -- WHEN
    FOREIGN KEY (organization_id) REFERENCES organizations(id),
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (asset_id) REFERENCES assets(id),
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (zone_id) REFERENCES zones(id)
);

-- Alerts
CREATE TABLE alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL,
    type TEXT NOT NULL, -- UNAUTHORIZED_MOVEMENT, MAINTENANCE_DUE, TASK_OVERDUE, RFID_OFFLINE, GPS_UNAVAILABLE
    severity TEXT NOT NULL, -- LOW, MEDIUM, HIGH
    message TEXT NOT NULL,
    related_entity_id INTEGER, -- Polyorphic ID (asset_id, task_id, etc depending on type)
    is_resolved BOOLEAN DEFAULT 0,
    resolved_by_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    FOREIGN KEY (organization_id) REFERENCES organizations(id),
    FOREIGN KEY (resolved_by_id) REFERENCES users(id)
);

-- GPS Positions
CREATE TABLE gps_positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    accuracy REAL,
    status TEXT DEFAULT 'LIVE', -- LIVE, IDLE, OFFLINE, GPS_UNAVAILABLE
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);

-- Documents
CREATE TABLE documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    related_entity_type TEXT NOT NULL, -- 'ASSET', 'TASK', etc
    related_entity_id INTEGER NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    uploaded_by_id INTEGER NOT NULL,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (uploaded_by_id) REFERENCES users(id)
);

-- RFID Devices (Planned state)
CREATE TABLE rfid_devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    location_id INTEGER,
    status TEXT DEFAULT 'PLANNED', -- PLANNED, CONNECTED, OFFLINE
    last_seen DATETIME,
    FOREIGN KEY (organization_id) REFERENCES organizations(id),
    FOREIGN KEY (location_id) REFERENCES locations(id)
);

-- Settings
CREATE TABLE settings (
    organization_id INTEGER PRIMARY KEY,
    company_name TEXT NOT NULL,
    notification_preferences TEXT, -- JSON string
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);
