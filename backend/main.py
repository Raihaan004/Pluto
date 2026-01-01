from fastapi import FastAPI, HTTPException, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from database import supabase
from models import UserCreate, RoleUpdate, NotificationCreate, ProcessPackageCreate, ProcessRename, ProcessVersionCreate, ProjectCreate, ProjectUpdate, CollaboratorAdd
from typing import Optional
from datetime import datetime
from email_service import send_email, create_assignment_email_html, create_assignment_email_text

import os

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

@app.post("/notifications")
def create_notification(notification: NotificationCreate):
    try:
        data = notification.model_dump()
        response = supabase.table("notifications").insert(data).execute()
        
        # Send email if this is a role/responsibility assignment notification
        metadata = notification.metadata or {}
        if metadata.get("node_id") and metadata.get("project_id"):
            try:
                print(f"Attempting to send email for notification to user {notification.user_id}")
                # Get recipient user details
                recipient_res = supabase.table("users").select("email, first_name, last_name").eq("clerk_id", notification.user_id).execute()
                if recipient_res.data:
                    recipient = recipient_res.data[0]
                    recipient_email = recipient.get("email")
                    recipient_name = f"{recipient.get('first_name', '')} {recipient.get('last_name', '')}".strip() or recipient_email
                    
                    # Get project details
                    project_res = supabase.table("projects").select("name, version_name, user_id").eq("id", metadata.get("project_id")).execute()
                    project = project_res.data[0] if project_res.data else None
                    
                    # Get assigned by user details
                    assigned_by_id = metadata.get("assigned_by_id")
                    assigned_by_name = metadata.get("assigned_by_name", "System")
                    assigned_by_email = metadata.get("assigned_by_email", "")
                    
                    if assigned_by_id:
                        assigned_by_res = supabase.table("users").select("email, first_name, last_name").eq("clerk_id", assigned_by_id).execute()
                        if assigned_by_res.data:
                            assigned_by_user = assigned_by_res.data[0]
                            assigned_by_name = f"{assigned_by_user.get('first_name', '')} {assigned_by_user.get('last_name', '')}".strip() or assigned_by_user.get("email", "")
                            assigned_by_email = assigned_by_user.get("email", "")
                    
                    if recipient_email and project:
                        # Determine role type from notification message or metadata
                        role_type = "Responsible"
                        if "Support" in notification.message or "support" in notification.message.lower():
                            role_type = "Support"
                        elif "Responsible" in notification.message or "responsible" in notification.message.lower():
                            role_type = "Responsible"
                        
                        # Get node details from metadata
                        work_product = metadata.get("node_label", notification.message.split('"')[1] if '"' in notification.message else "Untitled")
                        node_status = metadata.get("node_status", "None")
                        deadline = metadata.get("deadline")
                        # Format deadline if it's a date string
                        if deadline:
                            try:
                                from datetime import datetime
                                if isinstance(deadline, str):
                                    deadline_date = datetime.fromisoformat(deadline.replace('Z', '+00:00'))
                                    deadline = deadline_date.strftime("%B %d, %Y")
                            except:
                                pass  # Keep original format if parsing fails
                        description = metadata.get("description")
                        
                        # Create and send email
                        subject = f"New {role_type} Assignment - {project.get('name', 'Project')}"
                        html_body = create_assignment_email_html(
                            recipient_name=recipient_name,
                            role_type=role_type,
                            project_name=project.get("name", "Untitled Project"),
                            work_product=work_product,
                            assigned_by_name=assigned_by_name,
                            assigned_by_email=assigned_by_email,
                            project_version=project.get("version_name"),
                            node_status=node_status,
                            deadline=deadline,
                            description=description
                        )
                        text_body = create_assignment_email_text(
                            recipient_name=recipient_name,
                            role_type=role_type,
                            project_name=project.get("name", "Untitled Project"),
                            work_product=work_product,
                            assigned_by_name=assigned_by_name,
                            assigned_by_email=assigned_by_email,
                            project_version=project.get("version_name"),
                            node_status=node_status,
                            deadline=deadline,
                            description=description
                        )
                        
                        print(f"Sending email to {recipient_email}")
                        send_email(recipient_email, subject, html_body, text_body)
                    else:
                        print(f"Skipping email: recipient_email={recipient_email}, project={project}")
                else:
                    print(f"Recipient not found for user_id {notification.user_id}")
            except Exception as email_error:
                # Don't fail the notification creation if email fails
                print(f"Error sending email notification: {email_error}")
                import traceback
                traceback.print_exc()
        
        return {"status": "created", "data": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/dashboard-stats/{clerk_id}")
def get_dashboard_stats(clerk_id: str):
    try:
        # 1. Fetch recent notifications
        notif_response = supabase.table("notifications").select("*").eq("user_id", clerk_id).order("created_at", desc=True).limit(5).execute()
        notifications = notif_response.data if notif_response.data else []

        # 2. Fetch projects count (where user is owner or collaborator)
        # Get all projects to check collaborators and ownership
        # We need 'user_id' to check ownership and 'collaborators' to check collaboration
        all_projects_response = supabase.table("projects").select("id, name, user_id, collaborators, sheets, progress, updated_at, version_name").execute()
        all_projects = all_projects_response.data if all_projects_response.data else []
        
        user_projects = []
        tasks_assigned = 0
        upcoming_deadlines = 0
        
        from datetime import datetime, timedelta
        now = datetime.now()
        next_week = now + timedelta(days=7)
        
        # Set to track unique task IDs to avoid double counting
        assigned_task_ids = set()

        for project in all_projects:
            # Check Project Ownership/Collaboration
            is_owner = project.get("user_id") == clerk_id
            collaborators = project.get("collaborators", [])
            is_collaborator = any(c.get("clerk_id") == clerk_id for c in collaborators)
            
            if is_owner or is_collaborator:
                # Calculate automatic progress (Green Bar)
                # Based on nodes assigned to the user where state != 'Draft'
                assigned_nodes = 0
                changed_nodes = 0
                sheets = project.get("sheets", [])
                for sheet in sheets:
                    nodes = sheet.get("nodes", [])
                    for node in nodes:
                        data = node.get("data", {})
                        responsibility = data.get("responsibility", [])
                        support = data.get("support", [])
                        
                        if clerk_id in responsibility or clerk_id in support:
                            assigned_nodes += 1
                            # Check if state has changed from 'Draft' or 'None'
                            node_state = data.get("state") or data.get("status") or "None"
                            if node_state not in ["Draft", "None"]:
                                changed_nodes += 1
                
                manual_progress = project.get("progress", 0)
                if assigned_nodes > 0:
                    # Green Bar increases until it matches the Blue Bar
                    auto_progress = (changed_nodes / assigned_nodes) * manual_progress
                else:
                    auto_progress = 0

                user_projects.append({
                    "id": project["id"],
                    "name": project["name"],
                    "version_name": project.get("version_name", "v1.0"),
                    "progress": manual_progress, # Manual (Blue Bar)
                    "auto_progress": round(auto_progress), # Automatic (Green Bar)
                    "updated_at": project["updated_at"]
                })

                # Check Tasks Assigned
                # Iterate through sheets and nodes to find assignments
                sheets = project.get("sheets", [])
                for sheet in sheets:
                    nodes = sheet.get("nodes", [])
                    for node in nodes:
                        data = node.get("data", {})
                        
                        # Check responsibility
                        responsibility = data.get("responsibility", [])
                        # Check support
                        support = data.get("support", [])
                        
                        # If user is in responsibility or support list
                        if clerk_id in responsibility or clerk_id in support:
                            project_id = project.get("id", "unknown")
                            node_id = node.get("id", "unknown")
                            assigned_task_ids.add(f"{project_id}_{node_id}")

                        # Check for upcoming deadlines
                        deadline_str = data.get("deadline")
                        if deadline_str:
                            try:
                                deadline = datetime.fromisoformat(deadline_str.replace('Z', '+00:00'))
                                if now <= deadline <= next_week:
                                    upcoming_deadlines += 1
                            except:
                                continue

        tasks_assigned = len(assigned_task_ids)
        
        # Sort user projects by updated_at and take top 5
        user_projects.sort(key=lambda x: x["updated_at"], reverse=True)
        top_projects = user_projects[:5]

        return {
            "tasks_assigned": tasks_assigned,
            "upcoming_deadlines": upcoming_deadlines,
            "notifications": notifications,
            "projects": top_projects
        }
    except Exception as e:
        print(f"Error fetching dashboard stats: {e}")
        # Return empty structure on error to prevent frontend crash
        return {
            "tasks_assigned": 0,
            "upcoming_deadlines": 0,
            "notifications": [],
            "projects": []
        }

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
def update_process(process_id: int, process: ProcessPackageCreate):
    try:
        data = {
            "name": process.name,
            "sheets": [sheet.model_dump() for sheet in process.sheets],
            "updated_at": "now()",
            "status": process.status
        }
        response = supabase.table("processes").update(data).eq("id", process_id).execute()
        return {"status": "updated", "data": response.data}
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
def rename_process(process_id: int, rename: ProcessRename):
    try:
        data = supabase.table("processes").update({"name": rename.name}).eq("id", process_id).execute()
        return {"status": "updated", "data": data.data}
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

@app.delete("/processes/{process_id}")
def delete_process(process_id: int):
    try:
        response = supabase.table("processes").delete().eq("id", process_id).execute()
        return {"status": "deleted", "data": response.data}
    except Exception as e:
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

@app.get("/tasks/{user_id}")
def get_user_tasks(user_id: str):
    try:
        # Fetch all projects to scan for node assignments
        # In production, this should be optimized with a JSONB query
        response = supabase.table("projects").select("*").execute()
        projects = response.data
        
        tasks = []
        
        for project in projects:
            sheets = project.get("sheets", [])
            # Handle case where sheets might be None or empty
            if not sheets:
                continue
                
            for sheet in sheets:
                nodes = sheet.get("nodes", [])
                for node in nodes:
                    data = node.get("data", {})
                    responsibility = data.get("responsibility", [])
                    support = data.get("support", [])
                    
                    # Ensure lists
                    if not isinstance(responsibility, list): responsibility = []
                    if not isinstance(support, list): support = []
                    
                    # Check if user is assigned
                    is_responsible = user_id in responsibility
                    is_support = user_id in support
                    
                    if is_responsible or is_support:
                        # Determine role name
                        role = "Responsible" if is_responsible else "Support"
                        
                        task = {
                            "project_id": project["id"],
                            "project_name": project["name"],
                            "work_product": data.get("label", "Untitled Node"),
                            "version": project.get("version_name", "1.0"),
                            "author_id": project["user_id"],
                            "status": data.get("state", "None"),
                            "verification_reviewers": support, # List of support user IDs
                            "verification_comments": data.get("verificationComments", ""),
                            "author_comments": data.get("authorComments", ""),
                            "assigned_role": role,
                            "created_at": project.get("created_at", ""),
                            "node_id": node.get("id"),  # Store node ID for clearing
                            "sheet_index": sheets.index(sheet)  # Store sheet index for clearing
                        }
                        tasks.append(task)
                        
        return tasks
    except Exception as e:
        print(f"Error fetching tasks: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/tasks/{user_id}")
def clear_task(
    user_id: str,
    project_id: int = Query(...),
    node_id: str = Query(...),
    sheet_index: int = Query(...)
):
    try:
        # Fetch the project
        response = supabase.table("projects").select("*").eq("id", project_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Project not found")
        
        project = response.data[0]
        sheets = project.get("sheets", [])
        
        if sheet_index >= len(sheets):
            raise HTTPException(status_code=404, detail="Sheet not found")
        
        sheet = sheets[sheet_index]
        nodes = sheet.get("nodes", [])
        
        # Find the node
        node = None
        node_index = None
        for idx, n in enumerate(nodes):
            if n.get("id") == node_id:
                node = n
                node_index = idx
                break
        
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        
        # Remove user from responsibility or support
        data = node.get("data", {})
        responsibility = data.get("responsibility", [])
        support = data.get("support", [])
        
        # Ensure lists
        if not isinstance(responsibility, list): responsibility = []
        if not isinstance(support, list): support = []
        
        # Remove user from both arrays
        updated_responsibility = [uid for uid in responsibility if uid != user_id]
        updated_support = [uid for uid in support if uid != user_id]
        
        # Update the node data
        data["responsibility"] = updated_responsibility
        data["support"] = updated_support
        node["data"] = data
        
        # Update the nodes array
        nodes[node_index] = node
        sheet["nodes"] = nodes
        
        # Update the sheets array
        sheets[sheet_index] = sheet
        
        # Update the project
        response = supabase.table("projects").update({
            "sheets": sheets,
            "updated_at": "now()"
        }).eq("id", project_id).execute()
        
        return {"status": "cleared", "data": response.data}
    except Exception as e:
        print(f"Error clearing task: {e}")
        import traceback
        traceback.print_exc()
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

@app.put("/project/{project_id}")
def update_project(project_id: int, update: ProjectUpdate):
    try:
        data = {
            "updated_at": "now()"
        }
        if update.sheets is not None:
            data["sheets"] = [sheet.model_dump() for sheet in update.sheets]
            
        if update.name is not None:
            data["name"] = update.name

        if update.progress is not None:
            data["progress"] = update.progress
            
        if update.version_name is not None:
            data["version_name"] = update.version_name
            
        response = supabase.table("projects").update(data).eq("id", project_id).execute()
        return {"status": "updated", "data": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/admin/projects")
def get_all_projects(requester_id: Optional[str] = Header(None, alias="X-Clerk-User-Id")):
    if not requester_id:
        raise HTTPException(status_code=401, detail="Missing user ID header")
        
    # Ch
        # Optimize payload: Remove heavy 'sheets' data
        cleaned_data = []
        for project in response.data:
            p = project.copy()
            p.pop("sheets", None)
            cleaned_data.append(p)
            
        return cleaned_ is admin
    requester = supabase.table("users").select("role").eq("clerk_id", requester_id).execute()
    if not requester.data or requester.data[0]["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    try:
        response = supabase.table("projects").select("*").order("created_at", desc=True).execute()
        return response.data
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
                    if node.get('data', {}).get('deadline'):
                        events.append({
                            "id": f"{project['id']}-{node['id']}",
                            "title": node['data'].get('label', 'Untitled Task'),
                            "project_name": project['name'],
                            "date": node['data']['deadline'],
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


@app.get("/notifications/{user_id}")
def get_notifications(user_id: str):
    try:
        response = supabase.table("notifications").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/notifications/{notification_id}/read")
def mark_notification_read(notification_id: int):
    try:
        response = supabase.table("notifications").update({"read": True}).eq("id", notification_id).execute()
        return {"status": "updated", "data": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/notifications/{notification_id}/accept")
def accept_notification(notification_id: int):
    try:
        # 1. Get the notification
        notif_res = supabase.table("notifications").select("*").eq("id", notification_id).execute()
        if not notif_res.data:
            raise HTTPException(status_code=404, detail="Notification not found")
        
        notification = notif_res.data[0]
        metadata = notification.get("metadata") or {}
        project_id = metadata.get("project_id")
        role = metadata.get("role", "viewer")
        user_id = notification["user_id"] # The recipient of the notification

        if not project_id:
             raise HTTPException(status_code=400, detail="Invalid notification: missing project_id")

        # 2. Add user as collaborator to the project
        # Fetch current project
        project_res = supabase.table("projects").select("collaborators").eq("id", project_id).execute()
        if not project_res.data:
            raise HTTPException(status_code=404, detail="Project not found")
            
        current_collaborators = project_res.data[0].get("collaborators") or []
        
        # Check if already exists
        exists = False
        for c in current_collaborators:
            if c["user_id"] == user_id:
                c["role"] = role # Update role
                exists = True
                break
        
        if not exists:
            current_collaborators.append({"user_id": user_id, "role": role})
            
        # Update project
        supabase.table("projects").update({"collaborators": current_collaborators}).eq("id", project_id).execute()

        # 3. Mark notification as read
        supabase.table("notifications").update({"read": True}).eq("id", notification_id).execute()

        return {"status": "accepted"}
    except Exception as e:
        print(f"Error accepting notification: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/notifications/{notification_id}/reject")
def reject_notification(notification_id: int):
    try:
        # Just mark as read for now, or delete
        supabase.table("notifications").update({"read": True}).eq("id", notification_id).execute()
        return {"status": "rejected"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/notifications/{notification_id}")
def delete_notification(notification_id: int):
    try:
        # Check if notification exists first
        check_response = supabase.table("notifications").select("id").eq("id", notification_id).execute()
        if not check_response.data:
            raise HTTPException(status_code=404, detail="Notification not found")
        
        # Delete the notification
        response = supabase.table("notifications").delete().eq("id", notification_id).execute()
        
        # Supabase delete returns empty list [] on success, so check if response exists
        # If we got here without exception, deletion was successful
        return {"status": "deleted", "data": response.data if response.data else []}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting notification: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


