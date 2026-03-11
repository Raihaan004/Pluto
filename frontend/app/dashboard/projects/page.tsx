"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useUser } from "@clerk/nextjs"
import { toast } from "sonner"
import axios from "axios"
import { Plus, Folder, Calendar, Trash2, Clock, Users, Pencil, Layout, FileSpreadsheet, Search } from "lucide-react"
import { useRouter } from "next/navigation"
import { useUserRole } from "@/context/UserRoleContext"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import useSWR from 'swr'
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import { Particles } from "@/components/magicui/particles"
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
  version_comments?: string
  created_at: string
  updated_at: string
  collaborators: Collaborator[]
  user_id: string // Owner ID
  status?: string
  type?: 'freestyle' | 'table'
}

interface Process {
  id: number
  name: string
  type?: 'freestyle' | 'table'
  versions: { name: string; created_at: string; comments?: string }[]
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
  const { orgId } = useUserRole()
  const router = useRouter()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  
  // Form State
  const [projectName, setProjectName] = useState("")
  const [selectedProcessId, setSelectedProcessId] = useState<string>("")
  const [selectedVersion, setSelectedVersion] = useState<string>("")
  const [selectedStyle, setSelectedStyle] = useState<'freestyle' | 'table'>('freestyle')

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

  const filteredProjects = useMemo(() => {
    return projects.filter(project => 
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.version_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (project.version_comments && project.version_comments.toLowerCase().includes(searchQuery.toLowerCase()))
    )
  }, [projects, searchQuery]);

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
      toast.success("Project renamed successfully")
    } catch (error) {
      console.error("Failed to rename project:", error)
      toast.error("Failed to rename project")
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
      toast.success("Project deleted successfully")
    } catch (error) {
      console.error("Failed to delete project:", error)
      toast.error("Failed to delete project")
      mutateProjects()
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSearchQuery("");
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search projects"]') as HTMLInputElement;
        searchInput?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCreateProject = async () => {
    if (!user || !projectName || !selectedProcessId || !selectedVersion) return

    try {
      const selectedProc = processes.find(p => p.id.toString() === selectedProcessId)
      
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/projects`, {
        user_id: user.id,
        name: projectName,
        process_id: parseInt(selectedProcessId),
        version_name: selectedVersion,
        type: selectedProc?.type || 'freestyle',
        org_id: orgId ? parseInt(orgId) : null
      })
      
      // Refresh projects
      mutateProjects()
      setIsDialogOpen(false)
      setProjectName("")
      setSelectedProcessId("")
      setSelectedVersion("")
      toast.success("Project created successfully")
    } catch (error) {
      console.error("Failed to create project:", error)
      toast.error("Failed to create project")
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
    <div className="flex flex-col gap-8 p-8 max-w-7xl mx-auto relative min-h-screen">
      <Particles
        className="absolute inset-0 z-0"
        quantity={100}
        staticity={50}
        color="#3b82f6"
      />
      
      <div className="relative z-10 flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Projects</h1>
          <p className="text-gray-500 text-lg">Manage your projects and link them to FuSa processes.</p>
        </div>

        <div className="flex justify-between items-center gap-4">
          <h2 className="text-xl font-semibold text-gray-900 whitespace-nowrap">All Projects</h2>
          
          <div className="flex items-center gap-3 flex-1 justify-end max-w-2xl">
            <div className="relative flex-1 group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
              </div>
              <Input
                placeholder="Search projects by name, version or comments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 bg-white/70 backdrop-blur-md border-gray-200 hover:border-blue-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100/50 rounded-xl transition-all placeholder:text-gray-400 text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <span className="text-xs font-semibold px-1.5 py-0.5 bg-gray-100 rounded-md hover:bg-gray-200">ESC</span>
                </button>
              )}
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700 text-white shadow-sm shrink-0">
                  <Plus className="w-4 h-4 mr-2" /> Create New Project
                </Button>
              </DialogTrigger>
          <DialogContent className="sm:max-w-[700px] gap-0 p-0 overflow-hidden border-none shadow-2xl">
            <DialogHeader className="p-6 pb-2 bg-white">
              <DialogTitle className="text-2xl font-bold text-gray-900">Create New Project</DialogTitle>
              <DialogDescription className="text-gray-500">
                Create a new project based on a specific version of a process.
              </DialogDescription>
            </DialogHeader>
            <div className="px-8 py-6 space-y-8 bg-white">
              <div className="grid grid-cols-4 items-center gap-6">
                <Label htmlFor="name" className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                  Project Label
                </Label>
                <div className="col-span-3">
                  <Input
                    id="name"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="Enter project name"
                    className="h-11 bg-gray-50 border-gray-200 focus:bg-white transition-all rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 items-start gap-6">
                <Label className="text-sm font-bold text-gray-700 uppercase tracking-wider pt-3">
                  Process Style
                </Label>
                <div className="col-span-3 flex gap-4">
                  <button
                    onClick={() => { setSelectedStyle('freestyle'); setSelectedProcessId(""); setSelectedVersion(""); }}
                    className={cn(
                      "flex-1 flex flex-col items-center justify-center p-5 rounded-2xl border-2 transition-all gap-3 shadow-sm relative group",
                      selectedStyle === 'freestyle' 
                        ? "border-blue-600 bg-blue-50/30 ring-4 ring-blue-50" 
                        : "border-gray-100 hover:border-gray-200 bg-gray-50/50 hover:bg-white"
                    )}
                  >
                    <div className={cn(
                      "p-3 rounded-xl transition-colors",
                      selectedStyle === 'freestyle' ? "bg-blue-600 text-white" : "bg-white text-gray-400 border border-gray-100 shadow-inner group-hover:text-gray-600"
                    )}>
                      <Layout className="w-6 h-6" />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span className={cn(
                        "text-xs font-black uppercase tracking-widest",
                        selectedStyle === 'freestyle' ? "text-blue-700" : "text-gray-500"
                      )}>Freestyle</span>
                      <span className="text-[10px] text-gray-400 text-center font-medium leading-tight max-w-[120px]">Flexible canvas layout for process mapping</span>
                    </div>
                  </button>
                  <button
                    onClick={() => { setSelectedStyle('table'); setSelectedProcessId(""); setSelectedVersion(""); }}
                    className={cn(
                      "flex-1 flex flex-col items-center justify-center p-5 rounded-2xl border-2 transition-all gap-3 shadow-sm relative group",
                      selectedStyle === 'table' 
                        ? "border-indigo-600 bg-indigo-50/30 ring-4 ring-indigo-50" 
                        : "border-gray-100 hover:border-gray-200 bg-gray-50/50 hover:bg-white"
                    )}
                  >
                    <div className={cn(
                      "p-3 rounded-xl transition-colors",
                      selectedStyle === 'table' ? "bg-indigo-600 text-white" : "bg-white text-gray-400 border border-gray-100 shadow-inner group-hover:text-gray-600"
                    )}>
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span className={cn(
                        "text-xs font-black uppercase tracking-widest",
                        selectedStyle === 'table' ? "text-indigo-700" : "text-gray-500"
                      )}>Table Style</span>
                      <span className="text-[10px] text-gray-400 text-center font-medium leading-tight max-w-[120px]">Structured spreadsheet interface for detailed workflows</span>
                    </div>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-6 border-t pt-8">
                <Label htmlFor="process" className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                  Process
                </Label>
                <div className="col-span-3">
                  <Select onValueChange={setSelectedProcessId} value={selectedProcessId}>
                    <SelectTrigger className="h-11 rounded-xl border-gray-200 bg-gray-50 focus:bg-white">
                      <SelectValue placeholder={`Select a ${selectedStyle} process`} />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl shadow-xl border-gray-100">
                      {processes
                        .filter(p => (p as any).status === 'published' && (p.type === selectedStyle || (!p.type && selectedStyle === 'freestyle')))
                        .length > 0 ? (
                          processes
                            .filter(p => (p as any).status === 'published' && (p.type === selectedStyle || (!p.type && selectedStyle === 'freestyle')))
                            .map((process) => (
                              <SelectItem key={process.id} value={process.id.toString()} className="rounded-lg py-3">
                                <span className="font-medium">{process.name}</span>
                              </SelectItem>
                            ))
                        ) : (
                          <SelectItem value="none" disabled>No published {selectedStyle} processes found</SelectItem>
                        )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedProcess && (
                <div className="grid grid-cols-4 items-start gap-6 border-t pt-8">
                  <Label htmlFor="version" className="text-sm font-bold text-blue-600 uppercase tracking-wider pt-3">
                    Version
                  </Label>
                  <div className="col-span-3">
                    <Select onValueChange={setSelectedVersion} value={selectedVersion}>
                      <SelectTrigger className="h-auto w-full p-0 rounded-xl border-blue-100 bg-blue-50/10 hover:bg-blue-50/30 focus:ring-4 focus:ring-blue-100 transition-all text-left overflow-hidden border-2">
                        <SelectValue placeholder="Select a specific version">
                          {selectedVersion && selectedProcess && (
                            <div className="flex items-center justify-between w-full p-3 bg-white">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-bold text-gray-900 leading-none">{selectedVersion}</span>
                                {selectedProcess.versions?.find(v => v.name === selectedVersion)?.comments && (
                                  <span className="text-[10px] text-gray-500 italic line-clamp-1 max-w-[250px]">
                                    "{selectedProcess.versions.find(v => v.name === selectedVersion)?.comments}"
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-600 rounded-lg border border-blue-100 mr-6">
                                <Clock className="w-3 h-3" />
                                <span className="text-[10px] font-bold">
                                  {(() => {
                                    const v = selectedProcess.versions?.find(v => v.name === selectedVersion);
                                    return v ? new Date(v.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
                                  })()}
                                </span>
                              </div>
                            </div>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="max-h-[350px] rounded-xl shadow-2xl border-blue-100 p-2">
                        {selectedProcess.versions?.length > 0 ? (
                          selectedProcess.versions.map((v, i) => (
                            <SelectItem key={i} value={v.name} className="rounded-lg py-4 px-3 mb-1 hover:bg-blue-50 focus:bg-blue-50 transition-colors">
                              <div className="flex flex-col gap-2 w-full">
                                <div className="flex items-center justify-between gap-8">
                                  <span className="font-bold text-gray-900 text-base">{v.name}</span>
                                  <div className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-lg border border-blue-100 shadow-sm">
                                    <Clock className="w-3 h-3 text-blue-500" />
                                    <span className="text-[10px] text-gray-500 font-bold whitespace-nowrap">
                                      {new Date(v.created_at).toLocaleDateString(undefined, {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric'
                                      })}
                                    </span>
                                  </div>
                                </div>
                                {v.comments && (
                                  <div className="text-xs text-gray-600 italic bg-white/80 p-3 rounded-lg border border-blue-50/50 leading-relaxed shadow-sm">
                                    "{v.comments}"
                                  </div>
                                )}
                              </div>
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="none" disabled>No versions available for this process</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="bg-gray-50/80 backdrop-blur-sm p-6 gap-3 border-t">
              <Button 
                variant="ghost" 
                onClick={() => setIsDialogOpen(false)} 
                className="px-6 rounded-xl hover:bg-white hover:text-gray-900 transition-all font-semibold"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCreateProject} 
                disabled={!projectName || !selectedProcessId || !selectedVersion}
                className={cn(
                  "px-10 rounded-xl shadow-lg transition-all active:scale-95 font-bold text-white",
                  projectName && selectedProcessId && selectedVersion 
                    ? "bg-green-600 hover:bg-green-700 shadow-green-200" 
                    : "bg-gray-200 text-gray-400"
                )}
              >
                Launch Project
              </Button>
            </DialogFooter>
          </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="bg-white/40 backdrop-blur-[2px] rounded-xl border shadow-sm p-6 min-h-50">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse"></div>
                  ))}
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="bg-blue-50 p-4 rounded-full mb-4">
                  <Folder className="h-8 w-8 text-blue-500" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">No projects found</h3>
                <p className="text-gray-500 max-w-sm mt-2 mb-6">
                  {searchQuery ? `No projects match your search "${searchQuery}"` : "Create your first project to start managing your functional safety processes."}
                </p>
                {!searchQuery && (
                  <Button onClick={() => setIsDialogOpen(true)} className="bg-green-600 hover:bg-green-700 text-white">
                    <Plus className="w-4 h-4 mr-2" /> Create Project
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProjects.map((project) => {
                  const projectUsers = getProjectCollaborators(project);
                  const isOwner = project.user_id === user?.id;
                  const collaborator = project.collaborators?.find(c => (c.user_id || c.clerk_id) === user?.id);
                  const userRole = isOwner ? 'owner' : (collaborator?.role || 'viewer');
                  
                  return (
                    <div 
                      key={project.id} 
                      className="group relative bg-white/90 backdrop-blur-sm rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer flex flex-col"
                      onClick={() => router.push(`/dashboard/projects/editor?projectId=${project.id}`)}
                    >
                      <div className="p-5 flex flex-col gap-4 grow">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                              <Folder className="h-5 w-5 text-blue-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h3 className="font-semibold text-gray-900 truncate text-lg group-hover:text-blue-600 transition-colors" title={project.name}>
                                  {project.name}
                                </h3>
                                {!isOwner && (
                                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border uppercase tracking-wider ${
                                    userRole === 'admin' ? 'bg-red-100 text-red-700 border-red-200' :
                                    userRole === 'editor' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                    'bg-gray-100 text-gray-700 border-gray-200'
                                  }`}>
                                    {userRole}
                                  </span>
                                )}
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
                              <p className="text-xs text-gray-500 truncate">
                                Based on: <span className="font-medium text-gray-700">{processes.find(p => p.id === project.process_id)?.name} ({project.version_name})</span>
                              </p>
                              {project.version_comments && (
                                <p className="text-[11px] text-gray-400 italic mt-2 line-clamp-1 border-l-2 border-blue-100 pl-2">
                                  "{project.version_comments}"
                                </p>
                              )}
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
