import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url: str = os.environ.get("SUPABASE_URL", "")
key: str = os.environ.get("SUPABASE_KEY", "")

# Admin Database (for license verification)
admin_url: str = os.environ.get("ADMIN_SUPABASE_URL", url)
admin_key: str = os.environ.get("ADMIN_SUPABASE_KEY", key)

# Validate that required environment variables are set
if not url:
    raise ValueError("SUPABASE_URL environment variable is not set.")
if not key:
    raise ValueError("SUPABASE_KEY environment variable is not set.")

supabase: Client = create_client(url, key)
admin_supabase: Client = create_client(admin_url, admin_key)
