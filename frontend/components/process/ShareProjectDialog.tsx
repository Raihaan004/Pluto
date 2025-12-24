import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Users, Plus, Trash2 } from "lucide-react"
import axios from "axios"

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
  onUpdate: () => void
}

export function ShareProjectDialog({ projectId, users, currentCollaborators = [], onUpdate }: ShareProjectDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState("")
  const [selectedRole, setSelectedRole] = useState("viewer")
  const [isAdding, setIsAdding] = useState(false)

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
      setIsOpen(false)
      alert("Member added successfully!")
    } catch (error) {
      console.error("Failed to add collaborator:", error)
      alert("Failed to add collaborator")
    } finally {
      setIsAdding(false)
    }
  }

  // Filter out users who are already collaborators or the owner (handled by parent)
  const availableUsers = users.filter(u => !currentCollaborators.some(c => c.user_id === u.clerk_id))

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Users className="h-4 w-4" />
          Add Members
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Share Project</DialogTitle>
          <DialogDescription>
            Invite team members to collaborate on this project.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Select User</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a user..." />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map(u => (
                  <SelectItem key={u.clerk_id} value={u.clerk_id}>
                    {u.first_name} {u.last_name} ({u.email})
                  </SelectItem>
                ))}
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
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={handleAddCollaborator} disabled={!selectedUserId || isAdding}>
            {isAdding ? "Adding..." : "Add Member"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
