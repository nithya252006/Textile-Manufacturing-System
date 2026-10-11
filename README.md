# Everest Textile Mills Management System

A full-stack textile manufacturing management application built to digitalize yarn intake, production tracking, quality checks, dispatch, and owner-level financial operations for Everest Textile Mills.

## Project Links

| Item | Link |
| --- | --- |
| **Live Demo (Frontend)** | https://textile-manufacturing-system.vercel.app |
| **GitHub Repository** | https://github.com/nithya252006/Textile-Manufacturing-System |
| **Demo Video** |https://drive.google.com/file/d/1VJORV8A21vLBfz0nYH0cWQk9kmD2bMRI/view?usp=drivesdk |
| Backend API (Swagger docs) | https://textile-manufacturing-system-xw74.onrender.com/docs |
| Backend Health Check | https://textile-manufacturing-system-xw74.onrender.com/health |

> **Note:** The backend runs on Render's free tier and sleeps after inactivity. The first request can take 30 to 50 seconds. Open the health check link once, then use the live demo.

### Quick Login for Judges (Demo Accounts)

| Section | Email | Password |
| --- | --- | --- |
| Owner Executive | owner@everestmills.com | everest123 |
| Store Keeper | store@everestmills.com | store123 |
| Floor Supervisor | floor@everestmills.com | floor123 |
| Dispatch Section | dispatch@everestmills.com | dispatch123 |
| Buyer | buyer@everestmills.com | buyer123 |

Select the matching **Section** in the login dropdown before signing in. These accounts exist for the demo only.

## Overview

This project replaces manual production tracking and paper-based reporting with a unified workflow that covers:
- Yarn gate entry and stock monitoring
- Production machine status and assignment
- Quality inspection and roll traceability
- Buyer orders and dispatch management
- Payroll, supplier bills, and buyer receivables
- Profit and cost dashboard for the owner

## Architecture

```
User  ->  Vercel (React + Vite)  ->  Render (FastAPI)  ->  Database (SQLAlchemy)
```

## Tech Stack

| Layer | Stack | Purpose |
| --- | --- | --- |
| Backend | FastAPI + SQLAlchemy + Alembic | API layer, business logic, versioned schema migrations |
| Database | SQLite (local and demo deployment); PostgreSQL recommended for production | Persistent application data |
| Frontend | React + Vite | Role-based dashboards and operations UI |
| Auth | JWT + password hashing | Secure login and section-based access |
| Charts | Recharts | Revenue, cost, and profit analytics |
| Hosting | Render (API) + Vercel (UI) | Free-tier deployment |

## Mapping to the Problem Statement

### Scene 1: Yarn arrival and stock intake
- Gate entry for yarn lots with quantity, color, and lot number
- Low-stock threshold and material sufficiency checks
- Supplier invoice and payment tracking

### Scene 2 and 3: Floor and quality control
- Machine board for Spinning, Weaving, and Dyeing
- Status values: Idle, Running, Breakdown, Maintenance
- Fabric roll QC states: Pending, Pass, Rework, Reject
- Traceability from machine to order and product roll

### Scene 4, 5 and 6: Orders, dispatch, and owner books
- Buyer order booking and live status tracking
- Roll selection for dispatch and invoice generation
- Profit, cost, wages, and receivables dashboard

## Roles and Access

| Role | Value | Access |
| --- | --- | --- |
| Owner Executive | owner | Full dashboard and all modules |
| Store Keeper | store_keeper | Inventory |
| Floor Supervisor | floor_supervisor | Production and QC |
| Dispatch Section | dispatch | Orders and dispatch |
| Buyer | buyer | Own order tracking |

## Project Structure

```text
backend/
  auth.py
  alembic/
    versions/
  database.py
  main.py
  models.py
  requirements.txt
  requirements-dev.txt
  routers/
    accounting.py
    inventory.py
    orders_finance.py
    production.py

frontend/
  src/
  package.json
  vite.config.js
```

## Run Locally

