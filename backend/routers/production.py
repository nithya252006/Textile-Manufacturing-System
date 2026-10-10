from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import datetime
from database import get_db
import models

router = APIRouter(prefix="/api/production", tags=["Production & Quality (Person B)"])

# ==================== PYDANTIC SCHEMAS ====================

class MachineStatusUpdate(BaseModel):
    status: str # Idle, Running, Breakdown, Maintenance
    breakdown_reason: Optional[str] = None
    operator_name: Optional[str] = None
    add_output_meters: Optional[float] = 0.0

class ShiftChangeRequest(BaseModel):
    shift_name: str # Shift A (Morning), Shift B (Evening), Shift C (Night)
    operator_name: str
    handover_notes: Optional[str] = "Normal handover"

class AssignMachineOrder(BaseModel):
    machine_id: int
    order_id: int
    operator_name: Optional[str] = None

class QCInspectionCreate(BaseModel):
    roll_code: str
    order_id: int
    machine_id: int
    meters: float
    qc_status: str # Pass, Rework, Reject
    defect_reason: Optional[str] = "None" # Holes / Broken pick, Colour mismatch, Uneven weaving, None
    yarn_lot_number: Optional[str] = None
    inspected_by: Optional[str] = "Floor QC Officer"
    notes: Optional[str] = None

# ==================== SCENE 2: PRODUCTION FLOOR & MACHINES ====================

@router.get("/machines")
def get_all_machines(db: Session = Depends(get_db)):
    """Scene 2: Live floor board - which order is on which machine, idle vs running vs breakdown."""
    machines = db.query(models.Machine).all()
    
    total_output = sum(m.output_today_meters for m in machines)
    running_count = sum(1 for m in machines if m.status == "Running")
    idle_count = sum(1 for m in machines if m.status == "Idle")
    breakdown_count = sum(1 for m in machines if m.status == "Breakdown")

    machine_list = []
    for m in machines:
        order = db.query(models.BuyerOrder).filter(models.BuyerOrder.id == m.current_order_id).first() if m.current_order_id else None
        machine_list.append({
            "id": m.id,
            "name": m.name,
            "stage": m.stage,
            "status": m.status,
            "breakdown_reason": m.breakdown_reason,
            "downtime_minutes": m.downtime_minutes,
            "shift_name": m.shift_name,
            "operator_name": m.operator_name or "Unassigned",
            "current_order_id": m.current_order_id,
            "current_order_code": order.order_code if order else None,
            "buyer_name": order.buyer_name if order else None,
            "fabric_details": f"{order.fabric_type} ({order.color})" if order else None,
            "output_today_meters": m.output_today_meters,
            "updated_at": m.updated_at.isoformat() if m.updated_at else None
        })

    return {
        "floor_summary": {
            "total_machines": len(machines),
            "running": running_count,
            "idle": idle_count,
            "breakdown": breakdown_count,
            "total_output_today_meters": round(total_output, 1)
        },
        "machines": machine_list
    }

@router.put("/machines/{machine_id}/status")
def update_machine_status(machine_id: int, req: MachineStatusUpdate, db: Session = Depends(get_db)):
    """Scene 2: Handle machine breakdown, repair completion, or status toggle."""
    machine = db.query(models.Machine).filter(models.Machine.id == machine_id).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    old_status = machine.status
    machine.status = req.status
    machine.updated_at = datetime.datetime.utcnow()

    # If Breakdown triggered
    if req.status == "Breakdown":
        machine.breakdown_reason = req.breakdown_reason or "Unspecified mechanical issue"
        machine.downtime_minutes += 15 # default increment
        
        # Log breakdown incident
        log = models.BreakdownLog(
            machine_id=machine.id,
            reason=machine.breakdown_reason,
            operator_name=machine.operator_name,
            status="Open"
        )
        db.add(log)

    # If Machine was restored to Running or Idle
    elif old_status == "Breakdown" and req.status in ["Running", "Idle"]:
        machine.breakdown_reason = None
        # Close any open breakdown log
        open_log = db.query(models.BreakdownLog).filter(
            models.BreakdownLog.machine_id == machine.id,
            models.BreakdownLog.status == "Open"
        ).first()
        if open_log:
            open_log.status = "Resolved"
            open_log.resolved_at = datetime.datetime.utcnow()

    if req.operator_name:
        machine.operator_name = req.operator_name
    if req.add_output_meters:
        machine.output_today_meters += req.add_output_meters

    db.commit()
    db.refresh(machine)
    return {"message": f"{machine.name} status updated to {req.status}", "machine": machine}

