from flask import Blueprint, jsonify
from models.data_engine import get_kpis, get_alerts, get_client

analytics_bp = Blueprint("analytics", __name__)


@analytics_bp.route("/kpis/<int:client_id>", methods=["GET"])
def kpis(client_id):
    client = get_client(client_id)
    if not client:
        return jsonify({"error": "Client not found"}), 404
    return jsonify(get_kpis(client_id))


@analytics_bp.route("/alerts/<int:client_id>", methods=["GET"])
def alerts(client_id):
    client = get_client(client_id)
    if not client:
        return jsonify({"error": "Client not found"}), 404
    return jsonify(get_alerts(client_id))


@analytics_bp.route("/summary", methods=["GET"])
def portfolio_summary():
    """Aggregate stats across all clients for the portfolio overview."""
    from models.data_engine import get_clients, get_kpis
    clients = get_clients()
    totals = {"total_revenue": 0, "total_expenses": 0, "net_profit": 0}
    for c in clients:
        kpis = get_kpis(c["id"])
        for key in totals:
            totals[key] += kpis.get(key, 0)
    totals["profit_margin"] = round(
        (totals["net_profit"] / totals["total_revenue"]) * 100, 1
    ) if totals["total_revenue"] else 0
    totals["client_count"] = len(clients)
    return jsonify(totals)
