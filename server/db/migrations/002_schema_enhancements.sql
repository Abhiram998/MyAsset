-- Migration 002: Schema Enhancements for Full Operational Capabilities

-- 1. Enhancements to assignments (due dates, notes)
ALTER TABLE assignments ADD COLUMN expected_return DATETIME;
ALTER TABLE assignments ADD COLUMN notes TEXT;

-- 2. Enhancements to assets (condition, notes, serial number, archiving)
ALTER TABLE assets ADD COLUMN condition TEXT DEFAULT 'GOOD';
ALTER TABLE assets ADD COLUMN notes TEXT;
ALTER TABLE assets ADD COLUMN serial_number TEXT;
ALTER TABLE assets ADD COLUMN archived_at DATETIME;

-- 3. Enhancements to maintenance schedules (priority, notes, completed_at)
ALTER TABLE maintenance_schedules ADD COLUMN priority TEXT DEFAULT 'MEDIUM';
ALTER TABLE maintenance_schedules ADD COLUMN notes TEXT;
ALTER TABLE maintenance_schedules ADD COLUMN completed_at DATETIME;

-- 4. Indexes for high performance queries
CREATE INDEX IF NOT EXISTS idx_assets_org_status ON assets(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_assignments_asset ON assignments(asset_id, returned_at);
CREATE INDEX IF NOT EXISTS idx_assignments_emp ON assignments(employee_id, returned_at);
CREATE INDEX IF NOT EXISTS idx_tasks_org_status ON tasks(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id, status);
CREATE INDEX IF NOT EXISTS idx_alerts_org_resolved ON alerts(organization_id, is_resolved);
CREATE INDEX IF NOT EXISTS idx_activity_org ON activity(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_maint_sched_asset ON maintenance_schedules(asset_id, status);
CREATE INDEX IF NOT EXISTS idx_maint_req_asset ON maintenance_requests(asset_id, status);
