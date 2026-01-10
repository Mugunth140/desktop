# MotorMods Billing & Inventory Management System
## Complete Specification Document

---

## PROJECT OVERVIEW

**Project Name:** MotorMods  
**Client:** Auto Parts Store (Tiruppur, Tamil Nadu)  
**Tech Stack:** Tauri + React + SQLite  
**Current State:** Has billing, inventory, reports; needs sales returns, analytics, backup improvements  
**Objective:** Enhance with missing features, improve UX/design consistency, add analytics with configurable thresholds

---

## FEATURE SPECIFICATIONS

### 1. BILLING MODULE (No GST - CURRENT)
**Status:** ✅ Implemented

**Current Features:**
- Invoice creation with customer selection
- Item search by part number, name, brand
- Quantity, rate, line discounts
- Subtotal, discount, grand total (no GST breakdown)
- Payment modes: Cash, Cheque, Card, UPI, Credit
- Thermal printer integration (80mm width)
- Invoice numbering with sequence

**Enhancements Needed:**
- ✅ Keep as-is (working well)

---

### 2. SALES RETURNS (MISSING - HIGH PRIORITY)
**Status:** ❌ Not Implemented

**Features to Add:**
- **Return creation screen:**
  - Link to original invoice (search by invoice number/date)
  - Prefill customer and original items
  - Allow selecting subset of items to return
  - Auto-calculate refund amount
  - Reason field: dropdown with options (Damage, Wrong Part, Customer Request, Defective, Other)
  - Return quantity validation (cannot exceed original qty)
  - Add notes/remarks field

- **Return processing:**
  - Mark as "Return" or "Credit Note" on invoice
  - Stock increases by return qty for each item
  - Create reverse invoice entry for accounting
  - Store original invoice reference

- **Return management:**
  - View return list with date, invoice#, customer, amount
  - Edit/modify returns (if within grace period, e.g., 24 hours)
  - Cancel return (revert stock)
  - Print return note/credit slip

**Database Changes:**
```sql
-- Add to invoices table if not present:
ALTER TABLE invoices ADD COLUMN is_return BOOLEAN DEFAULT 0;
ALTER TABLE invoices ADD COLUMN original_invoice_id INTEGER;
ALTER TABLE invoices ADD COLUMN return_reason TEXT;

-- Create sales_returns table for detailed tracking:
CREATE TABLE sales_returns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_no TEXT UNIQUE NOT NULL,
  invoice_id INTEGER NOT NULL,
  return_date DATETIME NOT NULL,
  reason TEXT NOT NULL,
  total_amount REAL NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);

CREATE TABLE return_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  rate REAL NOT NULL,
  line_total REAL NOT NULL,
  FOREIGN KEY (return_id) REFERENCES sales_returns(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE INDEX idx_sales_returns_invoice_id ON sales_returns(invoice_id);
CREATE INDEX idx_sales_returns_return_date ON sales_returns(return_date);
CREATE INDEX idx_return_items_return_id ON return_items(return_id);
```

**UI Components:**
- `SalesReturnForm.tsx` - Main form for creating returns
- `ReturnList.tsx` - View all returns, filters by date/customer
- `ReturnDetail.tsx` - View return details, print return slip
- `ReturnReasonSelect.tsx` - Dropdown with reason options

---

### 3. INVENTORY MANAGEMENT (CURRENT)
**Status:** ✅ Partially Implemented

**Current Features:**
- Item master (CRUD)
- Stock tracking
- Basic adjustments (manual add/reduce)

**Enhancements Needed:**
- ✅ Add stock adjustment history/audit log (see Stock Adjustments section below)
- ✅ Improve search performance
- ✅ Add barcode field support (for future barcode scanner integration)

---

### 4. STOCK ADJUSTMENTS (PARTIAL - NEEDS ENHANCEMENT)
**Status:** ⚠️ Partially Implemented

**Current State:**
- Manual stock add/reduce works
- Missing: Audit trail, history view, reason tracking

**Features to Add:**
- **Reason tracking:**
  - Dropdown: `opening_stock`, `manual_add`, `manual_deduction`, `supplier_return`, `damage_write_off`, `other`
  - Required reason field with optional notes

- **Adjustment history:**
  - View all past adjustments per item
  - Columns: Date, Item, Type, Qty, Reason, Notes, User
  - Filter by date range, item, reason type
  - Export capability

- **Audit trail:**
  - Track who made the adjustment (username if multi-user)
  - Timestamp for all adjustments
  - Cannot delete adjustments (only add offset adjustment if needed)

