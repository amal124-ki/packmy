"""
PackMY configuration.

DATABASE
--------
Configured for Supabase (PostgreSQL) via DATABASE_URL in .env.
Falls back to local SQLite (sqlite:///packmy.db) if DATABASE_URL is not set.
"""
import os

from dotenv import load_dotenv

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

DEFAULT_DB = "sqlite:///packmy.db"


def _normalize_db_url(url: str) -> str:
    """Convert standard postgres:// or postgresql:// URLs to use the psycopg v3 driver."""
    if url.startswith("postgres://"):
        url = "postgresql+psycopg://" + url[len("postgres://"):]
    elif url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]

    if ("supabase.co" in url or "supabase.com" in url) and "sslmode=" not in url:
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}sslmode=require"
    return url


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "change-this-secret-key-before-demo")
    SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
    SUPABASE_PUBLISHABLE_KEY = os.environ.get("SUPABASE_PUBLISHABLE_KEY", "")
    SQLALCHEMY_DATABASE_URI = _normalize_db_url(os.environ.get("DATABASE_URL", DEFAULT_DB))
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}

    # Where the admin's ALNS parameter settings are saved
    ALNS_SETTINGS_FILE = os.path.join(BASE_DIR, "instance", "alns_settings.json")
