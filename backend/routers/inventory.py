from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from database import get_db
import models

router = APIRouter(prefix="/api/inventory", tags=["Inventory (Person A)"])

# Pydantic Schemas
class YarnCreate(BaseModel):
    material_name: str
    color: str
    lot_number: str
    quantity_kg: float
    min_threshold_kg: Optional[float] = 100.0
    supplier_name: Optional[str] = "Standard Mill Supplier"
    cost_per_kg: Optional[float] = 250.0

class MaterialCheckRequest(BaseModel):
    fabric_type: str
    color: str
    required_meters: float

@router.get("/yarn")
def get_all_yarn(db: Session = Depends(get_db)):
    """List all raw material yarn stocks with low-stock status."""
    stocks = db.query(models.YarnStock).all()
    result = []
    for s in stocks:
        result.append({
            "id": s.id,
            "material_name": s.material_name,
            "color": s.color,
            "lot_number": s.lot_number,
            "quantity_kg": s.quantity_kg,
            "min_threshold_kg": s.min_threshold_kg,
            "supplier_name": s.supplier_name,
            "cost_per_kg": s.cost_per_kg,
            "is_low_stock": s.quantity_kg <= s.min_threshold_kg,
            "received_date": s.received_date.isoformat() if s.received_date else None
        })
    return result

@router.post("/yarn")
def add_yarn_gate_entry(data: YarnCreate, db: Session = Depends(get_db)):
    """Scene 1: Yarn arrives at the gate - log incoming truck."""
    existing = db.query(models.YarnStock).filter(models.YarnStock.lot_number == data.lot_number).first()
    if existing:
        existing.quantity_kg += data.quantity_kg
        db.commit()
        db.refresh(existing)
        return {"message": "Stock updated for existing lot", "stock": existing}

    new_stock = models.YarnStock(
        material_name=data.material_name,
        color=data.color,
        lot_number=data.lot_number,
        quantity_kg=data.quantity_kg,
        min_threshold_kg=data.min_threshold_kg,
        supplier_name=data.supplier_name,
        cost_per_kg=data.cost_per_kg
    )
    db.add(new_stock)
    db.commit()
    db.refresh(new_stock)
    return {"message": "New yarn lot received at gate", "stock": new_stock}

@router.get("/alerts")
def get_low_stock_alerts(db: Session = Depends(get_db)):
    """Scene 1: Factory warning before yarn runs out."""
    alerts = db.query(models.YarnStock).filter(
        models.YarnStock.quantity_kg <= models.YarnStock.min_threshold_kg
    ).all()
    return [{
        "id": a.id,
        "material_name": a.material_name,
        "color": a.color,
        "current_stock": a.quantity_kg,
        "threshold": a.min_threshold_kg,
        "alert": f"LOW STOCK: {a.material_name} ({a.color}) has only {a.quantity_kg}kg left!"
    } for a in alerts]

@router.post("/check-material")
def check_material_for_order(req: MaterialCheckRequest, db: Session = Depends(get_db)):
    """Scene 1: Check whether there is enough yarn to start a new order."""
    # Approx 0.3 kg yarn required per meter of fabric
    required_kg = req.required_meters * 0.3
    stock = db.query(models.YarnStock).filter(
        models.YarnStock.color.ilike(f"%{req.color}%")
    ).first()

    available_kg = stock.quantity_kg if stock else 0.0
    is_sufficient = available_kg >= required_kg

    return {
        "fabric_type": req.fabric_type,
        "color": req.color,
        "required_kg": round(required_kg, 2),
        "available_kg": round(available_kg, 2),
        "is_sufficient": is_sufficient,
        "action_needed": "Ready to Start Production" if is_sufficient else f"Order {round(required_kg - available_kg, 2)}kg more yarn from supplier"
    }

@router.get("/finished-goods")
def get_finished_goods_inventory(db: Session = Depends(get_db)):
    """Scene 5: Finished fabric sitting on the shelf ready to dispatch."""
    passed_rolls = db.query(models.FabricRoll).filter(models.FabricRoll.qc_status == "Pass").all()
    return passed_rolls
