"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useUserRole } from "@/context/UserRoleContext"
import { useState } from "react"
import { useUser } from "@clerk/nextjs"
import axios from "axios"
import { FileText, Edit2, Check, X, Trash2, Eye, Plus, Clock } from "lucide-react"
import { useRouter } from "next/navigation"
import useSWR from 'swr'
import { formatDistanceToNow } from "date-fns"

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

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this process? This action cannot be undone.")) return
    try {
      // Optimistic update
      mutate(
        processes.filter((p: Process) => p.id !== id),
        false
      )
      
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/processes/${id}`)
      mutate() // Revalidate
    } catch (error) {
      console.error("Failed to delete process:", error)
      alert("Failed to delete process")
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
    <div className="group relative bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col">
      <div className="p-5 flex flex-col gap-4 flex-grow">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            {editingId === process.id ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="border rounded px-2 py-1 text-sm w-full focus:ring-2 focus:ring-blue-500 outline-none"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename(process.id);
                    if (e.key === 'Escape') cancelEditing();
                  }}
                />
                <button onClick={() => handleRename(process.id)} className="p-1 text-green-600 hover:bg-green-50 rounded">
                  <Check className="h-4 w-4" />
                </button>
                <button onClick={cancelEditing} className="p-1 text-red-600 hover:bg-red-50 rounded">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <h3 className="font-semibold text-gray-900 truncate text-lg" title={process.name}>{process.name}</h3>
            )}
          </div>
          
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {editingId !== process.id && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  startEditing(process);
                }}
                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                title="Rename"
              >
                <Edit2 className="h-4 w-4" />
              </button>
            )}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(process.id);
              }}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500 mt-auto">
          <Clock className="h-3 w-3" />
          <span>Updated {formatDistanceToNow(new Date(process.updated_at || process.created_at), { addSuffix: true })}</span>
        </div>
      </div>
      
      <div className="bg-gray-50/50 p-3 border-t flex items-center justify-between gap-2">
        <Button 
          variant="ghost" 
          size="sm"
          className="flex-1 text-xs font-medium hover:bg-white hover:shadow-sm"
          onClick={() => router.push(`/dashboard/process/create?id=${process.id}`)}
        >
          <Eye className="h-3.5 w-3.5 mr-2 text-gray-500" />
          Latest Version
        </Button>
        <div className="w-px h-4 bg-gray-200"></div>
        <Button 
          variant="ghost" 
          size="sm"
          className="flex-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50"
          onClick={() => router.push(`/dashboard/process/create?id=${process.id}`)}
        >
          Open Editor
        </Button>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-8 p-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Process Management</h1>
        <p className="text-gray-500 text-lg">Manage your FuSa processes - view, create, and publish.</p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Column: Published Processes & Create New */}
        <div className="lg:col-span-2 space-y-8">
          {role !== 'viewer' && (
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-white/20 transition-colors"></div>
              <div className="relative z-10">
                <h2 className="text-2xl font-bold mb-2">Create New Process</h2>
                <p className="text-blue-100 mb-6 max-w-md">Start designing a new process flow from scratch using our intuitive drag-and-drop editor.</p>
                <Link href="/dashboard/process/create">
                  <Button className="bg-white text-blue-600 hover:bg-blue-50 border-none shadow-md font-semibold px-6">
                    <Plus className="h-4 w-4 mr-2" />
                    Start Designing
                  </Button>
                </Link>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Published Processes</h2>
              <span className="text-sm text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full">{publishedProcesses.length}</span>
            </div>
            
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2].map(i => (
                  <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse"></div>
                ))}
              </div>
            ) : publishedProcesses.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No published processes yet</p>
                <p className="text-sm text-gray-400">Create a new process to get started</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {publishedProcesses.map((process: Process) => (
                  <ProcessCard key={process.id} process={process} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Drafts */}
        <div className="lg:col-span-1">
          <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 h-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Drafts</h2>
              <span className="text-sm text-gray-500 bg-white px-2.5 py-0.5 rounded-full shadow-sm">{draftProcesses.length}</span>
            </div>
            
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-32 bg-gray-200 rounded-xl animate-pulse"></div>
                ))}
              </div>
            ) : draftProcesses.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No drafts in progress</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {draftProcesses.map((process: Process) => (
                  <ProcessCard key={process.id} process={process} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
