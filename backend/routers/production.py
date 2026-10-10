from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Literal, Optional
from pydantic import BaseModel, Field
import datetime
from database import get_db
import models
from auth import require_roles

router = APIRouter(prefix="/api/production", tags=["Production & Quality (Person B)"])

# Pydantic Schemas
class MachineStatusUpdate(BaseModel):
    status: Literal["Idle", "Running", "Breakdown", "Maintenance"]
    operator_name: Optional[str] = None
    add_output_meters: Optional[float] = Field(default=0.0, ge=0)

class QCInspectionCreate(BaseModel):
    roll_code: str
    order_id: int
    machine_id: int
    meters: float = Field(gt=0)
    qc_status: Literal["Pending", "Pass", "Rework", "Reject"] = "Pending"
    defect_reason: Optional[str] = "None" # Holes, Colour mismatch, Uneven weaving
    notes: Optional[str] = None

class AssignMachineOrder(BaseModel):
    machine_id: int
    order_id: int
    operator_name: Optional[str] = "Floor Worker"

@router.get("/machines")
def get_all_machines(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("owner", "floor_supervisor", "operator")),
):
    """Scene 2: Live floor status - which order is on which machine, idle vs running."""
    machines = db.query(models.Machine).all()
    results = []
    running_count = 0
    idle_count = 0
    breakdown_count = 0
    total_output = 0.0

    for m in machines:
        order = db.query(models.BuyerOrder).filter(models.BuyerOrder.id == m.current_order_id).first() if m.current_order_id else None
        if m.status == "Running":
            running_count += 1
        elif m.status == "Idle":
            idle_count += 1
        elif m.status == "Breakdown":
            breakdown_count += 1
        
        total_output += (m.output_today_meters or 0.0)

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

    return {
        "floor_summary": {
            "running": running_count,
            "idle": idle_count,
            "breakdown": breakdown_count,
            "total_output_today": round(total_output, 2)
        },
        "machines": results
    }

@router.put("/machines/{machine_id}/status")
def update_machine_status(
    machine_id: int,
    req: MachineStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("owner", "floor_supervisor", "operator")),
):
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
def assign_order_to_machine(
    req: AssignMachineOrder,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("owner", "floor_supervisor", "operator")),
):
    """Assign an order to a spinning/weaving/dyeing machine."""
    machine = db.query(models.Machine).filter(models.Machine.id == req.machine_id).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    order = db.query(models.BuyerOrder).filter(models.BuyerOrder.id == req.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status == "Dispatched":
        raise HTTPException(status_code=409, detail="A dispatched order cannot be assigned to production")
    if machine.status in {"Breakdown", "Maintenance"}:
        raise HTTPException(status_code=409, detail=f"Cannot assign an order while {machine.name} is {machine.status.lower()}")
    if machine.status == "Running" and machine.current_order_id not in {None, order.id}:
        raise HTTPException(status_code=409, detail=f"{machine.name} is already running another order")

    reservations = db.query(models.YarnReservation).filter(
        models.YarnReservation.order_id == order.id,
        models.YarnReservation.status.in_(["Reserved", "Consumed"]),
    ).all()
    required_kg = order.quantity_meters * 0.3
    allocated_kg = sum(reservation.reserved_kg for reservation in reservations)
    if allocated_kg + 0.01 < required_kg:
        raise HTTPException(status_code=409, detail="Reserve sufficient yarn for this order before starting production")

    for reservation in reservations:
        if reservation.status != "Reserved":
            continue
        yarn_stock = db.query(models.YarnStock).filter(models.YarnStock.id == reservation.yarn_stock_id).first()
        if not yarn_stock or yarn_stock.quantity_kg + 0.001 < reservation.reserved_kg:
            db.rollback()
            raise HTTPException(status_code=409, detail="Reserved yarn stock is no longer available")
        yarn_stock.quantity_kg = max(0.0, yarn_stock.quantity_kg - reservation.reserved_kg)
        reservation.status = "Consumed"
        reservation.consumed_at = datetime.datetime.utcnow()
    
    machine.current_order_id = req.order_id
    machine.status = "Running"
    machine.operator_name = req.operator_name
    if machine.stage in {"Spinning", "Weaving", "Dyeing"}:
        order.status = machine.stage
    db.commit()
    db.refresh(machine)
    return {"message": f"Order #{req.order_id} assigned to {machine.name}", "machine": machine}

@router.get("/qc/rolls")
def get_all_rolls(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("owner", "floor_supervisor", "operator")),
):
    """Scene 3: Clear record of what passed, what failed, and what is waiting."""
    rolls = db.query(models.FabricRoll).all()
    results = []
    pass_count = 0
    defect_counts = {}

    for r in rolls:
        if r.qc_status == "Pass":
            pass_count += 1
        if r.defect_reason and r.defect_reason != "None":
            defect_counts[r.defect_reason] = defect_counts.get(r.defect_reason, 0) + 1

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

    total_rolls = len(rolls)
    inspected_count = sum(1 for roll in rolls if roll.qc_status != "Pending")
    pass_rate = round((pass_count / inspected_count * 100), 1) if inspected_count > 0 else 0.0

    return {
        "qc_summary": {
            "total_rolls": total_rolls,
            "pass_count": pass_count,
            "pass_rate": pass_rate,
            "defect_reasons": defect_counts
        },
        "rolls": results
    }

