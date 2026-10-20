# MyAsset — UI/UX Architecture Specification
### Universal Smart Asset Intelligence Platform
*Pre-implementation design document. No code included — architecture and UX only.*

---

## 1. Recommended Role Hierarchy

**Evaluation of the six proposed roles:**

Company Onboarding (Feature #2) means each landscaping company gets its own workspace, but the project is explicitly scoped as **single-org per company** (no cross-company "platform owner" managing multiple tenants — that's the multi-tenant SaaS layer already marked out of scope). Given that, **Owner/Super Admin and Organization Admin have no meaningful functional difference** in this MVP — both would have full control over the *same single workspace*. Keeping them separate adds a role with no distinct permission set, which is a common over-engineering mistake.

**Recommendation: merge Owner/Super Admin + Organization Admin → one role called `Admin`.**

This leaves **5 roles for the MVP**:

| # | Role | Merged from |
|---|---|---|
| 1 | **Admin** | Owner/Super Admin + Organization Admin |
| 2 | **Operations Manager** | (unchanged) |
| 3 | **Site/Crew Supervisor** | (unchanged) |
| 4 | **Maintenance Staff** | (unchanged) |
| 5 | **Field Worker** | (unchanged) |

If the project later expands into true multi-tenant SaaS (explicitly future scope), reintroducing a platform-level Super Admin above `Admin` is a clean, additive change — it doesn't require restructuring the roles below it.

### Role Definitions

**Admin**
- Purpose: full control of the company workspace — the account that registered the company, or anyone granted equivalent trust.
- Sees: everything, company-wide.
- Creates/Edits/Deletes: assets, employees, zones, roles, all data.
- Assigns: employees to zones/assets, roles to employees.
- Asset access: all.
- Employee info access: all (including GPS).
- Manages: users, roles, RFID/IoT config, company settings, billing (future).

**Operations Manager**
- Purpose: runs day-to-day operations across all sites, without owning company administration (billing, hardware config, role structure).
- Sees: all assets, employees, zones, company-wide activity/reports.
- Creates/Edits: tasks, maintenance schedules, asset assignments, zone assignments.
- Deletes: nothing structural (no asset/user deletion — escalate to Admin).
- Assigns: employees to tasks/zones; cannot assign roles.
- Asset access: all.
- Employee info access: operational info + GPS (company-wide), not sensitive account/security data.
- Cannot: manage users' accounts, change roles, configure RFID hardware, change company settings.

**Site/Crew Supervisor**
- Purpose: manages one or more assigned client sites and the crew working there.
- Sees: their assigned zones/sites only — assets, employees, tasks, activity, alerts scoped to those sites.
- Creates/Edits: tasks for their crew, maintenance requests (not schedules), activity notes.
- Deletes: nothing.
- Assigns: tasks to their crew members only.
- Asset access: assets located in their assigned zones only.
- Employee info access: their crew members only; GPS limited to their crew, not company-wide.
- Cannot: see other supervisors' sites, manage users, touch settings/RFID config.

**Maintenance Staff**
- Purpose: executes and logs maintenance work.
- Sees: assets flagged for maintenance (assigned to them or unassigned/open maintenance queue).
- Creates/Edits: maintenance records, task status updates for maintenance tasks.
- Deletes: nothing.
- Assigns: nothing (receives assignments).
- Asset access: assets currently in a maintenance-relevant state.
- Employee info access: none beyond their own profile.
- Cannot: see GPS, other employees, reports, settings.

**Field Worker**
- Purpose: executes assigned tasks, interacts with assets via scan.
- Sees: only their own tasks, assigned assets, own activity, own location.
- Creates: activity log entries via scan-to-start/scan-to-end, task status updates, maintenance issue reports (flag only, not schedule).
- Edits: their own task progress.
- Deletes: nothing.
- Assigns: nothing.
- Asset access: assets currently assigned to them only.
- Employee info access: none — **cannot see other employees, including their own supervisor's location.**
- Cannot: see GPS of anyone but themselves, reports, settings, other zones.

---

## 2. Permission Matrix

Legend: **FULL** = create/edit/delete/view · **LIMITED** = scoped create/edit, no delete, restricted to own scope · **VIEW** = read-only · **NONE** = no access

| Module | Admin | Ops Manager | Supervisor | Maintenance | Field Worker |
|---|---|---|---|---|---|
| Dashboard | FULL | FULL | LIMITED (own sites) | LIMITED (own queue) | LIMITED (own view) |
| Assets | FULL | FULL | LIMITED (own zones) | LIMITED (maintenance queue) | LIMITED (assigned only) |
| Employees | FULL | LIMITED (no delete/role change) | LIMITED (own crew) | NONE | NONE |
| Locations/Zones | FULL | FULL | VIEW (own zones) | VIEW (relevant zones) | VIEW (current site only) |
| Tasks | FULL | FULL | LIMITED (own crew) | LIMITED (maintenance tasks) | LIMITED (own tasks) |
| Maintenance | FULL | FULL | LIMITED (request only) | FULL (own scope) | LIMITED (report issue only) |
| Activity | FULL | FULL | LIMITED (own crew) | LIMITED (own actions) | LIMITED (own actions) |
| Alerts | FULL | FULL | LIMITED (own crew/zones) | LIMITED (maintenance-related) | LIMITED (own only) |
| Reports | FULL | FULL | LIMITED (own crew) | NONE | NONE |
| Settings | FULL | VIEW | NONE | NONE | NONE |
| GPS | FULL (company-wide) | FULL (company-wide) | LIMITED (own crew) | NONE | LIMITED (self only) |
| RFID/IoT | FULL | VIEW | NONE | NONE | NONE |
| User Management | FULL | LIMITED (invite only) | NONE | NONE | NONE |
| Role Management | FULL | NONE | NONE | NONE | NONE |

**Note on GPS**: this is the most privacy-sensitive row. Field Workers see *only their own* dot, never a peer's. Supervisors see only their assigned crew. Only Admin/Ops Manager see the full company map. This directly enforces the brief's requirement that a Field Worker must not casually see every other employee's location.

---

## 3. Multi-Role / Permission Design

**Recommendation for MVP: single primary role per employee.**

Rationale:
- A multi-role system (many-to-many role assignment, permission unions, conflict resolution when two roles disagree) is real complexity that a final-year MVP doesn't need to prove the concept.
- The "Supervisor who is also Maintenance Staff" case is better solved by **picking the more-privileged applicable role** (Supervisor, since it's a superset for their situation) rather than building a role-combination engine.
- Schema should still be **designed to allow** multi-role later without a rewrite: use an `employee_roles` join table (`employee_id`, `role_id`) even in MVP, just constrain the UI/business logic to allow only one active row per employee for now. This is a one-line constraint to remove later, not a schema migration.

**Temporary permissions**: out of scope for MVP — flag as future work (e.g., "grant Supervisor access for 3 days while covering a leave").

**Enforcement**: every permission check happens **server-side**, in the Business Logic/Domain layer, on every request — not just at UI render. The React frontend hides buttons/routes for UX clarity only; it is never the source of truth. Each API endpoint must independently verify the caller's role and scope (e.g., "does this Supervisor's zone list include the zone of the asset they're trying to edit?") before executing, regardless of what the UI allowed them to click.

---

## 4–7. Role-Based Dashboards

### Admin / Ops Manager Dashboard
*(Ops Manager sees the same layout as Admin, minus settings-related widgets)*
- Total Assets (with fixed/mobile breakdown)
- Assigned vs. Unassigned Assets
- Maintenance Due (count + list, next 7 days)
- Active Employees (online/offline split)
- Active Sites/Zones
- Active Alerts (unresolved count, severity breakdown)
- Recent Activity feed (company-wide)
- Asset Distribution by zone/type (chart)
- Live Employee Location Map (company-wide)
- Movement/Theft Alerts panel

### Supervisor Dashboard
- My Sites (assigned zones only)
- My Crew (status: active/idle/offline)
- Today's Tasks (crew-wide, by site)
- Assets in My Zones
- Maintenance Requests from My Crew
- Recent Activity (crew-scoped)
- Alerts (crew/zone-scoped)
- Crew Location Map (crew members only)

### Maintenance Staff Dashboard
- My Maintenance Queue (assigned + open/unassigned)
- Overdue Maintenance (count, highlighted)
- Assets Needing Attention (list, by urgency)
- Maintenance History (own completed work)
- Today's Maintenance Tasks

### Field Worker Dashboard
- Today's Tasks (checklist style)
- My Assigned Assets
- Scan Asset (primary action button, always visible)
- Upcoming Tasks
- Recent Activity (own actions only)
- Current Site (name + check-in status)
- Notifications

**Design principle applied throughout**: each dashboard answers *"what does this specific role need to act on right now?"* — not a filtered version of the Admin dashboard. Field Worker especially should feel like a task app, not a shrunk analytics dashboard.

---

## 8. Complete Sitemap

```
/login
/onboarding (company registration)
/dashboard                         → role-specific, as above

/assets
  /assets/:id                      → asset details
  /assets/new                      → add asset
  /assets/:id/edit                 → edit asset
  /assets/:id/identity              → QR/NFC identity view

/employees
  /employees/:id                   → employee details

/locations                          → zones/client sites

/tasks
  /tasks/:id                       → task details

/maintenance

/activity

/alerts

/reports

/settings
  /settings/users                  → user management
  /settings/roles                  → role & permissions
  /settings/rfid                   → RFID/IoT configuration
  /settings/gps                    → live employee map (also linked from dashboard)

403 (unauthorized)
404
session-expired
```

Field Worker's effective sitemap is a subset: `/dashboard`, `/tasks`, `/tasks/:id`, `/assets/:id` (view only, own assets), `/activity` (own), a simplified `/alerts` (own), and a "My Location" view — everything else 403s or is simply absent from their nav.

---

## 9. Page-by-Page UI Specification

For each page: Purpose · Access · Main components · Primary action · Secondary actions · Filters · Tables/cards · Empty state · Loading state · Error state · Mobile behavior.

### 1. Login
- **Purpose**: authenticate into a company workspace.
- **Access**: public.
- **Components**: email/password fields, "forgot password," company context (if subdomain/slug-based) or a company picker if email maps to multiple.
- **Primary action**: Log in.
- **Secondary**: forgot password, "register a new company" link.
- **Empty/Loading/Error**: n/a (auth-only) · spinner on submit · inline error ("incorrect email or password" — never reveal which field is wrong).
- **Mobile**: single-column, full-width inputs, no layout change needed.

### 2. Company Onboarding
- **Purpose**: register a new company workspace and its first Admin account.
- **Access**: public (creates the Admin role for the submitter).
- **Components**: company name, industry, team size, admin email, password.
- **Primary action**: Create workspace.
- **Secondary**: "already have an account? Sign in."
- **Error state**: duplicate company name/email, weak password.
- **Mobile**: stacked form, same fields.

### 3. Dashboard
- See Sections 4–7 above for per-role content.
- **Loading state**: skeleton cards for each widget (not a full-page spinner — dashboard should progressively render).
- **Error state**: per-widget error (e.g., "GPS map unavailable" shouldn't block the rest of the dashboard from rendering).
- **Empty state** (new company, no data yet): a "Get started" checklist — add your first asset, invite your first employee, create your first zone — replacing empty widgets.

### 4. Assets (list)
- **Access**: scoped per role (Section 2).
- **Components**: filterable/searchable table or card grid, category filter chips (by asset type), status filter (active/checked-out/maintenance/alert), zone filter.
- **Primary action**: "Register asset" (role-permitting).
- **Secondary**: export, bulk actions (Admin/Ops Manager only).
- **Filters**: type, zone, status, assigned employee.
- **Empty state**: "No assets yet — register your first asset" with the primary action inline.
- **Loading**: table skeleton rows.
- **Error**: retry banner, doesn't crash the page shell.
- **Mobile**: switches from table to stacked cards.

### 5. Asset Details
See Section on **Asset Details** below for full breakdown.

### 6. Add Asset
See **Asset UX** section below for the type→custom-field flow.
- **Primary action**: Save & generate tag.
- **Secondary**: Save as draft, Cancel.
- **Error state**: inline validation per field; duplicate tag ID conflict handled server-side with a clear message.

### 7. Edit Asset
- Same layout as Add Asset, pre-filled. Tag ID is **read-only** once generated (tags shouldn't silently change identity).

### 8. QR/NFC Identity page
- **Purpose**: view/print/re-generate an asset's physical tag.
- **Components**: QR code preview, tag ID (monospace), "print label," "regenerate tag" (Admin only, with a warning that the old tag becomes invalid).
- **Empty state**: n/a — every registered asset has an identity by definition.

### 9. Employees (list)
- **Access**: Admin/Ops Manager (full/limited), Supervisor (own crew only), others NONE.
- **Components**: table — name, role, zone, status (active/idle/offline), assets assigned count.
- **Primary action**: Invite employee (Admin/Ops Manager).
- **Filters**: role, zone, status.
- **Empty state**: "No employees yet — invite your team."

### 10. Employee Details
- **Components**: profile info, role, assigned zone, assigned assets list, activity history, GPS status (**visible only if viewer's role permits GPS for this employee's scope** — see Section 2).
- Maintenance Staff/Field Worker never reach this page (403).

### 11. Locations / Client Sites
- **Components**: list/map of zones, asset count per zone, employee count per zone.
- **Primary action**: Add zone (Admin/Ops Manager).
- **Empty state**: "No sites configured yet."

### 12. Tasks (list)
- **Components**: filterable list — status (assigned/in-progress/complete/verification), assignee, asset, zone, due date.
- **Primary action**: Create task (role-permitting); Field Worker sees "Start Task" per row instead.
- **Empty state** (Field Worker): "No tasks assigned to you right now" — friendly, not an error-styled empty state.

### 13. Task Details
- Workflow stepper (see Task Verification section), evidence upload if required, comments/notes, related asset link.

### 14. Maintenance
- **Components**: due/overdue list, scheduled list, maintenance history table.
- **Primary action**: Schedule maintenance (Admin/Ops Manager); "Mark complete" (Maintenance Staff).
- **Empty state**: "Nothing due — all caught up" (positive framing, not a blank void).

### 15. Activity
- **Components**: unified timeline (scoped per role — see matrix), filterable by employee/asset/action type/date range.
- **Empty state**: "No activity recorded yet."

### 16. Alerts
- **Components**: unresolved list (top), resolved history (collapsed by default), severity badges.
- **Primary action**: "Mark resolved" (role-permitting).
- **Empty state**: "No active alerts — everything's accounted for" (calm, positive — this is a good state, style it that way, not like a generic empty list).

### 17. Reports
- **Components**: report type cards, each with "generate/export."
- **Access**: Admin/Ops Manager/Supervisor (own scope) only.
- **Empty state**: n/a (reports generate on demand).

### 18. Settings
- **Components**: company profile, notification preferences — tabs/sections gated by sub-permission (Admin full, Ops Manager view-only).

### 19. User Management
- **Components**: employee accounts table, invite/deactivate actions, role assignment dropdown.
- **Access**: Admin (full), Ops Manager (invite only, cannot change roles or delete).

### 20. Role & Permissions
- **Components**: the permission matrix itself, editable (Admin only) — read-only for anyone else who can even reach it (Ops Manager: NONE, so this page 403s for them).

### 21. RFID/IoT Configuration
See **RFID UX** section below — this page must clearly communicate hardware is **planned/not yet connected**.

### 22. GPS / Live Employee Map
See **GPS UX** section below.

---

## 10. Asset Management UX

**Universal model — strictly enforced in UI, not just backend:**

```
Asset
 ├─ core fields (name, tag ID, status, zone, assigned employee, photo)
 └─ Asset Type → Custom Fields (dynamic, per type)
```

The **Add Asset flow**:
1. Step 1 — core fields (name, photo, zone, assign to employee — optional at creation).
2. Step 2 — select **Asset Type** from a dropdown (e.g., Plant, Tool, Machine, IT Equipment) — this is company-configurable, not hardcoded.
3. Step 3 — form **dynamically renders custom fields** defined for that Asset Type (e.g., Plant → Species, Age, Health; Machine → Brand, Model, Serial Number, Purchase Date). This step doesn't exist as separate UI per type — it's one generic "render fields from schema" component.
4. Step 4 — review & generate tag (QR auto-generated, printable).

**Critically**: there is exactly **one** "Add Asset" screen, **one** "Asset Details" screen, **one** "Assets" table — never type-specific pages. The Asset Type dropdown and its associated custom-field schema is itself manageable in Settings (Admin), which is what makes the system genuinely universal rather than universal-in-name-with-hardcoded-types.

---

## 11. Asset Details Page

**Sections and role visibility:**

| Section | Admin/Ops Mgr | Supervisor | Maintenance | Field Worker |
|---|---|---|---|---|
| Identity, photo, type, status | Visible | Visible | Visible | Visible |
| Current location | Visible | Visible (own zones) | Visible | Visible |
| Assigned employee | Visible | Visible (own crew) | Visible | Visible (self only) |
| QR/NFC identifier | Visible | Visible | Visible | Visible |
| Parent/child relationship (e.g., pot ↔ plant) | Visible | Visible | Visible | Visible |
| Maintenance history | Visible | Visible | Visible (full) | View own reports only |
| Activity timeline | Visible | Visible (own zone) | Visible (own actions) | Visible (own actions) |
| Movement history | Visible | Visible (own zone) | Hidden | Hidden |
| Task history | Visible | Visible (own crew) | Hidden | Own tasks only |
| Alerts (asset-specific) | Visible | Visible (own zone) | Maintenance-related only | Hidden |
| Documents | Visible | Visible | Visible | Hidden |

**Parent/child relationship** (e.g., a plant + its pot as linked assets) should render as a small linked-asset card, not a separate page — click-through navigates to the child/parent asset's own Details page.

---

## 12. Task Verification UX

**Workflow:**
```
Assigned → Start Task → Work in Progress → Complete Task → Verification → Completed
```

**Verification method recommendation for MVP:**

Given the project's own earlier-established priority order (sensor-verified > scan+time-threshold > photo > supervisor spot-check > single scan), and that **hardware isn't implemented yet**, the MVP should implement:

- **Primary**: Timestamp-based scan-to-start / scan-to-end with a plausibility check (flag if completion is suspiciously fast for the task type).
- **Secondary (fallback for tasks without a scannable asset)**: simple checklist completion + optional photo upload.

**Not for MVP**: supervisor approval workflow (adds a second-actor dependency that complicates testing/demoing solo) and location-based verification (depends on the GPS feature being reliable first). Both are reasonable "future scope" additions once the core loop works.

**UI for the workflow**: a horizontal stepper on the Task Details page, each stage clickable only in sequence, with the current stage highlighted. "Complete Task" always routes through whatever verification method the task type requires before it's allowed to reach "Completed" — this is enforced by the Business Logic layer, not just disabling a button.

---

## 13. Maintenance UX

- **Two views**: "Due/Upcoming" (time-based and usage-based triggers, sorted by urgency) and "History" (completed log).
- **Scheduling** (Admin/Ops Manager): time-based (recurring interval) or usage-based (after N task completions) trigger types, selectable per asset or per Asset Type as a default.
- **Completion** (Maintenance Staff): mark complete with optional notes/photo, timestamp auto-recorded.
- **Field Worker's role**: can only **report an issue** (flags an asset for maintenance review) — cannot schedule or close maintenance items. This keeps maintenance authority with the appropriate roles while still letting frontline workers surface problems.

---

## 14. GPS UX

**Core privacy rule, enforced in both UI and backend**: an employee's location is visible only to (a) themselves, (b) their direct supervisor (for their own crew), and (c) Admin/Ops Manager (company-wide). A Field Worker's map view literally **has no other employees rendered on it** — not grayed out, not hidden-but-present in the DOM, genuinely absent from the API response they receive.

**Components:**
- **Live map** (Leaflet or equivalent): marker per visible employee, colored by status (active/idle/offline).
- **Employee marker**: avatar-style pin, click reveals name, role, current site, last-seen time.
- **Last seen time**: relative ("3 min ago") not raw timestamp, for scannability.
- **Current site**: inferred from geofence/zone boundary if the employee's coordinates fall within a known zone; otherwise shows "en route" or the raw nearest-zone label.
- **Location history**: a toggle to show today's breadcrumb trail for one selected employee (Admin/Ops Manager/Supervisor-of-that-employee only).

**States:**
- **GPS unavailable** (employee's device hasn't reported recently): grey/faded marker + "last seen X ago," never silently disappears (disappearing markers read as a bug, not a status).
- **Permission denied** (employee's browser/app blocked location access): a banner on the *employee's own* dashboard prompting them to enable it — this is their problem to fix, shown to them, not just silently missing from managers' maps.
- **Offline** (no network): cached last-known position shown with a clear "offline since X" label, not a live-looking dot.

---

## 15. RFID/IoT UX

**Hardware is not implemented yet — the UI must say so honestly, everywhere it's relevant.**

**RFID/IoT Configuration page components:**
- **Devices list**: table of configured (or planned) readers/gates — device name, location/checkpoint, status, last seen, tag reads today.
- **Checkpoints/Gates**: logical mapping of a device to a physical location (e.g., "Depot Gate 1").
- **Tag↔Asset linking**: table showing which RFID tag ID maps to which asset (only meaningful once tags exist).
- **Movement events log**: real event log once hardware exists; **empty/placeholder state until then.**
- **Unauthorized movement alerts**: surfaces in the main Alerts Center once real, but the RFID config page itself explains this pipeline is planned.

**Required states — this page must never fake data:**
- **Not configured** (current real state): a clear empty state — *"No RFID devices configured yet. Hardware integration is planned for a future phase."* with a disabled/greyed "Add device" if you want to let Admin pre-configure a *planned* device entry ahead of hardware arriving, explicitly labeled "Planned — not yet connected."
- **Offline**: a device that was once connected but isn't reporting — greyed icon, "Offline since X."
- **Connected**: green status, live last-seen ticking — the only state that implies real data is flowing.
- **Planned**: a badge/tag used throughout (dashboard widgets, settings, device rows) wherever RFID-dependent data would normally appear, so the UI is honest by default rather than by exception.

Dashboard widgets that would depend on RFID (e.g., "movement alerts today") should show *"RFID not yet connected"* as their empty state copy specifically, rather than a generic "no data" — this tells the viewer *why*, not just *that*, data is absent.

---

## 16. Alert UX

- **Two-tier list**: Unresolved (top, prominent) / Resolved (collapsed, historical).
- **Severity**: color-coded badges (e.g., unauthorized movement = high, maintenance overdue = medium, device offline = low/info).
- **Resolve action**: role-permitting, requires no confirmation modal for low-severity, does for high-severity ("are you sure this unauthorized movement was resolved?").
- **Empty state**: styled positively, not as a blank/error state — "no active alerts" should feel reassuring.
- **Given RFID isn't live yet**: unauthorized-movement alerts simply won't populate until hardware exists — this is a natural, honest empty state, not something to special-case.

---

## 17. Reports UX

- **Report type cards**: Asset Register, Maintenance History, Movement & Alerts, Employee Activity, Zone Utilization — each with a "last generated" timestamp and an export button.
- **Access**: Admin/Ops Manager (all reports), Supervisor (own-crew-scoped reports only), others: page 403s.
- **Movement & Alerts report**: until RFID exists, this report is either empty or QR/NFC-checkpoint-based only — label it accordingly rather than implying full theft-detection coverage.

---

## 18. Settings UX

- **Sections**: Company Profile, Notifications, Connected Hardware (→ links to RFID config), Users (→ User Management page), Roles (→ Role Management page).
- **Access gating**: Admin sees/edits all sections; Ops Manager sees Company Profile and Notifications as **view-only**; all other roles 403 on this route entirely (it shouldn't even appear in their nav).

---

## 19. Responsive / Mobile UX

**Priority order for mobile optimization** (Field Workers are mobile-first; everyone else is secondary):

1. **Task screen** — must work flawlessly one-handed, large tap targets, scan button always reachable via thumb.
2. **Scan Asset** — camera viewfinder full-screen, minimal chrome.
3. **Dashboard (Field Worker)** — single column, card-stacked, today's tasks at the very top.
4. **Asset details** — collapsible sections (accordion) instead of a dense desktop layout with everything visible at once.
5. **GPS map** — full-screen toggle option, since a small embedded map is nearly useless on mobile.
6. **Employee/Assets list (Admin/manager-facing)** — table → card conversion at breakpoint, lowest priority since these roles are more likely on desktop/tablet.

**General rules**: sidebar nav collapses to a bottom tab bar or hamburger menu under ~900px width (this was already a real bug found and fixed earlier in the project — carry that fix forward as a standing requirement, not a one-off patch). No table ever scrolls horizontally on mobile if it can instead restructure as cards.

---

## 20. Design System

*(Carrying forward and formalizing the palette already established for MyAsset, refined for enterprise-SaaS seriousness.)*

**Colors**
| Token | Value | Use |
|---|---|---|
| Primary | Deep moss `#16342A` | Nav, primary actions, brand |
| Primary-soft | `#2F5A46` | Hover states, secondary emphasis |
| Secondary/accent | Copper `#BE7C3E` | Highlights, active states, tag/ID accents |
| Background | Warm paper `#F1EEE3` | App background |
| Surface | White / `#E9E4D3` | Cards, panels |
| Text (primary) | Ink `#1C1F1B` | Body text |
| Text (muted) | `#55584F` | Secondary text, labels |
| Success | Moss-soft `#2F5A46` | Active/resolved/online states |
| Warning | Copper `#BE7C3E` | Checked-out, due-soon, idle |
| Danger | Brick `#A83D2C` | Alerts, unauthorized, overdue |
| Info | Neutral grey-brown | Offline/planned/neutral states |

**Typography**
- Headings: a serif or slab display face for section titles (weight, not decoration) — sparingly, mainly on marketing/onboarding surfaces.
- UI/body: a clean grotesk (e.g., Work Sans) — this carries the actual product UI.
- Data/IDs/monospace: JetBrains Mono for tag IDs, timestamps, codes — reinforces the "tagging system" identity and improves scanability of dense data.

**Spacing/Radius**: consistent 4px base spacing scale (4/8/12/16/24/32), 6–8px border radius on cards/buttons/inputs (soft, not sharp — but not pill-shaped either, keeps it "enterprise" not "consumer app").

**Components**
- **Buttons**: solid ink/moss for primary, outline for secondary, no more than one solid-primary button visible per view.
- **Inputs**: consistent 1.5px border, clear focus state (moss border, no harsh glow).
- **Tables**: monospace for IDs/codes columns, sans for names/labels, zebra-free (use border-bottom rows, not alternating fill — reads cleaner at density).
- **Cards**: 1px border + subtle shadow only on hover/interactive cards, flat otherwise.
- **Badges/status pills**: consistent shape across the whole system (rounded, small-caps or uppercase mono label) — status color always maps to the same token regardless of which page it's on.
- **Modals**: reserved for destructive/high-consequence actions only (delete, role change, resolve high-severity alert) — routine actions use inline editing or slide-over panels, not modals, to avoid modal fatigue.
- **Dropdowns**: standard, consistent max-height with scroll, search-to-filter for long lists (employees, zones).
- **Toasts**: bottom-right, auto-dismiss for success, persistent-until-dismissed for errors.
- **Navigation**: fixed sidebar (desktop/tablet) → bottom tab bar (mobile), role-filtered so a role never sees a nav item they'd 403 on.

**Explicitly avoid**: gradients as decoration, animated background elements, more than one accent color competing for attention per screen, skeuomorphic shadows — the brief for "modern, professional, clean, trustworthy, enterprise, simple" rules these out.

---

## 21. Empty / Loading / Error States — System-Wide Principles

- **Empty ≠ Error**: an empty state (no alerts, no maintenance due, no RFID devices) should read as calm/positive/neutral information, styled distinctly from an actual error. Use a plain icon + one sentence, not a red banner.
- **Loading**: skeleton screens matching the real layout, not spinners-in-a-void, so the page doesn't visually "jump" once data arrives. Dashboards load widget-by-widget (progressive), not as one blocking unit.
- **Error**: inline, scoped to the failed component wherever possible (one failed widget shouldn't take down the whole dashboard) — with a retry action, and a distinct full-page error only for total page-load failures.
- **Planned/Not-yet-available** (RFID, and anything hardware-dependent): its own distinct visual treatment — a dashed border or muted "planned" badge, different from both empty and error, so the viewer understands *this feature exists in the design but isn't live yet*, not *this is broken* or *there's simply no data*.

---

## 22. Complete User Journeys

**Journey A — Admin onboarding a new company**
Register company → land on empty-state Dashboard with "Get started" checklist → add first Zone → add first Asset Type + custom fields → register first Asset → invite first Employee (assign role + zone) → dashboard populates.

**Journey B — Field Worker's day**
Log in → Dashboard shows Today's Tasks → tap a task → "Start Task" (scan asset if required) → do the work → "Complete Task" → verification per task type (timestamp/checklist/photo) → task moves to Completed → next task.

**Journey C — Supervisor handling a maintenance report**
Field Worker reports an issue on an asset → Supervisor sees it in their Alerts/Activity feed → Supervisor escalates by creating a maintenance request → Maintenance Staff picks it up from their queue → completes it → Supervisor sees it resolved in their crew's activity.

**Journey D — Admin investigating an alert**
Dashboard shows Active Alerts count → clicks through to Alerts Center → sees an unresolved unauthorized-movement flag (once RFID is live) or a checkpoint mismatch (QR-based interim) → clicks asset → reviews Movement History + Activity Timeline on Asset Details → resolves or escalates.

**Journey E — Ops Manager reviewing weekly performance**
Dashboard → Reports → generates Employee Activity + Zone Utilization reports for the week → cross-references with Maintenance history → exports for a stakeholder update.

---

## 23. MVP vs. Future UI Features

**Build now (MVP)**
- All 5 roles + permission matrix, server-enforced
- Universal Asset model (type + custom fields)
- Core pages: Login, Onboarding, Dashboard (all 5 variants), Assets (list/details/add/edit), Employees, Locations, Tasks, Maintenance, Activity, Alerts, Reports, Settings, User Management, Role Management
- QR/NFC identity generation (software-only — printable tags)
- Task verification: timestamp scan-to-start/end + checklist/photo fallback
- GPS live tracking with the privacy-scoped map, empty/offline/permission-denied states
- RFID/IoT Configuration page — **in "Planned" state**, structured but not wired to real hardware

**Explicit future scope (design for, don't build)**
- Real RFID/ESP32 hardware integration (page structure ready to receive it)
- Multi-role/temporary permissions
- Supervisor-approval task verification step
- Location-based task verification
- True multi-tenant Super Admin tier
- Predictive maintenance / ML features
- Full computer vision / CCTV

---

## 24. Recommended Implementation Order

1. **Auth + Roles/Permissions backbone** (server-side enforcement first — everything else depends on this being real, not decorative)
2. **Company Onboarding + Settings shell**
3. **Universal Asset model** (type + custom fields engine) — this is the architectural core; get it right before building any asset-dependent UI
4. **Assets pages** (list, details, add, edit, QR identity)
5. **Zones/Locations**
6. **Employees + User Management**
7. **Admin/Ops Manager Dashboard** (first real dashboard, validates the data model end-to-end)
8. **Tasks + verification workflow**
9. **Maintenance**
10. **Activity + Alerts** (these depend on tasks/assets/maintenance already emitting events)
11. **Remaining role-specific dashboards** (Supervisor, Maintenance Staff, Field Worker)
12. **GPS live map** (privacy-scoped)
13. **Reports**
14. **RFID/IoT Configuration page** (planned-state UI — no hardware dependency to build this shell)
15. **Mobile responsiveness pass** across all of the above
16. **Empty/loading/error state pass** — audit every page against Section 21's principles

This order front-loads the two things everything else depends on (permissions, universal asset model) and ends with the two things that can be visually/UX-polished last without blocking other work (mobile pass, state handling).

---

*End of specification. Awaiting approval before any React implementation begins, per the brief.*
