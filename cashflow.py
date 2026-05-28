from flask import Blueprint, jsonify, request
from models.data_engine import get_cashflow_timeseries, get_expense_breakdown

cashflow_bp = Blueprint("cashflow", __name__)


@cashflow_bp.route("/<int:client_id>", methods=["GET"])
def cashflow(client_id):
    months = request.args.get("months", 12, type=int)
    months = max(3, min(24, months))  # clamp 3–24
    data = get_cashflow_timeseries(client_id, months)
    if not data:
        return jsonify({"error": "Client not found"}), 404
    return jsonify(data)


@cashflow_bp.route("/<int:client_id>/expenses", methods=["GET"])
def expenses(client_id):
    data = get_expense_breakdown(client_id)
    if not data:
        return jsonify({"error": "Client not found"}), 404
    return jsonify(data)
