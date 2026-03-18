from fastapi import FastAPI, HTTPException, Header, Query, BackgroundTasks, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from sqlalchemy.orm import Session
import os
import asyncio
import zipfile
import json
import tempfile
from datetime import datetime
from typing import Optional, List, Dict, Any
from database import admin_supabase, get_db, engine, Base, SessionLocal
from models import (
    UserCreate, RoleUpdate, StatusUpdate, ProcessPackageCreate, ProcessRename, 
    ProcessVersionCreate, ProjectCreate, ProjectUpdate, CollaboratorAdd, 
    ConnectionJiraTrigger, LicenseVerify, JiraConfig,
    UserDB, PendingUserDB, InstanceSettingsDB, ProcessDB, ProjectDB, NotificationDB
)

app = FastAPI(title="Pluto API")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add a check for suspension status that can be used as a dependency
async def check_suspension(db: Session = Depends(get_db)):
    try:
        local_instance = db.query(InstanceSettingsDB).first()
        if local_instance and admin_supabase:
            # Check remote status
            admin_res = admin_supabase.table("organizations").select("status").eq("id", local_instance.org_id).execute()
            if admin_res.data and admin_res.data[0]["status"] != "active":
                raise HTTPException(status_code=403, detail="Instance Suspended: Access denied by Pluto Admin.")
    except HTTPException as he:
        raise he
    except Exception as e:
        # If admin DB is unreachable, we default to local state or allow
        pass

@app.get("/export-backup")
async def export_backup(db: Session = Depends(get_db)):
    try:
        # Fetch all data
        projects = db.query(ProjectDB).all()
        processes = db.query(ProcessDB).all()
        
        # Create a temporary file for the zip
        fd, temp_path = tempfile.mkstemp(suffix=".zip")
        os.close(fd)
        
        with zipfile.ZipFile(temp_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            # Export Projects
            project_data = []
            for p in projects:
                project_data.append({
                    "id": p.id,
                    "name": p.name,
                    "status": p.status,
                    "created_at": str(p.created_at),
                    "updated_at": str(p.updated_at),
                    "org_id": p.org_id,
                    "sheets": p.sheets,
                    "progress": p.progress,
                    "type": p.type,
                    "user_id": p.user_id,
                    "process_id": p.process_id,
                    "collaborators": p.collaborators
                })
            zipf.writestr("projects.json", json.dumps(project_data, indent=2))
            
            # Export Processes
            process_data = []
            for proc in processes:
                process_data.append({
                    "id": proc.id,
                    "name": proc.name,
                    "status": proc.status,
                    "created_at": str(proc.created_at),
                    "updated_at": str(proc.updated_at),
                    "org_id": proc.org_id,
                    "sheets": proc.sheets,
                    "versions": proc.versions,
                    "type": proc.type,
                    "user_id": proc.user_id
                })
            zipf.writestr("processes.json", json.dumps(process_data, indent=2))
            
            # Metadata
            metadata = {
                "exported_at": str(datetime.now()),
                "total_projects": len(projects),
                "total_processes": len(processes),
                "version": "1.0"
            }
            zipf.writestr("metadata.json", json.dumps(metadata, indent=2))
            
        return FileResponse(
            temp_path, 
            media_type="application/zip", 
            filename=f"pluto_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
        )
    except Exception as e:
        print(f"Backup Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from jira_utils import sync_task_to_jira, create_connection_jira_ticket

import os
import traceback
from dotenv import load_dotenv
from fastapi.exceptions import RequestValidationError

load_dotenv()

# Create database tables if they don't exist
Base.metadata.create_all(bind=engine)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    print(f"Validation error for {request.method} {request.url.path}")
    print(f"Error details: {exc.errors()}")
    print(f"Request body: {await request.body()}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": str(await request.body())},
    )

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
        # Note: We are skipping local metrics table for now as it's not in the core models
        # and would slow down every request.
        
        return response
    except Exception as e:
        # 1. Capture the error details
        error_msg = traceback.format_exc()
        stack_trace = error_msg
        endpoint = f"{request.method} {request.url.path}"
        user_id = request.headers.get("X-Clerk-User-Id")
        
        print(f"🚨 CRITICAL ERROR: {error_msg}")
        
        # 2. Log to Database
        db = SessionLocal()
        try:
            log_entry = NotificationDB(
                user_id=user_id or "system",
                type="error",
                title=f"API Error: {endpoint}",
                message=f"Error: {error_msg}\n\nStack Trace:\n{stack_trace}",
                read=False
            )
            db.add(log_entry)
            db.commit()
        except Exception as log_err:
            print(f"⚠️ Failed to log error to DB: {log_err}")
            db.rollback()
        finally:
            db.close()

        return JSONResponse(
            status_code=500,
            content={"detail": "Internal Server Error", "error_logged": True}
        )

@app.on_event("startup")
async def startup_event():
    """Perform initial instance status check on startup"""
    db = SessionLocal()
    try:
        local_instance = db.query(InstanceSettingsDB).first()
        if local_instance:
            global INSTANCE_STATUS_CACHE
            INSTANCE_STATUS_CACHE["is_suspended"] = str(getattr(local_instance, "status", "active")).lower() != "active"
            INSTANCE_STATUS_CACHE["org_name"] = getattr(local_instance, "org_name", "Unknown")
            INSTANCE_STATUS_CACHE["last_check"] = datetime.now()
            print(f"✅ Instance Status Initialized: {'SUSPENDED' if INSTANCE_STATUS_CACHE['is_suspended'] else 'ACTIVE'} ({INSTANCE_STATUS_CACHE['org_name']})")
            
            # Start Heartbeat reporting to Admin
            import asyncio
            asyncio.create_task(pulse_heartbeat(local_instance))
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"⚠️ Warning: Could not initialize instance status: {e}")

