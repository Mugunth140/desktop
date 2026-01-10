# Sample Data Seeded

The database is automatically seeded with sample data when you first run the application.

## Products (30 items)

### Engine Oils
- Motul 7100 10W50 1L - ₹850 (24 units)
- Motul 300V 10W40 1L - ₹1,100 (12 units)
- Castrol Power1 4T 10W40 1L - ₹720 (35 units)
- Shell Advance Ultra 10W40 1L - ₹680 (28 units)

### Spark Plugs
- NGK Iridium Spark Plug CR9EIX - ₹650 (50 units)
- Bosch Spark Plug - Universal - ₹280 (60 units)

### Brake Pads
- Brembo Brake Pads (Front) - KTM 390 - ₹2,400 (8 units)
- EBC Brake Pads (Rear) - RE 350 - ₹1,800 (10 units)

### Air Filters
- K&N Air Filter - Kawasaki Z900 - ₹5,500 (3 units)

### Chain Maintenance
- Chain Lube - Motul C2 - ₹450 (30 units)
- Chain Clean - Motul C1 - ₹420 (25 units)

### Tyres
- Pirelli Diablo Rosso III 110/70 R17 - ₹9,500 (4 units)
- Pirelli Diablo Rosso III 150/60 R17 - ₹11,500 (4 units)
- Michelin Pilot Street 90/90 R17 - ₹3,200 (6 units)
- Michelin Pilot Street 110/80 R17 - ₹3,800 (6 units)
- MRF Nylogrip Plus 2.75-18 - ₹2,100 (8 units)
- Ceat Zoom 100/90 R17 - ₹2,800 (5 units)

### Accessories
- Mobile Phone Holder (Aluminum) - ₹850 (15 units)
- USB Charger Waterproof - ₹600 (20 units)
- Helmet Cleaner Spray - ₹350 (18 units)
- Bike Cover - Large (Waterproof) - ₹1,200 (12 units)
- Disc Lock with Alarm - ₹1,500 (8 units)
- LED Headlight Bulb H4 - ₹950 (22 units)
- Bar End Mirror Set - ₹1,800 (7 units)

### Riding Gear
- Riding Gloves - Full Finger - ₹2,200 (14 units)

### Fluids
- Brake Fluid DOT 4 500ml - ₹380 (40 units)
- Coolant - Long Life 1L - ₹420 (32 units)

### Maintenance
- Battery Terminal Cleaner - ₹180 (25 units)

### Tools
- Multi-Tool Kit 17-in-1 - ₹680 (15 units)
- Tire Pressure Gauge Digital - ₹550 (11 units)

---

## Sample Invoices (15 transactions)

### Today's Transactions
1. **Rajesh Kumar** - ₹3,150 (2 hours ago)
   - 2x Motul 7100 10W50
   - 3x Chain Lube
   - 1x NGK Spark Plug

2. **Walking Customer** - ₹1,270 (1 hour ago)
   - 1x Chain Clean
   - 1x Mobile Phone Holder

3. **Priya Sharma** - ₹21,000 (30 minutes ago)
   - 1x Pirelli Diablo Rosso III 110/70
   - 1x Pirelli Diablo Rosso III 150/60

### Yesterday's Transactions
4. **Amit Singh** - ₹2,400
   - 1x Brembo Brake Pads

5. **Sneha Patel** - ₹8,300
   - 2x Motul 300V
   - 1x K&N Air Filter
   - 1x Chain Lube
   - 1x NGK Spark Plug

### Past Week (3-7 days ago)
6. **Walking Customer** - ₹1,800 (3 days ago)
7. **Vikram Mehta** - ₹6,100 (3 days ago)
8. **Anita Desai** - ₹7,400 (5 days ago)
9. **Rohan Gupta** - ₹4,900 (5 days ago)
10. **Meera Iyer** - ₹5,480 (7 days ago)

### Past 2-3 Weeks
11. **Karthik Reddy** - ₹3,730 (10 days ago)
12. **Walking Customer** - ₹3,650 (10 days ago)
13. **Deepak Joshi** - ₹6,280 (15 days ago)
14. **Sunita Agarwal** - ₹2,650 (20 days ago)
15. **Arjun Malhotra** - ₹12,300 (20 days ago)

---

## Revenue Summary

- **Total Revenue**: ₹90,130
- **Total Invoices**: 15
- **Today's Revenue**: ₹25,420 (3 invoices)
- **Average Transaction**: ₹6,008.67

---

## How Seeding Works

1. **Products**: Seeded only if the products table is empty
2. **Invoices**: Seeded only if the invoices table is empty
3. **First Run**: Both will be seeded automatically on first launch
4. **Subsequent Runs**: If data exists, seeding is skipped

To reset and reseed data:
1. Delete the database file (check app data directory)
2. Restart the application

---

## Notes

- All sample invoices use realistic Indian customer names
- Invoice dates are spread across the last 20 days for realistic reporting
- Sample data does NOT deduct from product quantities (uses special seed method)
- Transactions include a mix of "Walking Customer" and named customers
- Product mix includes popular motorcycle parts typical for an auto parts store
