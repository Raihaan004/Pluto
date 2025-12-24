"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useUserRole } from "@/context/UserRoleContext"
import { useEffect, useState } from "react"
import { useUser } from "@clerk/nextjs"
import axios from "axios"
import { FileText, Edit2, Check, X } from "lucide-react"
import { useRouter } from "next/navigation"

interface Process {
  id: number
  name: string
  created_at: string
  updated_at: string
}

export default function ProcessPage() {
  const { role } = useUserRole()
  const { user } = useUser()
  const router = useRouter()
  const [processes, setProcesses] = useState<Process[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [newName, setNewName] = useState("")

  useEffect(() => {
    const fetchProcesses = async () => {
      if (!user) return
      try {
        const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/processes/${user.id}`)
        setProcesses(response.data)
      } catch (error) {
        console.error("Failed to fetch processes:", error)
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      fetchProcesses()
    }
  }, [user])

  const handleRename = async (id: number) => {
    if (!newName.trim()) return
    try {
      await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/processes/${id}/rename`, { name: newName })
      setProcesses(processes.map(p => p.id === id ? { ...p, name: newName } : p))
      setEditingId(null)
      setNewName("")
    } catch (error) {
      console.error("Failed to rename process:", error)
      alert("Failed to rename process")
    }
  }

  const startEditing = (process: Process) => {
    setEditingId(process.id)
    setNewName(process.name)
  }

  const cancelEditing = () => {
    setEditingId(null)
    setNewName("")
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Process Management</h1>
        <p className="text-muted-foreground">Manage your FuSa processes - view, create, and publish.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Saved Processes</CardTitle>
            <CardDescription>Your saved process packages</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div>Loading processes...</div>
            ) : processes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No saved processes found.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {processes.map((process) => (
                  <div key={process.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-white flex flex-col justify-between gap-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileText className="h-5 w-5 text-blue-500 flex-shrink-0" />
                        {editingId === process.id ? (
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="text"
                              value={newName}
                              onChange={(e) => setNewName(e.target.value)}
                              className="border rounded px-2 py-1 text-sm w-full"
                              autoFocus
                            />
                            <button onClick={() => handleRename(process.id)} className="text-green-600 hover:text-green-700">
                              <Check className="h-4 w-4" />
                            </button>
                            <button onClick={cancelEditing} className="text-red-600 hover:text-red-700">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <h3 className="font-medium truncate" title={process.name}>{process.name}</h3>
                        )}
                      </div>
                      {editingId !== process.id && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditing(process);
                          }}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    
                    <div className="flex justify-between items-center mt-auto">
                      <span className="text-xs text-gray-500">
                        {new Date(process.created_at).toLocaleDateString()}
                      </span>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => router.push(`/dashboard/process/create?id=${process.id}`)}
                      >
                        Open
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {role !== 'viewer' && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Create New Process</CardTitle>
              <CardDescription>Start designing a new process from scratch</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/dashboard/process/create">
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                  Create New Process
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
