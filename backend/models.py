from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class UserCreate(BaseModel):
    clerk_id: str
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    image_url: Optional[str] = None
    role: Optional[str] = None

class User(UserCreate):
    id: int

class RoleUpdate(BaseModel):
    role: str

class NotificationCreate(BaseModel):
    user_id: str  # clerk_id of the recipient
    type: str
    title: str
    message: str
    read: bool = False

class Notification(NotificationCreate):
    id: int
    created_at: str

class ProcessSheet(BaseModel):
    id: str
    name: str
    nodes: list
    edges: list
    lanes: list = []

class ProcessPackageCreate(BaseModel):
    user_id: str
    name: str
    sheets: list[ProcessSheet]
    versions: list = []

class ProcessRename(BaseModel):
    name: str

class ProcessVersionCreate(BaseModel):
    name: str
    sheets: list[ProcessSheet]

class ProjectCreate(BaseModel):
    user_id: str
    name: str
    process_id: int
    version_name: str

class ProjectUpdate(BaseModel):
    sheets: list[ProcessSheet]

class CollaboratorAdd(BaseModel):
    user_id: str
    role: str

class ProcessPackage(ProcessPackageCreate):
    id: int
    created_at: str
    updated_at: str

