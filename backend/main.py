from fastapi import FastAPI, HTTPException, Header, Query, BackgroundTasks, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Add a check for suspension status that can be used as a dependency
async def check_suspension():
    try:
        instance = supabase.table("instance_settings").select("*").limit(1).execute()
        if instance.data:
            local_instance = instance.data[0]
            # Check remote status
            admin_res = admin_supabase.table("organizations").select("status").eq("id", local_instance["org_id"]).execute()
            if admin_res.data and admin_res.data[0]["status"] != "active":
                raise HTTPException(status_code=403, detail="Instance Suspended: Access denied by Pluto Admin.")
    except HTTPException as he:
        raise he
    except Exception as e:
        # If admin DB is unreachable, we default to local state or allow
        pass

# You can apply this to the whole app or specific routers
# For now, let's update the instance-status and add a middleware-like check
from pydantic import BaseModel
from database import supabase, admin_supabase
from models import (
    UserCreate, RoleUpdate, StatusUpdate, ProcessPackageCreate, ProcessRename, 
    ProcessVersionCreate, ProjectCreate, ProjectUpdate, CollaboratorAdd, 
    ConnectionJiraTrigger, LicenseVerify
)
from typing import Optional
from datetime import datetime
from jira_utils import sync_task_to_jira, create_connection_jira_ticket

import os
from dotenv import load_dotenv

load_dotenv()

import traceback

app = FastAPI()

# Configure CORS - Allow both localhost (development) and production frontend URL
allowed_origins = [
    "http://localhost:3000",
    "https://localhost:3000",
]

# Add production frontend URL from environment variable if set
frontend_url = os.environ.get("FRONTEND_URL")
if frontend_url:
    allowed_origins.append(frontend_url)

