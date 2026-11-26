"""
PackMY - Web-Based AI Destination Recommendation and Automated Itinerary
for Malaysian Tourism (Workshop 2, BAXU 3923)

Backend API:  python backend/app.py        (runs on http://127.0.0.1:5000)
Frontend UI:  cd frontend && npm run dev   (runs on http://localhost:3000)
"""
import os

from flask import Flask, jsonify
from flask_login import LoginManager

from config import Config
from models import User, db

login_manager = LoginManager()


@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))


@login_manager.unauthorized_handler
def unauthorized():
    return jsonify({"error": "Authentication required."}), 401


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    os.makedirs(os.path.join(app.root_path, "instance"), exist_ok=True)

    db.init_app(app)
    login_manager.init_app(app)

    from routes.api import api_bp
    app.register_blueprint(api_bp, url_prefix="/api")

    @app.route("/")
    def health():
        return jsonify({
            "status": "ok",
            "service": "PackMY Flask AI API",
            "frontend": "http://localhost:3000",
        })

    with app.app_context():
        db.create_all()
    return app


if __name__ == "__main__":
    create_app().run(debug=True)
