from flask import Flask
from flask_cors import CORS
from routes.analytics import analytics_bp
from routes.clients import clients_bp
from routes.cashflow import cashflow_bp

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000"])

app.register_blueprint(analytics_bp, url_prefix="/api/analytics")
app.register_blueprint(clients_bp, url_prefix="/api/clients")
app.register_blueprint(cashflow_bp, url_prefix="/api/cashflow")


@app.route("/api/health")
def health():
    return {"status": "ok", "service": "BizPulse API", "version": "1.0.0"}


if __name__ == "__main__":
    app.run(debug=True, port=5000)
