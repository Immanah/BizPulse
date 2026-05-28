"""
Simulated data engine for BizPulse — generates realistic medium-enterprise metrics.
In production this would connect to a real DB / ERP integration layer.
"""
import random
import math
from datetime import datetime, timedelta

CLIENTS = [
    {"id": 1, "name": "Meridian Logistics",  "sector": "Transportation", "revenue_tier": "mid",  "since": "2019-03"},
    {"id": 2, "name": "Apex Dynamics",       "sector": "Manufacturing",  "revenue_tier": "high", "since": "2018-07"},
    {"id": 3, "name": "NovaBuild Group",     "sector": "Construction",   "revenue_tier": "mid",  "since": "2021-01"},
    {"id": 4, "name": "Clearwater Foods",    "sector": "Food & Bev",     "revenue_tier": "low",  "since": "2022-06"},
    {"id": 5, "name": "Stratum Capital",     "sector": "Finance",        "revenue_tier": "high", "since": "2017-11"},
    {"id": 6, "name": "Helix BioMed",        "sector": "Healthcare",     "revenue_tier": "mid",  "since": "2020-04"},
]

BASE_INFLOW = {"low": 180_000, "mid": 520_000, "high": 1_400_000}


def _seeded(client_id: int):
    rng = random.Random(client_id * 42 + 7)
    return rng


def get_clients():
    return CLIENTS


def get_client(client_id: int):
    return next((c for c in CLIENTS if c["id"] == client_id), None)


def get_cashflow_timeseries(client_id: int, months: int = 12):
    rng = _seeded(client_id)
    client = get_client(client_id)
    if not client:
        return []
    base = BASE_INFLOW[client["revenue_tier"]]

    series = []
    today = datetime.now()
    for i in range(months - 1, -1, -1):
        dt = today - timedelta(days=30 * i)
        label = dt.strftime("%b %Y")
        seasonal = math.sin((dt.month / 12) * 2 * math.pi) * 0.12
        growth = i * 0.008  # slight historical growth trend
        noise = rng.gauss(0, 0.06)
        inflow = base * (1 + seasonal + noise + growth)
        expense_ratio = rng.uniform(0.68, 0.84)
        outflow = inflow * expense_ratio
        series.append({
            "month": label,
            "inflow": round(inflow),
            "outflow": round(outflow),
            "net": round(inflow - outflow),
        })
    return series


def get_kpis(client_id: int):
    cf = get_cashflow_timeseries(client_id)
    if not cf:
        return {}
    latest = cf[-1]
    prev = cf[-2]

    total_revenue = sum(m["inflow"] for m in cf)
    total_expenses = sum(m["outflow"] for m in cf)
    net_profit = total_revenue - total_expenses
    margin = (net_profit / total_revenue) * 100 if total_revenue else 0

    rev_change = ((latest["inflow"] - prev["inflow"]) / prev["inflow"]) * 100 if prev["inflow"] else 0
    exp_change = ((latest["outflow"] - prev["outflow"]) / prev["outflow"]) * 100 if prev["outflow"] else 0

    daily_burn = latest["outflow"] / 30
    runway_days = round(net_profit / daily_burn) if daily_burn > 0 else 999

    return {
        "total_revenue":       round(total_revenue),
        "total_expenses":      round(total_expenses),
        "net_profit":          round(net_profit),
        "profit_margin":       round(margin, 1),
        "current_inflow":      latest["inflow"],
        "current_outflow":     latest["outflow"],
        "current_net":         latest["net"],
        "revenue_change_pct":  round(rev_change, 1),
        "expense_change_pct":  round(exp_change, 1),
        "burn_rate":           round(daily_burn),
        "runway_days":         runway_days,
    }


def get_expense_breakdown(client_id: int):
    rng = _seeded(client_id + 1000)
    raw = [
        ("Payroll",    rng.uniform(0.38, 0.44)),
        ("Operations", rng.uniform(0.16, 0.22)),
        ("Marketing",  rng.uniform(0.08, 0.14)),
        ("R&D",        rng.uniform(0.06, 0.11)),
        ("Admin",      rng.uniform(0.04, 0.08)),
    ]
    total = sum(p for _, p in raw)
    result = [{"category": name, "percentage": round(pct / total * 100, 1)} for name, pct in raw]
    result.append({"category": "Other", "percentage": round(100 - sum(r["percentage"] for r in result), 1)})
    return result


def get_alerts(client_id: int):
    kpis = get_kpis(client_id)
    alerts = []
    if not kpis:
        return alerts
    if kpis["profit_margin"] < 15:
        alerts.append({"level": "warning",  "msg": f"Profit margin at {kpis['profit_margin']}% — below 15% threshold"})
    if kpis["runway_days"] < 90:
        alerts.append({"level": "critical", "msg": f"Runway at {kpis['runway_days']} days — review burn rate immediately"})
    if kpis["expense_change_pct"] > 8:
        alerts.append({"level": "warning",  "msg": f"Expenses up {kpis['expense_change_pct']}% MoM — investigate drivers"})
    if kpis["revenue_change_pct"] > 10:
        alerts.append({"level": "info",     "msg": f"Strong revenue growth: +{kpis['revenue_change_pct']}% this month"})
    if not alerts:
        alerts.append({"level": "info",     "msg": "All metrics within normal operating ranges"})
    return alerts
