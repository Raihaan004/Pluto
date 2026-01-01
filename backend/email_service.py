import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

def send_email(
    to_email: str,
    subject: str,
    html_body: str,
    text_body: Optional[str] = None
) -> bool:
    """
    Send an email using SMTP.
    Returns True if successful, False otherwise.
    """
    try:
        # Get SMTP configuration from environment variables
        smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        smtp_user = os.getenv("SMTP_USER")
        smtp_password = os.getenv("SMTP_PASSWORD")
        from_email = os.getenv("SMTP_FROM_EMAIL", smtp_user)
        
        # If SMTP credentials are not configured, skip sending email
        if not smtp_user or not smtp_password:
            print("SMTP credentials not configured. Email not sent.")
            return False
        
        # Create message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = from_email
        msg["To"] = to_email
        
        # Add text and HTML parts
        if text_body:
            text_part = MIMEText(text_body, "plain")
            msg.attach(text_part)
        
        html_part = MIMEText(html_body, "html")
        msg.attach(html_part)
        
        # Send email
        if smtp_port == 465:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=30) as server:
                server.login(smtp_user, smtp_password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=30) as server:
                server.starttls()
                server.login(smtp_user, smtp_password)
                server.send_message(msg)
        
        print(f"Email sent successfully to {to_email}")
        return True
        
    except Exception as e:
        print(f"Error sending email: {e}")
        import traceback
        traceback.print_exc()
        return False


def create_assignment_email_html(
    recipient_name: str,
    role_type: str,
    project_name: str,
    work_product: str,
    assigned_by_name: str,
    assigned_by_email: str,
    project_id: Optional[int] = None,
    project_version: Optional[str] = None,
    node_status: Optional[str] = None,
    deadline: Optional[str] = None,
    description: Optional[str] = None
) -> str:
    """
    Create an HTML email template for role/responsibility assignment.
    """
    role_display = "Responsible" if role_type.lower() == "responsible" else "Support"
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    project_link = f"{frontend_url}/dashboard/process/create?projectId={project_id}" if project_id else frontend_url
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #1f2937;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f3f4f6;
            }}
            .container {{
                background-color: white;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            }}
            .header {{
                background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
                color: white;
                padding: 30px 20px;
                text-align: center;
            }}
            .header h1 {{
                margin: 0;
                font-size: 24px;
                font-weight: 700;
            }}
            .content {{
                padding: 30px;
            }}
            .welcome-text {{
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 10px;
            }}
            .info-box {{
                background-color: #f9fafb;
                border: 1px solid #e5e7eb;
                padding: 20px;
                margin: 20px 0;
                border-radius: 8px;
            }}
            .detail-row {{
                display: flex;
                margin: 12px 0;
                padding-bottom: 8px;
                border-bottom: 1px solid #f3f4f6;
            }}
            .detail-label {{
                font-weight: 600;
                color: #6b7280;
                width: 140px;
                flex-shrink: 0;
            }}
            .detail-value {{
                color: #111827;
                font-weight: 500;
            }}
            .role-badge {{
                display: inline-block;
                background-color: #EEF2FF;
                color: #4F46E5;
                padding: 6px 16px;
                border-radius: 9999px;
                font-weight: 700;
                font-size: 14px;
                margin-bottom: 20px;
                border: 1px solid #C7D2FE;
            }}
            .button-container {{
                text-align: center;
                margin-top: 30px;
            }}
            .button {{
                background-color: #4F46E5;
                color: white !important;
                padding: 14px 28px;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
                display: inline-block;
                transition: background-color 0.2s;
            }}
            .footer {{
                text-align: center;
                padding: 20px;
                color: #9ca3af;
                font-size: 12px;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>New Task Assignment</h1>
            </div>
            <div class="content">
                <p class="welcome-text">Hello {recipient_name},</p>
                <p>You have been assigned as a <strong>{role_display}</strong> for a new task in the project management system.</p>
                
                <div class="info-box">
                    <div class="role-badge">{role_display}</div>
                    
                    <div class="detail-row">
                        <span class="detail-label">Project:</span>
                        <span class="detail-value">{project_name}</span>
                    </div>
    """
    
    if project_version:
        html += f"""
                    <div class="detail-row">
                        <span class="detail-label">Version:</span>
                        <span class="detail-value">{project_version}</span>
                    </div>
        """
    
    html += f"""
                    <div class="detail-row">
                        <span class="detail-label">Work Product:</span>
                        <span class="detail-value">{work_product}</span>
                    </div>
    """
    
    if node_status:
        html += f"""
                    <div class="detail-row">
                        <span class="detail-label">Status:</span>
                        <span class="detail-value">{node_status}</span>
                    </div>
        """
    
    if deadline:
        html += f"""
                    <div class="detail-row">
                        <span class="detail-label">Deadline:</span>
                        <span class="detail-value" style="color: #dc2626;">{deadline}</span>
                    </div>
        """
    
    html += f"""
                    <div class="detail-row">
                        <span class="detail-label">Assigned By:</span>
                        <span class="detail-value">{assigned_by_name}</span>
                    </div>
                </div>
    """
    
    if description:
        html += f"""
                <div style="margin-top: 20px;">
                    <p style="font-weight: 600; color: #6b7280; margin-bottom: 8px;">Task Description:</p>
                    <div style="background-color: white; padding: 15px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 14px;">
                        {description}
                    </div>
                </div>
        """
    
    html += f"""
                <div class="button-container">
                    <a href="{project_link}" class="button">View Project & Task</a>
                </div>
                
                <p style="margin-top: 30px; font-size: 14px; color: #6b7280; text-align: center;">
                    Click the button above to view the project details and start working on your task.
                </p>
            </div>
            <div class="footer">
                <p>This is an automated message from Pluto Project Management.</p>
                <p>&copy; 2026 Pluto. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return html


def create_assignment_email_text(
    recipient_name: str,
    role_type: str,
    project_name: str,
    work_product: str,
    assigned_by_name: str,
    assigned_by_email: str,
    project_id: Optional[int] = None,
    project_version: Optional[str] = None,
    node_status: Optional[str] = None,
    deadline: Optional[str] = None,
    description: Optional[str] = None
) -> str:
    """
    Create a plain text email template for role/responsibility assignment.
    """
    role_display = "Responsible" if role_type.lower() == "responsible" else "Support"
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    project_link = f"{frontend_url}/dashboard/process/create?projectId={project_id}" if project_id else frontend_url
    
    text = f"""
New Task Assignment

Hello {recipient_name},

You have been assigned as a {role_display} for a new task.

PROJECT DETAILS:
----------------
Role: {role_display}
Project Name: {project_name}
"""
    
    if project_version:
        text += f"Version: {project_version}\n"
    
    text += f"Work Product: {work_product}\n"
    
    if node_status:
        text += f"Status: {node_status}\n"
    
    if deadline:
        text += f"Deadline: {deadline}\n"
    
    text += f"Assigned By: {assigned_by_name} ({assigned_by_email})\n"
    
    if description:
        text += f"\nTASK DESCRIPTION:\n{description}\n"
    
    text += f"""
VIEW PROJECT:
{project_link}

Please log in to your account to manage this assignment.

This is an automated notification. Please do not reply to this email.
"""
    
    return text




