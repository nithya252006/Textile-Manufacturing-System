# Everest Textile Mills Management System

A full-stack textile manufacturing management application built to digitalize yarn intake, production tracking, quality checks, dispatch, and owner-level financial operations for Everest Textile Mills.

## Overview

This project replaces manual production tracking and paper-based reporting with a unified workflow that covers:
- Yarn gate entry and stock monitoring
- Production machine status and assignment
- Quality inspection and roll traceability
- Buyer orders and dispatch management
- Payroll, supplier bills, and buyer receivables
- Profit and cost dashboard for the owner

## Tech Stack

| Layer | Stack | Purpose |
| --- | --- | --- |
| Backend | FastAPI + SQLAlchemy + Alembic | API layer, business logic, versioned schema migrations |
| Database | SQLite locally; PostgreSQL in production | Persistent application data |
| Frontend | React + Vite | Role-based dashboards and operations UI |
| Auth | JWT + password hashing | Secure login and section-based access |
| Charts | Recharts | Revenue, cost, and profit analytics |

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

## Run Instructions

### 1) Backend
```bash
cd backend
pip install -r requirements-dev.txt
python -m alembic upgrade head
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

For a local database created by an earlier version of this project, back up `textile_factory.db` first, then mark the matching baseline and apply the role migration:

```bash
python -m alembic stamp 6e658d8b4ff4
python -m alembic upgrade head
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

If needed, create a frontend/.env file:
```env
VITE_API_URL=http://localhost:8000
```

## Roles and Access

| Role | Value | Access |
| --- | --- | --- |
| Owner Executive | owner | Full dashboard and all modules |
| Store Keeper | store_keeper | Inventory |
| Floor Supervisor | floor_supervisor | Production and QC |
| Dispatch Section | dispatch | Orders and dispatch |
| Buyer | buyer | Own order tracking |

## Demo Accounts (Development Only)

| Role | Email | Password |
| --- | --- | --- |
| Owner Executive | owner@everestmills.com | everest123 |
| Store Keeper | store@everestmills.com | store123 |
| Floor Supervisor | floor@everestmills.com | floor123 |
| Dispatch Section | dispatch@everestmills.com | dispatch123 |
| Buyer | buyer@everestmills.com | buyer123 |

## Verified Project Status

The project has been validated for:
- backend compilation
- frontend build success
- live FastAPI response on port 8000
- successful login flow using the seeded owner account
- automated auth and health API tests
- Alembic upgrade and schema drift checks on SQLite

This confirms that the application architecture, API wiring, and frontend-to-backend connection are operational.

## Manual Test Checklist

1. Launch backend and frontend.
2. Open the app and log in with a seeded user.
3. Confirm the selected role matches the account section.
4. Check dashboard access and role-specific modules.
5. Validate machine assignment, QC update, and order progress logic.
6. Dispatch a QC-passed roll and verify invoice/profit calculations.
7. Test attendance, wages, supplier bills, and buyer payment flows.
8. Verify yarn reservation and stock reduction behavior.

## Notes

- Development data is pre-seeded for demo use only; production never receives demo users or sample records.
- The backend enforces role permissions independently of the frontend UI.
- Production requires PostgreSQL, a strong JWT secret, secure invite codes, and explicit frontend CORS origins.

## Deployment

Deploy the frontend and backend as separate services.

### Backend API

Set the service root to `backend/`, install `requirements.txt`, and configure these environment variables in the hosting dashboard:

| Variable | Production value |
| --- | --- |
| `APP_ENV` | `production` |
| `DATABASE_URL` | PostgreSQL connection URL from the database provider |
| `JWT_SECRET_KEY` | Random secret of at least 32 characters |
| `CORS_ORIGINS` | Exact frontend origin, for example `https://your-app.example.com` |
| `OWNER_REGISTRATION_CODE` | Private owner invite code |
| `STORE_KEEPER_REGISTRATION_CODE` | Private store invite code |
| `FLOOR_SUPERVISOR_REGISTRATION_CODE` | Private floor invite code |
| `DISPATCH_REGISTRATION_CODE` | Private dispatch invite code |

Run migrations as the service's pre-deploy or release command:

```bash
python -m alembic upgrade head
```

Start the API with the host-provided port:

```bash
uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
```

The health/readiness endpoint is `/health`; API documentation is at `/docs`.

### Frontend

Set the service root to `frontend/`, install with `npm ci`, and build with `npm run build`. Configure `VITE_API_URL` to the backend's public base URL, such as `https://your-api.example.com`, then publish the generated `dist/` directory. Add the resulting frontend origin to backend `CORS_ORIGINS`.

### Existing Local Data

Alembic creates and updates the database schema; it does not copy rows from the local SQLite file to PostgreSQL. The initial migration is intended for a new production database. Preserve local records separately before deployment if they are needed.

### Ongoing Schema Changes

After changing SQLAlchemy models, create and inspect a revision before deployment:

```bash
cd backend
python -m alembic revision --autogenerate -m "describe schema change"
python -m alembic upgrade head
```

## Git Workflow

```bash
git checkout feature/inventory
git merge main
git push origin feature/inventory
```
