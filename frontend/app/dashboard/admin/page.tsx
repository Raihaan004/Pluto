"use client"

import { useEffect, useState } from "react"
import { useUser } from "@clerk/nextjs"
import { useUserRole } from "@/context/UserRoleContext"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import axios from "axios"
import { Loader2 } from "lucide-react"

interface User {
  id: number
  clerk_id: string
  email: string
  first_name: string
  last_name: string
  role: string
  created_at: string
}

export default function AdminPage() {
  const { user } = useUser()
  const { role, isLoading: isRoleLoading } = useUserRole()
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    const fetchUsers = async () => {
      if (role !== 'admin' || !user) return

      try {
        const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/users`, {
          headers: {
            'X-Clerk-User-Id': user.id
          }
        })
        setUsers(response.data)
      } catch (error) {
        console.error("Failed to fetch users:", error)
      } finally {
        setIsLoading(false)
      }
    }

    if (!isRoleLoading) {
      fetchUsers()
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Manage users and their roles.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>View and update user roles.</CardDescription>
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
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
                          ${u.role === 'admin' ? 'bg-red-100 text-red-800' : 
                            u.role === 'editor' ? 'bg-blue-100 text-blue-800' : 
                            'bg-gray-100 text-gray-800'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="p-4 align-middle">
                        <div className="flex gap-2">
                          <select 
                            className="h-9 w-[120px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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
