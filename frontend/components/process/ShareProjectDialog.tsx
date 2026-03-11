import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Users, Plus, Trash2, User as UserIcon, Lock, Edit3, Unlock } from "lucide-react"
import axios from "axios"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface User {
  clerk_id: string
  email: string
  first_name: string
  last_name: string
  role: string
  image_url?: string
}

interface ShareProjectDialogProps {
  projectId: string
  users: User[]
  currentCollaborators?: { user_id: string; role: string }[]
  projectOwnerId?: string
  onUpdate: () => void
}

export function ShareProjectDialog({ projectId, users, currentCollaborators = [], projectOwnerId, onUpdate }: ShareProjectDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState("")
  const [selectedRole, setSelectedRole] = useState("viewer")
  const [isAdding, setIsAdding] = useState(false)
  const [removingUserId, setRemovingUserId] = useState<string | null>(null)

  const handleAddCollaborator = async () => {
    if (!selectedUserId) return
    setIsAdding(true)
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/collaborators`, {
        user_id: selectedUserId,
        role: selectedRole
      })
      onUpdate()
      setSelectedUserId("")
      setSelectedRole("viewer")
    } catch (error) {
      console.error("Failed to add collaborator:", error)
    } finally {
      setIsAdding(false)
    }
  }

  const handleRemoveCollaborator = async (userId: string) => {
    setRemovingUserId(userId)
    try {
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/collaborators/${userId}`)
      onUpdate()
    } catch (error) {
      console.error("Failed to remove collaborator:", error)
    } finally {
      setRemovingUserId(null)
    }
  }

  // Filter out users who are already collaborators or the owner
  const availableUsers = users.filter(u => 
    !currentCollaborators.some(c => c.user_id === u.clerk_id) && 
    u.clerk_id !== projectOwnerId
  )

  // Get user details for collaborators
  const getCollaboratorUser = (userId: string) => {
    return users.find(u => u.clerk_id === userId)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 h-10 px-5 rounded-xl border-gray-200 hover:border-blue-200 hover:bg-blue-50 transition-all font-semibold">
          <Users className="h-4 w-4 text-blue-600" />
          Add Members
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] p-0 gap-0 overflow-hidden border-none shadow-2xl rounded-3xl">
        <DialogHeader className="p-6 bg-white border-b">
          <DialogTitle className="text-xl font-bold text-gray-900">Project Access</DialogTitle>
          <DialogDescription className="text-gray-500">
            Manage who can view or edit this project.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col max-h-[60vh]">
          {/* Current Members Section */}
          <div className="p-6 space-y-4 overflow-y-auto">
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Current Members</h4>
            <div className="space-y-3">
              {/* Owner */}
              {projectOwnerId && (() => {
                const owner = users.find(u => u.clerk_id === projectOwnerId)
                if (!owner) return null
                return (
                  <div key="owner" className="flex items-center justify-between p-3 bg-blue-50/50 rounded-2xl border border-blue-100 ring-4 ring-blue-50/30">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                        <AvatarImage src={owner.image_url} />
                        <AvatarFallback className="bg-blue-100 text-blue-700 font-bold">
                          {owner.first_name?.[0]}{owner.last_name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">
                          {owner.first_name} {owner.last_name}
                        </p>
                        <p className="text-[11px] text-gray-500 truncate font-medium">{owner.email}</p>
                      </div>
                      <Badge className="bg-blue-600 text-white hover:bg-blue-600 border-none px-3 py-1 font-bold text-[10px] uppercase tracking-wider">
                        Owner
                      </Badge>
                    </div>
                  </div>
                )
              })()}
              
              {/* Collaborators */}
              {currentCollaborators.length > 0 ? (
                currentCollaborators.map((collab, index) => {
                  const user = getCollaboratorUser(collab.user_id)
                  if (!user) return null
                  
                  return (
                    <div key={collab.user_id || index} className="group flex items-center justify-between p-3 bg-white rounded-2xl border border-gray-100 hover:border-blue-100 hover:shadow-sm transition-all duration-200">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Avatar className="h-10 w-10 border-2 border-gray-50 group-hover:border-blue-50 transition-colors">
                          <AvatarImage src={user.image_url} />
                          <AvatarFallback className="bg-gray-100 text-gray-600 font-bold group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                            {user.first_name?.[0]}{user.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">
                            {user.first_name} {user.last_name}
                          </p>
                          <p className="text-[11px] text-gray-500 truncate font-medium">{user.email}</p>
                        </div>
                        <div className="flex items-center gap-2 pr-2">
                            <Badge variant="outline" className={cn(
                                "font-bold text-[10px] uppercase tracking-wider px-2 py-0.5",
                                collab.role === 'editor' ? "border-amber-200 bg-amber-50 text-amber-700" : "border-gray-200 bg-gray-50 text-gray-600"
                            )}>
                            {collab.role}
                            </Badge>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl opacity-0 group-hover:opacity-100 transition-all active:scale-95"
                                onClick={() => handleRemoveCollaborator(collab.user_id)}
                                disabled={removingUserId === collab.user_id}
                                title="Remove member"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                  <div className="p-3 bg-white rounded-xl shadow-sm mb-2">
                    <Users className="h-5 w-5 text-gray-300" />
                  </div>
                  <p className="text-xs text-gray-400 font-medium tracking-tight">No collaborators added yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Add Member Section */}
          <div className="p-6 bg-gray-50/50 border-t space-y-4">
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Invite Collaborator</h4>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label className="text-[11px] font-bold text-gray-500 uppercase px-1">User Account</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="h-11 rounded-2xl border-gray-200 bg-white shadow-sm ring-offset-bg focus:ring-4 focus:ring-blue-100/50 transition-all">
                    <SelectValue placeholder="Search email or name..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl shadow-2xl border-gray-100 p-2 overflow-hidden">
                    {availableUsers.length > 0 ? (
                      availableUsers.map(u => (
                        <SelectItem key={u.clerk_id} value={u.clerk_id} className="rounded-xl py-3 px-3 hover:bg-blue-50 focus:bg-blue-50">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-sm text-gray-900">{u.first_name} {u.last_name}</span>
                            <span className="text-[10px] text-gray-500 font-medium">{u.email}</span>
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>No users found</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="text-[11px] font-bold text-gray-500 uppercase px-1">Role Permissions</Label>
                <div className="flex gap-2">
                    <button
                        onClick={() => setSelectedRole('viewer')}
                        className={cn(
                            "flex-1 flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all gap-2 shadow-sm",
                            selectedRole === 'viewer' 
                                ? "border-blue-600 bg-white ring-4 ring-blue-50 shadow-blue-100" 
                                : "border-transparent bg-white/50 hover:bg-white text-gray-400"
                        )}
                    >
                        <Lock className={cn("w-4 h-4", selectedRole === 'viewer' ? "text-blue-600" : "text-gray-400")} />
                        <span className={cn("text-[11px] font-black uppercase tracking-tight", selectedRole === 'viewer' ? "text-gray-900" : "text-gray-400")}>Viewer</span>
                    </button>
                    <button
                        onClick={() => setSelectedRole('editor')}
                        className={cn(
                            "flex-1 flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all gap-2 shadow-sm",
                            selectedRole === 'editor' 
                                ? "border-amber-500 bg-white ring-4 ring-amber-50 shadow-amber-100" 
                                : "border-transparent bg-white/50 hover:bg-white text-gray-400"
                        )}
                    >
                        <Unlock className={cn("w-4 h-4", selectedRole === 'editor' ? "text-amber-500" : "text-gray-400")} />
                        <span className={cn("text-[11px] font-black uppercase tracking-tight", selectedRole === 'editor' ? "text-gray-900" : "text-gray-400")}>Editor</span>
                    </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="p-6 bg-white border-t rounded-b-3xl gap-3">
          <Button 
            variant="ghost" 
            onClick={() => setIsOpen(false)}
            className="px-6 rounded-2xl font-bold text-gray-500 hover:bg-gray-50"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleAddCollaborator} 
            disabled={!selectedUserId || isAdding || availableUsers.length === 0}
            className={cn(
                "px-8 rounded-2xl font-black text-white shadow-lg transition-all active:scale-95 uppercase tracking-wider text-xs h-11",
                !selectedUserId || isAdding ? "bg-gray-200" : "bg-blue-600 hover:bg-blue-700 shadow-blue-100"
            )}
          >
            {isAdding ? "Working..." : "Invite Member"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
