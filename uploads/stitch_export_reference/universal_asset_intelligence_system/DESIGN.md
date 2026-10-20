---
name: Universal Asset Intelligence System
colors:
  surface: '#fcf9ee'
  surface-dim: '#dddacf'
  surface-bright: '#fcf9ee'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f7f4e8'
  surface-container: '#f1eee3'
  surface-container-high: '#ebe8dd'
  surface-container-highest: '#e5e2d8'
  on-surface: '#1c1c15'
  on-surface-variant: '#414845'
  inverse-surface: '#313129'
  inverse-on-surface: '#f4f1e6'
  outline: '#727975'
  outline-variant: '#c1c8c3'
  surface-tint: '#466559'
  primary: '#001f16'
  on-primary: '#ffffff'
  primary-container: '#16342a'
  on-primary-container: '#7d9d90'
  inverse-primary: '#adcebf'
  secondary: '#895115'
  on-secondary: '#ffffff'
  secondary-container: '#ffb470'
  on-secondary-container: '#794306'
  tertiary: '#001f12'
  on-tertiary: '#ffffff'
  tertiary-container: '#003623'
  on-tertiary-container: '#65a284'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#c8eadb'
  primary-fixed-dim: '#adcebf'
  on-primary-fixed: '#012017'
  on-primary-fixed-variant: '#2f4d42'
  secondary-fixed: '#ffdcc1'
  secondary-fixed-dim: '#ffb779'
  on-secondary-fixed: '#2e1500'
  on-secondary-fixed-variant: '#6c3a00'
  tertiary-fixed: '#b1f0ce'
  tertiary-fixed-dim: '#95d4b3'
  on-tertiary-fixed: '#002114'
  on-tertiary-fixed-variant: '#0e5138'
  background: '#fcf9ee'
  on-background: '#1c1c15'
  surface-variant: '#e5e2d8'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 2rem
    fontWeight: '700'
    lineHeight: 2.5rem
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 1.5rem
    fontWeight: '700'
    lineHeight: 2rem
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 1.5rem
    fontWeight: '600'
    lineHeight: 2rem
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 1.25rem
    fontWeight: '600'
    lineHeight: 1.75rem
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: 1.5rem
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.25rem
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '400'
    lineHeight: 1rem
    letterSpacing: 0.01em
  body-sm-bold:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '600'
    lineHeight: 1rem
    letterSpacing: 0.01em
  code-lg:
    fontFamily: JetBrains Mono
    fontSize: 0.875rem
    fontWeight: '600'
    lineHeight: 1.25rem
    letterSpacing: 0.02em
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 0.75rem
    fontWeight: '500'
    lineHeight: 1rem
    letterSpacing: 0.02em
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 0.6875rem
    fontWeight: '500'
    lineHeight: 0.875rem
    letterSpacing: 0.03em
  label-caps:
    fontFamily: Inter
    fontSize: 0.6875rem
    fontWeight: '700'
    lineHeight: 0.875rem
    letterSpacing: 0.06em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-mobile: 0.75rem
  margin: 1.5rem
  margin-mobile: 1rem
  space-2xs: 0.125rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
  space-2xl: 2rem
---

## Brand & Style

This design system delivers an industrial, high-density, mission-critical workspace built on the conviction that every physical asset carrying economic or operational value demands a persistent digital twin. Designed primarily for heavy commercial landscaping, field operations, and diversified fleet infrastructure, the interface prioritizes immediate situational awareness over decorative novelty.

The visual style is strictly Utilitarian Enterprise Modernism:
- Flat, tactile surfaces inspired by heavy field equipment nameplates, structural drafting documents, and weathered work logs.
- Absolute exclusion of ambient glassmorphism, decorative blurs, and chromatic gradients.
- High visual density, information chunking, and strict geometric alignment allowing operations managers, site supervisors, and field technicians to scan hundreds of assets, telemetry readings, and telemetry markers without layout fatigue.
- Deliberate dual-type system pairing an engineered sans-serif with a structural tabular monospace for unyielding alphanumeric clarity across asset IDs, hardware addresses, and telemetry stamps.

## Colors

The palette establishes an organic industrial dichotomy: deep, authoritative botanical greens grounded against warm, tactile paper substrates, anchored with heavy copper machine accents.

### Core Roles
- **Primary Deep Moss (`#16342A`)**: The structural anchor. Applied to dominant navigation, top-level headers, primary control buttons, high-priority icons, and structural focus frames.
- **Primary Hover / Focus (`#234D3F`)**: Direct interaction state for primary actionable elements.
- **Copper Accent (`#BE7C3E`)**: High-utility focus accent. Denotes telemetric links, highlighted asset badges, contextual callouts, and selected filter state indicators.
- **Warm Canvas Substrate (`#F1EEE3`)**: The primary screen background. Softens field eye-strain compared to clinical white while preserving an authentic, utilitarian paper feel.
- **White Surface (`#FFFFFF`)**: Card modules, data-table containers, flyout drawers, and segmented controls.
- **Secondary Warm Surface (`#E9E4D3`)**: Table headers, inactive pill backgrounds, sub-navigation strips, and docked metric rails.
- **Subtle Structural Border (`#DDD7C5`)**: The universal mechanical boundary line for dividers, cell walls, inputs, and container rims.

