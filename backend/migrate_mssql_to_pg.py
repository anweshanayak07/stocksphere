"""
migrate_mssql_to_pg.py

Reads all rows from MSSQL (Items, Issues, Users tables)
and inserts them into the PostgreSQL database.
Run once: .\venv312\Scripts\python.exe migrate_mssql_to_pg.py
"""

import os
import pymssql
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from decimal import Decimal

# ---------------------------------------------------------------------------
# Load env
# ---------------------------------------------------------------------------
load_dotenv()

# MSSQL connection parameters (from inventory-backend/.env)
MSSQL_SERVER   = "localhost"
MSSQL_PORT     = 1433
MSSQL_USER     = "inventory_user"
MSSQL_PASSWORD = "VECTRA"
MSSQL_DATABASE = "inventory_db"

# PostgreSQL URL (from inventory-backend-py/.env)
PG_URL = os.getenv("DATABASE_URL", "postgresql://inventory_user:VECTRA@localhost:5432/inventory_db")

# ---------------------------------------------------------------------------
# Connect to MSSQL
# ---------------------------------------------------------------------------
print("Connecting to MSSQL...")
mssql_conn = pymssql.connect(
    server=MSSQL_SERVER,
    port=MSSQL_PORT,
    user=MSSQL_USER,
    password=MSSQL_PASSWORD,
    database=MSSQL_DATABASE,
)
mssql_cursor = mssql_conn.cursor(as_dict=True)
print("Connected to MSSQL.")

# ---------------------------------------------------------------------------
# Connect to PostgreSQL via SQLAlchemy
# ---------------------------------------------------------------------------
print("Connecting to PostgreSQL...")
pg_engine = create_engine(PG_URL, echo=False)
PgSession = sessionmaker(bind=pg_engine)
pg = PgSession()
print("Connected to PostgreSQL.")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def pg_exec(sql, params=None):
    pg.execute(text(sql), params or {})


def migrate_users():
    print("\n--- Migrating Users ---")
    mssql_cursor.execute("SELECT id, username, password, role FROM users")
    rows = mssql_cursor.fetchall()
    print(f"Found {len(rows)} users in MSSQL.")

    # Disable sequence auto-increment temporarily to preserve IDs
    pg_exec("TRUNCATE TABLE users RESTART IDENTITY CASCADE")
    for row in rows:
        pg_exec(
            "INSERT INTO users (id, username, password, role) VALUES (:id, :username, :password, :role) "
            "ON CONFLICT (id) DO NOTHING",
            {"id": row["id"], "username": row["username"],
             "password": row["password"], "role": row.get("role", "user")},
        )
    # Re-sync sequence
    pg_exec("SELECT setval('users_id_seq', (SELECT COALESCE(MAX(id), 1) FROM users))")
    pg.commit()
    print(f"Migrated {len(rows)} users to PostgreSQL.")


def migrate_items():
    print("\n--- Migrating Items ---")
    mssql_cursor.execute(
        "SELECT id, name, quantity, location, category, make, material_code, min_quantity FROM Items"
    )
    rows = mssql_cursor.fetchall()
    print(f"Found {len(rows)} items in MSSQL.")

    pg_exec("TRUNCATE TABLE items RESTART IDENTITY CASCADE")
    for row in rows:
        pg_exec(
            "INSERT INTO items (id, name, quantity, location, category, make, material_code, min_quantity) "
            "VALUES (:id, :name, :quantity, :location, :category, :make, :material_code, :min_quantity) "
            "ON CONFLICT (id) DO NOTHING",
            {
                "id":            row["id"],
                "name":          row["name"],
                "quantity":      int(row["quantity"] or 0),
                "location":      row.get("location") or "",
                "category":      row.get("category") or "",
                "make":          row.get("make") or "",
                "material_code": row.get("material_code") or "",
                "min_quantity":  int(row.get("min_quantity") or 0),
            },
        )
    pg_exec("SELECT setval('items_id_seq', (SELECT COALESCE(MAX(id), 1) FROM items))")
    pg.commit()
    print(f"Migrated {len(rows)} items to PostgreSQL.")


def migrate_issues():
    print("\n--- Migrating Issues ---")
    mssql_cursor.execute(
        "SELECT id, item_id, quantity, issued_to, sap_notification, note, issue_date, type FROM Issues"
    )
    rows = mssql_cursor.fetchall()
    print(f"Found {len(rows)} issue records in MSSQL.")

    pg_exec("TRUNCATE TABLE issues RESTART IDENTITY CASCADE")
    for row in rows:
        pg_exec(
            "INSERT INTO issues (id, item_id, quantity, issued_to, sap_notification, note, issue_date, type) "
            "VALUES (:id, :item_id, :quantity, :issued_to, :sap_notification, :note, :issue_date, :type) "
            "ON CONFLICT (id) DO NOTHING",
            {
                "id":               row["id"],
                "item_id":          row["item_id"],
                "quantity":         Decimal(str(row["quantity"] or 0)),
                "issued_to":        row.get("issued_to") or "",
                "sap_notification": row.get("sap_notification") or "",
                "note":             row.get("note") or "",
                "issue_date":       row.get("issue_date"),
                "type":             row.get("type") or "ISSUE",
            },
        )
    pg_exec("SELECT setval('issues_id_seq', (SELECT COALESCE(MAX(id), 1) FROM issues))")
    pg.commit()
    print(f"Migrated {len(rows)} issue records to PostgreSQL.")


# ---------------------------------------------------------------------------
# Run migrations
# ---------------------------------------------------------------------------
try:
    migrate_users()
    migrate_items()
    migrate_issues()
    print("\n✅ Migration complete! All data has been moved from MSSQL → PostgreSQL.")
except Exception as e:
    pg.rollback()
    print(f"\n❌ Migration failed: {e}")
    raise
finally:
    pg.close()
    mssql_conn.close()
