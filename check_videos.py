import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_FILE = os.path.join(SCRIPT_DIR, ".env")
CORPUS_DIR = os.path.join(SCRIPT_DIR, "corpus")

database_url = None
if os.path.exists(ENV_FILE):
    with open(ENV_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line.startswith("DATABASE_URL="):
                database_url = line.split("=", 1)[1].strip().strip('"').strip("'")
                break

if not database_url:
    print("ERROR: No se encontro DATABASE_URL en el archivo '.env'")
    sys.exit(1)

database_url = database_url.replace("+asyncpg", "")

print("=" * 55)
print(" VERIFICACION DE VIDEOS APROBADOS - SUPABASE")
print("=" * 55)
safe_url = database_url.split("@")[1] if "@" in database_url else database_url
print(f"  Host: {safe_url}")
print()

import psycopg2

try:
    conn = psycopg2.connect(database_url, connect_timeout=15)
    cur = conn.cursor()
    print("Conexion a Supabase establecida.")
except Exception as e:
    print(f"ERROR al conectar: {e}")
    sys.exit(1)

cur.execute("""
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
