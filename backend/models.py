import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from database import Base

class YarnStock(Base):
    """Scene 1: Yarn arrives at the gate & Raw Material Inventory (Person A)"""
    __tablename__ = "yarn_stocks"

    id = Column(Integer, primary_key=True, index=True)
    material_name = Column(String(100), nullable=False) # e.g., Cotton 40s, Polyester, Wool
    color = Column(String(50), nullable=False)
    lot_number = Column(String(50), unique=True, index=True)
    quantity_kg = Column(Float, default=0.0)
    min_threshold_kg = Column(Float, default=100.0) # Warning trigger
    supplier_name = Column(String(100))
    cost_per_kg = Column(Float, default=0.0)
    received_date = Column(DateTime, default=datetime.datetime.utcnow)
    reservations = relationship("YarnReservation", back_populates="yarn_stock")

class User(Base):
    """User authentication and authorization model."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(200), nullable=False)
    role = Column(String(50), nullable=False) # "owner" | "operator" | "buyer"
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    orders = relationship("BuyerOrder", back_populates="buyer", foreign_keys="BuyerOrder.buyer_id")

class BuyerOrder(Base):
    """Scene 4 & 5: Buyer Orders & Traceability (Person C)"""
    __tablename__ = "buyer_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_code = Column(String(50), unique=True, index=True) # e.g. ORD-2026-001
    buyer_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Role-based ownership
    buyer_name = Column(String(100), nullable=False)
    fabric_type = Column(String(100), nullable=False) # Cotton Shirting, Denim, Silk
    color = Column(String(50), nullable=False)
    quantity_meters = Column(Float, nullable=False)
    produced_meters = Column(Float, default=0.0)
    deadline = Column(String(50), nullable=False)
    status = Column(String(50), default="Pending") 
    # Status: Pending -> Yarn Reserved -> Spinning -> Weaving -> Dyeing -> QC Passed -> Ready to Dispatch -> Dispatched
    total_price = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    buyer = relationship("User", back_populates="orders", foreign_keys=[buyer_id])
    rolls = relationship("FabricRoll", back_populates="order")
    dispatches = relationship("Dispatch", back_populates="order")

class Machine(Base):
    """Scene 2: Production Floor, Mid-Shift & Machines (Person B)"""
    __tablename__ = "machines"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False) # e.g. Loom-A1, Spinner-02, Dye-Vat-3
    stage = Column(String(50), nullable=False) # Spinning, Weaving, Dyeing
    status = Column(String(50), default="Idle") # Running, Idle, Breakdown, Maintenance
    current_order_id = Column(Integer, ForeignKey("buyer_orders.id"), nullable=True)
    operator_name = Column(String(100), nullable=True) # Worker on shift
    output_today_meters = Column(Float, default=0.0)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow)

class FabricRoll(Base):
    """Scene 3: Quality Check & Traceability before Leaving Line (Person B)"""
    __tablename__ = "fabric_rolls"

    id = Column(Integer, primary_key=True, index=True)
    roll_code = Column(String(50), unique=True, index=True) # e.g. ROLL-8841
    order_id = Column(Integer, ForeignKey("buyer_orders.id"), nullable=False)
    machine_id = Column(Integer, ForeignKey("machines.id"), nullable=False)
    dispatch_id = Column(Integer, ForeignKey("dispatches.id"), nullable=True) # Phase 2: double-dispatch prevention
    meters = Column(Float, nullable=False)
    qc_status = Column(String(50), default="Pending") # Pending, Pass, Rework, Reject
    defect_reason = Column(String(200), nullable=True) # Holes, Colour mismatch, Uneven weaving, None
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    order = relationship("BuyerOrder", back_populates="rolls")
    machine = relationship("Machine")
    dispatch = relationship("Dispatch", back_populates="shipped_rolls")

class Dispatch(Base):
    """Scene 5: Loading the Truck for Dispatch (Person C)"""
    __tablename__ = "dispatches"

    id = Column(Integer, primary_key=True, index=True)
    dispatch_code = Column(String(50), unique=True, index=True)
    order_id = Column(Integer, ForeignKey("buyer_orders.id"), nullable=False)
    truck_number = Column(String(50), nullable=False)
    invoice_number = Column(String(50), unique=True, nullable=False)
    rolls_count = Column(Integer, default=0)
    dispatched_meters = Column(Float, default=0.0)
    dispatch_date = Column(DateTime, default=datetime.datetime.utcnow)
    status = Column(String(50), default="Dispatched") # Loaded, Dispatched, Delivered

    order = relationship("BuyerOrder", back_populates="dispatches")
    shipped_rolls = relationship("FabricRoll", back_populates="dispatch")

class FinancialRecord(Base):
    """Scene 6: The Owner, Closing the Books (Person C)"""
    __tablename__ = "financial_records"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("buyer_orders.id"), nullable=True)
    yarn_cost = Column(Float, default=0.0)
    worker_wages = Column(Float, default=0.0)
    machine_cost = Column(Float, default=0.0)
    total_cost = Column(Float, default=0.0)
    revenue = Column(Float, default=0.0)
    profit = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class YarnReservation(Base):
    __tablename__ = "yarn_reservations"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("buyer_orders.id"), nullable=False, index=True)
    yarn_stock_id = Column(Integer, ForeignKey("yarn_stocks.id"), nullable=False, index=True)
    reserved_kg = Column(Float, nullable=False)
    status = Column(String(20), default="Reserved", nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    consumed_at = Column(DateTime, nullable=True)
    yarn_stock = relationship("YarnStock", back_populates="reservations")
    order = relationship("BuyerOrder")


class SupplierBill(Base):
    __tablename__ = "supplier_bills"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(100), unique=True, nullable=False, index=True)
    supplier_name = Column(String(100), nullable=False)
    yarn_stock_id = Column(Integer, ForeignKey("yarn_stocks.id"), nullable=True)
    total_amount = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    due_date = Column(String(30), nullable=True)


class SupplierPayment(Base):
    __tablename__ = "supplier_payments"

    id = Column(Integer, primary_key=True, index=True)
    supplier_bill_id = Column(Integer, ForeignKey("supplier_bills.id"), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    reference = Column(String(100), nullable=True)
    paid_at = Column(DateTime, default=datetime.datetime.utcnow)


class Worker(Base):
    __tablename__ = "workers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    job_title = Column(String(100), nullable=False)
    daily_wage = Column(Float, nullable=False)
    active = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id = Column(Integer, primary_key=True, index=True)
    worker_id = Column(Integer, ForeignKey("workers.id"), nullable=False, index=True)
    order_id = Column(Integer, ForeignKey("buyer_orders.id"), nullable=True, index=True)
    attendance_date = Column(String(10), nullable=False)
    shift = Column(String(50), nullable=False)
    status = Column(String(20), nullable=False)
    daily_wage = Column(Float, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    __table_args__ = (UniqueConstraint("worker_id", "attendance_date", "shift", name="uq_worker_attendance_shift"),)


class WagePayment(Base):
    __tablename__ = "wage_payments"

    id = Column(Integer, primary_key=True, index=True)
    attendance_id = Column(Integer, ForeignKey("attendance_records.id"), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    reference = Column(String(100), nullable=True)
    paid_at = Column(DateTime, default=datetime.datetime.utcnow)


class BuyerPayment(Base):
    __tablename__ = "buyer_payments"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("buyer_orders.id"), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    reference = Column(String(100), nullable=True)
    received_at = Column(DateTime, default=datetime.datetime.utcnow)
