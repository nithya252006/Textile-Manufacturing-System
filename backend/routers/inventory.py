from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
import models
from auth import require_roles

router = APIRouter(prefix="/api/inventory", tags=["Inventory (Person A)"])

# Pydantic Schemas
class YarnCreate(BaseModel):
    material_name: str
    color: str
    lot_number: str
    quantity_kg: float = Field(gt=0)
    min_threshold_kg: Optional[float] = Field(default=100.0, ge=0)
    supplier_name: Optional[str] = "Standard Mill Supplier"
    cost_per_kg: Optional[float] = Field(default=250.0, ge=0)
    supplier_invoice_number: Optional[str] = None
    supplier_bill_amount: Optional[float] = Field(default=None, gt=0)

class MaterialCheckRequest(BaseModel):
    fabric_type: str
    color: str
    required_meters: float = Field(gt=0)


class YarnReservationRequest(BaseModel):
    order_id: int

@router.get("/yarn")
def get_all_yarn(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("owner", "store_keeper")),
):
    """List all raw material yarn stocks with low-stock status."""
    stocks = db.query(models.YarnStock).all()
    result = []
    for s in stocks:
        active_reservations = [reservation for reservation in s.reservations if reservation.status == "Reserved"]
        reserved_kg = sum(reservation.reserved_kg for reservation in active_reservations)
        result.append({
            "id": s.id,
            "material_name": s.material_name,
            "color": s.color,
            "lot_number": s.lot_number,
            "quantity_kg": s.quantity_kg,
            "reserved_kg": round(reserved_kg, 2),
            "available_kg": round(max(0.0, s.quantity_kg - reserved_kg), 2),
            "reservations": [{
                "order_code": reservation.order.order_code if reservation.order else None,
                "reserved_kg": round(reservation.reserved_kg, 2),
                "status": reservation.status,
            } for reservation in s.reservations],
            "min_threshold_kg": s.min_threshold_kg,
            "supplier_name": s.supplier_name,
            "cost_per_kg": s.cost_per_kg,
            "is_low_stock": max(0.0, s.quantity_kg - reserved_kg) <= s.min_threshold_kg,
            "received_date": s.received_date.isoformat() if s.received_date else None
        })
    return result

@router.post("/yarn")
def add_yarn_gate_entry(
    data: YarnCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("owner", "store_keeper")),
):
    """Scene 1: Yarn arrives at the gate - log incoming truck."""
    if bool(data.supplier_invoice_number) != bool(data.supplier_bill_amount):
        raise HTTPException(status_code=400, detail="Enter both a supplier invoice number and its total amount")
    if data.supplier_invoice_number and db.query(models.SupplierBill).filter(
        models.SupplierBill.invoice_number == data.supplier_invoice_number.strip()
    ).first():
        raise HTTPException(status_code=409, detail="Supplier invoice number already exists")

    existing = db.query(models.YarnStock).filter(models.YarnStock.lot_number == data.lot_number).first()
    if existing:
        existing.quantity_kg += data.quantity_kg
        stock = existing
        message = "Stock updated for existing lot"
    else:
        stock = models.YarnStock(
            material_name=data.material_name,
            color=data.color,
            lot_number=data.lot_number,
            quantity_kg=data.quantity_kg,
            min_threshold_kg=data.min_threshold_kg,
            supplier_name=data.supplier_name,
            cost_per_kg=data.cost_per_kg,
        )
        db.add(stock)
        message = "New yarn lot received at gate"

    if data.supplier_invoice_number:
        db.flush()
        db.add(models.SupplierBill(
            invoice_number=data.supplier_invoice_number.strip(),
            supplier_name=data.supplier_name or stock.supplier_name or "Standard Mill Supplier",
            yarn_stock_id=stock.id,
            total_amount=data.supplier_bill_amount,
        ))
    db.commit()
    db.refresh(stock)
    return {"message": message, "stock": stock}

@router.get("/alerts")
def get_low_stock_alerts(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("owner", "store_keeper")),
):
    """Scene 1: Factory warning before yarn runs out."""
    stocks = db.query(models.YarnStock).all()
    alerts = []
    for stock in stocks:
        reserved_kg = sum(
            reservation.reserved_kg
            for reservation in stock.reservations
            if reservation.status == "Reserved"
        )
        available_kg = max(0.0, stock.quantity_kg - reserved_kg)
        if available_kg <= stock.min_threshold_kg:
            alerts.append({
                "id": stock.id,
                "material_name": stock.material_name,
                "color": stock.color,
                "current_stock": available_kg,
                "threshold": stock.min_threshold_kg,
                "alert": f"LOW STOCK: {stock.material_name} ({stock.color}) has only {available_kg}kg available!",
            })
    return alerts

