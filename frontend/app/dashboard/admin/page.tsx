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
import axios from "axios"
import { Loader2, Users, Plus, Trash2, CheckCircle2 } from "lucide-react"

interface User {
  id: number
  clerk_id: string
  email: string
  first_name: string
  last_name: string
  role: string
  created_at: string
  image_url?: string
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
      <DialogContent className="sm:max-w-106.25">
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
        
        <div className="grid gap-4 py-4">
          {!targetUser && (
            <div className="grid gap-2">
              <Label htmlFor="user">User</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a user..." />
                </SelectTrigger>
                <SelectContent>
                  {users.map(u => (
                    <SelectItem key={u.clerk_id} value={u.clerk_id}>
                      {u.first_name} {u.last_name} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="project">Projects</Label>
            <ScrollArea className="h-60 w-full border rounded-md p-2">
              <div className="space-y-1">
                {availableProjects.length > 0 ? (
                  availableProjects.map(p => {
                    const isSelected = selectedProjectIds.includes(p.id.toString());
                    return (
                      <div 
                        key={p.id} 
                        className={`group flex items-center justify-between p-2 rounded-md hover:bg-slate-50 transition-all ${
                          isSelected ? 'bg-blue-50/50 border-blue-100 border shadow-sm' : 'border border-transparent'
                        }`}
                      >
                        <div 
                          className="flex flex-col min-w-0 flex-1 cursor-pointer"
                          onClick={() => toggleProject(p.id.toString())}
                        >
                          <span className={`text-sm font-medium truncate ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>
                            {p.name}
                          </span>
                          <span className="text-[10px] text-slate-500">{p.version_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isSelected && (
                            <Select 
                              value={projectRoles[p.id.toString()] || "viewer"} 
                              onValueChange={(val) => handleRoleChangeForProject(p.id.toString(), val)}
                            >
                              <SelectTrigger className="h-7 w-22 text-[10px] bg-white border-blue-200">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="viewer">Viewer</SelectItem>
                                <SelectItem value="editor">Editor</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                          <div 
                            className={`h-5 w-5 rounded-md border flex items-center justify-center transition-colors cursor-pointer ${
                              isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'
                            }`}
                            onClick={() => toggleProject(p.id.toString())}
                          >
                            {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                          </div>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-sm text-slate-400 p-8 text-center mt-4">
                    {selectedUserId ? "No available projects for this user" : "Select a user first"}
                  </div>
                )}
              </div>
            </ScrollArea>
            {selectedProjectIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {selectedProjectIds.map(id => {
                  const p = projects.find(proj => proj.id.toString() === id)
                  const role = projectRoles[id] || "viewer"
                  return p ? (
                    <Badge key={id} variant="secondary" className="bg-blue-50 text-blue-600 border-blue-100 font-normal px-2 py-0 flex items-center gap-1">
                      {p.name}
                      <span className="text-[10px] opacity-70 font-bold uppercase">({role})</span>
                    </Badge>
                  ) : null
                })}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleAddProject} 
            disabled={selectedProjectIds.length === 0 || !selectedUserId || isAdding} 
            className="bg-blue-600 hover:bg-blue-700"
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
        <p className="text-muted-foreground">Manage users and their roles.</p>
      </div>

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
                  {users.map((u) => (
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
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
                          ${u.role === 'admin' ? 'bg-red-100 text-red-800' : 
                            u.role === 'editor' ? 'bg-blue-100 text-blue-800' : 
                            'bg-gray-100 text-gray-800'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="p-4 align-middle">
                        <div className="flex gap-2 items-center justify-end">
                          <select 
                            className="h-9 w-30 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            value={u.role}
                            onChange={(e) => handleRoleUpdate(u.clerk_id, e.target.value)}
                            disabled={updatingId === u.clerk_id || u.clerk_id === user?.id}
                          >
                            <option value="viewer">Viewer</option>
                            <option value="editor">Editor</option>
                            <option value="admin">Admin</option>
                          </select>
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
