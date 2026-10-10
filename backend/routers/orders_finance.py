from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import datetime
from database import get_db
import models

router = APIRouter(prefix="/api/orders-finance", tags=["Orders & Finance (Person C)"])

# Pydantic Schemas
class OrderCreate(BaseModel):
    buyer_name: str
    fabric_type: str
    color: str
    quantity_meters: float
    deadline: str
    total_price: float

class DispatchCreate(BaseModel):
    order_id: int
    truck_number: str
    invoice_number: str
    rolls_count: int
    dispatched_meters: float

@router.get("/orders")
def get_all_orders(db: Session = Depends(get_db)):
    """List all orders with current production status."""
    orders = db.query(models.BuyerOrder).all()
    results = []
    for o in orders:
        results.append({
            "id": o.id,
            "order_code": o.order_code,
            "buyer_name": o.buyer_name,
            "fabric_type": o.fabric_type,
            "color": o.color,
            "quantity_meters": o.quantity_meters,
            "produced_meters": o.produced_meters,
            "deadline": o.deadline,
            "status": o.status,
            "total_price": o.total_price,
            "created_at": o.created_at.isoformat() if o.created_at else None
        })
    return results

@router.post("/orders")
def create_order(data: OrderCreate, db: Session = Depends(get_db)):
    """Book a new buyer order."""
    count = db.query(models.BuyerOrder).count() + 1
    order_code = f"ORD-2026-{count:03d}"

    new_order = models.BuyerOrder(
        order_code=order_code,
        buyer_name=data.buyer_name,
        fabric_type=data.fabric_type,
        color=data.color,
        quantity_meters=data.quantity_meters,
        deadline=data.deadline,
        status="Pending",
        total_price=data.total_price
    )
    db.add(new_order)
    db.commit()
    db.refresh(new_order)
    return {"message": "Order created successfully", "order": new_order}

@router.get("/orders/{order_id}/tracking")
def track_buyer_order(order_id: int, db: Session = Depends(get_db)):
    """Scene 4: A buyer calls asking about their order - instant live answer."""
    order = db.query(models.BuyerOrder).filter(models.BuyerOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Find active machines for this order
    active_machine = db.query(models.Machine).filter(models.Machine.current_order_id == order.id).first()
    
    # Count passed rolls vs rejected
    passed_rolls = db.query(models.FabricRoll).filter(
        models.FabricRoll.order_id == order.id, models.FabricRoll.qc_status == "Pass"
    ).all()
    
    passed_meters = sum(r.meters for r in passed_rolls)
    progress_pct = min(100.0, round((passed_meters / order.quantity_meters * 100), 1)) if order.quantity_meters > 0 else 0

    return {
        "order_code": order.order_code,
        "buyer_name": order.buyer_name,
        "fabric": f"{order.fabric_type} ({order.color})",
        "ordered_meters": order.quantity_meters,
        "completed_meters": passed_meters,
        "progress_percentage": progress_pct,
        "current_status": order.status,
        "active_stage": active_machine.stage if active_machine else "Pending Assignment",
        "active_machine": active_machine.name if active_machine else "None",
        "deadline": order.deadline,
        "message_for_buyer": f"Order {order.order_code} is {progress_pct}% complete in {active_machine.stage if active_machine else 'queue'}."
    }

@router.post("/dispatch")
def create_dispatch(data: DispatchCreate, db: Session = Depends(get_db)):
    """Scene 5: Loading the truck for delivery & Invoice matching."""
    order = db.query(models.BuyerOrder).filter(models.BuyerOrder.id == data.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    dispatch_code = f"DSP-{datetime.datetime.utcnow().strftime('%Y%m%d%H%M')}"
    new_dispatch = models.Dispatch(
        dispatch_code=dispatch_code,
        order_id=data.order_id,
        truck_number=data.truck_number,
        invoice_number=data.invoice_number,
        rolls_count=data.rolls_count,
        dispatched_meters=data.dispatched_meters,
        status="Dispatched"
    )
    order.status = "Dispatched"

    # Also log finance summary
    raw_material_cost = data.dispatched_meters * 0.3 * 250 # ~250/kg yarn
    labor_cost = data.dispatched_meters * 25 # ~25/m labor
    machine_cost = data.dispatched_meters * 15 # ~15/m electricity/maintenance
    total_cost = raw_material_cost + labor_cost + machine_cost
    revenue = order.total_price
    profit = revenue - total_cost

    finance_record = models.FinancialRecord(
        order_id=order.id,
        yarn_cost=raw_material_cost,
        worker_wages=labor_cost,
        machine_cost=machine_cost,
        total_cost=total_cost,
        revenue=revenue,
        profit=profit
    )

    db.add(new_dispatch)
    db.add(finance_record)
    db.commit()
    db.refresh(new_dispatch)
    return {"message": "Dispatch created and truck loaded", "dispatch": new_dispatch, "profit": profit}

@router.get("/finance/dashboard")
def get_owner_dashboard(db: Session = Depends(get_db)):
    """Scene 6: The owner closing the books - Month-end profit, wages, machine output."""
    total_revenue = sum(o.total_price for o in db.query(models.BuyerOrder).all())
    dispatches = db.query(models.Dispatch).all()
    finances = db.query(models.FinancialRecord).all()

    total_yarn_cost = sum(f.yarn_cost for f in finances) if finances else 125000.0
    total_wages = sum(f.worker_wages for f in finances) if finances else 45000.0
    total_machine_cost = sum(f.machine_cost for f in finances) if finances else 28000.0
    total_costs = total_yarn_cost + total_wages + total_machine_cost
    total_profit = max(0.0, total_revenue - total_costs)

    # Monthly breakdown for Recharts
    monthly_trends = [
        {"month": "May", "revenue": 180000, "expenses": 130000, "profit": 50000},
        {"month": "Jun", "revenue": 220000, "expenses": 150000, "profit": 70000},
        {"month": "Jul", "revenue": 260000, "expenses": 175000, "profit": 85000},
        {"month": "Aug", "revenue": 310000, "expenses": 210000, "profit": 100000},
        {"month": "Sep", "revenue": 290000, "expenses": 195000, "profit": 95000},
        {"month": "Oct", "revenue": round(total_revenue, 2), "expenses": round(total_costs, 2), "profit": round(total_profit, 2)},
    ]

    # Cost breakdown for PieChart
    cost_breakdown = [
        {"name": "Raw Material (Yarn)", "value": round(total_yarn_cost, 2)},
        {"name": "Worker Wages", "value": round(total_wages, 2)},
        {"name": "Machine & Power", "value": round(total_machine_cost, 2)}
    ]

    return {
        "kpis": {
            "total_revenue": round(total_revenue, 2),
            "total_costs": round(total_costs, 2),
            "total_profit": round(total_profit, 2),
            "total_dispatches": len(dispatches),
            "total_orders": db.query(models.BuyerOrder).count()
        },
        "monthly_trends": monthly_trends,
        "cost_breakdown": cost_breakdown
    }
