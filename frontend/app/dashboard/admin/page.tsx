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
import { Loader2, Users, Plus, Trash2, CheckCircle2, Clock, ShieldX, Folder, ChevronDown } from "lucide-react"
import { Particles } from "@/components/magicui/particles"
import { cn } from "@/lib/utils"

interface User {
  id: number
  clerk_id: string
  email: string
  first_name: string
  last_name: string
  role: string
  created_at: string
  image_url?: string
  approval_status: 'pending' | 'approved' | 'rejected' | 'suspended'
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
      <DialogContent className="sm:max-w-4xl p-0 gap-0 overflow-hidden border-none shadow-2xl rounded-3xl bg-white max-h-[90vh] flex flex-col">
        <DialogHeader className="p-8 bg-white border-b relative overflow-hidden flex-shrink-0">
          <div className="absolute top-0 right-0 p-8 opacity-5">
             <Users className="h-24 w-24 text-blue-600" />
          </div>
          <DialogTitle className="text-2xl font-bold text-gray-900 flex items-center gap-3">
             <div className="p-2 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-100">
                <Plus className="h-5 w-5" />
             </div>
             {targetUser ? "Assign to Project" : "Assign User to Project"}
          </DialogTitle>
          <DialogDescription className="text-gray-500 text-base mt-2 font-medium">
            {targetUser ? (
              <>Assign <strong>{targetUser.first_name} {targetUser.last_name}</strong> to multiple existing projects.</>
            ) : (
              "Select a user and multiple projects to create new assignments simultaneously."
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
           {/* Left Sidebar - User Selection */}
           {!targetUser && (
              <div className="w-full md:w-80 bg-gray-50/50 border-r p-6 flex flex-col gap-4 min-h-0">
                 <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-1">1. Select Destination User</h4>
                 <ScrollArea className="flex-1 pr-3 overflow-y-auto">
                    <div className="space-y-2">
                       {users.map(u => (
                          <button
                             key={u.clerk_id}
                             className={cn(
                                "w-full flex items-center gap-3 p-3 rounded-2xl transition-all text-left border-2",
                                selectedUserId === u.clerk_id 
                                   ? "bg-white border-blue-600 shadow-lg shadow-blue-50 ring-4 ring-blue-50/50" 
                                   : "bg-transparent border-transparent hover:bg-white hover:border-gray-200 text-gray-400"
                             )}
                             onClick={() => setSelectedUserId(u.clerk_id)}
                          >
                             <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                                <AvatarImage src={u.image_url} />
                                <AvatarFallback className={cn(
                                   "font-bold text-xs",
                                   selectedUserId === u.clerk_id ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"
                                )}>{u.first_name?.[0]}{u.last_name?.[0]}</AvatarFallback>
                             </Avatar>
                             <div className="flex-1 min-w-0">
                                <p className={cn(
                                   "text-sm font-bold truncate",
                                   selectedUserId === u.clerk_id ? "text-gray-900" : "text-gray-600"
                                )}>{u.first_name} {u.last_name}</p>
                                <p className="text-[10px] truncate font-medium text-gray-400">{u.email}</p>
                             </div>
                             {selectedUserId === u.clerk_id && (
                                <div className="h-5 w-5 bg-blue-600 rounded-full flex items-center justify-center shadow-sm">
                                   <CheckCircle2 className="h-3 w-3 text-white" />
                                </div>
                             )}
                          </button>
                       ))}
                    </div>
                 </ScrollArea>
              </div>
           )}

           {/* Right Content - Project Selection */}
           <div className="flex-1 flex flex-col p-6 bg-white min-w-0 min-h-0 overflow-hidden">
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                 <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1">2. Choose Projects & Permissions</h4>
                 {selectedProjectIds.length > 0 && (
                    <Badge className="bg-blue-50 text-blue-600 hover:bg-blue-50 border-blue-100 px-3 py-1 font-bold text-[10px]">
                       {selectedProjectIds.length} Selected
                    </Badge>
                 )}
              </div>
              
              <ScrollArea className="flex-1 pr-4 -mr-4 overflow-y-auto">
                 <div className="grid grid-cols-1 gap-3 pb-4">
                   {availableProjects.length > 0 ? (
                     availableProjects.map(p => {
                       const isSelected = selectedProjectIds.includes(p.id.toString());
                       return (
                         <div 
                           key={p.id} 
                           className={cn(
                             "group flex flex-col gap-3 p-4 rounded-3xl transition-all border-2 relative",
                             isSelected 
                               ? 'bg-blue-50/30 border-blue-600/20 ring-4 ring-blue-50 shadow-sm' 
                               : 'bg-white border-gray-100 hover:border-gray-200'
                           )}
                         >
                           <div className="flex items-start justify-between gap-4">
                              <div 
                                className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer"
                                onClick={() => toggleProject(p.id.toString())}
                              >
                                <div 
                                  className={cn(
                                    "flex-shrink-0 h-6 w-6 rounded-lg border-2 flex items-center justify-center transition-all",
                                    isSelected ? 'bg-blue-600 border-blue-600 shadow-md' : 'bg-white border-gray-200 group-hover:border-gray-300'
                                  )}
                                >
                                  {isSelected && <CheckCircle2 className="h-4 w-4 text-white" />}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <div className="flex items-center gap-2">
                                     <Folder className={cn("h-4 w-4", isSelected ? "text-blue-600" : "text-gray-400")} />
                                     <span className={cn("text-base font-bold truncate tracking-tight", isSelected ? 'text-gray-900' : 'text-gray-700')}>
                                       {p.name}
                                     </span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                     <span className="text-[10px] text-gray-400 font-semibold bg-gray-100 px-2 py-0.5 rounded-md uppercase tracking-tighter shadow-inner">V{p.version_name}</span>
                                     <span className="text-[10px] text-gray-400 font-medium">Owner: {users.find(u => u.clerk_id === p.user_id)?.first_name}</span>
                                  </div>
                                </div>
                              </div>
                              
                              {isSelected && (
                                <div className="flex-shrink-0 flex items-center gap-2 bg-white p-1 rounded-2xl shadow-sm border border-blue-100 animate-in zoom-in-95 duration-200">
                                   {['viewer', 'editor', 'admin'].map((role) => (
                                      <button
                                         key={role}
                                         onClick={() => handleRoleChangeForProject(p.id.toString(), role)}
                                         className={cn(
                                            "px-3 py-1.5 rounded-xl text-[10px] font-semibold uppercase tracking-widest transition-all",
                                            projectRoles[p.id.toString()] === role || (!projectRoles[p.id.toString()] && role === 'viewer')
                                               ? role === 'admin' ? "bg-red-600 text-white shadow-md shadow-red-100" :
                                                 role === 'editor' ? "bg-amber-500 text-white shadow-md shadow-amber-100" :
                                                 "bg-blue-600 text-white shadow-md shadow-blue-100"
                                               : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                                         )}
                                      >
                                         {role}
                                      </button>
                                   ))}
                                </div>
                              )}
                           </div>
                         </div>
                       )
                     })
                   ) : (
                     <div className="flex flex-col items-center justify-center py-24 text-center">
                       <div className="p-5 bg-gray-50 rounded-full mb-4 shadow-inner ring-8 ring-gray-50/50">
                         <Folder className="h-8 w-8 text-gray-200" />
                       </div>
                       <h5 className="text-sm font-bold text-gray-400">No compatible projects found</h5>
                       <p className="text-[11px] text-gray-300 max-w-[200px] mt-2 leading-relaxed">
                         {selectedUserId ? "This user is already a member of all available projects" : "Please select a user first to see eligible projects"}
                       </p>
                     </div>
                   )}
                 </div>
              </ScrollArea>
           </div>
        </div>

        <DialogFooter className="p-8 bg-white border-t gap-3 rounded-b-3xl flex-shrink-0">
          <Button 
             variant="ghost" 
             onClick={() => setIsOpen(false)} 
             className="px-8 rounded-2xl font-bold text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all uppercase tracking-widest text-xs"
          >
            Discard
          </Button>
          <Button 
            onClick={handleAddProject} 
            disabled={selectedProjectIds.length === 0 || !selectedUserId || isAdding} 
            className={cn(
               "px-10 h-14 rounded-2xl font-bold text-white shadow-2xl transition-all active:scale-95 uppercase tracking-widest text-xs flex items-center gap-3",
               selectedProjectIds.length > 0 && selectedUserId && !isAdding
                  ? "bg-blue-600 hover:bg-blue-700 shadow-blue-200" 
                  : "bg-gray-200 text-gray-400"
            )}
          >
            {isAdding ? <Loader2 className="h-5 w-5 animate-spin" /> : (
               <>
                  <Plus className="h-5 w-5" />
                  Apply Assignments
               </>
            )}
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
    <div className="flex flex-col gap-6 p-8 relative min-h-screen">
      <Particles
        className="absolute inset-0 z-0"
        quantity={150}
        staticity={50}
        color="#3b82f6"
      />
      
      <div className="relative z-10 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500 text-lg">Manage users, approvals, and their roles.</p>
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

        <Card className="relative z-10 bg-white/80 backdrop-blur-sm border-gray-100 shadow-xl shadow-gray-200/50 rounded-3xl overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7 border-b bg-gray-50/50">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-xl font-bold text-gray-900 uppercase tracking-tight">User Management</CardTitle>
              <CardDescription className="font-medium text-gray-500 text-sm">View and update user roles, access, and account status.</CardDescription>
            </div>
            <ProjectAssignmentDialog users={users} projects={projects} onUpdate={fetchData} />
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center p-24 items-center gap-3 text-blue-600">
                 <Loader2 className="h-6 w-6 animate-spin" />
                 <span className="font-bold text-sm tracking-widest uppercase">Fetching Records...</span>
              </div>
            ) : (
              <div className="relative w-full overflow-auto p-4">
                <table className="w-full border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-gray-400">
                      <th className="px-6 py-4 text-left font-bold text-[10px] uppercase tracking-widest border-b-0">Member Profile</th>
                      <th className="px-6 py-4 text-left font-bold text-[10px] uppercase tracking-widest border-b-0">Identity</th>
                      <th className="px-6 py-4 text-left font-bold text-[10px] uppercase tracking-widest border-b-0">Assigned Canvas</th>
                      <th className="px-6 py-4 text-left font-bold text-[10px] uppercase tracking-widest border-b-0">Level</th>
                      <th className="px-6 py-4 text-right font-bold text-[10px] uppercase tracking-widest border-b-0 pr-12">Operations</th>
                    </tr>
                  </thead>
                  <tbody className="space-y-2">
                    {users.filter(u => u.approval_status === 'approved' || u.approval_status === 'suspended' || !u.approval_status).map((u) => (
                      <tr key={u.clerk_id} className="group hover:bg-white shadow-sm transition-all duration-300">
                        <td className="p-4 pl-6 align-middle border-y border-l rounded-l-3xl bg-gray-50/30 group-hover:bg-white group-hover:shadow-lg group-hover:shadow-gray-100 transition-all border-gray-100">
                          <div className="flex items-center gap-4">
                            <Avatar className="h-12 w-12 border-2 border-white shadow-sm ring-4 ring-gray-100/50">
                               <AvatarImage src={u.image_url} />
                               <AvatarFallback className="bg-blue-600 text-white font-bold text-sm">{u.first_name?.[0]}{u.last_name?.[0]}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                               <span className="font-bold text-gray-900 text-base">{u.first_name} {u.last_name}</span>
                               <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Registered User</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 align-middle border-y bg-gray-50/30 group-hover:bg-white group-hover:shadow-lg group-hover:shadow-gray-100 transition-all border-gray-100">
                           <div className="flex items-center gap-2 text-gray-500 font-medium">
                              <span className="text-sm">{u.email}</span>
                           </div>
                        </td>
                        <td className="p-4 align-middle border-y bg-gray-50/10 group-hover:bg-white group-hover:shadow-lg group-hover:shadow-gray-100/50 transition-all border-gray-100/50">
                          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-4 custom-scrollbar scroll-smooth">
                            {projects.filter(p => 
                              p.user_id === u.clerk_id || 
                              p.collaborators?.some(c => c.user_id === u.clerk_id)
                            ).map(p => {
                              const isOwner = p.user_id === u.clerk_id;
                              const collaborator = p.collaborators?.find(c => c.user_id === u.clerk_id);
                              const role = isOwner ? 'owner' : (collaborator?.role || 'viewer');
                              
                              return (
                                <div key={p.id} className="flex items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm hover:border-blue-200 transition-colors">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className={cn(
                                       "p-1.5 rounded-lg",
                                       isOwner ? "bg-blue-50 text-blue-600" : "bg-gray-50 text-gray-400"
                                    )}>
                                       <Folder className="h-3 w-3" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                       <span className="text-[11px] font-bold text-gray-700 truncate">{p.name}</span>
                                       <span className="text-[9px] text-gray-400 font-medium">V{p.version_name}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge className={cn(
                                       "text-[9px] font-bold uppercase tracking-wider px-2 py-0 border-none",
                                       isOwner ? 'bg-blue-600 text-white' : 
                                       role === 'admin' ? 'bg-red-600 text-white' :
                                       role === 'editor' ? 'bg-amber-500 text-white' : 
                                       'bg-gray-100 text-gray-500'
                                    )}>
                                      {role}
                                    </Badge>
                                    <ProjectAccessDialog project={p} users={users} onUpdate={fetchData} />
                                  </div>
                                </div>
                              );
                            })}
                            {projects.filter(p => 
                              p.user_id === u.clerk_id || 
                              p.collaborators?.some(c => c.user_id === u.clerk_id)
                            ).length === 0 && (
                              <div className="flex items-center gap-2 text-gray-400 italic text-[11px] font-medium p-2">
                                 <ShieldX className="h-3 w-3 opacity-30" />
                                 No assignments
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-4 align-middle border-y bg-gray-50/30 group-hover:bg-white group-hover:shadow-lg group-hover:shadow-gray-100 transition-all border-gray-100">
                          <div className="flex flex-col gap-1.5">
                            <Badge className={cn(
                               "text-[10px] font-bold uppercase tracking-widest px-3 py-1 border-none rounded-lg w-fit",
                               u.role === 'admin' ? 'bg-red-600 text-white shadow-md shadow-red-100' : 
                               u.role === 'editor' ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 
                               'bg-gray-200 text-gray-500'
                            )}>
                              {u.role}
                            </Badge>
                            {u.approval_status === 'suspended' && (
                              <Badge className="bg-orange-600 text-white font-bold text-[9px] uppercase tracking-tighter rounded-md h-4 px-1.5 w-fit animate-pulse border-none">Stopped</Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-4 pr-6 align-middle border-y border-r rounded-r-3xl bg-gray-50/30 group-hover:bg-white group-hover:shadow-lg group-hover:shadow-gray-100 transition-all border-gray-100">
                          <div className="flex gap-1.5 items-center justify-end">
                            <div className="relative group/sel shadow-sm rounded-xl">
                              <select 
                                className="h-10 w-32 rounded-xl border border-gray-200 bg-white/50 backdrop-blur-sm px-3 py-1 text-[11px] font-bold uppercase tracking-widest transition-all group-hover/sel:border-blue-400 group-hover/sel:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-400 disabled:opacity-30 appearance-none cursor-pointer pr-8"
                                value={u.role}
                                onChange={(e) => handleRoleUpdate(u.clerk_id, e.target.value)}
                                disabled={updatingId === u.clerk_id || u.clerk_id === user?.id || u.approval_status === 'suspended'}
                              >
                                <option value="viewer">Viewer</option>
                                <option value="editor">Editor</option>
                                <option value="admin">Admin</option>
                              </select>
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 rotate-0 group-hover/sel:rotate-180 transition-transform">
                                 <ChevronDown className="h-3 w-3" />
                              </div>
                            </div>
                            
                            <Button
                              variant="outline"
                              size="icon"
                              className={cn(
                                 "h-10 w-10 rounded-xl border-gray-200 bg-white/50 backdrop-blur-sm shadow-sm transition-all active:scale-95",
                                 u.approval_status === 'suspended' ? 'text-green-600 border-green-100 hover:bg-green-50' : 'text-orange-500 border-orange-100 hover:bg-orange-50'
                              )}
                              onClick={() => handleStatusUpdate(u.clerk_id, u.approval_status === 'suspended' ? 'approved' : 'suspended')}
                              disabled={updatingId === u.clerk_id || u.clerk_id === user?.id}
                              title={u.approval_status === 'suspended' ? 'Activate User' : 'Suspend User'}
                            >
                              {u.approval_status === 'suspended' ? <CheckCircle2 className="h-4 w-4" /> : <ShieldX className="h-4 w-4" />}
                            </Button>

                            <Button
                              variant="outline"
                              size="icon"
                              className="h-10 w-10 rounded-xl border-red-100 bg-white/50 backdrop-blur-sm text-red-500 hover:bg-red-50 hover:border-red-200 shadow-sm transition-all active:scale-95"
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
    </div>
  )
}