**Database Schema (if not present):**
```sql
CREATE TABLE stock_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  adjustment_type TEXT NOT NULL,
  -- opening_stock, manual_add, manual_deduction, supplier_return, damage_write_off, other
  quantity INTEGER NOT NULL,
  notes TEXT,
  created_by TEXT DEFAULT 'system',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE INDEX idx_stock_adjustments_item_id ON stock_adjustments(item_id);
CREATE INDEX idx_stock_adjustments_date ON stock_adjustments(created_at);
```

**UI Components:**
- `StockAdjustmentForm.tsx` - Create new adjustment
- `StockAdjustmentHistory.tsx` - View all adjustments (paginated, searchable)
- `AdjustmentAuditLog.tsx` - Detailed audit trail view

---

### 5. ANALYTICS & REPORTS (MISSING - HIGH PRIORITY)

#### 5.1 Low Stock Analysis
**Status:** ⚠️ Partially Implemented (likely basic only)

**Features:**
- **Configurable threshold:**
  - Settings → Inventory Tab
  - "Low Stock Threshold Method" - Select:
    - Option A: Per-item reorder_level (already in DB)
    - Option B: Global percentage (e.g., "Alert when stock < 20% of max_stock")
    - Option C: Days of supply (e.g., "Alert when stock < 15 days of avg daily sales")
  - Store selected method in `settings` table

- **Low Stock Report Page:**
  - Columns: Part#, Name, Brand, Vehicle Model, Current Stock, Reorder Level, Last Qty Sold, Stock Value (qty × cost), Days to Stockout
  - Filters: Brand, Vehicle Model, Stock Status (Critical/Low/Adequate)
  - Sorting: By stock qty, by days to stockout, by stock value
  - Color coding: Red (critical), Orange (low), Green (adequate)
  - Export: Excel, PDF
  - Print: Formatted list for ordering reference

**Database Requirements:**
```sql
-- Add to items table if not present:
ALTER TABLE items ADD COLUMN max_stock INTEGER;
ALTER TABLE items ADD COLUMN reorder_level INTEGER DEFAULT 0;

-- Settings to add:
INSERT OR IGNORE INTO settings (key, value) VALUES 
  ('low_stock_method', 'reorder_level'),
  ('low_stock_percentage', '20'),
  ('low_stock_days_supply', '15');
```

**UI Components:**
- `LowStockReport.tsx` - Main report page
- `LowStockFilters.tsx` - Filters sidebar
- `LowStockTable.tsx` - Sortable table with export
- `LowStockAlert.tsx` - Dashboard widget showing count

---

#### 5.2 Non-Moving Items Analysis
**Status:** ❌ Not Implemented

**Features:**
- **Configurable threshold:**
  - Settings → Analytics Tab
  - "Non-Moving Item Threshold (days)" - Default: 120 days, Range: 30-365 days
  - User can adjust: "Mark items as non-moving if no sale for X days"
  - Store in `settings` table as `non_moving_threshold_days`

- **Non-Moving Items Report Page:**
  - Show items where `last_sale_date IS NULL OR last_sale_date <= (TODAY - threshold_days)`
  - Calculate `days_since_last_sale = TODAY - last_sale_date`
  - Columns: Part#, Name, Brand, Current Stock, Stock Value (qty × cost), Days Since Sale, FSN Classification
  - FSN Classifications (color badges):
    - **F (Fast)**: Sold in last 30 days → Green
    - **S (Slow)**: Last sold 31 - threshold days ago → Orange
    - **N (Non-moving)**: Not sold in > threshold days → Red
  - Filters: FSN classification, stock value range, days range
  - Sorting: By days, by qty, by stock value
  - Action buttons: Mark for clearance, Archive item, Reduce price
  - Export: Excel, PDF

- **Stock Value Calculation:**
  - Formula: `current_stock × purchase_price`
  - Highlights money blocked in slow-moving inventory

**Database Requirements:**
```sql
-- Add to items table:
ALTER TABLE items ADD COLUMN last_sale_date DATETIME;
ALTER TABLE items ADD COLUMN fsn_classification TEXT;
-- fsn_classification: auto-calculated, values: 'F', 'S', 'N'

-- Add settings:
INSERT OR IGNORE INTO settings (key, value) VALUES 
  ('non_moving_threshold_days', '120');

-- Add function to calculate/update last_sale_date:
-- Trigger on invoice_items insert/update to set item.last_sale_date = today
-- Function to recalculate FSN for all items (run daily or on-demand)
```