### 1) Backend
```bash
cd backend
pip install -r requirements-dev.txt
python -m alembic upgrade head
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

API docs: http://127.0.0.1:8000/docs

Optional environment setup for PowerShell:
```powershell
$env:APP_ENV = "development"
$env:JWT_SECRET_KEY = "replace-with-a-long-random-secret"
$env:OWNER_REGISTRATION_CODE = "owner-invite"
$env:STORE_KEEPER_REGISTRATION_CODE = "store-invite"
$env:FLOOR_SUPERVISOR_REGISTRATION_CODE = "floor-invite"
$env:DISPATCH_REGISTRATION_CODE = "dispatch-invite"
```

### 2) Frontend
```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

Application URL: http://localhost:5173

If needed, create a `frontend/.env` file:
```env
VITE_API_URL=http://localhost:8000
```

## Deployment (Current Live Setup)

The live demo uses **Render** for the API and **Vercel** for the frontend.

### Backend on Render

| Setting | Value |
| --- | --- |
| Language | Python 3 |
| Root Directory | `backend` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Instance Type | Free |

| Environment Variable | Value |
| --- | --- |
| `APP_ENV` | `development` (seeds demo users and sample data) |
| `PYTHON_VERSION` | `3.11.9` |
| `JWT_SECRET_KEY` | a long random secret |
| `CORS_ORIGINS` | `https://textile-manufacturing-system.vercel.app` |

### Frontend on Vercel

| Setting | Value |
| --- | --- |
| Root Directory | `frontend` |
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Environment Variable | `VITE_API_URL` = `https://textile-manufacturing-system-xw74.onrender.com` (no trailing slash) |

### Demo Deployment Notes
- The free Render instance sleeps after inactivity, so the first request can take 30 to 50 seconds.
- SQLite lives inside the backend instance. Data added through the app resets when the service redeploys or restarts. Demo data is seeded again automatically on startup.
- Demo accounts and sample records are seeded only when `APP_ENV=development`.

## Production Deployment (Recommended for Real Use)

The repository also includes a Render Blueprint at `render.yaml` and Vercel SPA routing at `frontend/vercel.json`. For real use, run the API with `APP_ENV=production` and a PostgreSQL database (for example Neon).

1. Create a Neon project. Use its pooled connection string for `DATABASE_URL` and the direct connection string for `MIGRATION_DATABASE_URL`. Keep both private.
2. Create a Render Blueprint from this repository. Render reads `render.yaml`, generates the JWT secret and staff invite codes, and runs `python -m alembic upgrade head` before starting Uvicorn.
3. Deploy the frontend on Vercel with `VITE_API_URL` set to the Render API URL.
4. Set `CORS_ORIGINS` on Render to the exact Vercel origin (scheme and host only, no trailing slash).
5. Register the owner account using the private `OWNER_REGISTRATION_CODE`.

In production mode, demo users and sample rows are never seeded, and the API will not start on SQLite or with a wildcard CORS origin.

### Migrating Existing Local Data

Alembic creates and updates the schema, but it does not copy rows from SQLite to PostgreSQL. To preserve local records, create an empty PostgreSQL database and run the guarded transfer from `backend/`:

```powershell
cd backend
$env:SQLITE_DATABASE_URL = "sqlite:///./textile_factory.db"
Copy-Item migration-passwords.example.json migration-passwords.json
# Edit migration-passwords.json locally with new passwords (12+ chars).
python migrate_sqlite_to_postgres.py
```

### Ongoing Schema Changes

```bash
cd backend
python -m alembic revision --autogenerate -m "describe schema change"
python -m alembic upgrade head
```

## Manual Test Checklist

1. Open the live demo link and log in with a demo account.
2. Confirm the selected role matches the account section.
3. Check dashboard access and role-specific modules.
4. Validate machine assignment, QC update, and order progress logic.
5. Dispatch a QC-passed roll and verify invoice and profit calculations.
6. Test attendance, wages, supplier bills, and buyer payment flows.
7. Verify yarn reservation and stock reduction behavior.

## Team

| Member | Area |
| --- | --- |
| Pavithra S | Orders, Finance, Owner Dashboard |
| Nithya Sri S| Production Floor and Quality |
| Nithya Shree G | Inventory, Buyer Tracking, Dispatch |

## Git Workflow

```bash
git checkout feature/inventory
git merge main
git push origin feature/inventory
```

## Notes

- The backend enforces role permissions independently of the frontend UI.
- Development data is pre-seeded for demo use only.

```bash
git checkout feature/inventory
git merge main
git push origin feature/inventory
```
