from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON, BigInteger, ForeignKey, Text
from database import Base

# --- SQLAlchemy Models ---

class UserDB(Base):
    __tablename__ = "users"
    id = Column(BigInteger, primary_key=True, index=True)
    clerk_id = Column(String, unique=True, nullable=False)
    email = Column(String, nullable=False)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    role = Column(String, default='viewer')
    organization = Column(String, nullable=True)
    org_id = Column(String, nullable=True)
    is_verified = Column(Boolean, default=False)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    approval_status = Column(String, default='pending')
    is_suspended = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

class PendingUserDB(Base):
    __tablename__ = "pending_users"
    id = Column(BigInteger, primary_key=True, index=True)
    clerk_id = Column(String, unique=True, nullable=False)
    email = Column(String, nullable=False)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    role = Column(String, default='viewer')
    organization = Column(String, nullable=True)
    org_id = Column(String, nullable=True)
    is_verified = Column(Boolean, default=False)
    approval_status = Column(String, default='pending')
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

class InstanceSettingsDB(Base):
    __tablename__ = "instance_settings"
    id = Column(BigInteger, primary_key=True, index=True)
    org_id = Column(String, nullable=False)
    org_name = Column(String, nullable=False)
    org_code = Column(String, nullable=True)
    license_key = Column(String, nullable=False)
    admin_email = Column(String, nullable=False)
    plan = Column(String, nullable=True)
    status = Column(String, default='active')
    activated_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    last_synced_at = Column(DateTime(timezone=True), nullable=True)

class ProcessDB(Base):
    __tablename__ = "processes"
    id = Column(BigInteger, primary_key=True, index=True)
    user_id = Column(String, nullable=False)
    org_id = Column(String, nullable=True)
    name = Column(String, nullable=False)
    sheets = Column(JSON, nullable=False, default=[])
    versions = Column(JSON, nullable=False, default=[])
    status = Column(String, nullable=False, default='draft')
    type = Column(String, default='freestyle')
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

class ProjectDB(Base):
    __tablename__ = "projects"
    id = Column(BigInteger, primary_key=True, index=True)
    user_id = Column(String, nullable=False)
    name = Column(String, nullable=False)
    process_id = Column(BigInteger, nullable=True)
    version_name = Column(String, nullable=True)
    sheets = Column(JSON, nullable=False, default=[])
    collaborators = Column(JSON, nullable=False, default=[])
    progress = Column(Integer, default=0)
    status = Column(String, default='draft')
    jira_project_key = Column(String, nullable=True)
    org_id = Column(BigInteger, nullable=True)
    type = Column(String, default='freestyle')
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

class NotificationDB(Base):
    __tablename__ = "notifications"
    id = Column(BigInteger, primary_key=True, index=True)
    user_id = Column(String, nullable=False)
    type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

# --- Pydantic Models ---
class UserCreate(BaseModel):
    clerk_id: str
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    image_url: Optional[str] = None
    role: Optional[str] = None
    organization: Optional[str] = None
    org_id: Optional[Any] = None

class User(UserCreate):
    id: int

class RoleUpdate(BaseModel):
    role: str

class StatusUpdate(BaseModel):
    status: str

class ProcessSheet(BaseModel):
    id: str
    name: str
    nodes: List[Any]
    edges: List[Any]
    type: Optional[str] = 'flow'
    lanes: List[Any] = []
    cellData: Optional[Dict[str, Any]] = {}
    columnWidths: Optional[List[float]] = []
    rowHeight: Optional[float] = 80

class ProcessPackageCreate(BaseModel):
    user_id: str
    org_id: Optional[Any] = None
    name: str
    sheets: List[ProcessSheet]
    versions: List[Any] = []
    status: str = 'draft'
    type: str = 'freestyle'
    version_name: Optional[str] = None
    version_comments: Optional[str] = None

class ProcessRename(BaseModel):
    name: str

class ProcessVersionCreate(BaseModel):
    name: str
    sheets: List[ProcessSheet]
    comments: Optional[str] = None

class ProjectCreate(BaseModel):
    user_id: str
    name: str
    process_id: int
    version_name: str
    type: str = 'freestyle'
    org_id: Optional[int] = None

class ProjectUpdate(BaseModel):
    sheets: Optional[List[ProcessSheet]] = None
    name: Optional[str] = None
    progress: Optional[float] = None
    version_name: Optional[str] = None
    status: Optional[str] = None
    type: Optional[str] = None

class CollaboratorAdd(BaseModel):
    user_id: str
    role: str

class ConnectionJiraTrigger(BaseModel):
    activity_data: dict
    work_product_data: dict
    metadata: dict

class LicenseVerify(BaseModel):
    clerk_id: str
    org_name: str
    org_code: str
    license_id: str
    email_id: str
    app_version: Optional[str] = "1.0.0"
    server_id: Optional[str] = None

class ProcessPackage(ProcessPackageCreate):
    id: int
    created_at: str
    updated_at: str