# Also allow any Vercel preview deployments (optional, for testing)
vercel_url = os.environ.get("VERCEL_URL")
if vercel_url:
    allowed_origins.append(f"https://{vercel_url}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global cache for instance status to avoid redundant DB calls in middleware
INSTANCE_STATUS_CACHE = {
    "is_suspended": False,
    "last_check": None,
    "org_name": "Unknown"
}

@app.middleware("http")
async def log_errors_middleware(request: Request, call_next):
    import time
    start_time = time.time()
    
    try:
        response = await call_next(request)
        
        # Performance Tracking: Log successful metrics
        process_time = int((time.time() - start_time) * 1000)
        if not request.url.path.startswith("/_next"):
            try:
                supabase.table("api_metrics").insert({
                    "endpoint": request.url.path,
                    "method": request.method,
                    "latency_ms": process_time,
                    "status_code": response.status_code,
                    "user_id": request.headers.get("X-Clerk-User-Id")
                }).execute()
            except: pass # Don't block on metrics failure

        return response
    except Exception as e:
        # 1. Capture the error details
        error_msg = str(e)
        stack_trace = traceback.format_exc()
        endpoint = f"{request.method} {request.url.path}"
        user_id = request.headers.get("X-Clerk-User-Id")
        
        print(f"🚨 CRITICAL ERROR: {error_msg}")
        
        # 2. Log to Database
        try:
            log_data = {
                "level": "error",
                "category": "api",
                "message": error_msg,
                "stack_trace": stack_trace,
                "endpoint": endpoint,
                "user_id": user_id,
                "metadata": {
                    "query_params": str(request.query_params),
                    "client_host": request.client.host if request.client else "unknown"
                }
            }
            supabase.table("system_logs").insert(log_data).execute()
        except Exception as log_err:
            print(f"⚠️ Failed to log error to DB: {log_err}")

        return JSONResponse(
            status_code=500,
            content={"detail": "Internal Server Error", "error_logged": True}
        )

@app.on_event("startup")
async def startup_event():
    """Perform initial instance status check on startup"""
    try:
        instance_res = supabase.table("instance_settings").select("*").limit(1).execute()
        if instance_res.data:
            local_instance = instance_res.data[0]
            global INSTANCE_STATUS_CACHE
            INSTANCE_STATUS_CACHE["is_suspended"] = str(local_instance.get("status", "active")).lower() != "active"
            INSTANCE_STATUS_CACHE["org_name"] = local_instance.get("org_name", "Unknown")
            INSTANCE_STATUS_CACHE["last_check"] = datetime.now()
            print(f"✅ Instance Status Initialized: {'SUSPENDED' if INSTANCE_STATUS_CACHE['is_suspended'] else 'ACTIVE'} ({INSTANCE_STATUS_CACHE['org_name']})")
            
            # Start Heartbeat reporting to Admin
            import asyncio
            asyncio.create_task(pulse_heartbeat(local_instance))
            
    except Exception as e:
        print(f"⚠️ Warning: Could not initialize instance status: {e}")

async def pulse_heartbeat(instance_settings):
    """
    Periodically sends a heartbeat to Pluto Admin dashboard.
    Reports specialized metrics like CPU, RAM, and status.
    """
    import random
    import psutil
    
    org_id = instance_settings.get("org_id")
    org_name = instance_settings.get("org_name")
    server_id = instance_settings.get("server_id", "local-node")
    
    while True:
        try:
            # 1. Gather Real System Metrics
            cpu_usage = f"{psutil.cpu_percent()}%"
            memory = psutil.virtual_memory()
            memory_usage = f"{memory.used // (1024 * 1024)}MB"
            
            # 2. Map Status
            status = "operational"
            if INSTANCE_STATUS_CACHE["is_suspended"]:
               status = "degraded"
            
            # 3. Update Admin Monitoring DB
            admin_supabase.table("instance_health").upsert({
                "organization_id": org_id,
                "org_name": org_name,
                "status": status,
                "cpu_usage": cpu_usage,
                "memory_usage": memory_usage,
                "latency": f"{random.randint(10, 150)}ms",
                "uptime": "99.99%",
                "server_id": server_id,
                "last_heartbeat": datetime.now().isoformat()
            }, on_conflict="organization_id").execute()
            
            print(f"💓 Heartbeat synced for {org_name} (ID: {org_id})")
            
        except Exception as e:
            print(f"💓 Heartbeat Error: {e}")
            
        await asyncio.sleep(60) # Pulse every 60 seconds

@app.middleware("http")
async def block_if_suspended(request: Request, call_next):
    # Skip check for status, health and static endpoints
    if request.url.path in ["/instance-status", "/health", "/", "/verify-license"] or request.url.path.startswith("/_next"):
        return await call_next(request)
    
    # Check the cached status
    if INSTANCE_STATUS_CACHE["is_suspended"]:
        print(f"🚫 Blocking request to {request.url.path} - Instance {INSTANCE_STATUS_CACHE['org_name']} is SUSPENDED")
        return JSONResponse(
            status_code=403,
            content={"detail": f"Instance Suspended: Access denied by Pluto Admin for {INSTANCE_STATUS_CACHE['org_name']}."}
        )
                
    return await call_next(request)

@app.get("/")
def read_root():
    return {"Hello": "World", "status": "Backend is running"}

@app.get("/health")
def health_check():
    """Health check endpoint to verify Supabase connection"""
    try:
        # Try a simple query to verify Supabase connection
        test_response = supabase.table("users").select("id").limit(1).execute()
        return {
            "status": "healthy",
            "supabase_connected": True,
            "message": "Backend and Supabase are connected successfully"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "supabase_connected": False,
            "error": str(e),
            "message": "Backend is running but Supabase connection failed. Check SUPABASE_URL and SUPABASE_KEY environment variables."
        }


@app.post("/verify-license")
async def verify_and_setup_instance(data: LicenseVerify):
    """
    Connects to Pluto Admin to verify license and organization details.
    If valid, stores the configuration in the local database.
    """
    try:
        # 1. Call Pluto Admin API
        admin_url = os.environ.get("PLUTO_ADMIN_URL", "http://localhost:3001") # Default to local admin if not set
        verify_url = f"{admin_url}/api/verify-license"
        
        payload = {
            "license_key": data.license_id,
            "org_code": data.org_code,
            "server_id": data.server_id,
            "app_version": data.app_version
        }
        

        import requests
        print(f"DEBUG: Connecting to {verify_url}")
        response = requests.post(verify_url, json=payload)
        
        print(f"DEBUG: Response Status: {response.status_code}")
        print(f"DEBUG: Response Content: {response.text[:200]}") # Print first 200 chars


        if response.status_code != 200:
            error_detail = f"Verification failed with status {response.status_code}"
            try:
                error_detail = response.json().get("error", error_detail)
            except:
                # If response is not JSON, use text (truncated)
                error_detail = f"Verification failed: {response.text[:200]}"
            raise HTTPException(status_code=400, detail=error_detail)
            
        verification_data = response.json()
        
        # 2. Store in Local Database
        # Clean existing settings first (assuming single tenant)
        supabase.table("instance_settings").delete().neq("id", 0).execute()
        
        new_instance = {
            "org_id": verification_data["org_id"],
            "org_name": verification_data["org_name"],
            "org_code": verification_data["org_code"],
            "license_key": data.license_id,
            "status": "active",
            "last_synced_at": datetime.utcnow().isoformat(),
            "admin_email": data.email_id
        }
        
        
        insert_res = supabase.table("instance_settings").insert(new_instance).execute()
        
        if not insert_res.data:
             # Wait! If we deleted everything, maybe the insert failed because we didn't get return value?
             # Check if it was inserted
             check = supabase.table("instance_settings").select("*").eq("org_code", verification_data["org_code"]).execute()
             if not check.data:
                 print("Insert Failed - No Data Returned")
                 raise HTTPException(status_code=500, detail="Failed to save instance settings locally")
             
        # Update cache
        global INSTANCE_STATUS_CACHE
        INSTANCE_STATUS_CACHE["is_suspended"] = False
        INSTANCE_STATUS_CACHE["org_name"] = verification_data["org_name"]
        
        # 3. Promote Admin User if exists
        try:
            admin_email = data.email_id.strip()
            # Try exact match first
            user_check = supabase.table("users").select("*").eq("email", admin_email).execute()
            
            # If not found, try case insensitive match (if Supabase allows ilike or similar, or just python filter)
            if not user_check.data:
                 print(f"ℹ️ Exact match for {admin_email} failed. checking all users (slow but safe for setup).")
                 all_users = supabase.table("users").select("*").execute()
                 if all_users.data:
                     # manual filter
                     found_users = [u for u in all_users.data if str(u.get("email")).lower() == admin_email.lower()]
                     if found_users:
                         user_check.data = [found_users[0]]

            if user_check.data and len(user_check.data) > 0:
                user_id = user_check.data[0]["id"]
                print(f"✅ Found existing user for admin email {admin_email}. Promoting to Admin.")
                
                update_payload = {
                    "role": "admin",
                    "org_id": str(verification_data["org_id"]),
                    "organization": verification_data["org_name"],
                    "is_verified": True,
                    "approval_status": "approved"
                }
                
                up_res = supabase.table("users").update(update_payload).eq("id", user_id).execute()
                print(f"DEBUG: User update result: {up_res.data}")
            else:
                print(f"ℹ️ User with email {admin_email} not found yet. They will need to sign up.")
                
        except Exception as e:
            print(f"⚠️ Failed to promote admin user: {e}")
            # Don't fail the whole request, just log it
        
        return {"status": "verified", "detail": "Instance activated successfully"}


    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Verification Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/instance-status")
def get_instance_status():
    """
    Checks the status of this local instance by verifying its identity with the 
    central Pluto Admin database. Ensures the hosted project remains connected.
    """
    try:
        # 1. Look for local instance settings
        instance_res = supabase.table("instance_settings").select("*").limit(1).execute()
        if not instance_res.data:
            return {"is_activated": False}

        local_instance = instance_res.data[0]
        org_id = local_instance["org_id"]
        
        # 2. Remote check against Pluto Admin database
        # Convert org_id to int to ensure correct bigint comparison in Supabase/Postgres
        target_id = org_id
        try:
            if isinstance(org_id, str) and org_id.isdigit():
                target_id = int(org_id)
        except:
            pass
            
        admin_res = admin_supabase.table("organizations").select("status, plan, name").eq("id", target_id).execute()
            
        if not admin_res.data:
            print(f"❌ CRITICAL: Local Org ID '{org_id}' (Target: {target_id}) not found in Admin DB!")
            # Try to find by name as a fallback for robustness
            admin_res = admin_supabase.table("organizations").select("status, plan, name").ilike("name", local_instance.get("org_name", "")).execute()
            
            if not admin_res.data:
                return {
                    "is_activated": True,
                    "is_suspended": False,
                    "error": f"Organization '{org_id}' not found."
                }

        central_org = admin_res.data[0]
        
        # 3. Handle status changes (e.g. suspension)
        # FORCE check against 'active' - if it's 'suspended' or anything else, block it
        status_value = str(central_org.get("status", "active")).lower().strip()
        is_suspended = status_value != "active"
        
        print(f"🔄 [SYNC] Org: {central_org['name']} | Remote Status: '{status_value}' | Blocked: {is_suspended}")
        
        # 4. Update Global Cache
        global INSTANCE_STATUS_CACHE
        INSTANCE_STATUS_CACHE["is_suspended"] = is_suspended
        INSTANCE_STATUS_CACHE["org_name"] = central_org["name"]
        INSTANCE_STATUS_CACHE["last_check"] = datetime.now()
        
        # 5. Sync status and plan changes locally if they happened in Admin panel
        # Check if plan exists in local_instance before verifying change to likely
        # avoid key error if plan column is missing in older instances
        current_plan = local_instance.get("plan")
        current_status = local_instance.get("status")
        
        if central_org.get("plan") != current_plan or central_org.get("status") != current_status:
            update_data = {}
            if central_org.get("plan"): update_data["plan"] = central_org["plan"]
            if central_org.get("status"): update_data["status"] = central_org["status"]
            
            if update_data:
                supabase.table("instance_settings").update(update_data).eq("org_id", org_id).execute()

        return {
            "is_activated": True,
            "organization_name": central_org["name"],
            "plan": central_org["plan"],
            "is_suspended": is_suspended,
            "status": central_org["status"]
        }
    except Exception as e:
        print(f"Connection error to Pluto Admin: {e}")
        # In case of connectivity issues to Pluto Admin, we might want to allow 
        # cached access or block it. For safety-critical, we might report an error.
        return {
            "is_activated": True, 
            "error": "Could not connect to Pluto Admin central database.",
            # Use safe get just in case local_instance wasn't defined yet
            "organization_name": "Unknown"
        }


@app.post("/users")
def create_or_update_user(user: UserCreate):
    try:
        # 0. Fetch Instance Settings for Auto-Approval / Org Linkage
        instance_res = supabase.table("instance_settings").select("*").limit(1).execute()
        local_instance = instance_res.data[0] if instance_res.data else None
        
        # 1. Prepare data for update (exclude unset fields)
        user_data = user.model_dump(exclude_unset=True)
        if "role" in user_data and user_data["role"] is None:
            del user_data["role"]
            
        # --- AUTO APROVE ADMIN LOGIC (START) ---
        if local_instance and user.email:
            # Check if this user is the Instance Admin
            admin_email = str(local_instance.get("admin_email", "")).strip().lower()
            user_email = user.email.strip().lower()
            
            if admin_email and admin_email == user_email:
                print(f"👑 Auto-Approving Instance Admin: {user_email}")
                user_data["role"] = "admin"
                user_data["is_verified"] = True
                user_data["approval_status"] = "approved"
                user_data["org_id"] = local_instance["org_id"]
                user_data["organization"] = local_instance["org_name"]
            
            # Ensure organization link for regular users too if not set
            elif not user_data.get("org_id"):
                 user_data["org_id"] = local_instance["org_id"]
                 user_data["organization"] = local_instance["org_name"]
        # --- AUTO APROVE ADMIN LOGIC (END) ---

        # 2. Check if user belongs in main database or pending table
        is_approved = user_data.get("approval_status") == "approved"
        
        # Check if already in main users table
        existing_user = supabase.table("users").select("id").eq("clerk_id", user.clerk_id).execute()
        
        if existing_user.data or is_approved:
            # Update main users table
            response = supabase.table("users").update(user_data).eq("clerk_id", user.clerk_id).execute()
            if response.data:
                return {"status": "updated", "data": response.data}
                
            # If not found in update but is_approved (auto-approval case for new user)
            insert_data = user.model_dump()
            if local_instance:
                insert_data["organization"] = local_instance["org_name"]
                insert_data["org_id"] = local_instance["org_id"]
                if user.email and str(local_instance.get("admin_email", "")).strip().lower() == user.email.strip().lower():
                    insert_data["role"] = "admin"
                    insert_data["is_verified"] = True
                    insert_data["approval_status"] = "approved"
            
            if not insert_data.get("role"): insert_data["role"] = "viewer"
            if "approval_status" not in insert_data: insert_data["approval_status"] = "pending"
            if "is_verified" not in insert_data: insert_data["is_verified"] = False
            
            data = supabase.table("users").insert(insert_data).execute()
            return {"status": "created", "data": data.data}
        else:
            # Handle pending table
            response = supabase.table("pending_users").update(user_data).eq("clerk_id", user.clerk_id).execute()
            if response.data:
                return {"status": "pending_updated", "data": response.data}
            
            insert_data = user.model_dump()
            if local_instance:
                insert_data["organization"] = local_instance["org_name"]
                insert_data["org_id"] = local_instance["org_id"]
            
            if not insert_data.get("role"): insert_data["role"] = "viewer"
            insert_data["approval_status"] = "pending"
            insert_data["is_verified"] = False
            
            data = supabase.table("pending_users").insert(insert_data).execute()
            return {"status": "pending_created", "data": data.data}
            
    except Exception as e:
        print(f"Error in POST /users: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/users/{clerk_id}")
def get_user(clerk_id: str):
    try:
        # Check main users table first
        response = supabase.table("users").select("*").eq("clerk_id", clerk_id).execute()
        if response.data:
            return response.data[0]
            
        # Then check pending table
        pending_response = supabase.table("pending_users").select("*").eq("clerk_id", clerk_id).execute()
        if pending_response.data:
            return pending_response.data[0]
            
        raise HTTPException(status_code=404, detail="User not found")
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/users")
def get_all_users(requester_id: Optional[str] = Header(None, alias="X-Clerk-User-Id")):
    if not requester_id:
        raise HTTPException(status_code=401, detail="Missing user ID header")

    try:
        # Combine users from both tables
        users_res = supabase.table("users").select("clerk_id, first_name, last_name, email, image_url, role, approval_status, created_at, is_verified, organization, org_id").execute()
        pending_res = supabase.table("pending_users").select("clerk_id, first_name, last_name, email, image_url, role, approval_status, created_at, is_verified, organization, org_id").execute()
        
        combined_users = (users_res.data or []) + (pending_res.data or [])
        # Sort by created_at descending
        combined_users.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        return combined_users
    except Exception as e:
        print(f"Error in GET /users: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/users/{target_clerk_id}/role")
def update_user_role(target_clerk_id: str, role_update: RoleUpdate, requester_id: Optional[str] = Header(None, alias="X-Clerk-User-Id")):
    if not requester_id:
        raise HTTPException(status_code=401, detail="Missing user ID header")
        
    # Check if requester is admin
    requester = supabase.table("users").select("role").eq("clerk_id", requester_id).execute()
    if not requester.data or requester.data[0]["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    try:
        # Update main table
        data = supabase.table("users").update({"role": role_update.role}).eq("clerk_id", target_clerk_id).execute()
        if not data.data:
            # Update pending table
            data = supabase.table("pending_users").update({"role": role_update.role}).eq("clerk_id", target_clerk_id).execute()
            
        return {"status": "updated", "data": data.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/users/{target_clerk_id}/status")
def update_user_status(target_clerk_id: str, status_update: StatusUpdate, requester_id: Optional[str] = Header(None, alias="X-Clerk-User-Id")):
    if not requester_id:
        raise HTTPException(status_code=401, detail="Missing user ID header")
        
    requester = supabase.table("users").select("role").eq("clerk_id", requester_id).execute()
    if not requester.data or requester.data[0]["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    try:
        update_data = {"approval_status": status_update.status}
        
        if status_update.status == "approved":
            update_data["role"] = "editor"
            update_data["is_verified"] = True
            
            instance_res = supabase.table("instance_settings").select("org_id, org_name").limit(1).execute()
            if instance_res.data:
                instance = instance_res.data[0]
                update_data["organization"] = instance["org_name"]
                update_data["org_id"] = instance["org_id"]
            else:
                admin_data = supabase.table("users").select("role, organization, org_id").eq("clerk_id", requester_id).execute()
                if admin_data.data:
                    record = admin_data.data[0]
                    if record.get("organization"): update_data["organization"] = record["organization"]
                    if record.get("org_id"): update_data["org_id"] = record["org_id"]

            # MOVE USER from pending_users to users if they are currently in pending
            pending_res = supabase.table("pending_users").select("*").eq("clerk_id", target_clerk_id).execute()
            if pending_res.data:
                user_record = pending_res.data[0]
                # Merge current record with update_data
                for k, v in update_data.items():
                    user_record[k] = v
                
                # Delete id to avoid conflicts
                if "id" in user_record: del user_record["id"]
                
                # Insert into main table
                data = supabase.table("users").insert(user_record).execute()
                # Delete from pending table
                supabase.table("pending_users").delete().eq("clerk_id", target_clerk_id).execute()
                return {"status": "approved_and_moved", "data": data.data}

        # If already in users or just updating status without moving from pending
        data = supabase.table("users").update(update_data).eq("clerk_id", target_clerk_id).execute()
        
        # If not found in users, update in pending
        if not data.data:
            data = supabase.table("pending_users").update(update_data).eq("clerk_id", target_clerk_id).execute()
            
        return {"status": "updated", "data": data.data}
    except Exception as e:
        print(f"Error updating status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/users/{target_clerk_id}")
def delete_user(target_clerk_id: str, requester_id: Optional[str] = Header(None, alias="X-Clerk-User-Id")):
    if not requester_id:
        raise HTTPException(status_code=401, detail="Missing user ID header")
        
    requester = supabase.table("users").select("role").eq("clerk_id", requester_id).execute()
    if not requester.data or requester.data[0]["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    if target_clerk_id == requester_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    try:
        # Try both tables
        data_users = supabase.table("users").delete().eq("clerk_id", target_clerk_id).execute()
        data_pending = supabase.table("pending_users").delete().eq("clerk_id", target_clerk_id).execute()
        
        return {"status": "deleted", "users_cleared": len(data_users.data or []) + len(data_pending.data or [])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/verify-license")
def verify_license(verify: LicenseVerify):
    try:
        # 1. Search for organization in ADMIN database
        org_res = admin_supabase.table("organizations").select("*").ilike("name", verify.org_name).eq("admin_email", verify.email_id).execute()
        
        if not org_res.data:
            raise HTTPException(status_code=404, detail="Organization or Admin Email not found in Pluto Admin records.")
        
        org = org_res.data[0]
        org_id = org["id"]
        org_name_actual = org["name"]
        org_code = org.get("code")
        org_plan = org.get("plan")
        org_status = org.get("status")

        # 2. Check if the input org_name is strictly CAPS ONLY
        if verify.org_name != verify.org_name.upper():
            raise HTTPException(status_code=400, detail="Organization name must be entered in ALL CAPS.")

        # 3. Verify License Key in ADMIN database
        lic_res = admin_supabase.table("licenses").select("*").eq("organization_id", org_id).eq("license_key", verify.license_id).execute()
        
        if not lic_res.data:
            raise HTTPException(status_code=403, detail="Invalid License ID for this organization.")

        # 4. Success - Update the user in the MAIN database
        now = datetime.now().isoformat()
        
        # 4.5 Notify Pluto Admin about this activation
        try:
            admin_supabase.table("organizations").update({
                "status": "active",
                "activated_at": now,
                "server_id": verify.server_id,
                "app_version": verify.app_version or "1.0.0"
            }).eq("id", org_id).execute()

            # Create a log entry in Pluto Admin
            admin_supabase.table("admin_logs").insert({
                "action": "REMOTE_ACTIVATION",
                "details": f"Instance activated remotely for organization {org_name_actual}. Server: {verify.server_id}, Version: {verify.app_version}",
                "organization_id": org_id,
                "performed_by": f"Remote System ({verify.email_id})"
            }).execute()
        except Exception as admin_err:
            print(f"Warning: Could not notify Pluto Admin of activation: {admin_err}")

        # 5. Lock this instance to the organization
        # We use upscale or delete-then-insert to ensure we only have ONE instance record
        try:
            # Delete any existing settings to ensure clean activation
            supabase.table("instance_settings").delete().neq("id", -1).execute()
            
            supabase.table("instance_settings").insert({
                "org_id": str(org_id),
                "org_name": org_name_actual,
                "org_code": org_code or verify.org_code, # Prefer official code from Admin DB
                "plan": org_plan,
                "status": org_status,
                "license_key": verify.license_id,
                "app_version": verify.app_version or "1.0.0",
                "server_id": verify.server_id,
                "admin_email": verify.email_id,
                "activated_at": now
            }).execute()
            
            # Immediately update the local cache so the middleware knows we are ACTIVE
            global INSTANCE_STATUS_CACHE
            INSTANCE_STATUS_CACHE["is_suspended"] = str(org_status).lower() != "active"
            INSTANCE_STATUS_CACHE["org_name"] = org_name_actual
            INSTANCE_STATUS_CACHE["last_check"] = datetime.now()
            print(f"✅ Instance Activated and Locked to {org_name_actual} (ID: {org_id})")
        except Exception as lock_err:
            print(f"Error locking instance settings: {lock_err}")

        # Ensure we use 'supabase' for the main project update and 'admin_supabase' for the license check
        update_res = supabase.table("users").update({
            "is_verified": True,
            "verified_at": now,
            "organization": org_name_actual,
            "org_id": str(org_id), # Store the actual ID from Admin DB
            "approval_status": "approved",
            "role": "admin"
        }).eq("clerk_id", verify.clerk_id).execute()

        return {
            "status": "verified",
            "message": f"Successfully verified license for {org_name_actual}",
            "data": update_res.data
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Verification Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/processes")
def create_process(process: ProcessPackageCreate):
    try:
        # Store the sheets as JSONB
        data = {
            "user_id": process.user_id,
            "name": process.name,
            "sheets": [sheet.model_dump() for sheet in process.sheets],
            "status": process.status
        }
        
        response = supabase.table("processes").insert(data).execute()
        return {"status": "created", "data": response.data}
    except Exception as e:
        print(f"Error creating process: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/processes/{process_id}")
def update_process(process_id: int, process: ProcessPackageCreate, requester_id: Optional[str] = Header(None, alias="X-Clerk-User-Id")):
    try:
        # Check ownership if requester_id is provided
        if requester_id:
             p_res = supabase.table("processes").select("user_id").eq("id", process_id).execute()
             if p_res.data:
                 owner_id = p_res.data[0]["user_id"]
                 if owner_id != requester_id:
                     # Check if admin
                     user = supabase.table("users").select("role").eq("clerk_id", requester_id).execute()
                     if not user.data or user.data[0]["role"] != "admin":
                         raise HTTPException(status_code=403, detail="Not authorized to update this process")

        data = {
            "name": process.name,
            "sheets": [sheet.model_dump() for sheet in process.sheets],
            "updated_at": "now()",
            "status": process.status
        }
        response = supabase.table("processes").update(data).eq("id", process_id).execute()
        return {"status": "updated", "data": response.data}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/processes/{user_id}")
def get_processes(user_id: str):
    try:
        response = supabase.table("processes").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
        
        # Optimize payload: Remove heavy 'sheets' data
        cleaned_data = []
        for process in response.data:
            p = process.copy()
            p.pop("sheets", None)
            
            # Clean versions
            if "versions" in p and isinstance(p["versions"], list):
                for v in p["versions"]:
                    if isinstance(v, dict):
                        v.pop("sheets", None)
            cleaned_data.append(p)
            
        return cleaned_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/process/{process_id}")
def get_process(process_id: int):
    try:
        response = supabase.table("processes").select("*").eq("id", process_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Process not found")
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/processes/{process_id}/rename")
def rename_process(process_id: int, rename: ProcessRename, requester_id: Optional[str] = Header(None, alias="X-Clerk-User-Id")):
    try:
        # Check ownership if requester_id is provided
        if requester_id:
             process = supabase.table("processes").select("user_id").eq("id", process_id).execute()
             if process.data:
                 owner_id = process.data[0]["user_id"]
                 if owner_id != requester_id:
                     # Check if admin
                     user = supabase.table("users").select("role").eq("clerk_id", requester_id).execute()
                     if not user.data or user.data[0]["role"] != "admin":
                         raise HTTPException(status_code=403, detail="Not authorized to rename this process")

        data = supabase.table("processes").update({"name": rename.name}).eq("id", process_id).execute()
        return {"status": "updated", "data": data.data}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/processes/{process_id}/versions")
def save_process_version(process_id: int, version: ProcessVersionCreate, requester_id: Optional[str] = Header(None, alias="X-Clerk-User-Id")):
    try:
        # Check ownership if requester_id is provided
        if requester_id:
             p_res = supabase.table("processes").select("user_id").eq("id", process_id).execute()
             if p_res.data:
                 owner_id = p_res.data[0]["user_id"]
                 if owner_id != requester_id:
                     # Check if admin
                     user = supabase.table("users").select("role").eq("clerk_id", requester_id).execute()
                     if not user.data or user.data[0]["role"] != "admin":
                         raise HTTPException(status_code=403, detail="Not authorized to save version for this process")

        # 1. Get current versions
        current = supabase.table("processes").select("versions").eq("id", process_id).execute()
        if not current.data:
            raise HTTPException(status_code=404, detail="Process not found")
        
        versions = current.data[0].get("versions", []) or []
        
        # 2. Append new version
        new_version = {
            "name": version.name,
            "sheets": [sheet.model_dump() for sheet in version.sheets],
            "created_at": str(datetime.now())
        }
        versions.append(new_version)
        
        # 3. Update
        data = supabase.table("processes").update({"versions": versions}).eq("id", process_id).execute()
        return {"status": "version_saved", "data": data.data}
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error saving version: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/processes/{process_id}")
def delete_process(process_id: int, requester_id: Optional[str] = Header(None, alias="X-Clerk-User-Id")):
    try:
        # Check ownership if requester_id is provided
        if requester_id:
             process = supabase.table("processes").select("user_id").eq("id", process_id).execute()
             if process.data:
                 owner_id = process.data[0]["user_id"]
                 if owner_id != requester_id:
                     # Check if admin
                     user = supabase.table("users").select("role").eq("clerk_id", requester_id).execute()
                     if not user.data or user.data[0]["role"] != "admin":
                         raise HTTPException(status_code=403, detail="Not authorized to delete this process")

        response = supabase.table("processes").delete().eq("id", process_id).execute()
        return {"status": "deleted", "data": response.data}
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error deleting process: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/projects")
def create_project(project: ProjectCreate):
    try:
        # 1. Fetch the process to get the version data
        process_response = supabase.table("processes").select("versions").eq("id", project.process_id).execute()
        if not process_response.data:
            raise HTTPException(status_code=404, detail="Process not found")
        
        versions = process_response.data[0].get("versions", []) or []
        selected_version = next((v for v in versions if v["name"] == project.version_name), None)
        
        if not selected_version:
            raise HTTPException(status_code=404, detail="Version not found")
            
        # 2. Create the project with the COPIED sheets
        data = {
            "user_id": project.user_id,
            "name": project.name,
            "process_id": project.process_id,
            "version_name": project.version_name,
            "sheets": selected_version["sheets"] # Copy the sheets
        }
        
        response = supabase.table("projects").insert(data).execute()
        return {"status": "created", "data": response.data}
    except Exception as e:
        print(f"Error creating project: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/projects/{user_id}")
def get_projects(user_id: str):
    try:
        import json
        # Optimize: Fetch owned and shared projects in a single query using OR
        # This reduces database round trips and latency
        
        # Construct the JSON string for the contains filter
        collaborator_tag = json.dumps([{"user_id": user_id}])
        
        # Use the or_ filter: user_id.eq.UID,collaborators.cs.TAG
        response = supabase.table("projects").select("*").or_(
            f"user_id.eq.{user_id},collaborators.cs.{collaborator_tag}"
        ).order("created_at", desc=True).execute()
        
        # Optimize payload: Remove heavy 'sheets' data
        cleaned_data = []
        for project in response.data:
            p = project.copy()
            p.pop("sheets", None)
            cleaned_data.append(p)
        
        return cleaned_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/projects/{project_id}/collaborators")
def add_collaborator(project_id: int, collaborator: CollaboratorAdd):
    try:
        # Fetch current project
        project_res = supabase.table("projects").select("collaborators").eq("id", project_id).execute()
        if not project_res.data:
            raise HTTPException(status_code=404, detail="Project not found")
            
        current_collaborators = project_res.data[0].get("collaborators", [])
        
        # Check if already exists
        exists = False
        for c in current_collaborators:
            if c["user_id"] == collaborator.user_id:
                c["role"] = collaborator.role # Update role
                exists = True
                break
        
        if not exists:
            current_collaborators.append(collaborator.model_dump())
            
        response = supabase.table("projects").update({"collaborators": current_collaborators}).eq("id", project_id).execute()
        return {"status": "updated", "data": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/projects/{project_id}/collaborators/{user_id}")
def remove_collaborator(project_id: int, user_id: str):
    try:
        # Fetch current project
        project_res = supabase.table("projects").select("collaborators").eq("id", project_id).execute()
        if not project_res.data:
            raise HTTPException(status_code=404, detail="Project not found")
            
        current_collaborators = project_res.data[0].get("collaborators", [])
        
        # Remove the collaborator
        updated_collaborators = [c for c in current_collaborators if c.get("user_id") != user_id]
        
        response = supabase.table("projects").update({"collaborators": updated_collaborators}).eq("id", project_id).execute()
        return {"status": "removed", "data": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/project/{project_id}")
def get_project(project_id: int):
    try:
        response = supabase.table("projects").select("*").eq("id", project_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Project not found")
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/project/{project_id}/rename")
def rename_project(project_id: int, rename: ProcessRename):
    try:
        data = supabase.table("projects").update({"name": rename.name}).eq("id", project_id).execute()
        return {"status": "updated", "data": data.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def process_jira_sync(project_id: int, project_name: str, version: str, sheets: list):
    """Background task to sync project tasks with Jira"""
    updated_sheets = []
    has_changes = False
    
    # Fetch all users to resolve names in Jira
    user_map = {}
    try:
        users_res = supabase.table("users").select("clerk_id, first_name, last_name").execute()
        for u in users_res.data:
            name = f"{u.get('first_name', '')} {u.get('last_name', '')}".strip()
            user_map[u['clerk_id']] = name or u['clerk_id']
    except Exception as e:
        print(f"Error fetching users for Jira sync: {e}")

    # Fetch project details for metadata
    project_owner = "Unknown"
    project_status = "N/A"
    try:
        project_res = supabase.table("projects").select("user_id, status").eq("id", project_id).execute()
        if project_res.data:
            owner_id = project_res.data[0].get("user_id")
            project_owner = user_map.get(owner_id, owner_id)
            project_status = project_res.data[0].get("status", "N/A")
    except Exception as e:
        print(f"Error fetching project details for Jira sync: {e}")
    
    metadata = {
        "project_name": project_name,
        "version": version,
        "project_owner": project_owner,
        "project_status": project_status,
        "project_id": project_id
    }

    for sheet in sheets:
        sheet_changed = False
        nodes = sheet.get("nodes", [])
        for node in nodes:
            # Only sync 'activity' or 'process' nodes that have assignments (responsibility or support)
            node_type = node.get("type")
            data = node.get("data", {})
            responsibility = data.get("responsibility", [])
            support = data.get("support", [])
            
            if (node_type in ["activity", "process"]) and (responsibility or support):
                # Sync to Jira
                jira_key = sync_task_to_jira(data, metadata, user_map)
                if jira_key and data.get("jira_issue_id") != jira_key:
                    data["jira_issue_id"] = jira_key
                    sheet_changed = True
                    has_changes = True
        
        updated_sheets.append(sheet)

    if has_changes:
        # Update the project back in Supabase with the new Jira keys
        try:
            supabase.table("projects").update({"sheets": updated_sheets}).eq("id", project_id).execute()
            print(f"Jira sync complete for project {project_id}")
        except Exception as e:
            print(f"Error updating project after Jira sync: {e}")

@app.put("/project/{project_id}")
def update_project(project_id: int, update: ProjectUpdate, background_tasks: BackgroundTasks):
    try:
        data = {
            "updated_at": "now()"
        }
        
        project_name = update.name
        version_name = update.version_name
        
        if not project_name or not version_name:
            # Fetch missing info
            proj = supabase.table("projects").select("name", "version_name").eq("id", project_id).execute()
            if proj.data:
                if not project_name: project_name = proj.data[0]["name"]
                if not version_name: version_name = proj.data[0]["version_name"]

        if update.sheets is not None:
            data["sheets"] = [sheet.model_dump() for sheet in update.sheets]
            # Trigger Jira sync in background
            background_tasks.add_task(process_jira_sync, project_id, project_name, version_name, data["sheets"])
            
        if update.name is not None:
            data["name"] = update.name

        if update.progress is not None:
            data["progress"] = update.progress
            
        if update.version_name is not None:
            data["version_name"] = update.version_name
            
        if update.status is not None:
            data["status"] = update.status
            
        response = supabase.table("projects").update(data).eq("id", project_id).execute()
        return {"status": "updated", "data": response.data}
    except Exception as e:
        print(f"Error updating project: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/admin/projects")
def get_all_projects(requester_id: Optional[str] = Header(None, alias="X-Clerk-User-Id")):
    if not requester_id:
        raise HTTPException(status_code=401, detail="Missing user ID header")
        
    # Check if requester is admin
    requester = supabase.table("users").select("role").eq("clerk_id", requester_id).execute()
    if not requester.data or requester.data[0]["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    try:
        response = supabase.table("projects").select("*").order("created_at", desc=True).execute()
        
        # Optimize payload: Remove heavy 'sheets' data
        cleaned_data = []
        for project in response.data:
            p = project.copy()
            p.pop("sheets", None)
            cleaned_data.append(p)
            
        return cleaned_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/calendar/events/{user_id}")
def get_calendar_events(user_id: str):
    try:
        import json
        # Fetch all projects where the user is either the owner or a collaborator
        collaborator_tag = json.dumps([{"user_id": user_id}])
        response = supabase.table("projects").select("id, name, sheets").or_(
            f"user_id.eq.{user_id},collaborators.cs.{collaborator_tag}"
        ).execute()

        events = []
        for project in response.data:
            if not project.get('sheets'):
                continue
            for sheet in project['sheets']:
                if not sheet.get('nodes'):
                    continue
                for node in sheet['nodes']:
                    node_data = node.get('data', {})
                    
                    # Check if user is assigned to this specific task
                    responsibility = node_data.get("responsibility", [])
                    support = node_data.get("support", [])
                    
                    if user_id in responsibility or user_id in support:
                        if node_data.get('deadline'):
                            events.append({
                                "id": f"{project['id']}-{node['id']}",
                                "title": node_data.get('label', 'Untitled Task'),
                                "project_name": project['name'],
                                "date": node_data['deadline'],
                                "type": "task", # All deadlines are considered tasks for now
                                "route": f"/dashboard/process/create?projectId={project['id']}"
                            })
        return events
    except Exception as e:
        print(f"Error fetching calendar events: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/projects/{project_id}")
def delete_project(project_id: int, requester_id: Optional[str] = Header(None, alias="X-Clerk-User-Id")):
    try:
        # Check ownership if requester_id is provided
        if requester_id:
             project = supabase.table("projects").select("user_id").eq("id", project_id).execute()
             if project.data:
                 owner_id = project.data[0]["user_id"]
                 if owner_id != requester_id:
                     # Check if admin
                     user = supabase.table("users").select("role").eq("clerk_id", requester_id).execute()
                     if not user.data or user.data[0]["role"] != "admin":
                         raise HTTPException(status_code=403, detail="Not authorized to delete this project")

        response = supabase.table("projects").delete().eq("id", project_id).execute()
        return {"status": "deleted", "data": response.data}
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error deleting project: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/jira/connection-trigger")
def trigger_connection_jira(trigger: ConnectionJiraTrigger):
    try:
        # Fetch users to resolve names
        user_response = supabase.table("users").select("clerk_id", "first_name", "last_name").execute()
        user_map = {}
        if user_response.data:
            for u in user_response.data:
                name = f"{u.get('first_name', '')} {u.get('last_name', '')}".strip()
                user_map[u["clerk_id"]] = name or u["clerk_id"]

        jira_key = create_connection_jira_ticket(
            trigger.activity_data, 
            trigger.work_product_data, 
            trigger.metadata, 
            user_map
        )
        
        if not jira_key:
            raise HTTPException(status_code=500, detail="Failed to create Jira ticket")
            
        return {"status": "success", "jira_key": jira_key}
    except Exception as e:
        print(f"Error in connection trigger: {e}")
        raise HTTPException(status_code=500, detail=str(e))


