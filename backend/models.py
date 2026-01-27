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
    organization: Optional[str] = None

class User(UserCreate):
    id: int

class RoleUpdate(BaseModel):
    role: str

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
    status: str = 'Final'

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
    sheets: Optional[list[ProcessSheet]] = None
    name: Optional[str] = None
    progress: Optional[int] = None
    version_name: Optional[str] = None
    status: Optional[str] = None

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
    license_id: str
    email_id: str

class ProcessPackage(ProcessPackageCreate):
    id: int
    created_at: str
    updated_at: str

