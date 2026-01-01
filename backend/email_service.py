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
        with smtplib.SMTP(smtp_host, smtp_port) as server:
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
    project_version: Optional[str] = None,
    node_status: Optional[str] = None,
    deadline: Optional[str] = None,
    description: Optional[str] = None
) -> str:
    """
    Create an HTML email template for role/responsibility assignment.
    """
    role_display = "Responsible" if role_type.lower() == "responsible" else "Support"
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
            }}
            .header {{
                background-color: #4F46E5;
                color: white;
                padding: 20px;
                border-radius: 8px 8px 0 0;
                text-align: center;
            }}
            .content {{
                background-color: #f9fafb;
                padding: 30px;
                border: 1px solid #e5e7eb;
                border-top: none;
            }}
            .info-box {{
                background-color: white;
                border-left: 4px solid #4F46E5;
                padding: 15px;
                margin: 15px 0;
                border-radius: 4px;
            }}
            .detail-row {{
                margin: 10px 0;
                padding: 8px 0;
                border-bottom: 1px solid #e5e7eb;
            }}
            .detail-label {{
                font-weight: bold;
                color: #6b7280;
                display: inline-block;
                width: 150px;
            }}
            .detail-value {{
                color: #111827;
            }}
            .role-badge {{
                display: inline-block;
                background-color: #4F46E5;
                color: white;
                padding: 5px 15px;
                border-radius: 20px;
                font-weight: bold;
                margin: 10px 0;
            }}
            .footer {{
                text-align: center;
                padding: 20px;
                color: #6b7280;
                font-size: 12px;
                border-top: 1px solid #e5e7eb;
                margin-top: 20px;
            }}
        </style>
    </head>
    <body>
        <div class="header">
            <h1>New Assignment Notification</h1>
        </div>
        <div class="content">
            <p>Dear {recipient_name},</p>
            
            <p>You have been assigned a new role in a project. Please find the complete details below:</p>
            
            <div class="info-box">
                <div class="role-badge">{role_display}</div>
                
                <div class="detail-row">
                    <span class="detail-label">Project Name:</span>
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
                    <span class="detail-value">{deadline}</span>
                </div>
        """
    
    html += f"""
                <div class="detail-row">
                    <span class="detail-label">Assigned By:</span>
                    <span class="detail-value">{assigned_by_name} ({assigned_by_email})</span>
                </div>
            </div>
    """
    
    if description:
        html += f"""
            <div class="info-box">
                <div class="detail-label" style="width: 100%; margin-bottom: 10px;">Description:</div>
                <div class="detail-value">{description}</div>
            </div>
        """
    
    html += f"""
            <p style="margin-top: 20px;">
                Please log in to your account to view more details and manage this assignment.
            </p>
        </div>
        
        <div class="footer">
            <p>This is an automated notification. Please do not reply to this email.</p>
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
    project_version: Optional[str] = None,
    node_status: Optional[str] = None,
    deadline: Optional[str] = None,
    description: Optional[str] = None
) -> str:
    """
    Create a plain text email template for role/responsibility assignment.
    """
    role_display = "Responsible" if role_type.lower() == "responsible" else "Support"
    
    text = f"""
New Assignment Notification

Dear {recipient_name},

You have been assigned a new role in a project. Please find the complete details below:

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
        text += f"\nDescription:\n{description}\n"
    
    text += """
Please log in to your account to view more details and manage this assignment.

This is an automated notification. Please do not reply to this email.
"""
    
    return text




