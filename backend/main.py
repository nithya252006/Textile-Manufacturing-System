from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base, SessionLocal
import models
from routers import inventory, production, orders_finance
import datetime

# Create SQLite tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Everest Textile Mills - Manufacturing System",
    description="Unified digital backbone for Everest Textile Mills: Inventory, Production Floor, Quality Inspection, Orders, and Owner Financials.",
    version="1.0.0"
)

# Enable CORS for React Vite
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allows Vite dev server & production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(inventory.router)
app.include_router(production.router)
app.include_router(orders_finance.router)

# Seed realistic initial data on startup if empty
@app.on_event("startup")
def seed_initial_data():
    db = SessionLocal()
    try:
        if db.query(models.Machine).count() == 0:
            # Seed Machines for Spinning, Weaving, Dyeing
            machines = [
                models.Machine(name="Rotor Spinner #01", stage="Spinning", status="Running", operator_name="Murugan (Shift A)", output_today_meters=1200),
                models.Machine(name="Ring Spinner #02", stage="Spinning", status="Idle", operator_name="Selvam (Shift A)", output_today_meters=450),
                models.Machine(name="Air-Jet Loom #01", stage="Weaving", status="Running", operator_name="Ramesh (Shift A)", output_today_meters=850),
                models.Machine(name="Rapier Loom #02", stage="Weaving", status="Breakdown", operator_name="Kannan (Shift A)", output_today_meters=210),
                models.Machine(name="Soft-Flow Dye Vat #01", stage="Dyeing", status="Running", operator_name="Kumar (Shift A)", output_today_meters=1400),
                models.Machine(name="Jigger Dye Machine #02", stage="Dyeing", status="Idle", operator_name="Arun (Shift A)", output_today_meters=0),
            ]
            db.add_all(machines)

        if db.query(models.YarnStock).count() == 0:
            # Seed Yarn Stocks
            stocks = [
                models.YarnStock(material_name="Cotton 40s Combed", color="Navy Blue", lot_number="LOT-CB-401", quantity_kg=450.0, min_threshold_kg=150.0, supplier_name="Coimbatore Cotton Mills", cost_per_kg=280),
                models.YarnStock(material_name="Polyester Spun 30s", color="Crimson Red", lot_number="LOT-PS-302", quantity_kg=80.0, min_threshold_kg=120.0, supplier_name="Surat Synthetic Ltd", cost_per_kg=190), # Low stock!
                models.YarnStock(material_name="Viscose Rayon", color="Pure White", lot_number="LOT-VR-108", quantity_kg=620.0, min_threshold_kg=100.0, supplier_name="Grasim Fibres", cost_per_kg=240),
                models.YarnStock(material_name="Linen Blend 20s", color="Olive Green", lot_number="LOT-LB-990", quantity_kg=40.0, min_threshold_kg=100.0, supplier_name="Kerala Flax Hub", cost_per_kg=350), # Low stock!
            ]
            db.add_all(stocks)

        if db.query(models.BuyerOrder).count() == 0:
            # Seed Sample Orders
            orders = [
                models.BuyerOrder(order_code="ORD-2026-001", buyer_name="Raymond Garments", fabric_type="Cotton Shirting", color="Navy Blue", quantity_meters=2500, produced_meters=1800, deadline="2026-10-15", status="Weaving", total_price=375000),
                models.BuyerOrder(order_code="ORD-2026-002", buyer_name="FabIndia Retail", fabric_type="Pure Linen", color="Olive Green", quantity_meters=1000, produced_meters=300, deadline="2026-10-18", status="Pending", total_price=220000),
                models.BuyerOrder(order_code="ORD-2026-003", buyer_name="Zara Exports", fabric_type="Rayon Printed", color="Pure White", quantity_meters=5000, produced_meters=4900, deadline="2026-10-12", status="QC Passed", total_price=650000),
            ]
            db.add_all(orders)
            db.commit()

            # Seed Fabric Rolls
            rolls = [
                models.FabricRoll(roll_code="ROLL-101", order_id=1, machine_id=3, meters=120, qc_status="Pass", defect_reason="None", notes="Grade A Finish"),
                models.FabricRoll(roll_code="ROLL-102", order_id=1, machine_id=3, meters=115, qc_status="Rework", defect_reason="Colour mismatch", notes="Slight shading at edges"),
                models.FabricRoll(roll_code="ROLL-103", order_id=1, machine_id=4, meters=90, qc_status="Reject", defect_reason="Holes / Broken pick", notes="Tension fault during weaving"),
                models.FabricRoll(roll_code="ROLL-104", order_id=3, machine_id=5, meters=150, qc_status="Pass", defect_reason="None", notes="Export quality"),
            ]
            db.add_all(rolls)

        db.commit()
    finally:
        db.close()

@app.get("/")
def read_root():
    return {
        "system": "Everest Textile Mills Management System",
        "status": "Online",
        "documentation": "/docs",
        "modules": [
            "/api/inventory (Person A)",
            "/api/production (Person B)",
            "/api/orders-finance (Person C)"
        ]
    }
