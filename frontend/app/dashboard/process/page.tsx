"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useUserRole } from "@/context/UserRoleContext"
import { toast } from "sonner"
import { useState } from "react"
import { useUser } from "@clerk/nextjs"
import axios from "axios"
import { FileText, Edit2, Check, X, Trash2, Eye, Plus, Clock, FileSpreadsheet } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import useSWR from 'swr'
import { formatDistanceToNow } from "date-fns"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface Process {
  id: number
  name: string
  created_at: string
  updated_at: string
  status?: string
  type?: 'freestyle' | 'table'
}

const fetcher = (url: string) => axios.get(url).then(res => res.data)

export default function ProcessPage() {
  const { role } = useUserRole()
  const { user } = useUser()
  const router = useRouter()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [newName, setNewName] = useState("")
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [processToDelete, setProcessToDelete] = useState<number | null>(null)
  const [isSelectionDialogOpen, setIsSelectionDialogOpen] = useState(false)

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
      
      await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/processes/${id}/rename`, 
        { name: newName },
        { headers: { "X-Clerk-User-Id": user?.id } }
      )
      setEditingId(null)
      setNewName("")
      mutate() // Revalidate
      toast.success("Process renamed successfully")
    } catch (error) {
      console.error("Failed to rename process:", error)
      toast.error("Failed to rename process")
      mutate() // Revert on error
    }
  }

  const handleDelete = (id: number) => {
    setProcessToDelete(id)
    setIsDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!processToDelete) return
    try {
      // Optimistic update
      mutate(
        processes.filter((p: Process) => p.id !== processToDelete),
        false
      )
      
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/processes/${processToDelete}`, {
        headers: { "X-Clerk-User-Id": user?.id }
      })
      mutate() // Revalidate
      setIsDeleteDialogOpen(false)
      setProcessToDelete(null)
      toast.success("Process deleted successfully")
    } catch (error) {
      console.error("Failed to delete process:", error)
      toast.error("Failed to delete process")
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

  const ProcessCard = ({ process, isDraft }: { process: Process; isDraft: boolean }) => (
    <div className="group relative bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col">
      <div className="p-5 flex flex-col gap-4 grow">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={cn(
              "p-2 rounded-lg transition-colors",
              process.type === 'table' ? "bg-indigo-50 group-hover:bg-indigo-100" : "bg-blue-50 group-hover:bg-blue-100"
            )}>
              {process.type === 'table' ? (
                <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
              ) : (
                <FileText className="h-5 w-5 text-blue-600" />
              )}
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
              <div className="flex flex-col min-w-0">
                <h3 className="font-semibold text-gray-900 truncate text-lg leading-tight" title={process.name}>{process.name}</h3>
                <Badge 
                  variant="outline" 
                   className={cn(
                     "mt-1 text-[10px] uppercase tracking-wider py-0 px-1.5 h-4 w-fit",
                     process.type === 'table' ? "text-indigo-600 border-indigo-200 bg-indigo-50" : "text-blue-600 border-blue-200 bg-blue-50"
                   )}
                >
                  {process.type === 'table' ? 'Table Style' : 'Freestyle'}
                </Badge>
              </div>
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
          className={`flex-1 text-xs font-medium hover:bg-white hover:shadow-sm ${!isDraft && 'rounded-md'}`}
          onClick={() => {
            const path = process.type === 'table' ? '/dashboard/process/table' : '/dashboard/process/create';
            router.push(`${path}?id=${process.id}`);
          }}
        >
          <Eye className="h-3.5 w-3.5 mr-2 text-gray-500" />
          Latest Version
        </Button>
        {isDraft && (
          <>
            <div className="w-px h-4 bg-gray-200"></div>
            <Button 
              variant="ghost" 
              size="sm"
              className="flex-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              onClick={() => {
                const path = process.type === 'table' ? '/dashboard/process/table' : '/dashboard/process/create';
                router.push(`${path}?id=${process.id}`);
              }}
            >
              Open Editor
            </Button>
          </>
        )}
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
            <div className="bg-linear-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-white/20 transition-colors"></div>
              <div className="relative z-10">
                <h2 className="text-2xl font-bold mb-2">Create New Process</h2>
                <p className="text-blue-100 mb-6 max-w-md">Start designing a new process flow from scratch using our intuitive drag-and-drop editor.</p>
                <Button 
                  onClick={() => setIsSelectionDialogOpen(true)}
                  className="bg-white text-blue-600 hover:bg-blue-50 border-none shadow-md font-semibold px-6"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Start Designing
                </Button>
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
                  <ProcessCard key={`${process.type}-${process.id}`} process={process} isDraft={false} />
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
                  <ProcessCard key={`${process.type}-${process.id}`} process={process} isDraft={true} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Process</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this process? This action cannot be undone and all data associated with it will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Style Selection Dialog */}
      <Dialog open={isSelectionDialogOpen} onOpenChange={setIsSelectionDialogOpen}>
        <DialogContent className="sm:max-w-3xl p-8 overflow-hidden">
          <DialogHeader className="text-center mb-8">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <DialogTitle className="text-3xl font-bold tracking-tight text-gray-900">
                Choose Your Design Style
              </DialogTitle>
              <DialogDescription className="text-base text-gray-500 mt-2">
                Select how you would like to begin designing your process flow.
              </DialogDescription>
            </motion.div>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <Button
                variant="outline"
                className="flex flex-col items-center justify-center h-72 w-full gap-4 hover:border-blue-500 hover:bg-blue-50/50 transition-all border-2 group rounded-2xl relative overflow-hidden shadow-sm whitespace-normal p-8"
                onClick={() => {
                  setIsSelectionDialogOpen(false);
                  router.push('/dashboard/process/create');
                }}
              >
                <motion.div 
                  whileHover={{ scale: 1.1 }}
                  className="p-4 bg-blue-100 rounded-xl group-hover:bg-blue-200 transition-colors"
                >
                  <Plus className="h-10 w-10 text-blue-600" />
                </motion.div>
                <div className="text-center z-10">
                  <div className="text-2xl font-bold text-gray-900">Freestyle</div>
                  <p className="text-sm text-gray-500 mt-2 font-medium leading-relaxed">
                    Creative and flexible flowchart logic for complex decision trees.
                  </p>
                </div>
                <div className="absolute -bottom-6 -right-6 opacity-[0.05] group-hover:opacity-[0.1] transition-opacity pointer-events-none">
                  <Plus className="h-32 w-32 text-blue-600 rotate-12" />
                </div>
              </Button>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <Button
                variant="outline"
                className="flex flex-col items-center justify-center h-72 w-full gap-4 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all border-2 group rounded-2xl relative overflow-hidden shadow-sm whitespace-normal p-8"
                onClick={() => {
                  setIsSelectionDialogOpen(false);
                  router.push('/dashboard/process/table');
                }}
              >
                <motion.div 
                  whileHover={{ scale: 1.1 }}
                  className="p-4 bg-indigo-100 rounded-xl group-hover:bg-indigo-200 transition-colors"
                >
                  <FileSpreadsheet className="h-10 w-10 text-indigo-600" />
                </motion.div>
                <div className="text-center z-10">
                  <div className="text-2xl font-bold text-gray-900">Table Style</div>
                  <p className="text-sm text-gray-500 mt-2 font-medium leading-relaxed">
                    Structured grid view perfect for step-by-step SOPs and procedures.
                  </p>
                </div>
                <div className="absolute -bottom-6 -right-6 opacity-[0.05] group-hover:opacity-[0.1] transition-opacity pointer-events-none">
                  <FileSpreadsheet className="h-32 w-32 text-indigo-600 -rotate-12" />
                </div>
              </Button>
            </motion.div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
