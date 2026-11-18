"""
PackMY - Web-Based AI Destination Recommendation and Automated Itinerary
for Malaysian Tourism (Workshop 2, BAXU 3923)

Run:  python app.py   then open http://127.0.0.1:5000
"""
import os
import secrets

from flask import Flask, abort, request, session
from flask_login import LoginManager

from config import Config
from models import User, db

login_manager = LoginManager()
login_manager.login_view = "auth.login"
login_manager.login_message_category = "info"


@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))


def csrf_token():
    """Simple CSRF protection: every form carries a secret token from the session."""
    if "_csrf" not in session:
        session["_csrf"] = secrets.token_hex(16)
    return session["_csrf"]


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    os.makedirs(os.path.join(app.root_path, "instance"), exist_ok=True)

    db.init_app(app)
    login_manager.init_app(app)

    @app.before_request
    def check_csrf():
        if request.method == "POST" and not request.is_json:
            if request.form.get("_csrf") != session.get("_csrf"):
                abort(400, "Form expired. Please go back, refresh the page and try again.")

    app.jinja_env.globals["csrf_token"] = csrf_token

    from routes.admin import admin_bp
    from routes.auth import auth_bp
    from routes.traveller import traveller_bp
    app.register_blueprint(auth_bp)
    app.register_blueprint(traveller_bp)
    app.register_blueprint(admin_bp, url_prefix="/admin")

    with app.app_context():
        db.create_all()
    return app


if __name__ == "__main__":
    create_app().run(debug=True)
