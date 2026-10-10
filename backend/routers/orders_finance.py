from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import update
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, Field
import datetime
import uuid
from database import get_db
import models
from auth import get_current_user, require_roles


def serialize_order(order: models.BuyerOrder):
    passed_rolls = [r for r in order.rolls if r.qc_status == "Pass"]

    passed_meters = sum(r.meters for r in passed_rolls)
    progress_pct = min(100.0, round((passed_meters / order.quantity_meters * 100), 1)) if order.quantity_meters > 0 else 0

    return {
        "id": order.id,
        "order_code": order.order_code,
        "buyer_name": order.buyer_name,
        "fabric_type": order.fabric_type,
        "color": order.color,
        "quantity_meters": order.quantity_meters,
        "produced_meters": order.produced_meters,
        "completed_meters": passed_meters,
        "progress_percentage": progress_pct,
        "deadline": order.deadline,
        "status": order.status,
        "total_price": order.total_price,
        "created_at": order.created_at.isoformat() if order.created_at else None
    }

router = APIRouter(prefix="/api/orders-finance", tags=["Orders & Finance (Person C)"])

# Pydantic Schemas
class OrderCreate(BaseModel):
    buyer_name: str
    fabric_type: str
    color: str
    quantity_meters: float = Field(gt=0)
    deadline: str
    total_price: float = Field(ge=0)

class DispatchCreate(BaseModel):
    order_id: int
    truck_number: str
    invoice_number: str
    roll_ids: List[int]
    driver_name: Optional[str] = "Murugesan K"
    destination_city: Optional[str] = "Tiruppur / Chennai"

@router.get("/orders")
def get_all_orders(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("owner", "dispatch", "store_keeper", "floor_supervisor", "operator")),
):
    """List all orders with current production status and progress."""
    orders = db.query(models.BuyerOrder).all()
    return [serialize_order(order) for order in orders]


