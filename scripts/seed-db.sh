#!/usr/bin/env bash
set -euo pipefail

# Possible DB locations (Linux-focused). Add more paths if needed.
DB_CANDIDATES=(
  "./motormods.db"
  "$PWD/motormods.db"
  "${XDG_DATA_HOME:-$HOME/.local/share}/com.motormods.billing/databases/motormods.db"
  "${XDG_DATA_HOME:-$HOME/.local/share}/com.motormods.billing/motormods.db"
  "$HOME/.config/com.motormods.billing/motormods.db"
  "$HOME/.config/com.zendex.desktop/motormods.db"
)

DB_PATH=""
for p in "${DB_CANDIDATES[@]}"; do
  if [ -f "$p" ]; then
    DB_PATH="$p"
    break
  fi
done

if [ -z "$DB_PATH" ]; then
  echo "No motormods DB found. Looked in:"
  for p in "${DB_CANDIDATES[@]}"; do echo "  - $p"; done
  echo "If your DB is elsewhere, pass it as the first argument: ./scripts/seed-db.sh /path/to/motormods.db"
  exit 1
fi

if [ "$#" -ge 1 ]; then
  DB_PATH="$1"
fi

echo "Seeding database at: $DB_PATH"

echo "Ensuring tables exist..."
sqlite3 "$DB_PATH" <<'SQL'
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT,
  category TEXT,
  price REAL NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  discount_amount REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS invoice_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price REAL NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(invoice_id) REFERENCES invoices(id),
  FOREIGN KEY(product_id) REFERENCES products(id)
);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
SQL

PRODUCT_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM products;" || echo 0)
if [ "$PRODUCT_COUNT" -gt 0 ]; then
  echo "Products table already has $PRODUCT_COUNT rows — skipping product seed."
else
  echo "Seeding products..."
  sqlite3 "$DB_PATH" <<'SQL'
BEGIN;
INSERT OR IGNORE INTO products (id, name, sku, category, price, quantity) VALUES
('p1','Motul 7100 10W50 1L','OIL-M-7100-10W50','Oils',850.00,24),
('p2','Motul 300V 10W40 1L','OIL-M-300V-10W40','Oils',1100.00,12),
('p3','NGK Iridium Spark Plug CR9EIX','SP-NGK-CR9EIX','Spark Plugs',650.00,50),
('p4','Brembo Brake Pads (Front) - KTM 390','BP-BREM-KTM390-F','Brake Pads',2400.00,8),
('p5','K&N Air Filter - Kawasaki Z900','AF-KN-Z900','Filters',5500.00,3),
('p6','Chain Lube - Motul C2','LUBE-M-C2','Maintenance',450.00,30),
('p7','Chain Clean - Motul C1','CLEAN-M-C1','Maintenance',420.00,25),
('p8','Pirelli Diablo Rosso III 110/70 R17','TYRE-P-DR3-110','Tyres',9500.00,4),
('p9','Pirelli Diablo Rosso III 150/60 R17','TYRE-P-DR3-150','Tyres',11500.00,4),
('p10','Mobile Phone Holder (Aluminum)','ACC-PH-AL','Accessories',850.00,15),
('p11','USB Charger Waterproof','ACC-USB-WP','Accessories',600.00,20),
('p12','Helmet Cleaner Spray','ACC-HELM-CL','Accessories',350.00,18),
('p13','Castrol Power1 4T 10W40 1L','OIL-C-P1-10W40','Oils',720.00,35),
('p14','Shell Advance Ultra 10W40 1L','OIL-SH-ADV-10W40','Oils',680.00,28),
('p15','Bosch Spark Plug - Universal','SP-BOSCH-UNI','Spark Plugs',280.00,60),
('p16','EBC Brake Pads (Rear) - RE 350','BP-EBC-RE350-R','Brake Pads',1800.00,10),
('p17','Michelin Pilot Street 90/90 R17','TYRE-MIC-PS-90','Tyres',3200.00,6),
('p18','Michelin Pilot Street 110/80 R17','TYRE-MIC-PS-110','Tyres',3800.00,6),
('p19','MRF Nylogrip Plus 2.75-18','TYRE-MRF-NP-275','Tyres',2100.00,8),
('p20','Ceat Zoom 100/90 R17','TYRE-CEAT-ZM-100','Tyres',2800.00,5),
('p21','Bike Cover - Large (Waterproof)','ACC-COVER-L','Accessories',1200.00,12),
('p22','Disc Lock with Alarm','ACC-LOCK-ALARM','Accessories',1500.00,8),
('p23','LED Headlight Bulb H4','LIGHT-LED-H4','Lighting',950.00,22),
('p24','Bar End Mirror Set','ACC-MIRROR-BAR','Accessories',1800.00,7),
('p25','Riding Gloves - Full Finger','GEAR-GLOVE-FF','Gear',2200.00,14),
('p26','Brake Fluid DOT 4 500ml','FLUID-BF-DOT4','Fluids',380.00,40),
('p27','Coolant - Long Life 1L','FLUID-COOL-LL','Fluids',420.00,32),
('p28','Battery Terminal Cleaner','MAINT-BAT-CLN','Maintenance',180.00,25),
('p29','Multi-Tool Kit 17-in-1','TOOL-MULTI-17','Tools',680.00,15),
('p30','Tire Pressure Gauge Digital','TOOL-GAUGE-DIG','Tools',550.00,11);
COMMIT;
SQL
  echo "Products seeded."