@router.post("/machines/{machine_id}/shift-change")
def change_machine_shift(machine_id: int, req: ShiftChangeRequest, db: Session = Depends(get_db)):
    """Scene 2: Shifts change, workers move between machines."""
    machine = db.query(models.Machine).filter(models.Machine.id == machine_id).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    machine.shift_name = req.shift_name
    machine.operator_name = req.operator_name
    machine.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(machine)
    return {
        "message": f"Handover complete on {machine.name}. New shift: {req.shift_name}, Operator: {req.operator_name}",
        "machine": machine
    }

@router.post("/assign-order")
def assign_order_to_machine(req: AssignMachineOrder, db: Session = Depends(get_db)):
    """Scene 2: Assign order to machine & update order manufacturing stage."""
    machine = db.query(models.Machine).filter(models.Machine.id == req.machine_id).first()
    order = db.query(models.BuyerOrder).filter(models.BuyerOrder.id == req.order_id).first()
    if not machine or not order:
        raise HTTPException(status_code=404, detail="Machine or Order not found")

    machine.current_order_id = order.id
    machine.status = "Running"
    if req.operator_name:
        machine.operator_name = req.operator_name
    
    # Auto transition order status to machine's stage (e.g. Weaving)
    order.status = machine.stage

    db.commit()
    db.refresh(machine)
    db.refresh(order)
    return {
        "message": f"Order {order.order_code} assigned to {machine.name} ({machine.stage})",
        "machine_id": machine.id,
        "order_status": order.status
    }

@router.get("/breakdowns")
def get_breakdown_logs(db: Session = Depends(get_db)):
    """Scene 2: History of breakdowns, reasons, and repair times."""
    logs = db.query(models.BreakdownLog).order_by(models.BreakdownLog.started_at.desc()).all()
    return [{
        "id": l.id,
        "machine_name": l.machine.name if l.machine else f"Machine #{l.machine_id}",
        "reason": l.reason,
        "operator": l.operator_name,
        "status": l.status,
        "started_at": l.started_at.isoformat() if l.started_at else None,
        "resolved_at": l.resolved_at.isoformat() if l.resolved_at else None
    } for l in logs]


# ==================== SCENE 3: QUALITY CHECKS & TRACEABILITY ====================

@router.get("/qc/rolls")
def get_all_rolls(db: Session = Depends(get_db)):
    """Scene 3: Record of what passed, what failed, and defect statistics."""
    rolls = db.query(models.FabricRoll).all()
    
    total_rolls = len(rolls)
    passed_count = sum(1 for r in rolls if r.qc_status == "Pass")
    rework_count = sum(1 for r in rolls if r.qc_status == "Rework")
    reject_count = sum(1 for r in rolls if r.qc_status == "Reject")
    pass_percentage = round((passed_count / total_rolls * 100), 1) if total_rolls > 0 else 0.0

    # Defect summary
    defects = {}
    for r in rolls:
        if r.defect_reason and r.defect_reason != "None":
            defects[r.defect_reason] = defects.get(r.defect_reason, 0) + 1

    rolls_list = []
    for r in rolls:
        rolls_list.append({
            "id": r.id,
            "roll_code": r.roll_code,
            "order_id": r.order_id,
            "order_code": r.order.order_code if r.order else None,
            "buyer_name": r.order.buyer_name if r.order else None,
            "machine_id": r.machine_id,
            "machine_name": r.machine.name if r.machine else None,
            "yarn_lot_number": r.yarn_lot_number,
            "operator_name": r.operator_name,
            "meters": r.meters,
            "qc_status": r.qc_status,
            "defect_reason": r.defect_reason,
            "inspected_by": r.inspected_by,
            "notes": r.notes,
            "created_at": r.created_at.isoformat() if r.created_at else None
        })

    return {
        "qc_summary": {
            "total_inspected": total_rolls,
            "passed": passed_count,
            "rework": rework_count,
            "rejected": reject_count,
            "pass_rate_percentage": pass_percentage,
            "defect_reasons": defects
        },
        "rolls": rolls_list
    }

