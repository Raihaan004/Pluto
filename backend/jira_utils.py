import os
from jira import JIRA
from dotenv import load_dotenv

load_dotenv()

JIRA_URL = os.environ.get("JIRA_URL")
JIRA_EMAIL = os.environ.get("JIRA_EMAIL")
JIRA_API_TOKEN = os.environ.get("JIRA_API_TOKEN")
JIRA_PROJECT_KEY = os.environ.get("JIRA_PROJECT_KEY")

def get_jira_client():
    if not all([JIRA_URL, JIRA_EMAIL, JIRA_API_TOKEN]):
        return None
    try:
        return JIRA(server=JIRA_URL, basic_auth=(JIRA_EMAIL, JIRA_API_TOKEN))
    except Exception as e:
        print(f"Jira connection error: {e}")
        return None

def sync_task_to_jira(node_data, metadata, user_map=None):
    jira = get_jira_client()
    if not jira or not JIRA_PROJECT_KEY:
        return None

    user_map = user_map or {}
    project_key = JIRA_PROJECT_KEY.split('#')[0].strip()
    project_name = metadata.get('project_name', 'Unknown Project')
    version = metadata.get('version', 'N/A')
    project_owner = metadata.get('project_owner', 'N/A')
    project_status = metadata.get('project_status', 'N/A')
    project_id = metadata.get('project_id')
    
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    project_link = f"{frontend_url}/dashboard/process/create?projectId={project_id}" if project_id else None

    # Task title: [Project] Task Name
    summary = f"[{project_name}] {node_data.get('label', 'New Task')}"
    
    # Detailed Description using Jira markup
    details = []
    details.append(f"h1. Project: {project_name}")
    details.append(f"This task was generated from the Pluto Process Modeling Tool.")
    
    if project_link:
        details.append(f"View in Pluto: [{project_link}|{project_link}]")

    details.append(f"\nh2. Project Context")
    details.append(f"* *Project Name:* {project_name}")
    details.append(f"* *Version:* {version}")
    details.append(f"* *Project Owner:* {project_owner}")
    details.append(f"* *Current Project Status:* {project_status}")
    if project_id:
        details.append(f"* *Global Project ID:* {project_id}")
    
    details.append(f"\nh2. Task Details")
    details.append(f"* *Task Name:* {node_data.get('label', 'New Task')}")
    details.append(f"* *Task Status:* {node_data.get('state', 'None')}")
    
    if node_data.get('deadline'):
        details.append(f"* *Deadline:* {node_data.get('deadline')}")
        
    details.append(f"\nh2. Description")
    details.append(node_data.get('description', 'No description provided.'))
    
    # Add Responsibility/Support info to description
    responsibility_ids = node_data.get('responsibility', [])
    support_ids = node_data.get('support', [])
    
    if responsibility_ids or support_ids:
        details.append(f"\nh2. Assignments")
        
        if responsibility_ids:
            resp_names = [user_map.get(uid, uid) for uid in responsibility_ids]
            details.append(f"* *Responsible:* {', '.join(resp_names)}")
            
        if support_ids:
            supp_names = [user_map.get(uid, uid) for uid in support_ids]
            details.append(f"* *Support:* {', '.join(supp_names)}")

    description = "\n".join(details)
    
    # Check if there's already a Jira issue ID
    jira_issue_id = node_data.get('jira_issue_id')
    
    issue_dict = {
        'project': {'key': project_key},
        'summary': summary,
        'description': description,
        'issuetype': {'name': 'Task'},
    }

    try:
        if jira_issue_id:
            # Update existing issue
            issue = jira.issue(jira_issue_id)
            issue.update(summary=summary, description=description)
            return jira_issue_id
        else:
            # Create new issue
            try:
                # Test if project exists
                jira.project(project_key)
            except Exception as pe:
                print(f"Project '{project_key}' not found or inaccessible.")
                return None

            new_issue = jira.create_issue(fields=issue_dict)
            return new_issue.key
    except Exception as e:
        print(f"Error syncing to Jira: {e}")
        return None
