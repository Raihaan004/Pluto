from fastapi import FastAPI, HTTPException, Header, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from database import supabase
from models import UserCreate, RoleUpdate, ProcessPackageCreate, ProcessRename, ProcessVersionCreate, ProjectCreate, ProjectUpdate, CollaboratorAdd, ConnectionJiraTrigger
from typing import Optional
from datetime import datetime
from jira_utils import sync_task_to_jira, create_connection_jira_ticket

import os
from dotenv import load_dotenv

load_dotenv()

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
        # Optimize: Select only necessary fields to reduce payload size
        response = supabase.table("users").select("clerk_id, first_name, last_name, email, image_url, role").order("created_at", desc=True).execute()
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