async def pulse_heartbeat(instance_settings):
    """
    Periodically sends a heartbeat to Pluto Admin dashboard.
    Reports specialized metrics like CPU, RAM, and status.
    """
    import random
    import psutil
    
    org_id = getattr(instance_settings, "org_id", None)
    org_name = getattr(instance_settings, "org_name", "Unknown")
    server_id = "local-node"
    
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
            if admin_supabase:
                admin_supabase.table("instance_health").upsert({
                    "organization_id": org_id,
                    "org_name": org_name,
                    "status": status,
                    "cpu_usage": cpu_usage,
                    "memory_usage": memory_usage,
                    "latency": f"0ms",
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

@app.get("/jira-config")
def get_jira_config(db: Session = Depends(get_db)):
    """Retrieve JIRA configuration from instance settings"""
    settings = db.query(InstanceSettingsDB).first()
    if not settings:
        return {"jira_url": "", "jira_email": "", "jira_api_token": ""}
    return {
        "jira_url": settings.jira_url or "",
        "jira_email": settings.jira_email or "",
        "jira_api_token": settings.jira_api_token or ""
    }

@app.post("/jira-config")
def update_jira_config(config: JiraConfig, db: Session = Depends(get_db)):
    """Update JIRA configuration in instance settings"""
    settings = db.query(InstanceSettingsDB).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Instance settings not found. Please activate license first.")
    
    settings.jira_url = config.jira_url
    settings.jira_email = config.jira_email
    settings.jira_api_token = config.jira_api_token
    db.commit()
    return {"status": "success", "message": "JIRA configuration updated"}

@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    """Health check endpoint to verify database connection"""
    try:
        # Try a simple query to verify database connection
        db.execute("SELECT 1")
        return {
            "status": "healthy",
            "db_connected": True,
            "message": "Backend and Local Database are connected successfully"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "db_connected": False,
            "error": str(e),
            "message": "Backend is running but Local Database connection failed."
        }


@app.post("/verify-license-legacy")
async def verify_and_setup_instance_legacy(data: LicenseVerify, db: Session = Depends(get_db)):
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
        db.query(InstanceSettingsDB).delete()
        
        new_instance = InstanceSettingsDB(
            org_id=str(verification_data["org_id"]),
            org_name=verification_data["org_name"],
            org_code=verification_data["org_code"],
            license_key=data.license_id,
            status="active",
            last_synced_at=datetime.utcnow(),
            admin_email=data.email_id
        )
        db.add(new_instance)
        db.commit()
        db.refresh(new_instance)
             
        # Update cache
        global INSTANCE_STATUS_CACHE
        INSTANCE_STATUS_CACHE["is_suspended"] = False
        INSTANCE_STATUS_CACHE["org_name"] = verification_data["org_name"]
        
        # 3. Promote Admin User if exists
        try:
            admin_email = data.email_id.strip()
            # Try matching existing user
            user = db.query(UserDB).filter(UserDB.email.ilike(admin_email)).first()

            if user:
                print(f"✅ Found existing user for admin email {admin_email}. Promoting to Admin.")
                user.role = "admin"
                user.org_id = str(verification_data["org_id"])
                user.organization = verification_data["org_name"]
                user.is_verified = True
                user.approval_status = "approved"
                db.commit()
            else:
                print(f"ℹ️ User with email {admin_email} not found yet. They will need to sign up.")
                
        except Exception as e:
            print(f"⚠️ Failed to promote admin user: {e}")
            db.rollback()
            # Don't fail the whole request, just log it
        
        return {"status": "verified", "detail": "Instance activated successfully"}

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Verification Error: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/instance-status")
def get_instance_status(db: Session = Depends(get_db)):
    """
    Checks the status of this local instance by verifying its identity with the 
    central Pluto Admin database. Ensures the hosted project remains connected.
    """
    try:
        # 1. Look for local instance settings
        local_instance = db.query(InstanceSettingsDB).first()
        if not local_instance:
            return {"is_activated": False}

        org_id = local_instance.org_id
        
        # 2. Remote check against Pluto Admin database
        if admin_supabase:
            target_id = org_id
            try:
                if isinstance(org_id, str) and org_id.isdigit():
                    target_id = int(org_id)
            except:
                pass
                
            admin_res = admin_supabase.table("organizations").select("status, plan, name").eq("id", target_id).execute()
                
            if not admin_res.data:
                print(f"❌ CRITICAL: Local Org ID '{org_id}' not found in Admin DB!")
                # Try to find by name as a fallback
                admin_res = admin_supabase.table("organizations").select("status, plan, name").ilike("name", local_instance.org_name).execute()
                
                if not admin_res.data:
                    return {
                        "is_activated": True,
                        "is_suspended": False,
                        "error": f"Organization '{org_id}' not found."
                    }

            central_org = admin_res.data[0]
            
            # 3. Handle status changes (e.g. suspension)
            status_value = str(central_org.get("status", "active")).lower().strip()
            is_suspended = status_value != "active"
            
            # 4. Update Global Cache
            global INSTANCE_STATUS_CACHE
            INSTANCE_STATUS_CACHE["is_suspended"] = is_suspended
            INSTANCE_STATUS_CACHE["org_name"] = central_org['name']
            INSTANCE_STATUS_CACHE["last_check"] = datetime.utcnow().isoformat()
            
            return {
                "is_activated": True,
                "is_suspended": is_suspended,
                "org_name": central_org["name"],
                "plan": central_org.get("plan", "Standard"),
                "status": status_value
            }
        else:
            # No admin sync, trust local state
            return {
                "is_activated": True,
                "is_suspended": False,
                "org_name": local_instance.org_name,
                "plan": local_instance.plan or "Standard",
                "status": "active"
            }
        INSTANCE_STATUS_CACHE["is_suspended"] = is_suspended
        INSTANCE_STATUS_CACHE["org_name"] = central_org["name"]
        INSTANCE_STATUS_CACHE["last_check"] = datetime.now()
        
        # 5. Sync status and plan changes locally if they happened in Admin panel
        # Check if plan exists in local_instance before verifying change to likely
        # avoid key error if plan column is missing in older instances
        current_plan = local_instance.plan
        current_status = local_instance.status
        
        if central_org.get("plan") != current_plan or central_org.get("status") != current_status:
            if central_org.get("plan"): local_instance.plan = central_org["plan"]
            if central_org.get("status"): local_instance.status = central_org["status"]
            db.commit()

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
def create_or_update_user(user: UserCreate, db: Session = Depends(get_db)):
    try:
        # 0. Fetch Instance Settings for Auto-Approval / Org Linkage
        local_instance = db.query(InstanceSettingsDB).first()
        
        # 1. Prepare data for update
        user_data = user.model_dump(exclude_unset=True)
        if "role" in user_data and user_data["role"] is None:
            del user_data["role"]
            
        # --- AUTO APPROVE ADMIN LOGIC (START) ---
        is_approved = False
        if local_instance and user.email:
            admin_email = str(local_instance.admin_email or "").strip().lower()
            user_email = user.email.strip().lower()
            
            if admin_email and admin_email == user_email:
                print(f"👑 Auto-Approving Instance Admin: {user_email}")
                user_data["role"] = "admin"
                user_data["is_verified"] = True
                user_data["approval_status"] = "approved"
                user_data["org_id"] = local_instance.org_id
                user_data["organization"] = local_instance.org_name
                is_approved = True
            
            elif not user_data.get("org_id"):
                 user_data["org_id"] = local_instance.org_id
                 user_data["organization"] = local_instance.org_name
        # --- AUTO APPROVE ADMIN LOGIC (END) ---

        # 2. Check if user already exists in MAIN table
        existing_user = db.query(UserDB).filter(
            (UserDB.clerk_id == user.clerk_id) | (UserDB.email == user.email)
        ).first()
        
        if existing_user or is_approved:
            if existing_user:
                # Update main users table
                for key, value in user_data.items():
                    setattr(existing_user, key, value)
                db.commit()
                db.refresh(existing_user)
                
                # Clean up pending table
                db.query(PendingUserDB).filter(
                    (PendingUserDB.clerk_id == user.clerk_id) | (PendingUserDB.email == user.email)
                ).delete()
                db.commit()
                
                return {"status": "updated", "data": {"clerk_id": existing_user.clerk_id}}
            else:
                # Create in main table (Auto-approved)
                insert_data = user.model_dump()
                if local_instance:
                    insert_data["organization"] = local_instance.org_name
                    insert_data["org_id"] = local_instance.org_id
                    if user.email and str(local_instance.admin_email or "").strip().lower() == user.email.strip().lower():
                        insert_data["role"] = "admin"
                        insert_data["is_verified"] = True
                        insert_data["approval_status"] = "approved"
                
                if not insert_data.get("role"): insert_data["role"] = "viewer"
                insert_data["approval_status"] = "approved"
                insert_data["is_verified"] = True
                
                new_user = UserDB(**insert_data)
                db.add(new_user)
                db.commit()
                db.refresh(new_user)
                
                return {"status": "created", "data": {"clerk_id": new_user.clerk_id}}
        else:
            # Handle pending table
            existing_pending = db.query(PendingUserDB).filter(
                (PendingUserDB.clerk_id == user.clerk_id) | (PendingUserDB.email == user.email)
            ).first()
            
            if existing_pending:
                for key, value in user_data.items():
                    setattr(existing_pending, key, value)
                db.commit()
                return {"status": "pending_updated", "data": {"clerk_id": existing_pending.clerk_id}}
            
            # New pending user
            insert_data = user.model_dump()
            if local_instance:
                insert_data["organization"] = local_instance.org_name
                insert_data["org_id"] = local_instance.org_id
            
            if not insert_data.get("role"): insert_data["role"] = "viewer"
            insert_data["approval_status"] = "pending"
            insert_data["is_verified"] = False
            
            new_pending = PendingUserDB(**insert_data)
            db.add(new_pending)
            db.commit()
            
            return {"status": "pending_created", "data": {"clerk_id": new_pending.clerk_id}}
            
    except Exception as e:
        print(f"Error in POST /users: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/users/{clerk_id}")
def get_user(clerk_id: str, db: Session = Depends(get_db)):
    try:
        # Check main users table first
        user = db.query(UserDB).filter(UserDB.clerk_id == clerk_id).first()
        if user:
            # Convert to dict manually for JSON serialization
            user_dict = {c.name: getattr(user, c.name) for c in user.__table__.columns}
            for k, v in user_dict.items():
                if isinstance(v, datetime): user_dict[k] = v.isoformat()
            return user_dict
            
        # Then check pending table
        pending_user = db.query(PendingUserDB).filter(PendingUserDB.clerk_id == clerk_id).first()
        if pending_user:
            user_dict = {c.name: getattr(pending_user, c.name) for c in pending_user.__table__.columns}
            for k, v in user_dict.items():
                if isinstance(v, datetime): user_dict[k] = v.isoformat()
            return user_dict
            
        raise HTTPException(status_code=404, detail="User not found")
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error fetching user: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/users")
def get_all_users(db: Session = Depends(get_db), requester_id: Optional[str] = Header(None, alias="X-Clerk-User-Id")):
    if not requester_id:
        raise HTTPException(status_code=401, detail="Missing user ID header")

    try:
        # Fetch from both tables using SQLAlchemy
        main_users_query = db.query(UserDB).all()
        pending_users_query = db.query(PendingUserDB).all()
        
        # Convert to dicts and handle datetime serialization
        main_users = []
        for u in main_users_query:
            u_dict = {c.name: getattr(u, c.name) for c in u.__table__.columns}
            for k, v in u_dict.items():
                if isinstance(v, datetime): u_dict[k] = v.isoformat()
            main_users.append(u_dict)
            
        pending_users = []
        for u in pending_users_query:
            u_dict = {c.name: getattr(u, c.name) for c in u.__table__.columns}
            for k, v in u_dict.items():
                if isinstance(v, datetime): u_dict[k] = v.isoformat()
            pending_users.append(u_dict)
        
        # Deduplicate by email: If a user exists in main_users, ignore them in pending_users
        approved_emails = {u.get('email', '').lower() for u in main_users if u.get('email')}
        filtered_pending = [u for u in pending_users if u.get('email', '').lower() not in approved_emails]
        
        combined_users = main_users + filtered_pending
        
        # Sort by created_at descending
        combined_users.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        return combined_users
    except Exception as e:
        print(f"Error in GET /users: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/users/{target_clerk_id}/role")
def update_user_role(target_clerk_id: str, role_update: RoleUpdate, db: Session = Depends(get_db), requester_id: Optional[str] = Header(None, alias="X-Clerk-User-Id")):
    if not requester_id:
        raise HTTPException(status_code=401, detail="Missing user ID header")
        
    # Check if requester is admin
    requester = db.query(UserDB).filter(UserDB.clerk_id == requester_id).first()
    if not requester or requester.role != "admin":
        raise HTTPException(status_code=43, detail="Not authorized")

    try:
        # Update main table
        user = db.query(UserDB).filter(UserDB.clerk_id == target_clerk_id).first()
        if user:
            user.role = role_update.role
            db.commit()
            return {"status": "updated", "data": [{"clerk_id": user.clerk_id}]}
            
        # Update pending table
        pending_user = db.query(PendingUserDB).filter(PendingUserDB.clerk_id == target_clerk_id).first()
        if pending_user:
            pending_user.role = role_update.role
            db.commit()
            return {"status": "updated", "data": [{"clerk_id": pending_user.clerk_id}]}
            
        raise HTTPException(status_code=404, detail="User not found")
    except HTTPException as he:
        raise he
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/users/{target_clerk_id}/status")
def update_user_status(target_clerk_id: str, status_update: StatusUpdate, db: Session = Depends(get_db), requester_id: Optional[str] = Header(None, alias="X-Clerk-User-Id")):
    if not requester_id:
        raise HTTPException(status_code=401, detail="Missing user ID header")
        
    requester = db.query(UserDB).filter(UserDB.clerk_id == requester_id).first()
    if not requester or requester.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    try:
        # 1. Handle Approval/Promotion Logic
        if status_update.status == "approved":
            # Find in pending
            pending_user = db.query(PendingUserDB).filter(PendingUserDB.clerk_id == target_clerk_id).first()
            if pending_user:
                # Get instance settings for org data
                local_instance = db.query(InstanceSettingsDB).first()
                
                # Create main user record
                user_data = {c.name: getattr(pending_user, c.name) for c in pending_user.__table__.columns if c.name != 'id'}
                user_data["role"] = "editor" # Default role on approval
                user_data["approval_status"] = "approved"
                user_data["is_verified"] = True
                
                if local_instance:
                    user_data["organization"] = local_instance.org_name
                    user_data["org_id"] = local_instance.org_id
                
                new_user = UserDB(**user_data)
                db.add(new_user)
                db.delete(pending_user)
                db.commit()
                return {"status": "approved_and_moved", "data": [{"clerk_id": target_clerk_id}]}

        # 2. General update for existing users
        user = db.query(UserDB).filter(UserDB.clerk_id == target_clerk_id).first()
        if user:
            user.approval_status = status_update.status
            db.commit()
            return {"status": "updated", "data": [{"clerk_id": target_clerk_id}]}
            
        # 3. Update pending user status if not approved
        pending_user = db.query(PendingUserDB).filter(PendingUserDB.clerk_id == target_clerk_id).first()
        if pending_user:
            pending_user.approval_status = status_update.status
            db.commit()
            return {"status": "updated", "data": [{"clerk_id": target_clerk_id}]}
            
        raise HTTPException(status_code=404, detail="User not found")
    except Exception as e:
        print(f"Error updating status: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/users/{target_clerk_id}")
def delete_user(target_clerk_id: str, db: Session = Depends(get_db), requester_id: Optional[str] = Header(None, alias="X-Clerk-User-Id")):
    if not requester_id:
        raise HTTPException(status_code=401, detail="Missing user ID header")
        
    requester = db.query(UserDB).filter(UserDB.clerk_id == requester_id).first()
    if not requester or requester.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    if target_clerk_id == requester_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    try:
        # Try both tables
        deleted_count = 0
        user = db.query(UserDB).filter(UserDB.clerk_id == target_clerk_id).first()
        if user:
            db.delete(user)
            deleted_count += 1
            
        pending_user = db.query(PendingUserDB).filter(PendingUserDB.clerk_id == target_clerk_id).first()
        if pending_user:
            db.delete(pending_user)
            deleted_count += 1
            
        db.commit()
        return {"status": "deleted", "users_cleared": deleted_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/verify-license")
def verify_license(verify: LicenseVerify, db: Session = Depends(get_db)):
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

        # 4. Success - Update settings and user in the LOCAL database
        now = datetime.now()
        
        # 4.5 Notify Pluto Admin about this activation
        try:
            admin_supabase.table("organizations").update({
                "status": "active",
                "activated_at": now.isoformat(),
                "server_id": verify.server_id,
                "app_version": verify.app_version or "1.0.0"
            }).eq("id", org_id).execute()

            admin_supabase.table("admin_logs").insert({
                "action": "REMOTE_ACTIVATION",
                "details": f"Instance activated remotely for organization {org_name_actual}. Server: {verify.server_id}, Version: {verify.app_version}",
                "organization_id": org_id,
                "performed_by": f"Remote System ({verify.email_id})"
            }).execute()
        except Exception as admin_err:
            print(f"Warning: Could not notify Pluto Admin of activation: {admin_err}")

        # 5. Lock this instance to the organization in LOCAL DB
        try:
            db.query(InstanceSettingsDB).delete() # Single tenant model: clear old settings
            
            new_settings = InstanceSettingsDB(
                org_id=str(org_id),
                org_name=org_name_actual,
                org_code=org_code or verify.org_code,
                plan=org_plan,
                status=org_status,
                license_key=verify.license_id,
                app_version=verify.app_version or "1.0.0",
                server_id=verify.server_id,
                admin_email=verify.email_id,
                activated_at=now
            )
            db.add(new_settings)
            
            # Immediately update the local cache
            global INSTANCE_STATUS_CACHE
            INSTANCE_STATUS_CACHE["is_suspended"] = str(org_status).lower() != "active"
            INSTANCE_STATUS_CACHE["org_name"] = org_name_actual
            INSTANCE_STATUS_CACHE["last_check"] = now
            
            # Update the user
            user = db.query(UserDB).filter(UserDB.clerk_id == verify.clerk_id).first()
            if user:
                user.is_verified = True
                user.verified_at = now
                user.organization = org_name_actual
                user.org_id = str(org_id)
                user.approval_status = "approved"
                user.role = "admin"
            
            db.commit()
            print(f"✅ Instance Activated and Locked to {org_name_actual} (ID: {org_id})")
        except Exception as lock_err:
            print(f"Error locking instance settings: {lock_err}")
            db.rollback()

        return {
            "status": "verified",
            "message": f"Successfully verified license for {org_name_actual}",
            "data": [{"clerk_id": verify.clerk_id}]
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Verification Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Verification Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Helper to get process table name based on type
def get_process_table(p_type: str):
    if p_type == 'table':
        return "table_processes"
    elif p_type == 'freestyle':
        return "freestyle_processes"
    return "processes"

@app.post("/processes")
def create_process(process: ProcessPackageCreate, db: Session = Depends(get_db)):
    try:
        # Store the sheets as JSONB
        new_process = ProcessDB(
            user_id=process.user_id,
            org_id=str(process.org_id) if process.org_id is not None else None,
            name=process.name,
            sheets=[sheet.model_dump() for sheet in process.sheets],
            status=process.status,
            type=process.type,
            updated_at=datetime.now()
        )
        
        db.add(new_process)
        db.commit()
        db.refresh(new_process)
        
        # Auto-create a version if published
        if process.status == 'published':
            new_version = {
                "name": process.version_name or f"Published Version - {datetime.now().strftime('%Y-%m-%d %H:%M')}",
                "sheets": new_process.sheets,
                "comments": process.version_comments or "Automatically created on publish",
                "created_at": datetime.now().isoformat()
            }
            new_process.versions = [new_version]
            db.commit()

        return {"status": "created", "data": [{"id": new_process.id}]}
    except Exception as e:
        print(f"Error creating process: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/processes/{process_id}")
def update_process(process_id: int, process: ProcessPackageCreate, db: Session = Depends(get_db), requester_id: Optional[str] = Header(None, alias="X-Clerk-User-Id")):
    try:
        print(f"[PROCESS] Updating process {process_id}. Type: {process.type}, Status: {process.status}, Requester: {requester_id}")
        
        # 1. Fetch Process
        db_process = db.query(ProcessDB).filter(ProcessDB.id == process_id).first()
        if not db_process:
             raise HTTPException(status_code=404, detail="Process not found")
             
        # 2. Check Ownership
        if requester_id:
             if db_process.user_id != requester_id:
                  # Check if admin
                  user = db.query(UserDB).filter(UserDB.clerk_id == requester_id).first()
                  if not user or user.role != "admin":
                       print(f"[PROCESS] Unauthorized update attempt by {requester_id}")
                       raise HTTPException(status_code=403, detail="Not authorized to update this process")

        # 3. Update data
        db_process.name = process.name
        db_process.sheets = [sheet.model_dump() for sheet in process.sheets]
        db_process.status = process.status
        db_process.type = process.type
        db_process.org_id = str(process.org_id) if process.org_id is not None else None
        db_process.updated_at = datetime.now()
        
        # 4. Handle Versions
        if process.status == 'published':
            versions = list(db_process.versions) if db_process.versions else []
            new_version = {
                "name": process.version_name or f"Version {len(versions) + 1} - {datetime.now().strftime('%Y-%m-%d %H:%M')}",
                "sheets": db_process.sheets,
                "comments": process.version_comments or "Manual update publish",
                "created_at": datetime.now().isoformat()
            }
            versions.append(new_version)
            db_process.versions = versions

        db.commit()
        return {"status": "updated", "data": [{"id": db_process.id}]}
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error updating process: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/processes/{user_id}")
def get_processes(user_id: str, db: Session = Depends(get_db)):
    try:
        print(f"Fetching processes for user: {user_id}")
        # Fetch all processes for user, regardless of type as they are all in one table now
        processes = db.query(ProcessDB).filter(ProcessDB.user_id == user_id).all()
        
        # Optimize payload: Remove heavy 'sheets' data
        cleaned_data = []
        for p in processes:
            # Convert SQLAlchemy object to dict
            p_dict = {c.name: getattr(p, c.name) for c in p.__table__.columns}
            
            # Remove heavy sheets data
            p_dict.pop("sheets", None)
            
            # Clean versions (remove sheets from within versions too)
            versions = p_dict.get("versions", [])
            if isinstance(versions, list):
                for v in versions:
                    if isinstance(v, dict):
                        v.pop("sheets", None)
            
            # Handle datetime serialization
            for k, v in p_dict.items():
                if isinstance(v, datetime):
                    p_dict[k] = v.isoformat()
                    
            cleaned_data.append(p_dict)
        
        # Sort by updated_at or created_at descending
        cleaned_data.sort(key=lambda x: x.get("updated_at", x.get("created_at")), reverse=True)
            
        return cleaned_data
    except Exception as e:
        print(f"Error fetching processes: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/process/{process_id}")
def get_process(process_id: int, db: Session = Depends(get_db)):
    try:
        print(f"Fetching process {process_id}...")
        p = db.query(ProcessDB).filter(ProcessDB.id == process_id).first()
        if p:
            # Convert to dict and handle datetimes
            p_dict = {c.name: getattr(p, c.name) for c in p.__table__.columns}
            for k, v in p_dict.items():
                if isinstance(v, datetime):
                    p_dict[k] = v.isoformat()
            return p_dict
                
        raise HTTPException(status_code=404, detail="Process not found")
    except Exception as e:
        print(f"Error fetching process {process_id}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/processes/{process_id}/rename")
def rename_process(process_id: int, rename: ProcessRename, db: Session = Depends(get_db), requester_id: Optional[str] = Header(None, alias="X-Clerk-User-Id")):
    try:
        p = db.query(ProcessDB).filter(ProcessDB.id == process_id).first()
        if not p:
            raise HTTPException(status_code=404, detail="Process not found")

        # Check Ownership
        if requester_id:
             if p.user_id != requester_id:
                  # Check if admin
                  user = db.query(UserDB).filter(UserDB.clerk_id == requester_id).first()
                  if not user or user.role != "admin":
                       print(f"[PROCESS] Unauthorized rename attempt by {requester_id}")
                       raise HTTPException(status_code=403, detail="Not authorized to rename this process")

        p.name = rename.name
        p.updated_at = datetime.now()
        db.commit()
        return {"status": "updated", "data": [{"id": p.id, "name": p.name}]}
    except HTTPException as he:
        raise he
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/processes/{process_id}/versions")
def save_process_version(process_id: int, version: ProcessVersionCreate, db: Session = Depends(get_db), requester_id: Optional[str] = Header(None, alias="X-Clerk-User-Id")):
    try:
        p = db.query(ProcessDB).filter(ProcessDB.id == process_id).first()
        if not p:
            raise HTTPException(status_code=404, detail="Process not found")
            
        # Check Ownership
        if requester_id:
             if p.user_id != requester_id:
                  # Check if admin
                  user = db.query(UserDB).filter(UserDB.clerk_id == requester_id).first()
                  if not user or user.role != "admin":
                       print(f"[PROCESS] Unauthorized version save attempt by {requester_id}")
                       raise HTTPException(status_code=403, detail="Not authorized to save version for this process")

        # 2. Append new version
        versions = list(p.versions) if p.versions else []
        new_version = {
            "name": version.name,
            "sheets": [sheet.model_dump() for sheet in version.sheets],
            "comments": version.comments,
            "created_at": datetime.now().isoformat()
        }
        versions.append(new_version)
        p.versions = versions
        p.updated_at = datetime.now()
        
        db.commit()
        return {"status": "version_saved", "data": [{"id": p.id}]}
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error saving version: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/processes/{process_id}")
def delete_process(process_id: int, db: Session = Depends(get_db), requester_id: Optional[str] = Header(None, alias="X-Clerk-User-Id")):
    try:
        p = db.query(ProcessDB).filter(ProcessDB.id == process_id).first()
        if not p:
            raise HTTPException(status_code=404, detail="Process not found")

        # Check Ownership
        if requester_id:
             if p.user_id != requester_id:
                  # Check if admin
                  user = db.query(UserDB).filter(UserDB.clerk_id == requester_id).first()
                  if not user or user.role != "admin":
                       print(f"[PROCESS] Unauthorized delete attempt by {requester_id}")
                       raise HTTPException(status_code=403, detail="Not authorized to delete this process")

        db.delete(p)
        db.commit()
        return {"status": "deleted", "data": [{"id": process_id}]}
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error deleting process: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/projects")
def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    try:
        # 1. Fetch the process to get the version data
        process = db.query(ProcessDB).filter(ProcessDB.id == project.process_id).first()
        if not process:
            raise HTTPException(status_code=404, detail="Process template not found")
        
        versions = process.versions or []
        selected_version = next((v for v in versions if v["name"] == project.version_name), None)
        
        if not selected_version:
            raise HTTPException(status_code=404, detail="Version not found")
            
        # 2. Create the project with the COPIED sheets
        new_project = ProjectDB(
            user_id=project.user_id,
            name=project.name,
            process_id=project.process_id,
            version_name=project.version_name,
            sheets=selected_version["sheets"], # Copy the sheets
            type=project.type,
            org_id=project.org_id,
            jira_project_key=project.jira_project_key,
            updated_at=datetime.now()
        )
        
        db.add(new_project)
        db.commit()
        db.refresh(new_project)
        return {"status": "created", "data": [{"id": new_project.id}]}
    except Exception as e:
        print(f"Error creating project: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/projects/{user_id}")
def get_projects(user_id: str, db: Session = Depends(get_db)):
    try:
        from sqlalchemy import or_, cast, String
        # Using SQLAlchemy or_ to filter for owned or shared projects
        projects = db.query(ProjectDB).filter(
            or_(
                ProjectDB.user_id == user_id,
                cast(ProjectDB.collaborators, String).like(f'%{user_id}%')
            )
        ).order_by(ProjectDB.created_at.desc()).all()
        
        # Optimize payload: Remove heavy 'sheets' data
        cleaned_data = []
        for project in projects:
            p_dict = {c.name: getattr(project, c.name) for c in project.__table__.columns}
            p_dict.pop("sheets", None)
            
            # Handle datetime
            for k, v in p_dict.items():
                if isinstance(v, datetime): p_dict[k] = v.isoformat()
                
            cleaned_data.append(p_dict)
        
        return cleaned_data
    except Exception as e:
        print(f"Error fetching projects: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/projects/{project_id}/collaborators")
def add_collaborator(project_id: int, collaborator: CollaboratorAdd, db: Session = Depends(get_db)):
    try:
        # Fetch current project
        project = db.query(ProjectDB).filter(ProjectDB.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
            
        current_collaborators = list(project.collaborators) if project.collaborators else []
        
        # Check if already exists
        exists = False
        for c in current_collaborators:
            if c["user_id"] == collaborator.user_id:
                c["role"] = collaborator.role # Update role
                exists = True
                break
        
        if not exists:
            current_collaborators.append(collaborator.model_dump())
            
        project.collaborators = current_collaborators
        project.updated_at = datetime.now()
        db.commit()
        return {"status": "updated", "data": [{"id": project.id}]}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/projects/{project_id}/collaborators/{user_id}")
def remove_collaborator(project_id: int, user_id: str, db: Session = Depends(get_db)):
    try:
        # Fetch current project
        project = db.query(ProjectDB).filter(ProjectDB.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
            
        current_collaborators = list(project.collaborators) if project.collaborators else []
        
        # Remove the collaborator
        updated_collaborators = [c for c in current_collaborators if c.get("user_id") != user_id]
        
        project.collaborators = updated_collaborators
        project.updated_at = datetime.now()
        db.commit()
        return {"status": "removed", "data": [{"id": project.id}]}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/project/{project_id}")
def get_project(project_id: int, db: Session = Depends(get_db)):
    try:
        project = db.query(ProjectDB).filter(ProjectDB.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
            
        p_dict = {c.name: getattr(project, c.name) for c in project.__table__.columns}
        for k, v in p_dict.items():
            if isinstance(v, datetime): p_dict[k] = v.isoformat()
        return p_dict
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/project/{project_id}/rename")
def rename_project(project_id: int, rename: ProcessRename, db: Session = Depends(get_db)):
    try:
        project = db.query(ProjectDB).filter(ProjectDB.id == project_id).first()
        if not project:
             raise HTTPException(status_code=404, detail="Project not found")
             
        project.name = rename.name
        project.updated_at = datetime.now()
        db.commit()
        return {"status": "updated", "data": [{"id": project.id}]}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

def process_jira_sync(project_id: int, project_name: str, version: str, sheets: list, db_session_factory):
    """Background task to sync project tasks with Jira"""
    db = db_session_factory()
    try:
        # Fetch all users to resolve names in Jira
        user_map = {}
        users = db.query(UserDB).all()
        for u in users:
            name = f"{u.first_name or ''} {u.last_name or ''}".strip()
            user_map[u.clerk_id] = name or u.clerk_id

        # Fetch project details for metadata
        project = db.query(ProjectDB).filter(ProjectDB.id == project_id).first()
        if not project:
            return
            
        project_owner = user_map.get(project.user_id, project.user_id)
        
        metadata = {
            "project_name": project_name,
            "version": version,
            "project_owner": project_owner,
            "project_status": project.status,
            "project_id": project_id,
            "project_type": project.type,
            "jira_project_key": project.jira_project_key
        }

        updated_sheets = []
        has_changes = False

        for sheet in sheets:
            sheet_changed = False
            nodes = sheet.get("nodes", [])
            for node in nodes:
                node_type = node.get("type")
                data = node.get("data", {})
                responsibility = data.get("responsibility", [])
                support = data.get("support", [])
                
                if (node_type in ["activity", "process"]) and (responsibility or support):
                    jira_key = sync_task_to_jira(data, metadata, user_map)
                    if jira_key and data.get("jira_issue_id") != jira_key:
                        data["jira_issue_id"] = jira_key
                        sheet_changed = True
                        has_changes = True
            updated_sheets.append(sheet)

        if has_changes:
            project.sheets = updated_sheets
            db.commit()
            print(f"Jira sync complete for project {project_id}")
    except Exception as e:
        print(f"Error in Jira sync background task: {e}")
        traceback.print_exc()
    finally:
        db.close()

@app.put("/project/{project_id}")
def update_project(project_id: int, update: ProjectUpdate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    try:
        project = db.query(ProjectDB).filter(ProjectDB.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        if update.sheets is not None:
            project.sheets = [sheet.model_dump() for sheet in update.sheets]
            if project.status == 'published':
                 background_tasks.add_task(process_jira_sync, project_id, project.name, project.version_name, project.sheets, SessionLocal)
            
        if update.name is not None:
            project.name = update.name

        if update.progress is not None:
            project.progress = update.progress

        if update.status is not None:
            project.status = update.status

        if update.version_name is not None:
            project.version_name = update.version_name
            
        project.updated_at = datetime.now()
        db.commit()
        return {"status": "updated", "data": [{"id": project_id}]}
    except Exception as e:
        print(f"Error updating project: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/admin/projects")
def get_all_projects(db: Session = Depends(get_db), requester_id: Optional[str] = Header(None, alias="X-Clerk-User-Id")):
    if not requester_id:
        raise HTTPException(status_code=401, detail="Missing user ID header")
        
    # Check if requester is admin
    requester = db.query(UserDB).filter(UserDB.clerk_id == requester_id).first()
    if not requester or requester.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    try:
        projects = db.query(ProjectDB).order_by(ProjectDB.created_at.desc()).all()
        
        # Optimize payload: Remove heavy 'sheets' data
        cleaned_data = []
        for project in projects:
            p_dict = {c.name: getattr(project, c.name) for c in project.__table__.columns}
            p_dict.pop("sheets", None)
            for k, v in p_dict.items():
                if isinstance(v, datetime): p_dict[k] = v.isoformat()
            cleaned_data.append(p_dict)
        return cleaned_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/calendar/events/{user_id}")
def get_calendar_events(user_id: str, db: Session = Depends(get_db)):
    try:
        from sqlalchemy import or_
        # Fetch all projects where the user is either the owner or a collaborator
        projects = db.query(ProjectDB).filter(
            or_(
                ProjectDB.user_id == user_id,
                ProjectDB.collaborators.contains([{"user_id": user_id}])
            )
        ).all()

        events = []
        for project in projects:
            if not project.sheets:
                continue
            for sheet in project.sheets:
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
                                "id": f"{project.id}-{node['id']}",
                                "title": node_data.get('label', 'Untitled Task'),
                                "project_name": project.name,
                                "date": node_data['deadline'],
                                "type": "task",
                                "route": f"/dashboard/process/create?projectId={project.id}"
                            })
        return events
    except Exception as e:
        print(f"Error fetching calendar events: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/projects/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db), requester_id: Optional[str] = Header(None, alias="X-Clerk-User-Id")):
    try:
        project = db.query(ProjectDB).filter(ProjectDB.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # Check ownership
        if requester_id:
            if project.user_id != requester_id:
                # Check if admin
                user = db.query(UserDB).filter(UserDB.clerk_id == requester_id).first()
                if not user or user.role != "admin":
                    raise HTTPException(status_code=403, detail="Not authorized to delete this project")

        db.delete(project)
        db.commit()
        return {"status": "deleted", "data": [{"id": project_id}]}
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error deleting project: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/jira/connection-trigger")
def trigger_connection_jira(trigger: ConnectionJiraTrigger, db: Session = Depends(get_db)):
    try:
        # Fetch users to resolve names
        user_records = db.query(UserDB).all()
        user_map = {}
        for u in user_records:
            name = f"{u.first_name or ''} {u.last_name or ''}".strip()
            user_map[u.clerk_id] = name or u.clerk_id

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


