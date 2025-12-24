
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)

try:
    response = supabase.table("projects").select("*").limit(1).execute()
    print("Table 'projects' exists.")
    print(response)
except Exception as e:
    print(f"Error accessing 'projects' table: {e}")
