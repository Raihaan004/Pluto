"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useUser } from "@clerk/nextjs"
import axios from "axios"
import { Plus, Folder, Calendar, Trash2, Clock, Users, Pencil } from "lucide-react"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import useSWR from 'swr'
import { formatDistanceToNow } from "date-fns"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Collaborator {
  user_id: string
  role: string
  clerk_id?: string // Handle potential inconsistency in naming
}

interface Project {
  id: number
  name: string
  process_id: number
  version_name: string
  created_at: string
  updated_at: string
  collaborators: Collaborator[]
  user_id: string // Owner ID
  status?: string
}

interface Process {
  id: number
  name: string
  versions: { name: string; created_at: string }[]
}

interface User {
  clerk_id: string
  first_name: string
  last_name: string
  image_url: string
  email: string
}

const fetcher = (url: string) => axios.get(url).then(res => res.data)
const fetcherWithHeader = ([url, token]: [string, string]) => axios.get(url, { headers: { "X-Clerk-User-Id": token } }).then(res => res.data)

export default function ProjectsPage() {
  const { user } = useUser()
  const router = useRouter()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  
  // Form State
  const [projectName, setProjectName] = useState("")
  const [selectedProcessId, setSelectedProcessId] = useState<string>("")
  const [selectedVersion, setSelectedVersion] = useState<string>("")

  // Rename State
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false)
  const [projectToRename, setProjectToRename] = useState<Project | null>(null)
  const [newProjectName, setNewProjectName] = useState("")

  // Delete State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<number | null>(null)

  const { data: projects = [], mutate: mutateProjects, isLoading: loadingProjects } = useSWR<Project[]>(
    user ? `${process.env.NEXT_PUBLIC_API_URL}/projects/${user.id}` : null,
    fetcher
  )

  const { data: processes = [] } = useSWR<Process[]>(
    user ? `${process.env.NEXT_PUBLIC_API_URL}/processes/${user.id}` : null,
    fetcher
  )

  const { data: users = [] } = useSWR<User[]>(
    user ? [`${process.env.NEXT_PUBLIC_API_URL}/users`, user.id] : null,
    fetcherWithHeader
  )

  const loading = loadingProjects

  const handleRenameProject = async () => {
    if (!projectToRename || !newProjectName) return

    try {
      await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/project/${projectToRename.id}`, {
        name: newProjectName
      })
      
      mutateProjects()
      setIsRenameDialogOpen(false)
      setProjectToRename(null)
      setNewProjectName("")
    } catch (error) {
      console.error("Failed to rename project:", error)
      alert("Failed to rename project")
    }
  }

  const openRenameDialog = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation()
    setProjectToRename(project)
    setNewProjectName(project.name)
    setIsRenameDialogOpen(true)
  }

  const handleDeleteProject = (e: React.MouseEvent, projectId: number) => {
    e.stopPropagation() // Prevent navigation
    setProjectToDelete(projectId)
    setIsDeleteDialogOpen(true)
  }

  const confirmDeleteProject = async () => {
    if (!projectToDelete) return

    try {
      mutateProjects(projects.filter((p: Project) => p.id !== projectToDelete), false)
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectToDelete}`, {
        headers: { "X-Clerk-User-Id": user?.id }
      })
      mutateProjects()
      setIsDeleteDialogOpen(false)
      setProjectToDelete(null)
    } catch (error) {
      console.error("Failed to delete project:", error)
      alert("Failed to delete project")
      mutateProjects()
    }
  }

  const handleCreateProject = async () => {
    if (!user || !projectName || !selectedProcessId || !selectedVersion) return

    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/projects`, {
        user_id: user.id,
        name: projectName,
        process_id: parseInt(selectedProcessId),
        version_name: selectedVersion
      })
      
      // Refresh projects
      mutateProjects()
      setIsDialogOpen(false)
      setProjectName("")
      setSelectedProcessId("")
      setSelectedVersion("")
    } catch (error) {
      console.error("Failed to create project:", error)
      alert("Failed to create project")
    }
  }

  const selectedProcess = processes.find(p => p.id.toString() === selectedProcessId)

  const getProjectCollaborators = (project: Project) => {
    // Combine owner and collaborators
    const owner = users.find(u => u.clerk_id === project.user_id);
    const collaboratorUsers = (project.collaborators || []).map(c => {
      const uid = c.user_id || c.clerk_id;
      return users.find(u => u.clerk_id === uid);
    }).filter(Boolean) as User[];

    // Unique users
    const allUsers = owner ? [owner, ...collaboratorUsers] : collaboratorUsers;
    return Array.from(new Set(allUsers.map(u => u.clerk_id)))
      .map(id => allUsers.find(u => u.clerk_id === id))
      .filter(Boolean) as User[];
  };

  return (
    <div className="flex flex-col gap-8 p-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Projects</h1>
        <p className="text-gray-500 text-lg">Manage your projects and link them to FuSa processes.</p>
      </div>

      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">All Projects</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-green-600 hover:bg-green-700 text-white shadow-sm">
              <Plus className="w-4 h-4 mr-2" /> Create New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-106.25">
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>
                Create a new project based on a specific version of a process.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Project Label
                </Label>
                <Input
                  id="name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Enter project name"
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="process" className="text-right">
                  Process
                </Label>
                <Select onValueChange={setSelectedProcessId} value={selectedProcessId}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select a process" />
                  </SelectTrigger>
                  <SelectContent>
                    {processes
                      .filter(p => (p as any).status === 'published')
                      .map((process) => (
                        <SelectItem key={process.id} value={process.id.toString()}>
                          {process.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedProcess && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="version" className="text-right">
                    Version
                  </Label>
                  <Select onValueChange={setSelectedVersion} value={selectedVersion}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select a version" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedProcess.versions?.length > 0 ? (
                        selectedProcess.versions.map((v, i) => (
                          <SelectItem key={i} value={v.name}>
                            {v.name} ({new Date(v.created_at).toLocaleDateString()})
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>No versions available</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateProject} className="bg-green-600 hover:bg-green-700 text-white">Save Project</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-xl border shadow-sm p-6 min-h-50">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {[1, 2, 3].map(i => (
                  <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse"></div>
                ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="bg-blue-50 p-4 rounded-full mb-4">
                <Folder className="h-8 w-8 text-blue-500" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">No projects yet</h3>
              <p className="text-gray-500 max-w-sm mt-2 mb-6">Create your first project to start managing your functional safety processes.</p>
              <Button onClick={() => setIsDialogOpen(true)} className="bg-green-600 hover:bg-green-700 text-white">
                <Plus className="w-4 h-4 mr-2" /> Create Project
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => {
                const projectUsers = getProjectCollaborators(project);
                
                return (
                  <div 
                    key={project.id} 
                    className="group relative bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer flex flex-col"
                    onClick={() => router.push(`/dashboard/projects/editor?projectId=${project.id}`)}
                  >
                    <div className="p-5 flex flex-col gap-4 grow">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                            <Folder className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-gray-900 truncate text-lg group-hover:text-blue-600 transition-colors" title={project.name}>
                                {project.name}
                              </h3>
                              {project.status === 'draft' && (
                                <span className="px-2 py-0.5 text-[10px] font-bold bg-orange-100 text-orange-700 rounded-full border border-orange-200 uppercase tracking-wider">
                                  Draft
                                </span>
                              )}
                              {project.status === 'published' && (
                                <span className="px-2 py-0.5 text-[10px] font-bold bg-green-100 text-green-700 rounded-full border border-green-200 uppercase tracking-wider">
                                  Published
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 truncate mt-0.5">
                              Based on: <span className="font-medium text-gray-700">{processes.find(p => p.id === project.process_id)?.name} ({project.version_name})</span>
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => openRenameDialog(e, project)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="Rename Project"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={(e) => handleDeleteProject(e, project.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Delete Project"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-auto pt-2">
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}</span>
                        </div>
                        
                        <div className="flex -space-x-2 items-center">
                          {projectUsers.slice(0, 3).map((u, i) => (
                            <Avatar key={i} className="h-7 w-7 border-2 border-white ring-1 ring-gray-100">
                              <AvatarImage src={u.image_url} />
                              <AvatarFallback className="bg-blue-100 text-blue-700 text-[10px]">
                                {u.first_name?.[0]}{u.last_name?.[0]}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                          {projectUsers.length > 3 && (
                            <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-gray-100 text-[10px] font-medium text-gray-600 ring-1 ring-gray-100">
                              +{projectUsers.length - 3}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      </div>

      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent className="sm:max-w-106.25">
          <DialogHeader>
            <DialogTitle>Rename Project</DialogTitle>
            <DialogDescription>
              Enter a new name for your project.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="rename" className="text-right">
                Name
              </Label>
              <Input
                id="rename"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleRenameProject} className="bg-blue-600 hover:bg-blue-700 text-white">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this project? This action cannot be undone and all data associated with it will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={confirmDeleteProject}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>    </div>
  )
}
