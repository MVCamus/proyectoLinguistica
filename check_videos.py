import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_FILE = os.path.join(SCRIPT_DIR, ".env")
CORPUS_DIR = os.path.join(SCRIPT_DIR, "corpus")

# ---------- Leer DATABASE_URL del archivo .env ----------
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

# Convertir postgresql+asyncpg:// -> postgresql:// para psycopg2
database_url = database_url.replace("+asyncpg", "")

print("=" * 55)
print(" VERIFICACION DE VIDEOS APROBADOS - SUPABASE")
print("=" * 55)
# Ocultar password en el log
safe_url = database_url.split("@")[1] if "@" in database_url else database_url
print(f"  Host: {safe_url}")
print()

# ---------- Conectar a PostgreSQL ----------
import psycopg2

try:
    conn = psycopg2.connect(database_url, connect_timeout=15)
    cur = conn.cursor()
    print("Conexion a Supabase establecida.")
except Exception as e:
    print(f"ERROR al conectar: {e}")
    sys.exit(1)

# ---------- Verify tables exist ----------
cur.execute("""
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
""")
tables = [r[0] for r in cur.fetchall()]
print(f"  Tablas en Supabase: {tables if tables else 'NINGUNA'}")
print()

if "videos" not in tables:
    print("ERROR: La tabla 'videos' no existe en Supabase.")
    print("Ejecuta la aplicacion para que se creen las tablas automaticamente.")
    conn.close()
    sys.exit(1)

# ---------- Count total ----------
cur.execute("SELECT COUNT(*) FROM videos")
total = cur.fetchone()[0]

# ---------- Count by status ----------
cur.execute("SELECT status, COUNT(*) FROM videos GROUP BY status ORDER BY COUNT(*) DESC")
by_status = cur.fetchall()

# ---------- Count aprobados ----------
cur.execute("SELECT COUNT(*) FROM videos WHERE status = 'aprobado'")
aprobados = cur.fetchone()[0]

# ---------- Count listos_para_triage ----------
cur.execute("SELECT COUNT(*) FROM videos WHERE status = 'listo_para_triage'")
listos = cur.fetchone()[0]

# ---------- Count pendientes ----------
cur.execute("SELECT COUNT(*) FROM videos WHERE status = 'pendiente'")
pendientes = cur.fetchone()[0]

# ---------- Count with corpus_number ----------
cur.execute("SELECT COUNT(*) FROM videos WHERE corpus_number IS NOT NULL")
con_numero = cur.fetchone()[0]

# ---------- Max corpus_number ----------
cur.execute("SELECT MAX(corpus_number) FROM videos")
max_corpus = cur.fetchone()[0] or 0

# ---------- Corpus text files ----------
txt_files = []
if os.path.exists(CORPUS_DIR):
    txt_files = [f for f in os.listdir(CORPUS_DIR) if f.endswith(".txt")]

conn.close()

# ---------- Resultados ----------
print("=" * 55)
print(" RESULTADOS")
print("=" * 55)
print(f"  Total de videos en DB:              {total}")
print(f"  Videos APROBADOS:                   {aprobados}")
print(f"  Videos LISTOS PARA TRIAGE:          {listos}")
print(f"  Videos PENDIENTES:                  {pendientes}")
print(f"  Videos con corpus_number asignado:  {con_numero}")
print(f"  Max corpus_number:                  {max_corpus}")
print(f"  Archivos .txt en corpus/:           {len(txt_files)}")
print("-" * 55)
print("  Desglose completo por status:")
for status, count in by_status:
    bar = "#" * min(count, 40) if count > 0 else ""
    print(f"    {status + ':':.<30} {count:>4}  {bar}")
print("-" * 55)

if total == 0:
    print("RESULTADO: La base de datos esta VACIA.")
elif aprobados == total:
    print("RESULTADO: SI - Todos los videos estan APROBADOS.")
else:
    pend = total - aprobados
    print(f"RESULTADO: NO - Faltan {pend} video(s) por aprobar ({aprobados}/{total}).")

if len(txt_files) != aprobados:
    print(f"AVISO: Discrepancia: {len(txt_files)} .txt vs {aprobados} aprobados en DB.")
else:
    print("Los archivos .txt en corpus/ coinciden con los aprobados en DB.")

print("=" * 55)