@router.post("/qc/inspect")
def inspect_fabric_roll(data: QCInspectionCreate, db: Session = Depends(get_db)):
    """Scene 3: Quality check slip - Record Pass, Rework, or Reject with defects."""
    machine = db.query(models.Machine).filter(models.Machine.id == data.machine_id).first()
    order = db.query(models.BuyerOrder).filter(models.BuyerOrder.id == data.order_id).first()
    
    if not machine or not order:
        raise HTTPException(status_code=404, detail="Machine or Order not found")

    # Find matching raw yarn lot for traceability if not specified
    yarn_lot = data.yarn_lot_number
    if not yarn_lot:
        matching_stock = db.query(models.YarnStock).filter(models.YarnStock.color.ilike(f"%{order.color}%")).first()
        yarn_lot = matching_stock.lot_number if matching_stock else "LOT-DEFAULT-01"

    existing = db.query(models.FabricRoll).filter(models.FabricRoll.roll_code == data.roll_code).first()
    if existing:
        existing.qc_status = data.qc_status
        existing.defect_reason = data.defect_reason
        existing.notes = data.notes
        existing.inspected_by = data.inspected_by
        db.commit()
        db.refresh(existing)
        return {"message": f"Updated inspection slip for {existing.roll_code}", "roll": existing}

    new_roll = models.FabricRoll(
        roll_code=data.roll_code,
        order_id=data.order_id,
        machine_id=data.machine_id,
        yarn_lot_number=yarn_lot,
        operator_name=machine.operator_name or "Floor Operator",
        meters=data.meters,
        qc_status=data.qc_status,
        defect_reason=data.defect_reason,
        inspected_by=data.inspected_by,
        notes=data.notes
    )
    db.add(new_roll)

    # If roll passed, increment order produced meters
    if data.qc_status == "Pass":
        order.produced_meters += data.meters
        if order.produced_meters >= order.quantity_meters:
            order.status = "QC Passed"

    db.commit()
    db.refresh(new_roll)
    return {"message": f"Inspection recorded: Roll {new_roll.roll_code} marked as {new_roll.qc_status}", "roll": new_roll}

@router.get("/qc/trace/{roll_code}")
def trace_roll_deep(roll_code: str, db: Session = Depends(get_db)):
    """Scene 3: Deep Root Cause Traceability.
    Traces roll -> machine -> operator -> shift -> buyer order -> raw material yarn supplier!
    """
    roll = db.query(models.FabricRoll).filter(models.FabricRoll.roll_code == roll_code).first()
    if not roll:
        raise HTTPException(status_code=404, detail=f"Roll code '{roll_code}' not found")

    # Trace yarn supplier
    yarn_info = None
    if roll.yarn_lot_number:
        yarn = db.query(models.YarnStock).filter(models.YarnStock.lot_number == roll.yarn_lot_number).first()
        if yarn:
            yarn_info = {
                "lot_number": yarn.lot_number,
                "material": yarn.material_name,
                "color": yarn.color,
                "supplier": yarn.supplier_name,
                "received_date": yarn.received_date.isoformat() if yarn.received_date else None
            }

    return {
        "trace_status": "Success",
        "roll": {
            "code": roll.roll_code,
            "meters": roll.meters,
            "qc_verdict": roll.qc_status,
            "defect_reason": roll.defect_reason,
            "inspected_by": roll.inspected_by,
            "inspection_notes": roll.notes,
            "inspected_at": roll.created_at.isoformat() if roll.created_at else None
        },
        "manufacturing_origin": {
            "machine_name": roll.machine.name if roll.machine else "Unknown",
            "production_stage": roll.machine.stage if roll.machine else "Unknown",
            "shift": roll.machine.shift_name if roll.machine else "Shift A",
            "operator_on_shift": roll.operator_name or (roll.machine.operator_name if roll.machine else "Unknown")
        },
        "buyer_order": {
            "order_code": roll.order.order_code if roll.order else "Unknown",
            "buyer_name": roll.order.buyer_name if roll.order else "Unknown",
            "fabric_specification": f"{roll.order.fabric_type} ({roll.order.color})" if roll.order else "Unknown",
            "deadline": roll.order.deadline if roll.order else "Unknown"
        },
        "raw_material_origin": yarn_info or {
            "lot_number": roll.yarn_lot_number or "LOT-CB-401",
            "supplier": "Coimbatore Cotton Mills",
            "material": "Cotton 40s Combed"
        },
        "root_cause_diagnosis": (
            f"Defect '{roll.defect_reason}' occurred on {roll.machine.name if roll.machine else 'Machine'} "
            f"under operator '{roll.operator_name}' using Yarn lot '{roll.yarn_lot_number}'."
            if roll.qc_status != "Pass" else "No defect detected. Roll passed standard mill specifications."
        )
    }
