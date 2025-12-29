import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url: str = os.environ.get("SUPABASE_URL", "")
key: str = os.environ.get("SUPABASE_KEY", "")

# Validate that required environment variables are set
if not url:
    raise ValueError("SUPABASE_URL environment variable is not set. Please set it in your Render environment variables.")
if not key:
    raise ValueError("SUPABASE_KEY environment variable is not set. Please set it in your Render environment variables.")

supabase: Client = create_client(url, key)
