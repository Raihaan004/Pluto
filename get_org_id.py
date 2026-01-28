import os
from supabase import create_client
from dotenv import load_dotenv

env_path = r"d:\Projects\Pluto\pluto-admin\.env.local"
load_dotenv(env_path)

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not url or not key:
    print("Missing env")
else:
    try:
        supabase = create_client(url, key)
        res = supabase.table("organizations").select("id").ilike("name", "DRIVVIZE").execute()
        print(f"RESULT_ID:{res.data[0]['id'] if res.data else 'NOT_FOUND'}")
    except Exception as e:
        print(f"ERROR:{e}")
