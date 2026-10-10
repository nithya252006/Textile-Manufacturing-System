import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
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

class BuyerOrder(Base):
    """Scene 4 & 5: Buyer Orders & Traceability (Person C)"""
    __tablename__ = "buyer_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_code = Column(String(50), unique=True, index=True) # e.g. ORD-2026-001
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
    rolls = relationship("FabricRoll", back_populates="order")
    dispatches = relationship("Dispatch", back_populates="order")

class Machine(Base):
    """Scene 2: Production Floor, Mid-Shift & Machines (Person B)"""
    __tablename__ = "machines"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False) # e.g. Loom-A1, Spinner-02, Dye-Vat-3
    stage = Column(String(50), nullable=False) # Spinning, Weaving, Dyeing
    status = Column(String(50), default="Idle") # Running, Idle, Breakdown, Maintenance
    breakdown_reason = Column(String(200), nullable=True) # e.g. Motor overheating, Weft snap
    downtime_minutes = Column(Integer, default=0)
    shift_name = Column(String(50), default="Shift A (Morning)") # Shift A, Shift B, Shift C
    operator_name = Column(String(100), nullable=True) # Worker on shift
    current_order_id = Column(Integer, ForeignKey("buyer_orders.id"), nullable=True)
    output_today_meters = Column(Float, default=0.0)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow)

    breakdown_logs = relationship("BreakdownLog", back_populates="machine")

class BreakdownLog(Base):
    """Scene 2: Log Machine Maintenance & Breakdowns"""
    __tablename__ = "breakdown_logs"

    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(Integer, ForeignKey("machines.id"), nullable=False)
    reason = Column(String(200), nullable=False)
    operator_name = Column(String(100), nullable=True)
    started_at = Column(DateTime, default=datetime.datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    status = Column(String(50), default="Open") # Open, Resolved

    machine = relationship("Machine", back_populates="breakdown_logs")

class FabricRoll(Base):
    """Scene 3: Quality Check & Deep Traceability (Person B)"""
    __tablename__ = "fabric_rolls"

    id = Column(Integer, primary_key=True, index=True)
    roll_code = Column(String(50), unique=True, index=True) # e.g. ROLL-8841
    order_id = Column(Integer, ForeignKey("buyer_orders.id"), nullable=False)
    machine_id = Column(Integer, ForeignKey("machines.id"), nullable=False)
    yarn_lot_number = Column(String(50), nullable=True) # Raw yarn traceability
    operator_name = Column(String(100), nullable=True) # Floor worker on shift
    meters = Column(Float, nullable=False)
    qc_status = Column(String(50), default="Pending") # Pending, Pass, Rework, Reject
    defect_reason = Column(String(200), nullable=True) # Holes, Colour mismatch, Uneven weaving, None
    inspected_by = Column(String(100), default="QC Inspector")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    order = relationship("BuyerOrder", back_populates="rolls")
    machine = relationship("Machine")

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