@router.post("/check-material")
def check_material_for_order(
    req: MaterialCheckRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("owner", "store_keeper")),
):
    """Scene 1: Check whether there is enough yarn to start a new order."""
    # Approx 0.3 kg yarn required per meter of fabric
    required_kg = req.required_meters * 0.3
    stocks = db.query(models.YarnStock).filter(
        func.lower(models.YarnStock.color) == req.color.strip().lower()
    ).all()
    available_kg = 0.0
    for stock in stocks:
        reserved_kg = sum(
            reservation.reserved_kg
            for reservation in stock.reservations
            if reservation.status == "Reserved"
        )
        available_kg += max(0.0, stock.quantity_kg - reserved_kg)
    is_sufficient = available_kg >= required_kg

    return {
        "fabric_type": req.fabric_type,
        "color": req.color,
        "required_kg": round(required_kg, 2),
        "available_kg": round(available_kg, 2),
        "is_sufficient": is_sufficient,
        "action_needed": "Ready to Start Production" if is_sufficient else f"Order {round(required_kg - available_kg, 2)}kg more yarn from supplier"
    }


@router.post("/orders/{order_id}/reserve-yarn")
def reserve_yarn_for_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("owner", "store_keeper")),
):
    order = db.query(models.BuyerOrder).filter(models.BuyerOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status == "Dispatched":
        raise HTTPException(status_code=409, detail="Cannot reserve yarn for a dispatched order")

    required_kg = round(order.quantity_meters * 0.3, 2)
    existing = db.query(models.YarnReservation).filter(
        models.YarnReservation.order_id == order.id,
        models.YarnReservation.status.in_(["Reserved", "Consumed"]),
    ).all()
    already_allocated_kg = sum(reservation.reserved_kg for reservation in existing)
    needed_kg = max(0.0, required_kg - already_allocated_kg)
    if needed_kg <= 0:
        return {
            "message": "Required yarn is already reserved or consumed for this order",
            "order_id": order.id,
            "required_kg": required_kg,
            "allocated_kg": round(already_allocated_kg, 2),
            "allocations": [],
        }

    stocks = db.query(models.YarnStock).filter(
        func.lower(models.YarnStock.color) == order.color.strip().lower()
    ).order_by(models.YarnStock.received_date, models.YarnStock.id).all()
    plan = []
    remaining_kg = needed_kg
    for stock in stocks:
        reserved_elsewhere = sum(
            reservation.reserved_kg
            for reservation in stock.reservations
            if reservation.status == "Reserved" and reservation.order_id != order.id
        )
        reserved_here = sum(
            reservation.reserved_kg
            for reservation in stock.reservations
            if reservation.status == "Reserved" and reservation.order_id == order.id
        )
        available_kg = max(0.0, stock.quantity_kg - reserved_elsewhere - reserved_here)
        allocation_kg = min(available_kg, remaining_kg)
        if allocation_kg > 0:
            plan.append((stock, allocation_kg))
            remaining_kg = round(remaining_kg - allocation_kg, 2)
        if remaining_kg <= 0:
            break

    if remaining_kg > 0.01:
        raise HTTPException(
            status_code=409,
            detail=f"Insufficient unreserved {order.color} yarn: need {needed_kg}kg more",
        )

    created = []
    for stock, allocation_kg in plan:
        reservation = models.YarnReservation(
            order_id=order.id,
            yarn_stock_id=stock.id,
            reserved_kg=allocation_kg,
            status="Reserved",
        )
        db.add(reservation)
        created.append({
            "lot_number": stock.lot_number,
            "reserved_kg": round(allocation_kg, 2),
        })
    db.commit()

    return {
        "message": "Yarn reserved for order",
        "order_id": order.id,
        "required_kg": required_kg,
        "allocated_kg": round(already_allocated_kg + needed_kg, 2),
        "allocations": created,
    }

@router.get("/finished-goods")
def get_finished_goods_inventory(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("owner", "dispatch")),
):
    """Scene 5: Finished fabric sitting on the shelf ready to dispatch."""
    passed_rolls = db.query(models.FabricRoll).filter(
        models.FabricRoll.qc_status == "Pass",
        models.FabricRoll.dispatch_id.is_(None),
    ).all()
    return passed_rolls