### Functional Status System
All status colors are strictly solid fills or low-chroma tinted surfaces with high-contrast text:
- **Active / Operational / In Spec (`#2D6A4F`)**: Health confirmation, online telematics, green-lit pre-start checklists.
- **Warning / Inspection Required (`#C87A1E`)**: Approaching maintenance thresholds, telematics deviations, geo-fence warnings.
- **Danger / Critical / Down (`#A83D2C`)**: Mechanical breakdowns, unassigned high-value movement, lockout/tagout statuses, critical sensor faults.
- **Primary Body Ink (`#1C1F1B`)**: Machine-stamped charcoal black for maximum contrast across data tables.
- **Muted Metadata Ink (`#55584F`)**: Secondary spec parameters, dimensional units, and micro labels.

## Typography

Typography functions as an analytical instrument. We establish two rigid typographical tracks:

1. **Analytical Sans (`Inter`)**: Governs interfaces, metadata, analytical tables, configuration panels, and high-level metric boards. Headlines enforce tightened tracking (`-0.02em`) to command presence without waste.
2. **Tabular Monospace (`JetBrains Mono`)**: Strict, non-proportional alignment for critical operational tokens: Asset IDs (`#AST-8842`), QR and RFID payload identifiers, hardware MAC addresses, telemetric serials, engine hour counters, runtime intervals, GPS coordinates, and timestamp logs. Monospaced characters guarantee that numerical columns align vertically down to the decimal point, preventing parallax scanning errors across large equipment rosters.

### Rules of Usage
- Metric and counter numbers must render with tabular figure variants enabled (`font-feature-settings: "tnum" 1`).
- All system status indicators, badges, and table column headers utilize `label-caps` in complete uppercase tracking to enforce immediate distinction from narrative asset descriptions.
- Dynamic asset tags and sensor reading values never fall below `code-sm` (`11px`), ensuring field-readability under direct sunlight on rugged mobile tablets.

## Layout & Spacing

The layout model is an ultra-structured, edge-conscious modular grid calibrated for high information throughput.

### Spatial Rhythm
- Base spacing is calibrated to a strict 4px / 8px scale.
- Components favor compact inner padding (`space-sm` and `space-md`) to present critical operational context (asset status, battery level, current job site, assigned crew member) above the digital fold without unnecessary scrolling.

### Grid & Breakpoints
- **Desktop (1280px and above)**: 12-column dynamic layout with `1.5rem` margins and `1rem` column gutters. Persistent dual-sidebar support (collapsed primary module spine at 64px, expandable asset tree panel at 280px).
- **Tablet / Rugged Toughpad (768px - 1279px)**: 8-column layout with `1rem` margins and gutters. Asset rosters switch from standard spread table rows into responsive dense card blocks.
- **Mobile Handheld (320px - 767px)**: 4-column layout with `1rem` edge margin and `0.75rem` gutters. Primary action dock anchored to the bottom thumb zone for single-handed barcode scanning and equipment status verification.

### Density Presets
- Tables and data views default to "Condensed" row height (36px per row) with single-line truncation and immediate monospaced reference keys.
- Sectional spacing never exceeds `space-2xl` (`2rem`), eliminating bloated aesthetic margins in favor of unified data visualization.

## Elevation & Depth

This design system deliberately eschews realistic shadows, blur diffusions, and multi-light skeuomorphic drops. In field software operating on standard and hardened outdoor displays, high-blur shadows translate into visual murk and reduced contrast.

Visual hierarchy is executed strictly through **Tonal Layering and Tactical Ghost Borders**:

### Elevation Hierarchy
- **Level 0 (Canvas Base)**: The unraised warm workspace substrate (`#F1EEE3`).
- **Level 1 (Surface Containers & Modules)**: Flat pure white (`#FFFFFF`) or secondary warm substrate (`#E9E4D3`) bounded by a single 1px solid border (`#DDD7C5`).
- **Level 2 (Dropdowns, Filter Sheets, Contextual Tooltips)**: Pure white (`#FFFFFF`) container bounded by a 1px solid structural border (`#DDD7C5`) paired with a minimal, crisp directional offset: `box-shadow: 0px 4px 0px 0px rgba(22, 52, 42, 0.08)`.
- **Level 3 (Modal Dialogs, Lockout Alerts, System Overlays)**: Crisp 1px boundary (`#16342A`) over an opaque tint barrier (`rgba(22, 52, 42, 0.60)`). Backdrop filters are strictly disabled to ensure optimal GPU performance across low-spec field tablets.

Every elevation tier relies on mechanical border delineation rather than depth illusion.