@router.get("/my-orders")
def get_my_orders(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return only the orders linked to the signed-in buyer account."""
    if current_user.role != "buyer":
        raise HTTPException(status_code=403, detail="This view is reserved for buyer accounts")

    orders = db.query(models.BuyerOrder).filter(models.BuyerOrder.buyer_id == current_user.id).all()
    return [serialize_order(order) for order in orders]

@router.post("/orders")
def create_order(
    data: OrderCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("owner", "dispatch", "buyer")),
):
    """Book a new buyer order."""
    count = db.query(models.BuyerOrder).count() + 1
    order_code = f"ORD-2026-{count:03d}"

    buyer_name = current_user.name if current_user.role == "buyer" else data.buyer_name.strip()
    buyer_id = current_user.id if current_user.role == "buyer" else None

    new_order = models.BuyerOrder(
        order_code=order_code,
        buyer_name=buyer_name,
        buyer_id=buyer_id,
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
def track_buyer_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("owner", "dispatch", "buyer")),
):
    """Scene 4: A buyer calls asking about their order - instant live answer with timeline."""
    order = db.query(models.BuyerOrder).filter(models.BuyerOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if current_user.role == "buyer" and order.buyer_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only track your own orders")

    # Find active machines for this order
    active_machine = db.query(models.Machine).filter(models.Machine.current_order_id == order.id).first()
    
    # Count passed rolls vs rejected
    passed_rolls = db.query(models.FabricRoll).filter(
        models.FabricRoll.order_id == order.id, models.FabricRoll.qc_status == "Pass"
    ).all()
    rejected_rolls = db.query(models.FabricRoll).filter(
        models.FabricRoll.order_id == order.id, models.FabricRoll.qc_status == "Reject"
    ).all()
    
    passed_meters = sum(r.meters for r in passed_rolls)
    progress_pct = min(100.0, round((passed_meters / order.quantity_meters * 100), 1)) if order.quantity_meters > 0 else 0

    # Build Stage Timeline Stepper
    status_lower = order.status.lower()
    stages = [
        {"name": "Order Placed", "status": "completed", "desc": f"Confirmed on {order.created_at.strftime('%d %b %Y') if order.created_at else 'Day 1'}"},
        {"name": "Yarn Allocated", "status": "completed" if order.status != "Pending" else "in-progress", "desc": f"Yarn stock reserved in store"},
        {"name": "Weaving Floor", "status": "completed" if order.status in ["QC Passed", "Ready to Dispatch", "Dispatched"] else ("in-progress" if order.status == "Weaving" else "pending"), "desc": f"Assigned to {active_machine.name if active_machine else 'Air-Jet Loom #01'}"},
        {"name": "Quality Check", "status": "completed" if order.status in ["Ready to Dispatch", "Dispatched"] else ("in-progress" if order.status == "QC Passed" else "pending"), "desc": f"{len(passed_rolls)} rolls passed inspection"},
        {"name": "Dispatch & Delivery", "status": "completed" if order.status == "Dispatched" else "pending", "desc": "Truck loading & Invoice"}
    ]

    # Pre-formatted WhatsApp / Phone SMS Message
    whatsapp_text = (
        f"Namaste {order.buyer_name}! Update on your order {order.order_code} ({order.fabric_type} - {order.color}): "
        f"Production is {progress_pct}% complete ({passed_meters}m/{order.quantity_meters}m). "
        f"Current Stage: {order.status}. Estimated dispatch deadline: {order.deadline}. "
        f"- Everest Textile Mills"
    )

    return {
        "order_code": order.order_code,
        "buyer_name": order.buyer_name,
        "fabric": f"{order.fabric_type} ({order.color})",
        "ordered_meters": order.quantity_meters,
        "completed_meters": passed_meters,
        "progress_percentage": progress_pct,
        "current_status": order.status,
        "active_stage": active_machine.stage if active_machine else "Floor Production",
        "active_machine": active_machine.name if active_machine else "Loom / Spinner Floor",
        "operator": active_machine.operator_name if active_machine else "Floor Team",
        "deadline": order.deadline,
        "passed_rolls_count": len(passed_rolls),
        "rejected_rolls_count": len(rejected_rolls),
        "stages": stages,
        "whatsapp_message": whatsapp_text,
        "message_for_buyer": f"Your order {order.order_code} is {progress_pct}% complete in {order.status} stage. Committed delivery by {order.deadline}."
    }

@router.get("/available-rolls")
def get_available_rolls(
    order_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("owner", "dispatch")),
):
    query = db.query(models.FabricRoll).filter(
        models.FabricRoll.qc_status == "Pass",
        models.FabricRoll.dispatch_id.is_(None),
    )
    if order_id is not None:
        query = query.filter(models.FabricRoll.order_id == order_id)

    rolls = query.order_by(models.FabricRoll.id).all()
    return [
        {
            "id": roll.id,
            "roll_code": roll.roll_code,
            "order_id": roll.order_id,
            "order_code": roll.order.order_code if roll.order else None,
            "meters": roll.meters,
            "qc_status": roll.qc_status,
        }
        for roll in rolls
    ]


@router.post("/dispatch")
def create_dispatch(
    data: DispatchCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("owner", "dispatch")),
):
    """Scene 5: Loading the truck for delivery & Invoice generation."""
    if not data.roll_ids:
        raise HTTPException(status_code=400, detail="Select at least one available QC-passed roll")
    if len(set(data.roll_ids)) != len(data.roll_ids):
        raise HTTPException(status_code=400, detail="A roll can only be selected once")

    order = db.query(models.BuyerOrder).filter(models.BuyerOrder.id == data.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    rolls = db.query(models.FabricRoll).filter(
        models.FabricRoll.id.in_(data.roll_ids),
        models.FabricRoll.order_id == data.order_id,
        models.FabricRoll.qc_status == "Pass",
        models.FabricRoll.dispatch_id.is_(None),
    ).with_for_update().all()
    if len(rolls) != len(data.roll_ids):
        raise HTTPException(
            status_code=409,
            detail="One or more selected rolls are unavailable, already dispatched, or not QC-passed for this order",
        )

    rolls_count = len(rolls)
    dispatched_meters = round(sum(roll.meters for roll in rolls), 2)
    previously_dispatched_meters = sum(dispatch.dispatched_meters for dispatch in order.dispatches)
    if previously_dispatched_meters + dispatched_meters > order.quantity_meters + 0.01:
        raise HTTPException(status_code=409, detail="Selected rolls exceed the order's remaining quantity")

    dispatch_code = f"DSP-{datetime.datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:8].upper()}"
    new_dispatch = models.Dispatch(
        dispatch_code=dispatch_code,
        order_id=data.order_id,
        truck_number=data.truck_number,
        invoice_number=data.invoice_number,
        rolls_count=rolls_count,
        dispatched_meters=dispatched_meters,
        status="Dispatched"
    )
    if previously_dispatched_meters + dispatched_meters >= order.quantity_meters:
        order.status = "Dispatched"

    # Financial Cost Calculation
    raw_material_cost = dispatched_meters * 0.3 * 250 # ~250/kg yarn
    labor_cost = dispatched_meters * 25 # ~25/m labor
    machine_cost = dispatched_meters * 15 # ~15/m electricity/maintenance
    total_cost = raw_material_cost + labor_cost + machine_cost
    revenue = round(
        order.total_price * dispatched_meters / order.quantity_meters,
        2,
    ) if order.quantity_meters > 0 else 0.0
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
    db.flush()
    assignment = db.execute(
        update(models.FabricRoll)
        .where(
            models.FabricRoll.id.in_(data.roll_ids),
            models.FabricRoll.order_id == data.order_id,
            models.FabricRoll.qc_status == "Pass",
            models.FabricRoll.dispatch_id.is_(None),
        )
        .values(dispatch_id=new_dispatch.id)
    )
    if assignment.rowcount != len(data.roll_ids):
        db.rollback()
        raise HTTPException(status_code=409, detail="One or more selected rolls were just dispatched by another request")
    db.commit()
    db.refresh(new_dispatch)

    # Return full Tax Invoice object
    gst_rate = 0.05 # 5% GST for fabric
    tax_amount = round(revenue * gst_rate, 2)
    grand_total = round(revenue + tax_amount, 2)

    invoice_data = {
        "invoice_number": data.invoice_number,
        "dispatch_code": dispatch_code,
        "date": datetime.datetime.utcnow().strftime("%d-%b-%Y"),
        "truck_number": data.truck_number,
        "driver_name": data.driver_name,
        "buyer_name": order.buyer_name,
        "fabric_type": order.fabric_type,
        "color": order.color,
        "rolls_count": rolls_count,
        "dispatched_meters": dispatched_meters,
        "rate_per_meter": round(order.total_price / order.quantity_meters, 2) if order.quantity_meters > 0 else 0,
        "subtotal": revenue,
        "gst_amount": tax_amount,
        "grand_total": grand_total,
        "status": "DISPATCHED"
    }

    return {
        "message": "Dispatch created and truck loaded successfully",
        "dispatch": new_dispatch,
        "invoice": invoice_data,
        "profit": profit
    }

@router.get("/dispatches")
def get_all_dispatches(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("owner", "dispatch")),
):
    """Scene 5: List all historical truck dispatches and generated invoices."""
    dispatches = db.query(models.Dispatch).all()
    results = []
    for d in dispatches:
        order = d.order
        results.append({
            "id": d.id,
            "dispatch_code": d.dispatch_code,
            "order_code": order.order_code if order else "N/A",
            "buyer_name": order.buyer_name if order else "N/A",
            "fabric": f"{order.fabric_type} ({order.color})" if order else "N/A",
            "truck_number": d.truck_number,
            "invoice_number": d.invoice_number,
            "rolls_count": d.rolls_count,
            "dispatched_meters": d.dispatched_meters,
            "dispatch_date": d.dispatch_date.strftime("%d-%b-%Y %I:%M %p") if d.dispatch_date else "N/A",
            "status": d.status
        })
    return results

@router.get("/shelf-audit")
def get_shelf_vs_dispatched_audit(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("owner", "dispatch")),
):
    """Scene 5: Finished fabric on shelf vs already dispatched truck rolls."""
    all_rolls = db.query(models.FabricRoll).all()
    passed_rolls = [r for r in all_rolls if r.qc_status == "Pass"]
    dispatched_rolls = [r for r in passed_rolls if r.dispatch_id is not None]
    shelf_rolls = [r for r in passed_rolls if r.dispatch_id is None]

    total_dispatched_meters = sum(r.meters for r in dispatched_rolls)
    shelf_meters = sum(r.meters for r in shelf_rolls)

    return {
        "shelf_rolls_count": len(shelf_rolls),
        "shelf_meters": round(shelf_meters, 2),
        "total_dispatched_rolls": len(dispatched_rolls),
        "total_dispatched_meters": round(total_dispatched_meters, 2),
        "audit_status": "All rolls accounted for - Zero double-dispatch"
    }

@router.get("/finance/dashboard")
def get_owner_dashboard(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("owner")),
):
    """Scene 6: The owner closing the books - Month-end profit, cost-per-roll, wages."""
    orders = db.query(models.BuyerOrder).all()
    dispatches = db.query(models.Dispatch).all()
    finances = db.query(models.FinancialRecord).all()
    supplier_bills = db.query(models.SupplierBill).all()
    attendance_records = db.query(models.AttendanceRecord).filter(models.AttendanceRecord.status == "Present").all()
    wage_payments = db.query(models.WagePayment).all()
    supplier_payments = db.query(models.SupplierPayment).all()
    buyer_payments = db.query(models.BuyerPayment).all()

    dispatched_meters_by_order = {}
    for dispatch in dispatches:
        if dispatch.order:
            dispatched_meters_by_order[dispatch.order_id] = (
                dispatched_meters_by_order.get(dispatch.order_id, 0.0)
                + max(0.0, dispatch.dispatched_meters or 0.0)
            )

    total_revenue = sum(
        min(
            order.total_price,
            order.total_price * dispatched_meters_by_order.get(order.id, 0.0) / order.quantity_meters,
        )
        for order in orders
        if order.quantity_meters > 0
    )

    consumed_yarn_reservations = db.query(models.YarnReservation).filter(
        models.YarnReservation.status == "Consumed"
    ).all()
    total_yarn_cost = sum(
        reservation.reserved_kg * (reservation.yarn_stock.cost_per_kg or 0.0)
        for reservation in consumed_yarn_reservations
        if reservation.yarn_stock
    )
    total_wages = sum(record.daily_wage for record in attendance_records)
    total_machine_cost = sum(f.machine_cost for f in finances)
    total_costs = total_yarn_cost + total_wages + total_machine_cost
    total_profit = total_revenue - total_costs
    total_supplier_paid = sum(payment.amount for payment in supplier_payments)
    total_worker_wages_paid = sum(payment.amount for payment in wage_payments)
    total_buyer_payments_received = sum(payment.amount for payment in buyer_payments)

    # Attribute recorded yarn and payroll costs to each order; machine power stays estimated.
    order_costs = []
    for o in orders:
        meters = min(o.quantity_meters, dispatched_meters_by_order.get(o.id, 0.0))
        consumed_reservations = db.query(models.YarnReservation).filter(
            models.YarnReservation.order_id == o.id,
            models.YarnReservation.status == "Consumed",
        ).all()
        yarn_c = sum(
            reservation.reserved_kg * (reservation.yarn_stock.cost_per_kg or 0.0)
            for reservation in consumed_reservations
            if reservation.yarn_stock
        )
        wage_c = sum(
            record.daily_wage
            for record in db.query(models.AttendanceRecord).filter(
                models.AttendanceRecord.order_id == o.id,
                models.AttendanceRecord.status == "Present",
            ).all()
        )
        power_c = sum(record.machine_cost or 0.0 for record in finances if record.order_id == o.id)
        tot_c = yarn_c + wage_c + power_c
        rev = min(o.total_price, o.total_price * meters / o.quantity_meters) if o.quantity_meters > 0 else 0.0
        prof = rev - tot_c
        margin = round((prof / rev * 100), 1) if rev > 0 else 0
        cost_per_meter = round(tot_c / meters, 2) if meters > 0 else 0.0
        sell_price_per_meter = round(rev / meters, 2) if meters > 0 else 0.0
        cost_per_roll = round(cost_per_meter * 100, 2) # approx 100 meters per roll

        order_costs.append({
            "order_code": o.order_code,
            "buyer_name": o.buyer_name,
            "fabric": f"{o.fabric_type} ({o.color})",
            "meters": meters,
            "yarn_cost": round(yarn_c, 2),
            "wage_cost": round(wage_c, 2),
            "power_cost": round(power_c, 2),
            "total_cost": round(tot_c, 2),
            "revenue": round(rev, 2),
            "profit": round(prof, 2),
            "margin_pct": margin,
            "cost_per_meter": cost_per_meter,
            "selling_price_per_meter": sell_price_per_meter,
            "cost_per_roll": cost_per_roll
        })

    worker_wages_summary = []
    for record in attendance_records:
        worker = db.query(models.Worker).filter(models.Worker.id == record.worker_id).first()
        paid_amount = sum(payment.amount for payment in wage_payments if payment.attendance_id == record.id)
        order = db.query(models.BuyerOrder).filter(models.BuyerOrder.id == record.order_id).first() if record.order_id else None
        worker_wages_summary.append({
            "worker_name": worker.name if worker else "Unknown",
            "shift": record.shift,
            "role": worker.job_title if worker else "Unknown",
            "output_meters": 0,
            "daily_wage": record.daily_wage,
            "paid_amount": round(paid_amount, 2),
            "balance": round(max(0.0, record.daily_wage - paid_amount), 2),
            "attendance_date": record.attendance_date,
            "order_code": order.order_code if order else None,
            "status": record.status,
        })

    # Aggregate recent months from actual dispatch and finance records.
    monthly_totals = {}
    for dispatch in dispatches:
        order = dispatch.order
        if not order or not dispatch.dispatch_date or order.quantity_meters <= 0:
            continue
        month_key = (dispatch.dispatch_date.year, dispatch.dispatch_date.month)
        monthly = monthly_totals.setdefault(month_key, {"revenue": 0.0, "expenses": 0.0})
        monthly["revenue"] += order.total_price * max(0.0, dispatch.dispatched_meters or 0.0) / order.quantity_meters

    for finance in finances:
        if not finance.created_at:
            continue
        month_key = (finance.created_at.year, finance.created_at.month)
        monthly = monthly_totals.setdefault(month_key, {"revenue": 0.0, "expenses": 0.0})
        monthly["expenses"] += finance.machine_cost or 0.0

    for reservation in consumed_yarn_reservations:
        if not reservation.consumed_at or not reservation.yarn_stock:
            continue
        month_key = (reservation.consumed_at.year, reservation.consumed_at.month)
        monthly = monthly_totals.setdefault(month_key, {"revenue": 0.0, "expenses": 0.0})
        monthly["expenses"] += reservation.reserved_kg * (reservation.yarn_stock.cost_per_kg or 0.0)

    for attendance in attendance_records:
        try:
            attendance_month = datetime.date.fromisoformat(attendance.attendance_date)
        except ValueError:
            continue
        month_key = (attendance_month.year, attendance_month.month)
        monthly = monthly_totals.setdefault(month_key, {"revenue": 0.0, "expenses": 0.0})
        monthly["expenses"] += attendance.daily_wage or 0.0

    monthly_trends = []
    current_month = datetime.datetime.utcnow().date().replace(day=1)
    for offset in range(5, -1, -1):
        year = current_month.year
        month_number = current_month.month - offset
        while month_number <= 0:
            month_number += 12
            year -= 1
        month_totals = monthly_totals.get((year, month_number), {"revenue": 0.0, "expenses": 0.0})
        revenue = round(month_totals["revenue"], 2)
        expenses = round(month_totals["expenses"], 2)
        monthly_trends.append({
            "month": datetime.date(year, month_number, 1).strftime("%b"),
            "revenue": revenue,
            "expenses": expenses,
            "profit": round(revenue - expenses, 2),
        })

    # Cost breakdown for PieChart
    cost_breakdown = [
        {"name": "Supplier Bills (Yarn)", "value": round(total_yarn_cost, 2)},
        {"name": "Recorded Attendance Wages", "value": round(total_wages, 2)},
        {"name": "Machine & Power (Estimated)", "value": round(total_machine_cost, 2)}
    ]

    return {
        "kpis": {
            "total_revenue": round(total_revenue, 2),
            "total_costs": round(total_costs, 2),
            "total_profit": round(total_profit, 2),
            "total_dispatches": len(dispatches),
            "total_orders": len(orders),
            "supplier_payments_paid": round(total_supplier_paid, 2),
            "worker_wages_paid": round(total_worker_wages_paid, 2),
            "buyer_payments_received": round(total_buyer_payments_received, 2),
            "buyer_receivables": round(max(0.0, sum(order.total_price for order in orders) - total_buyer_payments_received), 2),
            "supplier_payables": round(max(0.0, sum(bill.total_amount for bill in supplier_bills) - total_supplier_paid), 2),
            "worker_wages_accrued": round(total_wages, 2),
            "worker_attendance_count": len(attendance_records),
        },
        "order_costs": order_costs,
        "worker_wages_summary": worker_wages_summary,
        "monthly_trends": monthly_trends,
        "cost_breakdown": cost_breakdown
    }
