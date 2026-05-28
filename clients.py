from flask import Blueprint, jsonify
from models.data_engine import get_clients, get_client

clients_bp = Blueprint("clients", __name__)


@clients_bp.route("/", methods=["GET"])
def list_clients():
    return jsonify(get_clients())


@clients_bp.route("/<int:client_id>", methods=["GET"])
def single_client(client_id):
    client = get_client(client_id)
    if not client:
        return jsonify({"error": "Client not found"}), 404
    return jsonify(client)