**Trigger Logic (Pseudo-code):**
```sql
-- After insert on invoice_items (only for non-return invoices):
UPDATE items 
SET last_sale_date = CURRENT_DATE 
WHERE id = NEW.item_id 
  AND NOT EXISTS (
    SELECT 1 FROM invoices WHERE id = NEW.invoice_id AND is_return = 1
  );
```

**UI Components:**
- `NonMovingItemsReport.tsx` - Main report page
- `NonMovingFilters.tsx` - FSN filters, date range, stock value range
- `FSNBadge.tsx` - Color-coded F/S/N badge component
- `NonMovingActions.tsx` - Bulk actions (archive, clearance mark)
- `NonMovingChart.tsx` - Pie chart showing F vs S vs N distribution

---

#### 5.3 Sales Reports (CURRENT - CHECK IMPLEMENTATION)
**Status:** ✅ Likely Implemented

**Daily Sales Report:**
- Date range picker
- Total bills, total qty, total sales, payment mode breakdown
- Top 10 items by qty/revenue
- Printable format

**Monthly Sales Report:**
- Month selector
- Month-wise summary (month, total sales, bill count, avg bill)
- Chart: Sales trend line
- Comparison to prev month

**Yearly Sales Report:**
- Year selector or range
- Year-wise totals with monthly breakdown
- Chart: Monthly distribution bar chart
- YoY comparison if multiple years selected

**Enhancements Needed:**
- ✅ If working well, keep as-is
- ⚠️ Verify date grouping accuracy in SQLite (use strftime)
- ⚠️ Add filtering by payment mode, customer type (optional)

**SQL Patterns for Reference:**
```sql
-- Daily
SELECT 
  DATE(i.date) as sale_date,
  COUNT(i.id) as total_bills,
  SUM(ii.quantity) as total_qty,
  SUM(i.grand_total) as total_sales,
  GROUP_CONCAT(i.payment_mode) as payment_modes
FROM invoices i
LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
WHERE i.is_return = 0
  AND DATE(i.date) BETWEEN ? AND ?
GROUP BY DATE(i.date)
ORDER BY sale_date DESC;

-- Monthly
SELECT 
  STRFTIME('%Y-%m', i.date) as month,
  COUNT(i.id) as total_bills,
  SUM(ii.quantity) as total_qty,
  SUM(i.grand_total) as total_sales
FROM invoices i
LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
WHERE i.is_return = 0
  AND STRFTIME('%Y-%m', i.date) BETWEEN ? AND ?
GROUP BY STRFTIME('%Y-%m', i.date)
ORDER BY month DESC;

-- Yearly
SELECT 
  STRFTIME('%Y', i.date) as year,
  COUNT(i.id) as total_bills,
  SUM(ii.quantity) as total_qty,
  SUM(i.grand_total) as total_sales
FROM invoices i
LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
WHERE i.is_return = 0
GROUP BY STRFTIME('%Y', i.date)
ORDER BY year DESC;
```

---

### 6. BACKUP & RESTORE (PARTIAL - NEEDS ENHANCEMENT)
**Status:** ⚠️ Partially Implemented

**Current State:**
- Basic backup service (likely daily)
- No manual restore UI
- No retention cleanup

**Features to Add:**

**Daily Auto-Backup:**
- Scheduled at: 11 PM daily (configurable in settings)
- File naming: `motormods_backup_YYYY-MM-DD_HHMM.db`
- Location: `{app_data_dir}/backups/`
- Auto-delete backups older than 30 days (configurable: 7, 14, 30, 60 days)
- Silent operation (no interruption)
- Log each backup in DB for audit

**Manual Backup:**
- UI button in Settings → Backup Tab
- "Backup Now" → File picker for destination
- Create backup with timestamp
- Show success message with file size & location

**Restore Functionality:**
- "Restore from Backup" button in Settings
- File picker to select backup file
- Preview: Backup date, file size, items in backup (if metadata available)
- **Confirmation dialog:** "⚠️ WARNING: All current data will be replaced with backup from [DATE]. This cannot be undone. Continue?"
- On confirm:
  - Close all DB connections
  - Replace `motormods.db` with selected backup
  - Clear React cache
  - Restart app or show "Please restart app to complete restore"
  - Log restore action with timestamp, file name, user

