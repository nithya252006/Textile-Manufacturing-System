from datetime import date
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from auth import require_roles
from database import get_db
import models

router = APIRouter(prefix="/api/accounting", tags=["Payroll & Accounts"])


class WorkerCreate(BaseModel):
    name: str
    job_title: str
    daily_wage: float = Field(ge=0)


class AttendanceCreate(BaseModel):
    worker_id: int
    attendance_date: date
    shift: str
    status: Literal["Present", "Absent", "Leave"]
    order_id: Optional[int] = None
    notes: Optional[str] = None


class PaymentCreate(BaseModel):
    amount: float = Field(gt=0)
    reference: Optional[str] = None


class SupplierBillCreate(BaseModel):
    invoice_number: str
    supplier_name: str
    total_amount: float = Field(gt=0)
    due_date: Optional[str] = None


class BuyerPaymentCreate(BaseModel):
    amount: float = Field(gt=0)
    reference: Optional[str] = None


def _paid_for(db: Session, model, foreign_key: int, key: str) -> float:
    return sum(
        payment.amount or 0.0
        for payment in db.query(model).filter(getattr(model, key) == foreign_key).all()
    )


@router.get("/workers")
def get_workers(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("owner")),
):
    workers = db.query(models.Worker).filter(models.Worker.active == 1).order_by(models.Worker.name).all()
    return [{
        "id": worker.id,
        "name": worker.name,
        "job_title": worker.job_title,
        "daily_wage": worker.daily_wage,
    } for worker in workers]


@router.post("/workers")
def create_worker(
    data: WorkerCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("owner")),
):
    worker = models.Worker(
        name=data.name.strip(),
        job_title=data.job_title.strip(),
        daily_wage=data.daily_wage,
    )
    if not worker.name or not worker.job_title:
        raise HTTPException(status_code=400, detail="Worker name and job title are required")
    db.add(worker)
    db.commit()
    db.refresh(worker)
    return {"id": worker.id, "name": worker.name, "job_title": worker.job_title, "daily_wage": worker.daily_wage}


@router.get("/attendance")
def get_attendance(
    attendance_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("owner")),
):
    query = db.query(models.AttendanceRecord)
    if attendance_date:
        query = query.filter(models.AttendanceRecord.attendance_date == attendance_date.isoformat())
    records = query.order_by(models.AttendanceRecord.attendance_date.desc(), models.AttendanceRecord.id.desc()).all()
    result = []
    for record in records:
        worker = db.query(models.Worker).filter(models.Worker.id == record.worker_id).first()
        order = db.query(models.BuyerOrder).filter(models.BuyerOrder.id == record.order_id).first() if record.order_id else None
        paid_amount = _paid_for(db, models.WagePayment, record.id, "attendance_id")
        result.append({
            "id": record.id,
            "worker_id": record.worker_id,
            "worker_name": worker.name if worker else "Unknown",
            "job_title": worker.job_title if worker else "Unknown",
            "order_id": record.order_id,
            "order_code": order.order_code if order else None,
            "attendance_date": record.attendance_date,
            "shift": record.shift,
            "status": record.status,
            "daily_wage": record.daily_wage,
            "paid_amount": round(paid_amount, 2),
            "balance": round(max(0.0, record.daily_wage - paid_amount), 2),
            "notes": record.notes,
        })
    return result


@router.post("/attendance")
def save_attendance(
    data: AttendanceCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("owner")),
):
    worker = db.query(models.Worker).filter(models.Worker.id == data.worker_id, models.Worker.active == 1).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Active worker not found")
    if data.order_id and not db.query(models.BuyerOrder).filter(models.BuyerOrder.id == data.order_id).first():
        raise HTTPException(status_code=404, detail="Order not found")

    attendance_date = data.attendance_date.isoformat()
    record = db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.worker_id == data.worker_id,
        models.AttendanceRecord.attendance_date == attendance_date,
        models.AttendanceRecord.shift == data.shift.strip(),
    ).first()
    wage = worker.daily_wage if data.status == "Present" else 0.0
    if record:
        already_paid = _paid_for(db, models.WagePayment, record.id, "attendance_id")
        if already_paid > wage:
            raise HTTPException(status_code=409, detail="Cannot reduce attendance wage below wages already paid")
        record.status = data.status
        record.daily_wage = wage
        record.order_id = data.order_id
        record.notes = data.notes
    else:
        record = models.AttendanceRecord(
            worker_id=data.worker_id,
            order_id=data.order_id,
            attendance_date=attendance_date,
            shift=data.shift.strip(),
            status=data.status,
            daily_wage=wage,
            notes=data.notes,
        )
        db.add(record)
    db.commit()
    db.refresh(record)
    return {"id": record.id, "status": record.status, "daily_wage": record.daily_wage}