fi

INVOICE_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM invoices;" || echo 0)
if [ "$INVOICE_COUNT" -gt 0 ]; then
  echo "Invoices table already has $INVOICE_COUNT rows — skipping invoice seed."
else
  echo "Seeding invoices and invoice items..."
  sqlite3 "$DB_PATH" <<'SQL'
BEGIN;
INSERT OR IGNORE INTO invoices (id, customer_name, discount_amount, total_amount, created_at) VALUES
('inv-001','Rajesh Kumar',0,3150.00, datetime('now','-2 hours')),
('inv-002','Walking Customer',0,1270.00, datetime('now','-1 hours')),
('inv-003','Priya Sharma',0,21000.00, datetime('now','-30 minutes')),
('inv-004','Amit Singh',0,2400.00, datetime('now','-1 days','-5 hours')),
('inv-005','Sneha Patel',0,8300.00, datetime('now','-1 days','-3 hours')),
('inv-006','Walking Customer',0,1800.00, datetime('now','-3 days')),
('inv-007','Vikram Mehta',0,6100.00, datetime('now','-3 days','-2 hours')),
('inv-008','Anita Desai',0,7400.00, datetime('now','-5 days')),
('inv-009','Rohan Gupta',0,4900.00, datetime('now','-5 days','-4 hours')),
('inv-010','Meera Iyer',0,5480.00, datetime('now','-7 days')),
('inv-011','Karthik Reddy',0,3730.00, datetime('now','-10 days')),
('inv-012','Walking Customer',0,3650.00, datetime('now','-10 days','-3 hours')),
('inv-013','Deepak Joshi',0,6280.00, datetime('now','-15 days')),
('inv-014','Sunita Agarwal',0,2650.00, datetime('now','-20 days')),
('inv-015','Arjun Malhotra',0,12300.00, datetime('now','-20 days','-5 hours'));

-- Invoice items (matching the sample set used in the front-end seed)
INSERT OR IGNORE INTO invoice_items (id, invoice_id, product_id, quantity, price) VALUES
('item-001-1','inv-001','p1',2,850.00),
('item-001-2','inv-001','p6',3,450.00),
('item-001-3','inv-001','p3',1,650.00),
('item-002-1','inv-002','p7',1,420.00),
('item-002-2','inv-002','p10',1,850.00),
('item-003-1','inv-003','p8',1,9500.00),
('item-003-2','inv-003','p9',1,11500.00),
('item-004-1','inv-004','p4',1,2400.00),
('item-005-1','inv-005','p2',2,1100.00),
('item-005-2','inv-005','p5',1,5500.00),
('item-005-3','inv-005','p6',1,450.00),
('item-005-4','inv-005','p3',1,650.00),
('item-006-1','inv-006','p11',3,600.00),
('item-007-1','inv-007','p17',1,3200.00),
('item-007-2','inv-007','p13',4,720.00),
('item-008-1','inv-008','p18',1,3800.00),
('item-008-2','inv-008','p16',2,1800.00),
('item-009-1','inv-009','p19',2,2100.00),
('item-009-2','inv-009','p12',2,350.00),
('item-010-1','inv-010','p20',1,2800.00),
('item-010-2','inv-010','p21',1,1200.00),
('item-010-3','inv-010','p22',1,1500.00),
('item-011-1','inv-011','p23',2,950.00),
('item-011-2','inv-011','p24',1,1800.00),
('item-012-1','inv-012','p14',4,680.00),
('item-012-2','inv-012','p26',3,380.00),
('item-012-3','inv-012','p27',2,420.00),
('item-013-1','inv-013','p25',2,2200.00),
('item-013-2','inv-013','p29',2,680.00),
('item-013-3','inv-013','p30',1,550.00),
('item-013-4','inv-013','p28',1,180.00),
('item-014-1','inv-014','p1',3,850.00),
('item-014-2','inv-014','p15',2,280.00),
('item-015-1','inv-015','p8',1,9500.00),
('item-015-2','inv-015','p20',1,2800.00);
COMMIT;
SQL
  echo "Invoices seeded."
fi

echo "Seeding complete. Products: $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM products;"), Invoices: $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM invoices;")"
exit 0
