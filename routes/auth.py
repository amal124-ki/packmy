"""Authorisation: register, login, logout."""
from flask import Blueprint, flash, redirect, render_template, request, url_for
from flask_login import current_user, login_required, login_user, logout_user

from models import TravelProfile, User, db

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/register", methods=["GET", "POST"])
def register():
    if current_user.is_authenticated:
        return redirect(url_for("traveller.dashboard"))
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        email = request.form.get("email", "").strip().lower()
        pw = request.form.get("password", "")
        if not name or not email or len(pw) < 6:
            flash("Please fill in all fields. Password needs at least 6 characters.", "error")
        elif pw != request.form.get("confirm", ""):
            flash("Passwords do not match.", "error")
        elif User.query.filter_by(email=email).first():
            flash("That email is already registered. Please log in.", "error")
        else:
            user = User(name=name, email=email)
            user.set_password(pw)  # hashed, never stored as plain text
            user.profile = TravelProfile()
            db.session.add(user)
            db.session.commit()
            login_user(user)
            flash("Welcome to PackMY! Set up your travel profile to get better recommendations.", "success")
            return redirect(url_for("traveller.profile"))
    return render_template("auth/register.html")


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("admin.dashboard" if current_user.is_admin else "traveller.dashboard"))
    if request.method == "POST":
        user = User.query.filter_by(email=request.form.get("email", "").strip().lower()).first()
        if user and user.check_password(request.form.get("password", "")):
            if not user.is_active_account:
                flash("This account has been deactivated by the admin.", "error")
            else:
                login_user(user, remember=bool(request.form.get("remember")))
                nxt = request.args.get("next")
                if nxt and nxt.startswith("/"):
                    return redirect(nxt)
                return redirect(url_for("admin.dashboard" if user.is_admin else "traveller.dashboard"))
        else:
            flash("Wrong email or password.", "error")
    return render_template("auth/login.html")


@auth_bp.route("/logout")
@login_required
def logout():
    logout_user()
    flash("You have logged out.", "info")
    return redirect(url_for("traveller.home"))
