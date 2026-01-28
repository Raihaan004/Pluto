"use client"

import { useEffect, useState } from "react"
import { useUser } from "@clerk/nextjs"
import { useUserRole } from "@/context/UserRoleContext"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import axios from "axios"
import { Loader2, Users, Plus, Trash2, CheckCircle2, Clock, ShieldX } from "lucide-react"

interface User {
  id: number
  clerk_id: string
  email: string
  first_name: string
  last_name: string
  role: string
  created_at: string
  image_url?: string
  approval_status: 'pending' | 'approved' | 'rejected'
  is_verified?: boolean
  organization?: string
  org_id?: string
}

interface Project {
  id: number
  user_id: string
  name: string
  process_id: number
  version_name: string
  created_at: string
  collaborators?: { user_id: string; role: string }[]
}

function ProjectAccessDialog({ project, users, onUpdate }: { project: Project, users: User[], onUpdate: () => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState("")
  const [selectedRole, setSelectedRole] = useState("viewer")
  const [isAdding, setIsAdding] = useState(false)

  const handleAddCollaborator = async () => {
    if (!selectedUserId) return
    setIsAdding(true)
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/projects/${project.id}/collaborators`, {
        user_id: selectedUserId,
        role: selectedRole
      })
      onUpdate()
      setSelectedUserId("")
      setSelectedRole("viewer")
    } catch (error) {
      console.error("Failed to add collaborator:", error)
      alert("Failed to add collaborator")
    } finally {
      setIsAdding(false)
    }
  }

  const handleRemoveCollaborator = async (userId: string) => {
    try {
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/projects/${project.id}/collaborators/${userId}`)
      onUpdate()
    } catch (error) {
      console.error("Failed to remove collaborator:", error)
      alert("Failed to remove collaborator")
    }
  }

  const collaborators = project.collaborators || []

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
          <Users className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-125">
        <DialogHeader>
          <DialogTitle>Manage Access - {project.name}</DialogTitle>
          <DialogDescription>
            Add users to this project and set their permissions.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="flex items-end gap-2">
            <div className="grid gap-2 flex-1">
              <Label>Add User</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a user..." />
                </SelectTrigger>
                <SelectContent>
                  {users.filter(u => u.clerk_id !== project.user_id && !collaborators.some(c => c.user_id === u.clerk_id)).map(u => (
                    <SelectItem key={u.clerk_id} value={u.clerk_id}>
                      {u.first_name} {u.last_name} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 w-25">
              <Label>Role</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAddCollaborator} disabled={!selectedUserId || isAdding}>
              {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Current Access</Label>
            <div className="border rounded-md p-2 space-y-2 max-h-50 overflow-y-auto">
              <div className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                <span className="font-medium">Owner</span>
                <span className="text-muted-foreground">
                  {users.find(u => u.clerk_id === project.user_id)?.email || project.user_id}
                </span>
              </div>
              {collaborators.filter(c => c.user_id !== project.user_id).map((c, i) => {
                const user = users.find(u => u.clerk_id === c.user_id)
                return (
                  <div key={i} className="flex items-center justify-between text-sm p-2 border rounded">
                    <div className="flex flex-col">
                      <span className="font-medium">{user ? `${user.first_name} ${user.last_name}` : c.user_id}</span>
                      <span className="text-xs text-muted-foreground">{user?.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        c.role === 'admin' ? 'bg-red-100 text-red-800' :
                        c.role === 'editor' ? 'bg-blue-100 text-blue-800' : 
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {c.role}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                        onClick={() => handleRemoveCollaborator(c.user_id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
              {collaborators.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-2">No collaborators</div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ProjectAssignmentDialog({ targetUser, users, projects, onUpdate }: { targetUser?: User, users: User[], projects: Project[], onUpdate: () => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState(targetUser?.clerk_id || "")
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([])
  const [projectRoles, setProjectRoles] = useState<Record<string, string>>({})
  const [isAdding, setIsAdding] = useState(false)

  // Reset state when targetUser changes or dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedUserId(targetUser?.clerk_id || "")
      setSelectedProjectIds([])
      setProjectRoles({})
    }
  }, [isOpen, targetUser])

  const handleAddProject = async () => {
    if (selectedProjectIds.length === 0 || !selectedUserId) return
    setIsAdding(true)
    try {
      await Promise.all(selectedProjectIds.map(projectId => 
        axios.post(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/collaborators`, {
          user_id: selectedUserId,
          role: projectRoles[projectId] || "viewer"
        })
      ))
      onUpdate()
      setIsOpen(false)
    } catch (error) {
      console.error("Failed to add user to projects:", error)
      alert("Failed to add user to one or more projects")
    } finally {
      setIsAdding(false)
    }
  }

  const toggleProject = (projectId: string) => {
    setSelectedProjectIds(prev => {
      if (prev.includes(projectId)) {
        const next = prev.filter(id => id !== projectId)
        const nextRoles = { ...projectRoles }
        delete nextRoles[projectId]
        setProjectRoles(nextRoles)
        return next
      } else {
        setProjectRoles(prev => ({ ...prev, [projectId]: "viewer" }))
        return [...prev, projectId]
      }
    })
  }

  const handleRoleChangeForProject = (projectId: string, role: string) => {
    setProjectRoles(prev => ({ ...prev, [projectId]: role }))
  }

  // Filter projects where selected user is not already a member
  const availableProjects = projects.filter(p => {
    if (!selectedUserId) return true;
    return p.user_id !== selectedUserId && 
           !p.collaborators?.some(c => c.user_id === selectedUserId);
  })

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {targetUser ? (
          <Button variant="outline" size="sm" className="h-8 gap-1 border-blue-200 hover:border-blue-300 hover:bg-blue-50 text-blue-600 transition-all">
            <Plus className="h-3.5 w-3.5" />
            Add to Project
          </Button>
        ) : (
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Project to User
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>{targetUser ? "Assign to Project" : "Assign User to Project"}</DialogTitle>
          <DialogDescription>
            {targetUser ? (
              <>Assign <strong>{targetUser.first_name} {targetUser.last_name}</strong> to multiple existing projects.</>
            ) : (
              "Select a user and multiple projects to create new assignments."
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-5 py-4">
          {!targetUser && (
            <div className="grid gap-2">
              <Label className="text-xs font-semibold text-slate-500 uppercase ml-1">Select User</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Select a user..." />
                </SelectTrigger>
                <SelectContent>
                  {users.map(u => (
                    <SelectItem key={u.clerk_id} value={u.clerk_id}>
                      <div className="flex flex-col py-0.5">
                        <span className="font-medium text-sm">{u.first_name} {u.last_name}</span>
                        <span className="text-[10px] text-slate-400">{u.email}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-2">
            <Label className="text-xs font-semibold text-slate-500 uppercase ml-1">Available Projects</Label>
            <ScrollArea className="h-64 w-full border border-slate-200 rounded-xl bg-slate-50/30">
              <div className="p-3 space-y-2">
                {availableProjects.length > 0 ? (
                  availableProjects.map(p => {
                    const isSelected = selectedProjectIds.includes(p.id.toString());
                    return (
                      <div 
                        key={p.id} 
                        className={`group flex items-center justify-between p-3 rounded-xl transition-all border ${
                          isSelected 
                            ? 'bg-white border-blue-200 shadow-sm ring-1 ring-blue-100' 
                            : 'bg-white border-slate-100 hover:border-slate-200'
                        }`}
                      >
                        <div 
                          className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                          onClick={() => toggleProject(p.id.toString())}
                        >
                          <div 
                            className={`flex-shrink-0 h-5 w-5 rounded-md border flex items-center justify-center transition-all ${
                              isSelected ? 'bg-blue-600 border-blue-600 shadow-sm' : 'bg-white border-slate-300'
                            }`}
                          >
                            {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className={`text-sm font-semibold truncate ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>
                              {p.name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">{p.version_name}</span>
                          </div>
                        </div>
                        
                        {isSelected && (
                          <div className="flex items-center gap-2 pl-3 ml-auto border-l border-slate-100">
                            <Select 
                              value={projectRoles[p.id.toString()] || "viewer"} 
                              onValueChange={(val) => handleRoleChangeForProject(p.id.toString(), val)}
                            >
                              <SelectTrigger className="h-8 w-24 text-[11px] bg-slate-50 border-slate-200 hover:bg-slate-100 font-medium">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="viewer">Viewer</SelectItem>
                                <SelectItem value="editor">Editor</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    )
                  })
                ) : (
                  <div className="text-center py-12">
                    <div className="p-3 bg-slate-100 rounded-full w-fit mx-auto mb-3">
                      <Plus className="h-5 w-5 text-slate-400" />
                    </div>
                    <p className="text-xs text-slate-400 font-medium">
                      {selectedUserId ? "No projects available to assign" : "Select a user to see projects"}
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
            
            {selectedProjectIds.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3 p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
                {selectedProjectIds.map(id => {
                  const p = projects.find(proj => proj.id.toString() === id)
                  const role = projectRoles[id] || "viewer"
                  return p ? (
                    <Badge key={id} variant="secondary" className="bg-white text-blue-600 border-blue-200 py-1 pl-2 pr-1.5 flex items-center gap-1.5 shadow-sm">
                      <span className="text-xs font-semibold">{p.name}</span>
                      <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-[9px] font-bold px-1 py-0 border-none shadow-none uppercase">
                        {role}
                      </Badge>
                    </Badge>
                  ) : null
                })}
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0 mt-2">
          <Button variant="outline" onClick={() => setIsOpen(false)} className="rounded-xl border-slate-200">
            Cancel
          </Button>
          <Button 
            onClick={handleAddProject} 
            disabled={selectedProjectIds.length === 0 || !selectedUserId || isAdding} 
            className="rounded-xl bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200"
          >
            {isAdding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Assign User
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function AdminPage() {
  const { user } = useUser()
  const { role, loading: isRoleLoading } = useUserRole()
  const [users, setUsers] = useState<User[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const fetchData = async () => {
    if (role !== 'admin' || !user) return

    try {
      const [usersRes, projectsRes] = await Promise.all([
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/users`, {
          headers: { 'X-Clerk-User-Id': user.id }
        }),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/admin/projects`, {
          headers: { 'X-Clerk-User-Id': user.id }
        })
      ])
      setUsers(usersRes.data)
      setProjects(projectsRes.data)
    } catch (error) {
      console.error("Failed to fetch data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!user) return
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) return
    
    setUpdatingId(userId)
    try {
      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/users/${userId}`,
        {
          headers: {
            'X-Clerk-User-Id': user.id
          }
        }
      )
      setUsers(users.filter(u => u.clerk_id !== userId))
    } catch (error) {
      console.error("Failed to delete user:", error)
      alert("Failed to delete user")
    } finally {
      setUpdatingId(null)
    }
  }

  useEffect(() => {
    if (!isRoleLoading) {
      fetchData()
    }
  }, [role, isRoleLoading, user])

  const handleRoleUpdate = async (userId: string, newRole: string) => {
    if (!user) return
    setUpdatingId(userId)
    try {
      await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}/users/${userId}/role`,
        { role: newRole },
        {
          headers: {
            'X-Clerk-User-Id': user.id
          }
        }
      )
      // Update local state
      setUsers(users.map(u => u.clerk_id === userId ? { ...u, role: newRole } : u))
    } catch (error) {
      console.error("Failed to update role:", error)
      alert("Failed to update role")
    } finally {
      setUpdatingId(null)
    }
  }

  const handleStatusUpdate = async (userId: string, newStatus: string) => {
    if (!user) return
    setUpdatingId(userId)
    try {
      await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}/users/${userId}/status`,
        { status: newStatus },
        {
          headers: {
            'X-Clerk-User-Id': user.id
          }
        }
      )
      // Update local state - if approved, also set role to editor and mark as verified
      setUsers(users.map(u => 
        u.clerk_id === userId 
          ? { 
              ...u, 
              approval_status: newStatus as any,
              role: newStatus === 'approved' ? 'editor' : u.role,
              is_verified: newStatus === 'approved' ? true : u.is_verified
            } 
          : u
      ))
    } catch (error) {
      console.error("Failed to update status:", error)
      alert("Failed to update status")
    } finally {
      setUpdatingId(null)
    }
  }

  if (isRoleLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  if (role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
        <p className="text-muted-foreground">You do not have permission to view this page.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Manage users, approvals, and their roles.</p>
      </div>

      {users.filter(u => u.approval_status === 'pending').length > 0 && (
        <Card className="border-amber-200 bg-amber-50/10 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
          <CardHeader>
            <CardTitle className="text-amber-800 flex items-center gap-2">
              <Clock className="h-5 w-5" /> Pending Approval Requests
            </CardTitle>
            <CardDescription>New users waiting for access to the platform.</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="space-y-3">
               {users.filter(u => u.approval_status === 'pending').map(u => (
                 <div key={u.clerk_id} className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-amber-100 dark:border-amber-900/20 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-4">
                       <Avatar className="h-12 w-12 border-2 border-white dark:border-zinc-800 shadow-sm">
                         <AvatarImage src={u.image_url} />
                         <AvatarFallback className="bg-amber-100 text-amber-700 font-bold">{u.first_name?.[0]}{u.last_name?.[0]}</AvatarFallback>
                       </Avatar>
                       <div>
                         <p className="font-bold text-zinc-900 dark:text-white">{u.first_name} {u.last_name}</p>
                         <p className="text-sm text-zinc-500">{u.email}</p>
                         <p className="text-[10px] text-zinc-400 mt-0.5 uppercase tracking-wider font-bold">Requested on {new Date(u.created_at).toLocaleDateString()}</p>
                       </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline"
                        size="sm"
                        className="rounded-xl border-zinc-200 dark:border-zinc-800 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all px-4"
                        onClick={() => handleStatusUpdate(u.clerk_id, 'rejected')}
                      >
                         Dismiss
                      </Button>
                      <Button 
                        size="sm" 
                        className="rounded-xl bg-green-600 hover:bg-green-700 shadow-md shadow-green-100 dark:shadow-none px-6"
                        onClick={() => handleStatusUpdate(u.clerk_id, 'approved')}
                      >
                         Approve Access
                      </Button>
                    </div>
                 </div>
               ))}
             </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
          <div className="flex flex-col gap-1">
            <CardTitle>User Management</CardTitle>
            <CardDescription>View and update user roles.</CardDescription>
          </div>
          <ProjectAssignmentDialog users={users} projects={projects} onUpdate={fetchData} />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <div className="relative w-full overflow-auto">
              <table className="w-full caption-bottom text-sm">
                <thead className="[&_tr]:border-b">
                  <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">User</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Email</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Projects</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Current Role</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {users.filter(u => u.approval_status === 'approved' || u.approval_status === 'suspended' || !u.approval_status).map((u) => (
                    <tr key={u.clerk_id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                      <td className="p-4 align-middle font-medium">
                        <div className="flex items-center gap-2">
                          {u.image_url && <img src={u.image_url} alt="" className="h-8 w-8 rounded-full" />}
                          <span>{u.first_name} {u.last_name}</span>
                        </div>
                      </td>
                      <td className="p-4 align-middle">{u.email}</td>
                      <td className="p-4 align-middle">
                        <div className="flex flex-col gap-1 max-h-25 overflow-y-auto">
                          {projects.filter(p => 
                            p.user_id === u.clerk_id || 
                            p.collaborators?.some(c => c.user_id === u.clerk_id)
                          ).map(p => {
                            const isOwner = p.user_id === u.clerk_id;
                            const collaborator = p.collaborators?.find(c => c.user_id === u.clerk_id);
                            const role = isOwner ? 'owner' : (collaborator?.role || 'viewer');
                            
                            return (
                              <div key={p.id} className="flex items-center justify-between gap-2 text-xs bg-secondary px-2 py-1 rounded-md whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <span>{p.name} <span className="text-muted-foreground">({p.version_name})</span></span>
                                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${
                                    isOwner ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                                    role === 'admin' ? 'bg-red-50 text-red-700 border-red-200' :
                                    role === 'editor' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                                    'bg-slate-50 text-slate-700 border-slate-200'
                                  }`}>
                                    {role.charAt(0).toUpperCase() + role.slice(1)}
                                  </span>
                                </div>
                                <ProjectAccessDialog project={p} users={users} onUpdate={fetchData} />
                              </div>
                            );
                          })}
                          {projects.filter(p => 
                            p.user_id === u.clerk_id || 
                            p.collaborators?.some(c => c.user_id === u.clerk_id)
                          ).length === 0 && (
                            <span className="text-muted-foreground text-xs italic">No projects</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 align-middle">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium w-fit
                            ${u.role === 'admin' ? 'bg-red-100 text-red-800' : 
                              u.role === 'editor' ? 'bg-blue-100 text-blue-800' : 
                              'bg-gray-100 text-gray-800'}`}>
                            {u.role}
                          </span>
                          {u.approval_status === 'suspended' && (
                            <Badge variant="destructive" className="text-[10px] h-4 py-0 w-fit">Suspended</Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-4 align-middle">
                        <div className="flex gap-2 items-center justify-end">
                          <select 
                            className="h-9 w-24 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            value={u.role}
                            onChange={(e) => handleRoleUpdate(u.clerk_id, e.target.value)}
                            disabled={updatingId === u.clerk_id || u.clerk_id === user?.id || u.approval_status === 'suspended'}
                          >
                            <option value="viewer">Viewer</option>
                            <option value="editor">Editor</option>
                            <option value="admin">Admin</option>
                          </select>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            className={`h-9 px-2 ${u.approval_status === 'suspended' ? 'text-green-600 border-green-200 hover:bg-green-50' : 'text-amber-600 border-amber-200 hover:bg-amber-50'}`}
                            onClick={() => handleStatusUpdate(u.clerk_id, u.approval_status === 'suspended' ? 'approved' : 'suspended')}
                            disabled={updatingId === u.clerk_id || u.clerk_id === user?.id}
                            title={u.approval_status === 'suspended' ? 'Activate User' : 'Suspend User'}
                          >
                            {u.approval_status === 'suspended' ? <CheckCircle2 className="h-4 w-4" /> : <ShieldX className="h-4 w-4" />}
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 px-2 text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => handleDeleteUser(u.clerk_id)}
                            disabled={updatingId === u.clerk_id || u.clerk_id === user?.id}
                            title="Delete User"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
