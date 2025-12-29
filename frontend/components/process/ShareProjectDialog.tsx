import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Users, Plus, Trash2, User as UserIcon } from "lucide-react"
import axios from "axios"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

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
      alert("Member added successfully!")
    } catch (error) {
      console.error("Failed to add collaborator:", error)
      alert("Failed to add collaborator")
    } finally {
      setIsAdding(false)
    }
  }

  const handleRemoveCollaborator = async (userId: string) => {
    if (!confirm("Are you sure you want to remove this member?")) return
    
    setRemovingUserId(userId)
    try {
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/collaborators/${userId}`)
      onUpdate()
      alert("Member removed successfully!")
    } catch (error) {
      console.error("Failed to remove collaborator:", error)
      alert("Failed to remove collaborator")
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
        <Button variant="outline" className="gap-2">
          <Users className="h-4 w-4" />
          Add Members
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Share Project</DialogTitle>
          <DialogDescription>
            Invite team members to collaborate on this project.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Current Members Section */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Current Members</Label>
            <div className="border rounded-md p-3 space-y-2 max-h-[200px] overflow-y-auto">
              {/* Owner */}
              {projectOwnerId && (() => {
                const owner = users.find(u => u.clerk_id === projectOwnerId)
                if (!owner) return null
                return (
                  <div key="owner" className="flex items-center justify-between p-2 bg-blue-50 rounded-md border border-blue-100">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={owner.image_url} />
                        <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
                          {owner.first_name?.[0]}{owner.last_name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {owner.first_name} {owner.last_name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{owner.email}</p>
                      </div>
                      <Badge variant="default" className="bg-blue-600 text-white">
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
                    <div key={collab.user_id || index} className="flex items-center justify-between p-2 bg-gray-50 rounded-md border border-gray-200 hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.image_url} />
                          <AvatarFallback className="bg-gray-200 text-gray-700 text-xs">
                            {user.first_name?.[0]}{user.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {user.first_name} {user.last_name}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        </div>
                        <Badge variant={collab.role === 'editor' ? 'secondary' : 'outline'} className="mr-2">
                          {collab.role}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleRemoveCollaborator(collab.user_id)}
                        disabled={removingUserId === collab.user_id}
                        title="Remove member"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                })
              ) : (
                <div className="text-center py-4 text-sm text-gray-500">
                  No collaborators yet
                </div>
              )}
            </div>
          </div>

          {/* Add Member Section */}
          <div className="border-t pt-4 space-y-3">
            <Label className="text-base font-semibold">Add New Member</Label>
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label>Select User</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.length > 0 ? (
                      availableUsers.map(u => (
                        <SelectItem key={u.clerk_id} value={u.clerk_id}>
                          {u.first_name} {u.last_name} ({u.email})
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>No users available</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Permission</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer (Read Only)</SelectItem>
                    <SelectItem value="editor">Editor (Can Edit)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>Close</Button>
          <Button onClick={handleAddCollaborator} disabled={!selectedUserId || isAdding || availableUsers.length === 0}>
            {isAdding ? "Adding..." : "Add Member"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
