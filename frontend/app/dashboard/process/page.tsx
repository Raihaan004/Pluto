"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useUserRole } from "@/context/UserRoleContext"
import { useState } from "react"
import { useUser } from "@clerk/nextjs"
import axios from "axios"
import { FileText, Edit2, Check, X } from "lucide-react"
import { useRouter } from "next/navigation"
import useSWR from 'swr'

interface Process {
  id: number
  name: string
  created_at: string
  updated_at: string
  status?: string
}

const fetcher = (url: string) => axios.get(url).then(res => res.data)

export default function ProcessPage() {
  const { role } = useUserRole()
  const { user } = useUser()
  const router = useRouter()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [newName, setNewName] = useState("")

  const { data: processes = [], error, isLoading, mutate } = useSWR<Process[]>(
    user ? `${process.env.NEXT_PUBLIC_API_URL}/processes/${user.id}` : null,
    fetcher
  )

  const publishedProcesses = processes.filter((p: Process) => p.status !== 'draft')
  const draftProcesses = processes.filter((p: Process) => p.status === 'draft')

  const handleRename = async (id: number) => {
    if (!newName.trim()) return
    try {
      // Optimistic update
      mutate(
        processes.map((p: Process) => p.id === id ? { ...p, name: newName } : p),
        false
      )
      
      await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/processes/${id}/rename`, { name: newName })
      setEditingId(null)
      setNewName("")
      mutate() // Revalidate
    } catch (error) {
      console.error("Failed to rename process:", error)
      alert("Failed to rename process")
      mutate() // Revert on error
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

  const ProcessCard = ({ process }: { process: Process }) => (
    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-white flex flex-col justify-between gap-4">
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
  )

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Process Management</h1>
        <p className="text-muted-foreground">Manage your FuSa processes - view, create, and publish.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Published Processes & Create New */}
        <div className="lg:col-span-2 space-y-6">
          {role !== 'viewer' && (
            <Card>
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

          <Card>
            <CardHeader>
              <CardTitle>Published Processes</CardTitle>
              <CardDescription>Your published process packages</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div>Loading processes...</div>
              ) : publishedProcesses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No published processes found.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {publishedProcesses.map((process: Process) => (
                    <ProcessCard key={process.id} process={process} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Drafts */}
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Drafts</CardTitle>
              <CardDescription>Work in progress</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div>Loading drafts...</div>
              ) : draftProcesses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No drafts found.</div>
              ) : (
                <div className="flex flex-col gap-4">
                  {draftProcesses.map((process: Process) => (
                    <ProcessCard key={process.id} process={process} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
