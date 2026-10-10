import sqlite3
import os
from database import engine, Base
import models

def migrate():
    # 1. Ensure all new tables are created
    Base.metadata.create_all(bind=engine)

    # 2. Add missing columns to existing SQLite tables
    db_path = os.path.join(os.path.dirname(__file__), "textile_factory.db")
    if not os.path.exists(db_path):
        print(f"Database at {db_path} does not exist yet. Created tables via metadata.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check buyer_orders for buyer_id column
        cursor.execute("PRAGMA table_info(buyer_orders);")
        columns = [row[1] for row in cursor.fetchall()]
        if "buyer_id" not in columns:
            print("Migrating: Adding buyer_id to buyer_orders table...")
            cursor.execute("ALTER TABLE buyer_orders ADD COLUMN buyer_id INTEGER REFERENCES users(id);")
            conn.commit()
            print("Added buyer_id column to buyer_orders successfully.")
        else:
            print("buyer_orders already has buyer_id column.")

        # Check fabric_rolls for dispatch_id column (Phase 2 migration)
        cursor.execute("PRAGMA table_info(fabric_rolls);")
        roll_cols = [row[1] for row in cursor.fetchall()]
        if "dispatch_id" not in roll_cols:
            print("Migrating: Adding dispatch_id to fabric_rolls table...")
            cursor.execute("ALTER TABLE fabric_rolls ADD COLUMN dispatch_id INTEGER REFERENCES dispatches(id);")
            conn.commit()
            print("Added dispatch_id column to fabric_rolls successfully.")
        else:
            print("fabric_rolls already has dispatch_id column.")

    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
