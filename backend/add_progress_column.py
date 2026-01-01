import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

def add_progress_column():
    try:
        # We can't run arbitrary SQL via the python client easily without a RPC or similar
        # But we can try to update a non-existent column to see if it fails, 
        # or just assume the user will run the SQL.
        # However, I can try to use the 'rpc' if they have one for migrations, 
        # but usually they don't.
        
        print("Please run the following SQL in your Supabase SQL Editor:")
        print("ALTER TABLE projects ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    add_progress_column()
