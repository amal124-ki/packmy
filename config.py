"""
PackMY configuration.

DATABASE
--------
By default PackMY uses MySQL, as planned in the report.
Set the DATABASE_URL environment variable, or edit DEFAULT_DB below.

    MySQL  : mysql+pymysql://root:yourpassword@localhost/packmy
    SQLite : sqlite:///packmy.db   (no installation needed - handy for quick testing)
"""
import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# Change "root:password" to your own MySQL username and password.
DEFAULT_DB = "mysql+pymysql://root:@localhost/packmy"


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "change-this-secret-key-before-demo")
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL", DEFAULT_DB)
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Where the admin's ALNS parameter settings are saved
    ALNS_SETTINGS_FILE = os.path.join(BASE_DIR, "instance", "alns_settings.json")
