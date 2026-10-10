from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from database import engine, Base, SessionLocal
from database import get_db
import models
from routers import inventory, production, orders_finance, accounting
from migrate_db import migrate
from auth import create_access_token, get_current_user, hash_password, verify_password
import datetime
import hmac
import os
from sqlalchemy import or_

# Ensure database schema is current before the app starts
migrate()
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
app.include_router(accounting.router)


class AuthRegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str = "buyer"
    registration_code: Optional[str] = None


class AuthLoginRequest(BaseModel):
    email: str
    password: str
    role: Optional[str] = None


@app.post("/api/auth/register")
def register_user(data: AuthRegisterRequest, db: Session = Depends(get_db)):
    if not data.name or not data.email or not data.password:
        raise HTTPException(status_code=400, detail="All fields are required")

    email = data.email.strip().lower()
    role = data.role.strip().lower()
    role_registration_env = {
        "owner": "OWNER_REGISTRATION_CODE",
        "operator": "FLOOR_SUPERVISOR_REGISTRATION_CODE",
        "store_keeper": "STORE_KEEPER_REGISTRATION_CODE",
        "floor_supervisor": "FLOOR_SUPERVISOR_REGISTRATION_CODE",
        "dispatch": "DISPATCH_REGISTRATION_CODE",
    }
    if role not in {*role_registration_env, "buyer"}:
        raise HTTPException(status_code=400, detail="Select a valid account section")

    if role in role_registration_env:
        expected_code = os.getenv(role_registration_env[role])
        if not expected_code or not data.registration_code or not hmac.compare_digest(data.registration_code, expected_code):
            raise HTTPException(status_code=403, detail=f"A valid invite code is required to register for the {role.replace('_', ' ')} section")

    existing = db.query(models.User).filter(models.User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account already exists for this email")

    user = models.User(
        name=data.name.strip(),
        email=email,
        password_hash=hash_password(data.password),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user)
    return {
        "token": token,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
        },
    }


@app.post("/api/auth/login")
def login_user(data: AuthLoginRequest, db: Session = Depends(get_db)):
    email = data.email.strip().lower()
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if data.role and user.role != data.role.strip().lower():
        raise HTTPException(status_code=403, detail="This account does not belong to the selected section")

    token = create_access_token(user)
    return {
        "token": token,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
        },
    }


@app.get("/api/auth/me")
def get_me(current_user: models.User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role,
    }


@app.get("/api/auth/demo-users")
def get_demo_users():
    return [
        {"name": "Aarav Nair", "email": "owner@everestmills.com", "role": "owner"},
        {"name": "Meena Kumar", "email": "store@everestmills.com", "role": "store_keeper"},
        {"name": "Raghul S.", "email": "floor@everestmills.com", "role": "floor_supervisor"},
        {"name": "Sundar Rao", "email": "dispatch@everestmills.com", "role": "dispatch"},
        {"name": "Kavya Raman", "email": "buyer@everestmills.com", "role": "buyer"},
    ]

