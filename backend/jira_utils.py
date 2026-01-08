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

def sync_task_to_jira(node_data, metadata):
    jira = get_jira_client()
    if not jira or not JIRA_PROJECT_KEY:
        return None

    project_key = JIRA_PROJECT_KEY.split('#')[0].strip()
    project_name = metadata.get('project_name', 'Unknown Project')
    version = metadata.get('version', 'N/A')
    
    # Task title: [Project] Task Name
    summary = f"[{project_name}] {node_data.get('label', 'New Task')}"
    
    # Detailed Description using Jira markup
    details = []
    details.append(f"h2. Project Details")
    details.append(f"* *Project:* {project_name}")
    details.append(f"* *Version:* {version}")
    details.append(f"* *Status:* {node_data.get('state', 'None')}")
    
    if node_data.get('deadline'):
        details.append(f"* *Deadline:* {node_data.get('deadline')}")
        
    details.append(f"\nh2. Task Description")
    details.append(node_data.get('description', 'No description provided.'))
    
    # Add Responsibility/Support info to description
    responsibility = node_data.get('responsibility', [])
    support = node_data.get('support', [])
    
    if responsibility or support:
        details.append(f"\nh2. Assignments")
        if responsibility:
            details.append(f"* *Responsible:* {', '.join(responsibility)}")
        if support:
            details.append(f"* *Support:* {', '.join(support)}")

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
