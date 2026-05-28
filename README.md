<div align="center">

<img src="https://img.shields.io/badge/BizPulse-Commercial%20Dashboard-00E5C8?style=for-the-badge&logoColor=white" alt="BizPulse"/>

# BizPulse

### Full-stack commercial client analytics dashboard

**Monitor cash flow. Track KPIs. Spot problems before they become crises.**

<br/>

[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.1-000000?style=flat-square&logo=flask&logoColor=white)](https://flask.palletsprojects.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://reactjs.org)
[![Recharts](https://img.shields.io/badge/Recharts-2.12-22B5BF?style=flat-square)](https://recharts.org)
[![pytest](https://img.shields.io/badge/pytest-38%20passing-00E5C8?style=flat-square&logo=pytest&logoColor=white)](./backend/tests)
[![CI](https://img.shields.io/badge/GitHub%20Actions-CI%20Pipeline-2088FF?style=flat-square&logo=github-actions&logoColor=white)](./.github/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-MIT-7B61FF?style=flat-square)](./LICENSE)

<br/>

> Built as a portfolio project demonstrating full-stack development, REST API design,  
> automated testing, and CI/CD — applied to a real-world business intelligence use case.

<br/>

[Features](#-features) · [Quick Start](#-quick-start) · [Architecture](#-architecture) · [API Reference](#-api-reference) · [Testing](#-testing) · [Roadmap](#-roadmap)

</div>

---

## The Problem

Consulting firms and financial advisors managing multiple business clients have no unified view. They're jumping between spreadsheets, accounting software, and email chains trying to answer basic questions:

- Is Client A burning through cash faster than last quarter?
- Which clients are below target margin right now?
- Who needs an urgent conversation this week?

**BizPulse solves this** — one dashboard, all clients, real-time answers.

---

## ✨ Features

### Dashboard
- **6 simulated client profiles** across Transportation, Manufacturing, Construction, Food & Bev, Finance, and Healthcare
- **KPI cards** — Annual Revenue, Expenses, Net Profit, Profit Margin, Daily Burn Rate, Runway (days)
- **Month-over-month trend indicators** — instantly see what's moving and in which direction
- **Range selector** — toggle between 6-month, 12-month, and 24-month views

### Charts
- **Cash Flow Area Chart** — inflow vs outflow over time with gradient fills
- **Expense Breakdown Pie** — payroll, operations, marketing, R&D, admin, other
- **Net Profit Bar Chart** — per-month profitability, color-coded green/red

### Data Modes
- **Simulated Mode** — seeded, deterministic financial data with seasonal patterns and realistic growth curves. Great for demos
- **Manual Entry Mode** — type in actual monthly figures (revenue + expenses), switch to expense % tab, hit Apply — all charts and KPIs update instantly. No backend needed for this flow

### Alerts Engine
Auto-generates contextual alerts from live metrics:
- 🔴 **CRITICAL** — runway below 90 days
- 🟡 **WARNING** — profit margin below 15%, or expenses spiking >8% MoM
- 🟢 **INFO** — strong revenue growth detected

### UX
- Collapsible sidebar with live portfolio-wide revenue total
- Per-client data persistence within the session
- Clean dark UI with smooth transitions

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node 18+
- pip & npm

### 1. Clone
```bash
git clone https://github.com/immanah-codes/bizpulse.git
cd bizpulse
```

### 2. Backend
```bash
cd backend
pip install -r requirements.txt
python app.py
```
> Flask runs at **http://localhost:5000**

### 3. Frontend
```bash
cd frontend
npm install
npm start
```
> React runs at **http://localhost:3000**

### 4. Verify
```bash
curl http://localhost:5000/api/health
# → {"status": "ok", "service": "BizPulse API", "version": "1.0.0"}
```

---

## 🏗 Architecture

```
bizpulse/
│
├── .github/
│   └── workflows/
│       └── ci.yml                  # 3-job GitHub Actions pipeline
│
├── backend/                        # Python / Flask
│   ├── app.py                      # App factory, blueprint registration, CORS
│   ├── requirements.txt
│   │
│   ├── models/
│   │   └── data_engine.py          # Analytics engine — swap this for real DB
│   │
│   ├── routes/
│   │   ├── analytics.py            # /api/analytics/* — KPIs, alerts, portfolio summary
│   │   ├── cashflow.py             # /api/cashflow/* — time-series + expense breakdown
│   │   └── clients.py             # /api/clients/* — client registry
│   │
│   └── tests/
│       └── test_backend.py         # 38 unit + integration tests
│
└── frontend/                       # React 18
    ├── package.json
    └── src/
        ├── App.jsx                 # Full dashboard — all components in one modular file
        └── index.js
```

### How data flows

```
React (port 3000)
    │
    │  fetch("/api/...")
    ▼
Flask (port 5000)
    │
    ├── routes/analytics.py   ──▶  models/data_engine.py
    ├── routes/cashflow.py    ──▶  models/data_engine.py
    └── routes/clients.py     ──▶  models/data_engine.py
                                        │
                                        ▼
                              [ Seeded RNG simulation ]
                              [ or swap: PostgreSQL    ]
                              [ or swap: QuickBooks API ]
                              [ or swap: CSV upload     ]
```

---

## 📡 API Reference

Base URL: `http://localhost:5000/api`

| Method | Endpoint | Description | Params |
|--------|----------|-------------|--------|
| `GET` | `/health` | Service health check | — |
| `GET` | `/clients/` | List all client profiles | — |
| `GET` | `/clients/<id>` | Single client details | `id`: int |
| `GET` | `/cashflow/<id>` | Monthly cash flow time-series | `months`: 3–24 (default 12) |
| `GET` | `/cashflow/<id>/expenses` | Expense category breakdown | `id`: int |
| `GET` | `/analytics/kpis/<id>` | Full KPI snapshot (11 metrics) | `id`: int |
| `GET` | `/analytics/alerts/<id>` | Auto-generated alert list | `id`: int |
| `GET` | `/analytics/summary` | Portfolio-wide aggregated totals | — |

### Example Response — `/api/analytics/kpis/1`
```json
{
  "total_revenue": 6284310,
  "total_expenses": 5021480,
  "net_profit": 1262830,
  "profit_margin": 20.1,
  "current_inflow": 548200,
  "current_outflow": 421600,
  "current_net": 126600,
  "revenue_change_pct": 3.4,
  "expense_change_pct": 1.8,
  "burn_rate": 14053,
  "runway_days": 89
}
```

---

## 🧪 Testing

**38 tests** across 8 test classes. Covers data integrity, edge cases, API routes, and determinism.

```bash
cd backend
pytest tests/ -v --cov=. --cov-report=term-missing
```

```
tests/test_backend.py::TestGetClients::test_returns_list              PASSED
tests/test_backend.py::TestGetClients::test_revenue_tiers_valid       PASSED
tests/test_backend.py::TestCashflowTimeseries::test_deterministic     PASSED
tests/test_backend.py::TestCashflowTimeseries::test_inflow_positive   PASSED
tests/test_backend.py::TestKpis::test_net_profit_consistency          PASSED
tests/test_backend.py::TestAnalyticsEndpoint::test_portfolio_summary  PASSED
... (38 total)

============================== 38 passed in 0.16s ==============================
```

---

## ⚙️ CI/CD Pipeline

Every push to any branch and every PR to `main`/`develop` triggers the pipeline automatically.

```
Push / PR
    │
    ├──▶  backend-tests
    │         pip install → pytest --cov → upload coverage artifact
    │
    ├──▶  frontend-tests
    │         npm ci → jest → npm run build → upload build artifact
    │
    └──▶  integration-check  (needs both above to pass)
              start Flask → curl /health → curl /clients/ → curl /analytics/summary
```

The integration job spins up the real Flask server and hits three endpoints with `curl`, failing the build if any return a non-2xx response. No mocks — real HTTP.

---

## 🔌 Plugging in Real Data

The only file that needs replacing to go live is `backend/models/data_engine.py`. Every route, chart, KPI, and alert stays exactly the same.

**Option A — CSV/Excel upload**
```python
import pandas as pd

@app.route("/api/upload", methods=["POST"])
def upload():
    df = pd.read_csv(request.files["file"])
    # parse → return as cashflow format
```

**Option B — QuickBooks / Xero API**
```python
import requests

def get_cashflow_timeseries(client_id, months=12):
    token = get_oauth_token(client_id)
    return requests.get(
        f"https://api.xero.com/api.xro/2.0/Reports/CashSummary",
        headers={"Authorization": f"Bearer {token}"}
    ).json()
```

**Option C — PostgreSQL**
```python
from sqlalchemy import create_engine

engine = create_engine(os.getenv("DATABASE_URL"))

def get_cashflow_timeseries(client_id, months=12):
    return engine.execute(
        "SELECT month, inflow, outflow FROM cashflow WHERE client_id = %s ...",
        (client_id,)
    ).fetchall()
```

**Option D — Manual Entry (already built)**
Switch to Manual Entry mode in the dashboard UI → type in monthly figures → Apply.

---

## 🗺 Roadmap

- [ ] PostgreSQL integration with SQLAlchemy ORM
- [ ] QuickBooks Online OAuth flow
- [ ] PDF report export per client
- [ ] Date range picker (custom start/end)
- [ ] User authentication (JWT)
- [ ] Dark/light theme toggle
- [ ] Mobile-responsive layout

---

## 👤 Author

**Immanah** — [@immanah-codes](https://github.com/immanah-codes)

---

<div align="center">

Made with obsessive attention to detail · Flask · React · Recharts · pytest · GitHub Actions

<br/>

⭐ **Star this repo if it helped you** ⭐

</div>