**Backup Dashboard:**
- Last backup date & time (auto & manual)
- Next scheduled backup
- List of recent backups (last 10)
  - Columns: Date, Size, Type (Auto/Manual), Status
  - Action: View details, Restore, Delete, Download
- Backup settings:
  - Auto-backup frequency: Daily (time picker) / Weekly (day+time) / Disabled
  - Retention: 7, 14, 30, 60 days
  - Manual backup destination (default vs custom folder)

**Database Updates:**
```sql
-- Add backup log table:
CREATE TABLE backup_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  backup_file TEXT NOT NULL,
  backup_date DATETIME NOT NULL,
  backup_type TEXT DEFAULT 'auto',
  -- auto, manual
  file_size INTEGER,
  status TEXT DEFAULT 'success',
  -- success, failed
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Add settings:
INSERT OR IGNORE INTO settings (key, value) VALUES 
  ('auto_backup_enabled', '1'),
  ('auto_backup_time', '23:00'),
  ('backup_retention_days', '30');
```

**UI Components:**
- `BackupSettings.tsx` - Backup configuration & dashboard
- `BackupsList.tsx` - List of backups with actions
- `RestoreDialog.tsx` - Confirmation & restore progress
- `ManualBackupButton.tsx` - Quick backup button

---

## DATABASE SCHEMA - COMPLETE

### Current Tables (Keep as-is if working)
```sql
-- Assumed to exist already
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'staff',
  active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  part_number TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  brand TEXT,
  vehicle_model TEXT,
  oem_code TEXT,
  unit TEXT DEFAULT 'piece',
  purchase_price REAL DEFAULT 0,
  selling_price REAL NOT NULL,
  current_stock INTEGER DEFAULT 0,
  reorder_level INTEGER DEFAULT 0,
  max_stock INTEGER,
  location TEXT,
  supplier_name TEXT,
  barcode TEXT,
  last_sale_date DATETIME,
  fsn_classification TEXT,
  active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  vehicle_number TEXT,
  address TEXT,
  city TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no TEXT UNIQUE NOT NULL,
  date DATETIME NOT NULL,
  customer_id INTEGER,
  subtotal REAL DEFAULT 0,
  discount_amount REAL DEFAULT 0,
  grand_total REAL NOT NULL,
  payment_mode TEXT DEFAULT 'cash',
  payment_status TEXT DEFAULT 'paid',
  notes TEXT,
  is_return BOOLEAN DEFAULT 0,
  original_invoice_id INTEGER,
  return_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (original_invoice_id) REFERENCES invoices(id)
);

CREATE TABLE invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  rate REAL NOT NULL,
  discount_amount REAL DEFAULT 0,
  line_total REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id)
);
```

### New Tables Required (Add)
```sql
-- Stock adjustments audit
CREATE TABLE stock_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  adjustment_type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  notes TEXT,
  created_by TEXT DEFAULT 'system',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES items(id)
);

-- Sales returns tracking
CREATE TABLE sales_returns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_no TEXT UNIQUE NOT NULL,
  invoice_id INTEGER NOT NULL,
  return_date DATETIME NOT NULL,
  reason TEXT NOT NULL,
  total_amount REAL NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);

CREATE TABLE return_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  rate REAL NOT NULL,
  line_total REAL NOT NULL,
  FOREIGN KEY (return_id) REFERENCES sales_returns(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id)
);

-- Backup audit log
CREATE TABLE backup_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  backup_file TEXT NOT NULL,
  backup_date DATETIME NOT NULL,
  backup_type TEXT DEFAULT 'auto',
  file_size INTEGER,
  status TEXT DEFAULT 'success',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Settings table (if not present)
CREATE TABLE settings (
  id INTEGER PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Indexes (Add)
```sql
CREATE INDEX idx_invoices_date ON invoices(date);
CREATE INDEX idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_item_id ON invoice_items(item_id);
CREATE INDEX idx_items_part_number ON items(part_number);
CREATE INDEX idx_items_brand ON items(brand);
CREATE INDEX idx_items_last_sale_date ON items(last_sale_date);
CREATE INDEX idx_stock_adjustments_item_id ON stock_adjustments(item_id);
CREATE INDEX idx_stock_adjustments_date ON stock_adjustments(created_at);
CREATE INDEX idx_sales_returns_invoice_id ON sales_returns(invoice_id);
CREATE INDEX idx_sales_returns_date ON sales_returns(return_date);
CREATE INDEX idx_return_items_return_id ON return_items(return_id);
CREATE INDEX idx_backup_log_date ON backup_log(backup_date);
```

---

## DESIGN SYSTEM

### Color Palette
**Primary:** Teal `#218 08D` or `rgb(33, 128, 141)`  
**Secondary:** Brown/Gray `#5E5240` or `rgb(94, 82, 64)`  
**Success:** Green `#22C55E` or `rgb(34, 197, 94)`  
**Warning/Low Stock:** Orange `#E68 161` or `rgb(230, 129, 97)`  
**Error/Critical:** Red `#C01 52F` or `rgb(192, 21, 47)`  
**Background:** Cream `#FCFCC 9` or `rgb(252, 252, 249)`  
**Text Primary:** Charcoal `#1F 2121` or `rgb(31, 33, 33)`  
**Text Secondary:** Gray `#6 26C 71` or `rgb(98, 108, 113)`  

