from database import supabase
from models import UserCreate
import json

def test_create_user():
    print("Testing POST /users logic...")
    
    # Mock data similar to what the frontend sends
    user_data = {
        "clerk_id": "test_debug_user_2",
        "email": "debug2@example.com",
        "first_name": "Debug",
        "last_name": "User",
        "image_url": "https://example.com/image.png"
        # role is NOT sent by frontend
    }
    
    try:
        user = UserCreate(**user_data)
        print(f"Model created: {user}")
        
        # Try Upsert
        print("Testing Upsert...")
        upsert_data = user.model_dump()
        # We want to ignore 'role' if it's None during update, but upsert replaces the row.
        # However, for a simple sync, maybe we just want to ensure the user exists and update basic info.
        # If we use upsert, we might overwrite the role if we are not careful, or we need to fetch it first?
        # Actually, if we just want to sync profile info (name, email, image), we can use upsert.
        # But we don't want to reset the role to 'viewer' if it's already 'admin'.
        
        # Better approach for race condition:
        # Try INSERT. If it fails (unique violation), then UPDATE.
        # OR use upsert with on_conflict='clerk_id' and ignore_duplicates=False?
        
        # Let's try the upsert method from the library
        data = supabase.table("users").upsert(upsert_data, on_conflict="clerk_id").execute()
        print(f"Upsert response: {data}")
            
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_create_user()
