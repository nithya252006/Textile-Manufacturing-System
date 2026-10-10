# 🧵 Everest Textile Mills - Management System

A unified digital backbone built for Everest Textile Mills to replace paper notebooks, floor walking, and telephone calls with automated real-time workflows.

---

## 🏗️ Architecture & Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Backend** | **FastAPI (Python)** | High-speed REST APIs, automatic Swagger documentation (`/docs`) |
| **Database** | **SQLite + SQLAlchemy** | Zero-configuration database, pre-seeded models |
| **Frontend** | **React (Vite) + Tailwind CSS** | Real-time floor status, modals, responsive tables |
| **Charts** | **Recharts** | Interactive revenue, costs, and profit analytics |

---

## 🎯 PDF Problem Statement Mapped to Modules

1. **Scene 1: Yarn arrives at the gate** (`Person A: feature/inventory`)
   - Truck arrival gate entry (material type, color, lot number, quantity in kg).
   - Automated low-stock threshold alerts.
   - Pre-production material check calculator.

2. **Scene 2 & 3: Floor mid-shift & Quality Checks** (`Person B: feature/production`)
   - Machine status board (Spinning, Weaving, Dyeing - Running, Idle, Breakdown).
   - Fabric roll inspection slips (Pass, Rework, Reject) with defect logging (holes, color mismatch, uneven weaving).
   - End-to-end roll traceability to machine, shift operator, and order.

3. **Scene 4, 5 & 6: Orders, Dispatch & Owner Books** (`Person C: feature/orders-finance`)
   - Instant buyer call inquiry view with live completion progress.
   - Dispatch truck loading and invoice validation.
   - Owner Executive Dashboard: Revenue vs Costs (Yarn + Wages + Power) = Net Profit.

---

## 🚀 How to Run Locally

### 1. Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
- Swagger API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

### 2. Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
- App UI: [http://localhost:5173](http://localhost:5173)

---

## 🌿 Git Branching Workflow for Teammates

### After base setup is on `main`:
Teammates should update their branches:
```bash
git checkout feature/inventory       # (or feature/production or feature/orders-finance)
git merge main
```
Push changes to your feature branch:
```bash
git push origin feature/<your-feature-name>
```