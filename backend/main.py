from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from database import supabase
from models import UserCreate, RoleUpdate, NotificationCreate, ProcessPackageCreate, ProcessRename, ProcessVersionCreate, ProjectCreate, ProjectUpdate, CollaboratorAdd
from typing import Optional
from datetime import datetime

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Allow frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"Hello": "World"}

import traceback

@app.post("/users")
def create_or_update_user(user: UserCreate):
    try:
        # 1. Prepare data for update (exclude unset fields)
        user_data = user.model_dump(exclude_unset=True)
        if "role" in user_data and user_data["role"] is None:
            del user_data["role"]
            
        # 2. Try to UPDATE first (Optimistic: assume user exists)
        response = supabase.table("users").update(user_data).eq("clerk_id", user.clerk_id).execute()
        
        if response.data:
            return {"status": "updated", "data": response.data}
            
        # 3. If Update returned no data, user does not exist. Try INSERT.
        insert_data = user.model_dump()
        # Set default role if not provided
        if not insert_data.get("role"):
            insert_data["role"] = "viewer"
            
        try:
            data = supabase.table("users").insert(insert_data).execute()
            return {"status": "created", "data": data.data}
        except Exception as insert_error:
            # Check for race condition (duplicate key violation)
            error_str = str(insert_error).lower()
            if "duplicate key" in error_str or "23505" in error_str:
                print(f"Race condition detected for user {user.clerk_id}. Retrying update.")
                # User was created by another request in the meantime. Update again.
                response = supabase.table("users").update(user_data).eq("clerk_id", user.clerk_id).execute()
                return {"status": "updated_after_race", "data": response.data}
            else:
                # Genuine error
                raise insert_error
            
    except Exception as e:
        print(f"Error in POST /users: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/users/{clerk_id}")
def get_user(clerk_id: str):
    try:
        response = supabase.table("users").select("*").eq("clerk_id", clerk_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="User not found")
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/users")
def get_all_users(requester_id: Optional[str] = Header(None, alias="X-Clerk-User-Id")):
    # Allow any authenticated user to see the list of users for assignment purposes
    # In a stricter system, you might restrict this to admin/editor
    if not requester_id:
        raise HTTPException(status_code=401, detail="Missing user ID header")

    try:
        response = supabase.table("users").select("*").order("created_at", desc=True).execute()
        return response.data
    except Exception as e:
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
        data = supabase.table("users").update({"role": role_update.role}).eq("clerk_id", target_clerk_id).execute()
        return {"status": "updated", "data": data.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/notifications")
def create_notification(notification: NotificationCreate):
    try:
        data = supabase.table("notifications").insert(notification.model_dump()).execute()
        return {"status": "created", "data": data.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/notifications/{user_id}")
def get_notifications(user_id: str):
    try:
        response = supabase.table("notifications").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
        return response.data
    except Exception as e:
        print(f"Error in GET /notifications: {e}")
        # If table doesn't exist or other error, return empty list to prevent frontend crash
        return []

@app.put("/notifications/{notification_id}/read")
def mark_notification_read(notification_id: int):
    try:
        data = supabase.table("notifications").update({"read": True}).eq("id", notification_id).execute()
        return {"status": "updated", "data": data.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/dashboard-stats/{clerk_id}")
def get_dashboard_stats(clerk_id: str):
    # Mock data for now, replace with real DB queries later
    return {
        "tasks_assigned": 12,
        "projects_pending": 3,
        "notifications": [
            {"id": 1, "message": "New project assigned", "time": "2h ago"},

            {"id": 2, "message": "Meeting at 3 PM", "time": "5h ago"}
        ]
    }

@app.post("/processes")
def create_process(process: ProcessPackageCreate):
    try:
        # Store the sheets as JSONB
        data = {
            "user_id": process.user_id,
            "name": process.name,
            "sheets": [sheet.model_dump() for sheet in process.sheets]
        }
        
        response = supabase.table("processes").insert(data).execute()
        return {"status": "created", "data": response.data}
    except Exception as e:
        print(f"Error creating process: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/processes/{user_id}")
def get_processes(user_id: str):
    try:
        response = supabase.table("processes").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
        return response.data
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
def rename_process(process_id: int, rename: ProcessRename):
    try:
        data = supabase.table("processes").update({"name": rename.name}).eq("id", process_id).execute()
        return {"status": "updated", "data": data.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/processes/{process_id}")
def update_process_content(process_id: int, process: ProcessPackageCreate):
    try:
        data = {
            "user_id": process.user_id,
            "name": process.name,
            "sheets": [sheet.model_dump() for sheet in process.sheets],
            "updated_at": "now()"
        }
        response = supabase.table("processes").update(data).eq("id", process_id).execute()
        return {"status": "updated", "data": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/processes/{process_id}/versions")
def save_process_version(process_id: int, version: ProcessVersionCreate):
    try:
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
    except Exception as e:
        print(f"Error saving version: {e}")
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
        # 1. Owned projects
        owned = supabase.table("projects").select("*").eq("user_id", user_id).execute()
        
        # 2. Shared projects
        shared_data = []
        try:
            shared = supabase.table("projects").select("*").contains("collaborators", [{"user_id": user_id}]).execute()
            shared_data = shared.data
        except Exception as e:
            print(f"Warning: Could not fetch shared projects (likely missing 'collaborators' column): {e}")
        
        # Merge and sort
        all_projects = owned.data + shared_data
        # Remove duplicates based on id if any
        seen = set()
        unique_projects = []
        for p in all_projects:
            if p['id'] not in seen:
                seen.add(p['id'])
                unique_projects.append(p)
                
        unique_projects.sort(key=lambda x: x['created_at'], reverse=True)
        return unique_projects
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

@app.get("/project/{project_id}")
def get_project(project_id: int):
    try:
        response = supabase.table("projects").select("*").eq("id", project_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Project not found")
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/project/{project_id}")
def update_project(project_id: int, update: ProjectUpdate):
    try:
        data = {
            "sheets": [sheet.model_dump() for sheet in update.sheets],
            "updated_at": "now()"
        }
        response = supabase.table("projects").update(data).eq("id", project_id).execute()
        return {"status": "updated", "data": response.data}
    except Exception as e:
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
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/projects/{project_id}")
def delete_project(project_id: int):
    try:
        response = supabase.table("projects").delete().eq("id", project_id).execute()
        return {"status": "deleted", "data": response.data}
    except Exception as e:
        print(f"Error deleting project: {e}")
        raise HTTPException(status_code=500, detail=str(e))