@router.post("/attendance/{attendance_id}/payments")
def record_wage_payment(
    attendance_id: int,
    data: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("owner")),
):
    attendance = db.query(models.AttendanceRecord).filter(models.AttendanceRecord.id == attendance_id).first()
    if not attendance:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    paid_amount = _paid_for(db, models.WagePayment, attendance.id, "attendance_id")
    if paid_amount + data.amount > attendance.daily_wage + 0.01:
        raise HTTPException(status_code=409, detail="Wage payment exceeds the worker's recorded daily wage")
    payment = models.WagePayment(attendance_id=attendance.id, amount=data.amount, reference=data.reference)
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return {"id": payment.id, "paid_amount": round(paid_amount + data.amount, 2), "balance": round(max(0.0, attendance.daily_wage - paid_amount - data.amount), 2)}


@router.get("/supplier-bills")
def get_supplier_bills(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("owner", "store_keeper")),
):
    bills = db.query(models.SupplierBill).order_by(models.SupplierBill.created_at.desc()).all()
    result = []
    for bill in bills:
        paid_amount = _paid_for(db, models.SupplierPayment, bill.id, "supplier_bill_id")
        result.append({
            "id": bill.id,
            "invoice_number": bill.invoice_number,
            "supplier_name": bill.supplier_name,
            "total_amount": bill.total_amount,
            "paid_amount": round(paid_amount, 2),
            "balance": round(max(0.0, bill.total_amount - paid_amount), 2),
            "created_at": bill.created_at.isoformat() if bill.created_at else None,
            "due_date": bill.due_date,
        })
    return result


@router.post("/supplier-bills")
def create_supplier_bill(
    data: SupplierBillCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("owner", "store_keeper")),
):
    if db.query(models.SupplierBill).filter(models.SupplierBill.invoice_number == data.invoice_number.strip()).first():
        raise HTTPException(status_code=409, detail="Supplier invoice number already exists")
    bill = models.SupplierBill(
        invoice_number=data.invoice_number.strip(),
        supplier_name=data.supplier_name.strip(),
        total_amount=data.total_amount,
        due_date=data.due_date,
    )
    db.add(bill)
    db.commit()
    db.refresh(bill)
    return {"id": bill.id, "invoice_number": bill.invoice_number, "total_amount": bill.total_amount}


@router.post("/supplier-bills/{bill_id}/payments")
def record_supplier_payment(
    bill_id: int,
    data: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("owner")),
):
    bill = db.query(models.SupplierBill).filter(models.SupplierBill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Supplier bill not found")
    paid_amount = _paid_for(db, models.SupplierPayment, bill.id, "supplier_bill_id")
    if paid_amount + data.amount > bill.total_amount + 0.01:
        raise HTTPException(status_code=409, detail="Payment exceeds supplier bill balance")
    payment = models.SupplierPayment(supplier_bill_id=bill.id, amount=data.amount, reference=data.reference)
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return {"id": payment.id, "paid_amount": round(paid_amount + data.amount, 2), "balance": round(max(0.0, bill.total_amount - paid_amount - data.amount), 2)}


@router.get("/buyer-balances")
def get_buyer_balances(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("owner")),
):
    orders = db.query(models.BuyerOrder).order_by(models.BuyerOrder.created_at.desc()).all()
    result = []
    for order in orders:
        received = _paid_for(db, models.BuyerPayment, order.id, "order_id")
        result.append({
            "order_id": order.id,
            "order_code": order.order_code,
            "buyer_name": order.buyer_name,
            "order_value": order.total_price,
            "received_amount": round(received, 2),
            "balance": round(max(0.0, order.total_price - received), 2),
        })
    return result


@router.post("/orders/{order_id}/payments")
def record_buyer_payment(
    order_id: int,
    data: BuyerPaymentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("owner", "dispatch")),
):
    order = db.query(models.BuyerOrder).filter(models.BuyerOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    received = _paid_for(db, models.BuyerPayment, order.id, "order_id")
    if received + data.amount > order.total_price + 0.01:
        raise HTTPException(status_code=409, detail="Payment exceeds buyer order balance")
    payment = models.BuyerPayment(order_id=order.id, amount=data.amount, reference=data.reference)
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return {"id": payment.id, "received_amount": round(received + data.amount, 2), "balance": round(max(0.0, order.total_price - received - data.amount), 2)}
