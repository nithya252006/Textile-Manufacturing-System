from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import datetime
from database import get_db
import models

router = APIRouter(prefix="/api/production", tags=["Production & Quality (Person B)"])

# Pydantic Schemas
class MachineStatusUpdate(BaseModel):
    status: str # Idle, Running, Breakdown, Maintenance
    operator_name: Optional[str] = None
    add_output_meters: Optional[float] = 0.0

class QCInspectionCreate(BaseModel):
    roll_code: str
    order_id: int
    machine_id: int
    meters: float
    qc_status: str # Pass, Rework, Reject
    defect_reason: Optional[str] = "None" # Holes, Colour mismatch, Uneven weaving
    notes: Optional[str] = None

class AssignMachineOrder(BaseModel):
    machine_id: int
    order_id: int
    operator_name: Optional[str] = "Floor Worker"

@router.get("/machines")
def get_all_machines(db: Session = Depends(get_db)):
    """Scene 2: Live floor status - which order is on which machine, idle vs running."""
    machines = db.query(models.Machine).all()
    results = []
    for m in machines:
        order = db.query(models.BuyerOrder).filter(models.BuyerOrder.id == m.current_order_id).first() if m.current_order_id else None
        results.append({
            "id": m.id,
            "name": m.name,
            "stage": m.stage,
            "status": m.status,
            "current_order_id": m.current_order_id,
            "current_order_code": order.order_code if order else None,
            "buyer_name": order.buyer_name if order else None,
            "operator_name": m.operator_name,
            "output_today_meters": m.output_today_meters,
            "updated_at": m.updated_at.isoformat() if m.updated_at else None
        })
    return results

@router.put("/machines/{machine_id}/status")
def update_machine_status(machine_id: int, req: MachineStatusUpdate, db: Session = Depends(get_db)):
    """Scene 2: Handle machine breakdown, shift change, or resume."""
    machine = db.query(models.Machine).filter(models.Machine.id == machine_id).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")
    
    machine.status = req.status
    if req.operator_name:
        machine.operator_name = req.operator_name
    if req.add_output_meters:
        machine.output_today_meters += req.add_output_meters
    machine.updated_at = datetime.datetime.utcnow()

    db.commit()
    db.refresh(machine)
    return {"message": "Machine status updated", "machine": machine}

@router.post("/assign-order")
def assign_order_to_machine(req: AssignMachineOrder, db: Session = Depends(get_db)):
    """Assign an order to a spinning/weaving/dyeing machine."""
    machine = db.query(models.Machine).filter(models.Machine.id == req.machine_id).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")
    
    machine.current_order_id = req.order_id
    machine.status = "Running"
    machine.operator_name = req.operator_name
    db.commit()
    db.refresh(machine)
    return {"message": f"Order #{req.order_id} assigned to {machine.name}", "machine": machine}

@router.get("/qc/rolls")
def get_all_rolls(db: Session = Depends(get_db)):
    """Scene 3: Clear record of what passed, what failed, and what is waiting."""
    rolls = db.query(models.FabricRoll).all()
    results = []
    for r in rolls:
        results.append({
            "id": r.id,
            "roll_code": r.roll_code,
            "order_id": r.order_id,
            "order_code": r.order.order_code if r.order else None,
            "machine_name": r.machine.name if r.machine else None,
            "meters": r.meters,
            "qc_status": r.qc_status,
            "defect_reason": r.defect_reason,
            "notes": r.notes,
            "created_at": r.created_at.isoformat() if r.created_at else None
        })
    return results

@router.post("/qc/inspect")
def inspect_fabric_roll(data: QCInspectionCreate, db: Session = Depends(get_db)):
    """Scene 3: Record quality check (Pass/Rework/Reject) with defect tracking."""
    existing = db.query(models.FabricRoll).filter(models.FabricRoll.roll_code == data.roll_code).first()
    if existing:
        existing.qc_status = data.qc_status
        existing.defect_reason = data.defect_reason
        existing.notes = data.notes
        db.commit()
        db.refresh(existing)
        return {"message": "QC status updated for roll", "roll": existing}

    roll = models.FabricRoll(
        roll_code=data.roll_code,
        order_id=data.order_id,
        machine_id=data.machine_id,
        meters=data.meters,
        qc_status=data.qc_status,
        defect_reason=data.defect_reason,
        notes=data.notes
    )
    db.add(roll)
    db.commit()
    db.refresh(roll)
    return {"message": "Fabric roll inspection logged", "roll": roll}

@router.get("/qc/trace/{roll_code}")
def trace_roll(roll_code: str, db: Session = Depends(get_db)):
    """Scene 3: Trace roll back to the order, machine, and operator that produced it."""
    roll = db.query(models.FabricRoll).filter(models.FabricRoll.roll_code == roll_code).first()
    if not roll:
        raise HTTPException(status_code=404, detail="Roll not found")
    
    return {
        "roll_code": roll.roll_code,
        "qc_status": roll.qc_status,
        "defect_reason": roll.defect_reason,
        "length_meters": roll.meters,
        "machine": {
            "id": roll.machine.id,
            "name": roll.machine.name,
            "stage": roll.machine.stage,
            "operator": roll.machine.operator_name
        } if roll.machine else None,
        "order": {
            "id": roll.order.id,
            "code": roll.order.order_code,
            "buyer": roll.order.buyer_name,
            "fabric": roll.order.fabric_type,
            "color": roll.order.color
        } if roll.order else None
    }