## Shapes

The shape architecture is engineered, precise, and contained. Geometric forms mirror stamped aluminum inspection tags, serial plates, and structural components.

- **Base Radius (`0.25rem` / 4px - 6px)**: Applied to input controls, inline code tags, compact buttons, dropdown selectors, and status chips.
- **Large Radius (`0.5rem` / 8px)**: Applied to equipment overview cards, split containers, data grid boundaries, and interactive map wrappers.
- **Pill Radius (`9999px`)**: Reserved exclusively for lifecycle indicators, field status pills, and user access roles (`Admin`, `Field Worker`, `Crew Supervisor`) to clearly decouple textual labels from interactive action triggers.
- **Circular (`50%`)**: Reserved strictly for telemetric pulse indicators, equipment connectivity beacons, and user profile monograms.

## Components

### Buttons
- **Primary**: Solid Deep Moss (`#16342A`) fill with `#FFFFFF` text. Hover transitions to `#234D3F`. Active press states trigger an inward 1px offset with zero shadow. Border-radius is 6px (`0.375rem`). Height is calibrated to 36px (desktop) and 44px (field mobile).
- **Secondary / Utility**: Solid Warm White (`#FFFFFF`) fill with `#1C1F1B` text and a continuous 1px `#DDD7C5` border. Hover changes surface to `#E9E4D3`.
- **Copper Operational**: Solid Copper (`#BE7C3E`) fill with `#FFFFFF` text. Reserved strictly for primary action workflows: "Assign Asset", "Deploy Fleet", "Scan QR Tag", or "Log Inspection".
- **Destructive**: Outlined or solid Danger Red (`#A83D2C`) for "Decommission", "Flag Lockout", or "Report Damaged".

### Status Pills & Role Badges
- **Status Pills**: Pill-shaped (`rounded-full`), 20px total height, horizontal padding of 8px. Incorporate a solid 6px circular dot indicator followed by text in `label-caps`.
  - *ACTIVE / IN SERVICE*: Background `#EAF2ED`, Text `#2D6A4F`, Dot `#2D6A4F`.
  - *ASSIGNED*: Background `#E5EFF6`, Text `#1E517B`, Dot `#1E517B`.
  - *AVAILABLE*: Background `#E9E4D3`, Text `#55584F`, Dot `#55584F`.
  - *IN MAINTENANCE*: Background `#FBF1E6`, Text `#C87A1E`, Dot `#C87A1E`.
  - *DAMAGED / LOCKOUT*: Background `#F7EAE8`, Text `#A83D2C`, Dot `#A83D2C`.
  - *RETIRED*: Background `#E1DDCF`, Text `#787C73`, Dot `#787C73`.
- **Role Badges**: Monospaced tags (`code-sm`) indicating enterprise user tier:
  - `ADMIN`: Inverted solid `#16342A` background with `#FFFFFF` text.
  - `OPERATIONS MANAGER`: Bordered `#16342A` stroke with `#16342A` text.
  - `SITE SUPERVISOR`: Solid `#E9E4D3` background with `#1C1F1B` text.
  - `MAINTENANCE TECH`: Solid `#FBF1E6` background with `#BE7C3E` text.
  - `FIELD WORKER`: 1px `#DDD7C5` border with `#55584F` text.

### Asset Identification Chips
- Inline micro-components displaying monospaced identifiers:
  - Formatted as `[ ICON | #AST-8842 ]` inside a 1px `#DDD7C5` bordered cell with `#FFFFFF` background.
  - Clicking automatically copies the clean identifier to the clipboard or expands telemetric quick-specs.

### Data Tables & Dense Lists
- Container features a 1px solid boundary (`#DDD7C5`) on `#FFFFFF` ground.
- Header row is 32px height, colored `#E9E4D3`, with labels set in `label-caps` (`#55584F`).
- Body rows are 36px uniform height with alternating row hover (`#F7F5EE`).
- Vertical divider lines use 1px solid `#DDD7C5` between critical data cells (e.g., separating Asset ID, Current Location, Engine Hours, and Status).

### Input Fields & Selectors
- Standard height: 36px.
- Background: `#FFFFFF`. Border: 1px solid `#DDD7C5`.
- Active/Focus: Border transitions to 1.5px solid `#16342A` with no outer glow.
- Monospaced inputs: Asset search, barcode inputs, and telemetry threshold fields automatically render typed input in `JetBrains Mono`.

### Inspection & Telemetric Cards
- Compact modules encapsulated in 1px `#DDD7C5` borders on `#FFFFFF` surfaces.
- Card Header: 36px height, divided from body by a 1px `#DDD7C5` horizontal line. Contains thumbnail slot, Asset Name (`body-sm-bold`), and Status Pill.
- Card Body: Grid of key-value pairs (e.g., *S/N*, *Crew*, *Next Service*, *Hours*) rendered with `label-caps` for the key and `code-md` for the value.