"""
Unit tests for BizPulse backend — data engine and API routes.
Run with:  pytest backend/tests/ -v
"""
import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models.data_engine import (
    get_clients,
    get_client,
    get_cashflow_timeseries,
    get_kpis,
    get_expense_breakdown,
    get_alerts,
)
from app import app as flask_app


# ─── Data Engine Tests ────────────────────────────────────────────────────────

class TestGetClients:
    def test_returns_list(self):
        clients = get_clients()
        assert isinstance(clients, list)

    def test_at_least_one_client(self):
        assert len(get_clients()) >= 1

    def test_client_fields(self):
        for c in get_clients():
            assert "id" in c
            assert "name" in c
            assert "sector" in c
            assert "revenue_tier" in c

    def test_revenue_tiers_valid(self):
        valid = {"low", "mid", "high"}
        for c in get_clients():
            assert c["revenue_tier"] in valid


class TestGetClient:
    def test_known_client(self):
        c = get_client(1)
        assert c is not None
        assert c["id"] == 1

    def test_unknown_client_returns_none(self):
        assert get_client(9999) is None


class TestCashflowTimeseries:
    def test_default_12_months(self):
        data = get_cashflow_timeseries(1)
        assert len(data) == 12

    def test_custom_months(self):
        data = get_cashflow_timeseries(1, months=6)
        assert len(data) == 6

    def test_data_shape(self):
        for row in get_cashflow_timeseries(1):
            assert "month" in row
            assert "inflow" in row
            assert "outflow" in row
            assert "net" in row

    def test_net_equals_inflow_minus_outflow(self):
        # Each field is rounded independently, so allow ±1 rounding delta
        for row in get_cashflow_timeseries(1):
            assert abs(row["net"] - (row["inflow"] - row["outflow"])) <= 1

    def test_inflow_positive(self):
        for row in get_cashflow_timeseries(1):
            assert row["inflow"] > 0

    def test_different_clients_differ(self):
        d1 = get_cashflow_timeseries(1)
        d2 = get_cashflow_timeseries(2)
        assert d1[0]["inflow"] != d2[0]["inflow"]

    def test_invalid_client_returns_empty(self):
        assert get_cashflow_timeseries(9999) == []

    def test_deterministic(self):
        """Same client always yields same result."""
        a = get_cashflow_timeseries(3)
        b = get_cashflow_timeseries(3)
        assert a == b


class TestKpis:
    def test_required_keys(self):
        kpis = get_kpis(1)
        required = [
            "total_revenue", "total_expenses", "net_profit",
            "profit_margin", "current_inflow", "current_outflow",
            "current_net", "revenue_change_pct", "expense_change_pct",
            "burn_rate", "runway_days",
        ]
        for key in required:
            assert key in kpis, f"Missing KPI key: {key}"

    def test_margin_in_reasonable_range(self):
        kpis = get_kpis(1)
        assert 0 <= kpis["profit_margin"] <= 100

    def test_net_profit_consistency(self):
        kpis = get_kpis(1)
        assert kpis["net_profit"] == kpis["total_revenue"] - kpis["total_expenses"]

    def test_burn_rate_positive(self):
        assert get_kpis(1)["burn_rate"] > 0

    def test_invalid_client_returns_empty(self):
        assert get_kpis(9999) == {}


class TestExpenseBreakdown:
    def test_returns_list(self):
        assert isinstance(get_expense_breakdown(1), list)

    def test_percentages_sum_to_100(self):
        breakdown = get_expense_breakdown(1)
        total = sum(b["percentage"] for b in breakdown)
        assert abs(total - 100.0) < 1.0  # allow 1% float tolerance

    def test_each_item_has_fields(self):
        for item in get_expense_breakdown(1):
            assert "category" in item
            assert "percentage" in item

    def test_percentages_positive(self):
        for item in get_expense_breakdown(1):
            assert item["percentage"] >= 0


class TestAlerts:
    def test_returns_list(self):
        assert isinstance(get_alerts(1), list)

    def test_alert_fields(self):
        for alert in get_alerts(1):
            assert "level" in alert
            assert "msg" in alert

    def test_alert_levels_valid(self):
        valid = {"info", "warning", "critical"}
        for alert in get_alerts(1):
            assert alert["level"] in valid

    def test_at_least_one_alert(self):
        assert len(get_alerts(1)) >= 1


# ─── API Route Tests ──────────────────────────────────────────────────────────

@pytest.fixture
def client():
    flask_app.config["TESTING"] = True
    with flask_app.test_client() as c:
        yield c


class TestHealthEndpoint:
    def test_health_ok(self, client):
        r = client.get("/api/health")
        assert r.status_code == 200
        data = r.get_json()
        assert data["status"] == "ok"


class TestClientsEndpoint:
    def test_list(self, client):
        r = client.get("/api/clients/")
        assert r.status_code == 200
        assert isinstance(r.get_json(), list)

    def test_single_client(self, client):
        r = client.get("/api/clients/1")
        assert r.status_code == 200
        assert r.get_json()["id"] == 1

    def test_missing_client_404(self, client):
        r = client.get("/api/clients/9999")
        assert r.status_code == 404


class TestCashflowEndpoint:
    def test_default(self, client):
        r = client.get("/api/cashflow/1")
        assert r.status_code == 200
        data = r.get_json()
        assert len(data) == 12

    def test_custom_months(self, client):
        r = client.get("/api/cashflow/1?months=6")
        assert r.status_code == 200
        assert len(r.get_json()) == 6

    def test_months_clamped(self, client):
        r = client.get("/api/cashflow/1?months=100")
        assert r.status_code == 200
        assert len(r.get_json()) == 24  # max

    def test_expenses(self, client):
        r = client.get("/api/cashflow/1/expenses")
        assert r.status_code == 200
        assert isinstance(r.get_json(), list)


class TestAnalyticsEndpoint:
    def test_kpis(self, client):
        r = client.get("/api/analytics/kpis/1")
        assert r.status_code == 200
        assert "net_profit" in r.get_json()

    def test_alerts(self, client):
        r = client.get("/api/analytics/alerts/1")
        assert r.status_code == 200
        assert isinstance(r.get_json(), list)

    def test_portfolio_summary(self, client):
        r = client.get("/api/analytics/summary")
        assert r.status_code == 200
        data = r.get_json()
        assert "total_revenue" in data
        assert "client_count" in data
