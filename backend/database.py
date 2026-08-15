import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# --- LOCAL DATABASE ---
# When running in Docker, DATABASE_URL should be set in docker-compose.yml
# For local development outside Docker, default to local Postgres with SQLite fallback
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:plutopass@localhost:5432/plutodb")

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

try:
    engine = create_engine(DATABASE_URL, connect_args=connect_args)
    if DATABASE_URL.startswith("postgresql"):
        with engine.connect() as conn:
            pass
except Exception as e:
    print(f"\n[Pluto Backend] WARNING: Unable to connect to PostgreSQL at {DATABASE_URL}")
    print("[Pluto Backend] Falling back to local SQLite database (sqlite:///./pluto.db)\n")
    DATABASE_URL = "sqlite:///./pluto.db"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- REMOTE ADMIN DATABASE (Cloud-based for license verification) ---
# Admin Database (for license verification against Pluto Admin)
admin_url: str = os.environ.get("ADMIN_SUPABASE_URL", "")
admin_key: str = os.environ.get("ADMIN_SUPABASE_KEY", "")

# We keep this to talk to the centralized "Pluto Admin" for license checks
admin_supabase: Client = None
if admin_url and admin_key:
    try:
        admin_supabase = create_client(admin_url, admin_key)
    except Exception as e:
        print(f"[Pluto Backend] Warning initializing admin Supabase client: {e}")
else:
    # If not set, use placeholder or handle error in verification logic
    pass

# We no longer export the local 'supabase' client as we use SQLAlchemy now.