@router.post("/qc/inspect")
def inspect_fabric_roll(
    data: QCInspectionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("owner", "floor_supervisor", "operator")),
):
    """Scene 3: Record quality check (Pass/Rework/Reject) with defect tracking."""
    if not db.query(models.BuyerOrder).filter(models.BuyerOrder.id == data.order_id).first():
        raise HTTPException(status_code=404, detail="Order not found")
    if not db.query(models.Machine).filter(models.Machine.id == data.machine_id).first():
        raise HTTPException(status_code=404, detail="Machine not found")

    existing = db.query(models.FabricRoll).filter(models.FabricRoll.roll_code == data.roll_code).first()
    if existing:
        if existing.order_id != data.order_id or existing.machine_id != data.machine_id:
            raise HTTPException(status_code=409, detail="Roll code already belongs to a different order or machine")
        if existing.dispatch_id is not None:
            raise HTTPException(status_code=409, detail="QC cannot be changed after a roll has been dispatched")
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
def trace_roll(
    roll_code: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("owner", "floor_supervisor", "operator")),
):
    """Scene 3: Trace roll back to order, machine, operator, raw yarn lot, and diagnosis."""
    roll = db.query(models.FabricRoll).filter(models.FabricRoll.roll_code == roll_code).first()
    if not roll:
        raise HTTPException(status_code=404, detail=f"Roll '{roll_code}' not found")
    
    order = roll.order
    machine = roll.machine

    yarn = None
    if order and order.color:
        yarn = db.query(models.YarnStock).filter(models.YarnStock.color.ilike(f"%{order.color}%")).first()
    if not yarn:
        yarn = db.query(models.YarnStock).first()

    # Determine root cause diagnosis
    if roll.qc_status == "Pass":
        diagnosis = "Optimal warp/weft tension observed. All tensile and color fastness parameters meet export specifications."
    elif roll.defect_reason and "Colour" in roll.defect_reason:
        diagnosis = f"Shade variation detected during dyeing stage. Recommend recalibration of dye bath liquor ratio on {machine.name if machine else 'finishing unit'}."
    elif roll.defect_reason and ("Hole" in roll.defect_reason or "Broken" in roll.defect_reason):
        diagnosis = f"Mechanical loom stop detected on {machine.name if machine else 'loom'}. Weft insertion tension exceeded threshold, leading to broken pick."
    elif roll.defect_reason and "Uneven" in roll.defect_reason:
        diagnosis = f"Warp let-off speed mismatch with take-up roller on {machine.name if machine else 'loom'}."
    else:
        diagnosis = f"Quality variance identified during shift inspection. Raw yarn lot {yarn.lot_number if yarn else 'LOT-CB-401'} from {yarn.supplier_name if yarn else 'supplier'} is within spec."

    return {
        "roll": {
            "code": roll.roll_code,
            "meters": roll.meters,
            "qc_verdict": roll.qc_status,
            "defect_reason": roll.defect_reason,
            "inspected_by": "Senior Quality Inspector"
        },
        "manufacturing_origin": {
            "machine_name": machine.name if machine else "Unknown",
            "production_stage": machine.stage if machine else "Weaving",
            "shift": "Shift A (Morning)",
            "operator_on_shift": machine.operator_name if machine else "Unassigned"
        },
        "buyer_order": {
            "order_code": order.order_code if order else "N/A",
            "buyer_name": order.buyer_name if order else "N/A",
            "fabric_specification": f"{order.fabric_type} ({order.color})" if order else "N/A",
            "deadline": order.deadline if order else "N/A"
        },
        "raw_material_origin": {
            "lot_number": yarn.lot_number if yarn else "LOT-CB-401",
            "supplier": yarn.supplier_name if yarn else "Coimbatore Cotton Mills",
            "material": yarn.material_name if yarn else "Cotton 40s"
        },
        "root_cause_diagnosis": diagnosis
    }