# Seed realistic initial data on startup if empty
@app.on_event("startup")
def seed_initial_data():
    db = SessionLocal()
    try:
        is_development = os.getenv("APP_ENV", "development").lower() == "development"
        if is_development and db.query(models.User).count() == 0:
            demo_users = [
                models.User(name="Aarav Nair", email="owner@everestmills.com", password_hash=hash_password("everest123"), role="owner"),
                models.User(name="Meena Kumar", email="store@everestmills.com", password_hash=hash_password("store123"), role="store_keeper"),
                models.User(name="Raghul S.", email="floor@everestmills.com", password_hash=hash_password("floor123"), role="floor_supervisor"),
                models.User(name="Sundar Rao", email="dispatch@everestmills.com", password_hash=hash_password("dispatch123"), role="dispatch"),
                models.User(name="Kavya Raman", email="buyer@everestmills.com", password_hash=hash_password("buyer123"), role="buyer"),
            ]
            db.add_all(demo_users)
            db.flush()

        buyer_user = db.query(models.User).filter(models.User.email == "buyer@everestmills.com").first() if is_development else None
        if is_development and not buyer_user:
            buyer_user = models.User(
                name="Kavya Raman",
                email="buyer@everestmills.com",
                password_hash=hash_password("buyer123"),
                role="buyer",
            )
            db.add(buyer_user)
            db.flush()

        demo_roles = {
            "owner@everestmills.com": "owner",
            "store@everestmills.com": "store_keeper",
            "floor@everestmills.com": "floor_supervisor",
            "dispatch@everestmills.com": "dispatch",
        }
        if is_development:
            for email, role in demo_roles.items():
                demo_user = db.query(models.User).filter(models.User.email == email).first()
                if demo_user and demo_user.role in {"owner", "operator"}:
                    demo_user.role = role

        if is_development and db.query(models.Machine).count() == 0:
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

        if is_development and db.query(models.Worker).count() == 0:
            workers = [
                models.Worker(name="Murugan", job_title="Rotor Spinner", daily_wage=650),
                models.Worker(name="Selvam", job_title="Ring Spinner", daily_wage=550),
                models.Worker(name="Ramesh", job_title="Air-Jet Loom Operator", daily_wage=700),
                models.Worker(name="Kannan", job_title="Rapier Loom Operator", daily_wage=500),
                models.Worker(name="Kumar", job_title="Dye Master", daily_wage=800),
            ]
            db.add_all(workers)

        if is_development and db.query(models.YarnStock).count() == 0:
            # Seed Yarn Stocks
            stocks = [
                models.YarnStock(material_name="Cotton 40s Combed", color="Navy Blue", lot_number="LOT-CB-401", quantity_kg=450.0, min_threshold_kg=150.0, supplier_name="Coimbatore Cotton Mills", cost_per_kg=280),
                models.YarnStock(material_name="Polyester Spun 30s", color="Crimson Red", lot_number="LOT-PS-302", quantity_kg=80.0, min_threshold_kg=120.0, supplier_name="Surat Synthetic Ltd", cost_per_kg=190), # Low stock!
                models.YarnStock(material_name="Viscose Rayon", color="Pure White", lot_number="LOT-VR-108", quantity_kg=620.0, min_threshold_kg=100.0, supplier_name="Grasim Fibres", cost_per_kg=240),
                models.YarnStock(material_name="Linen Blend 20s", color="Olive Green", lot_number="LOT-LB-990", quantity_kg=40.0, min_threshold_kg=100.0, supplier_name="Kerala Flax Hub", cost_per_kg=350), # Low stock!
            ]
            db.add_all(stocks)

        if is_development and db.query(models.BuyerOrder).count() == 0:
            # Seed Sample Orders
            orders = [
                models.BuyerOrder(order_code="ORD-2026-001", buyer_name="Raymond Garments", fabric_type="Cotton Shirting", color="Navy Blue", quantity_meters=2500, produced_meters=1800, deadline="2026-10-15", status="Weaving", total_price=375000),
                models.BuyerOrder(order_code="ORD-2026-002", buyer_name="FabIndia Retail", fabric_type="Pure Linen", color="Olive Green", quantity_meters=1000, produced_meters=300, deadline="2026-10-18", status="Pending", total_price=220000),
                models.BuyerOrder(order_code="ORD-2026-003", buyer_name="Zara Exports", fabric_type="Rayon Printed", color="Pure White", quantity_meters=5000, produced_meters=4900, deadline="2026-10-12", status="QC Passed", total_price=650000),
            ]
            db.add_all(orders)
            db.commit()

            if buyer_user:
                for order in orders:
                    order.buyer_id = buyer_user.id

            # Seed Fabric Rolls
            rolls = [
                models.FabricRoll(roll_code="ROLL-101", order_id=1, machine_id=3, meters=120, qc_status="Pass", defect_reason="None", notes="Grade A Finish"),
                models.FabricRoll(roll_code="ROLL-102", order_id=1, machine_id=3, meters=115, qc_status="Rework", defect_reason="Colour mismatch", notes="Slight shading at edges"),
                models.FabricRoll(roll_code="ROLL-103", order_id=1, machine_id=4, meters=90, qc_status="Reject", defect_reason="Holes / Broken pick", notes="Tension fault during weaving"),
                models.FabricRoll(roll_code="ROLL-104", order_id=3, machine_id=5, meters=150, qc_status="Pass", defect_reason="None", notes="Export quality"),
            ]
            db.add_all(rolls)

        owner_user = db.query(models.User).filter(models.User.email == "owner@everestmills.com").first() if is_development else None
        if owner_user and buyer_user:
            db.query(models.BuyerOrder).filter(
                models.BuyerOrder.order_code.in_(["ORD-2026-001", "ORD-2026-002", "ORD-2026-003"]),
                or_(
                    models.BuyerOrder.buyer_id.is_(None),
                    models.BuyerOrder.buyer_id == owner_user.id,
                ),
            ).update({models.BuyerOrder.buyer_id: buyer_user.id}, synchronize_session=False)

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
            "/api/orders-finance (Person C)",
            "/api/accounting (Owner payroll and settlements)"
        ]
    }