**Note:** If current app uses indigo/slate, update color tokens to teal palette.

### Typography
- **Headings (h1-h6):** Inter, weight 600, sizes 32px → 16px
- **Body:** Inter, weight 400, 14px
- **Small/Labels:** Inter, weight 400, 12-13px
- **Mono (Numbers):** JetBrains Mono, 13px

### Spacing
- Base: 8px (multiples: 4, 8, 12, 16, 24, 32, 48px)
- Card padding: 16px
- Input height: 40px
- Button height: 40px

### Components
- Buttons: Rounded 6px, hover/active color transitions
- Inputs: Border-only, focus ring 3px teal
- Tables: Striped rows, sticky headers, hover highlight
- Cards: Subtle shadow, light border
- Modals: Overlay + focus trap, close button (X) top-right
- Alerts: Toasts top-right, 4s auto-dismiss

---

## CONFIGURABLE THRESHOLDS (Settings Panel)

**Inventory → Low Stock:**
- Method: Reorder Level (per-item) / Global % / Days of Supply
- Global %: 0-100, default 20
- Days of Supply: 1-30 days, default 15

**Analytics → Non-Moving Items:**
- Threshold: 30-365 days, default 120 days

**Backup → Retention:**
- Days: 7, 14, 30, 60 days (dropdown), default 30
- Auto-backup time: Time picker, default 23:00

**Backup → Frequency:**
- Option: Daily / Weekly / Disabled
- If Weekly: Select day + time

---

## IMPLEMENTATION PRIORITY

**Phase 1 (Immediate - Week 1):**
1. Add `sales_returns` table & related logic
2. Build SalesReturnForm & ReturnList UI
3. Stock reversal on return confirmation
4. Test returns workflow

**Phase 2 (Week 2):**
1. Add `stock_adjustments` table & history tracking
2. Implement audit log view
3. Add reason dropdown to adjustments
4. Track created_by user

**Phase 3 (Week 3):**
1. Implement LowStockReport with configurable thresholds
2. Add FSN classification logic for non-moving items
3. Implement NonMovingItemsReport with filters/charts
4. Add settings UI for thresholds

**Phase 4 (Week 4):**
1. Enhance backup system: 30-day retention, cleanup
2. Add manual backup UI & file picker
3. Implement restore dialog with confirmation
4. Create backup settings dashboard
5. Test backup/restore cycles

**Phase 5 (Ongoing):**
1. Update color scheme from indigo to teal
2. Improve responsive design
3. Performance optimization (indexes, pagination)
4. User testing & refinement

---

## TESTING CHECKLIST

- [ ] Sales return flow (create, print, stock reversal)
- [ ] Stock adjustment history (add, view, filter by type)
- [ ] Low stock report (with different threshold methods)
- [ ] Non-moving items (FSN classification accuracy, filter/sort)
- [ ] Sales reports (daily/monthly/yearly calculations correct)
- [ ] Daily auto-backup (runs at scheduled time)
- [ ] Manual backup (creates file, stores metadata)
- [ ] Restore (replaces DB correctly, app restarts)
- [ ] Backup retention (deletes files older than retention days)
- [ ] Color scheme updates (all UI uses teal primary)
- [ ] Edge cases (no sales data, empty returns, concurrent backup)

---

## DELIVERY CHECKLIST

- [ ] All new tables & indexes created
- [ ] Sales returns feature fully working
- [ ] Stock adjustments with audit log
- [ ] Analytics reports with configurable thresholds
- [ ] Backup & restore fully functional
- [ ] Design system updated (teal colors)
- [ ] All components tested
- [ ] Documentation updated
- [ ] User guide with new features
- [ ] Release notes prepared
