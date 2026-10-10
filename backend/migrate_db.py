import sqlite3
from database import engine, Base
import models

# 1. Create any missing tables (like breakdown_logs)
Base.metadata.create_all(bind=engine)

# 2. Add any missing columns to existing tables
conn = sqlite3.connect('textile_factory.db')
cursor = conn.cursor()

cols_machine = [row[1] for row in cursor.execute('PRAGMA table_info(machines)').fetchall()]
if 'breakdown_reason' not in cols_machine:
    cursor.execute('ALTER TABLE machines ADD COLUMN breakdown_reason VARCHAR(200)')
if 'downtime_minutes' not in cols_machine:
    cursor.execute('ALTER TABLE machines ADD COLUMN downtime_minutes INTEGER DEFAULT 0')
if 'shift_name' not in cols_machine:
    cursor.execute("ALTER TABLE machines ADD COLUMN shift_name VARCHAR(50) DEFAULT 'Shift A (Morning)'")

cols_rolls = [row[1] for row in cursor.execute('PRAGMA table_info(fabric_rolls)').fetchall()]
if 'yarn_lot_number' not in cols_rolls:
    cursor.execute('ALTER TABLE fabric_rolls ADD COLUMN yarn_lot_number VARCHAR(50)')
if 'operator_name' not in cols_rolls:
    cursor.execute('ALTER TABLE fabric_rolls ADD COLUMN operator_name VARCHAR(100)')
if 'inspected_by' not in cols_rolls:
    cursor.execute("ALTER TABLE fabric_rolls ADD COLUMN inspected_by VARCHAR(100) DEFAULT 'QC Inspector'")

# Update sample rolls to have yarn lot & operator for demo
cursor.execute("UPDATE fabric_rolls SET yarn_lot_number = 'LOT-CB-401', operator_name = 'Ramesh (Shift A)' WHERE roll_code = 'ROLL-101'")
cursor.execute("UPDATE fabric_rolls SET yarn_lot_number = 'LOT-CB-401', operator_name = 'Ramesh (Shift A)' WHERE roll_code = 'ROLL-102'")
cursor.execute("UPDATE fabric_rolls SET yarn_lot_number = 'LOT-PS-302', operator_name = 'Kannan (Shift A)' WHERE roll_code = 'ROLL-103'")
cursor.execute("UPDATE fabric_rolls SET yarn_lot_number = 'LOT-VR-108', operator_name = 'Kumar (Shift A)' WHERE roll_code = 'ROLL-104'")

# Update machine breakdown reasons
cursor.execute("UPDATE machines SET breakdown_reason = 'Weft yarn breakage & tension sensor fault', downtime_minutes = 45 WHERE id = 4")

conn.commit()
conn.close()
print("Migration & Demo data enrichment completed successfully!")
