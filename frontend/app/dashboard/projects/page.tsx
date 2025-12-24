"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useUser } from "@clerk/nextjs"
import axios from "axios"
import { Plus, Folder, Calendar, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import useSWR from 'swr'
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

interface Project {
  id: number
  name: string
  process_id: number
  version_name: string
  created_at: string
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

  const { data: projects = [], mutate: mutateProjects, isLoading: loadingProjects } = useSWR(
    user ? `${process.env.NEXT_PUBLIC_API_URL}/projects/${user.id}` : null,
    fetcher
  )

  const { data: processes = [] } = useSWR(
    user ? `${process.env.NEXT_PUBLIC_API_URL}/processes/${user.id}` : null,
    fetcher
  )

  const { data: users = [] } = useSWR(
    user ? [`${process.env.NEXT_PUBLIC_API_URL}/users`, user.id] : null,
    fetcherWithHeader
  )

  const loading = loadingProjects



  const handleDeleteProject = async (e: React.MouseEvent, projectId: number) => {
    e.stopPropagation() // Prevent navigation
    if (!confirm("Are you sure you want to delete this project?")) return

    try {
      mutateProjects(projects.filter((p: Project) => p.id !== projectId), false)
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}`)
      mutateProjects()
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Projects</h1>
        <p className="text-muted-foreground">Manage your projects and link them to FuSa processes.</p>
      </div>

      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">All Projects</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-green-600 hover:bg-green-700 text-white">
              <Plus className="w-4 h-4 mr-2" /> Create New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
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
                    {processes.map((process) => (
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

      <Card>
        <CardContent className="p-6">
          {loading ? (
            <div>Loading projects...</div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
              No projects created yet. Click "Create New Project" to get started.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => (
                <div 
                  key={project.id} 
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-white cursor-pointer group"
                  onClick={() => router.push(`/dashboard/process/create?projectId=${project.id}`)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Folder className="h-5 w-5 text-blue-500" />
                      <h3 className="font-medium group-hover:text-blue-600 transition-colors">{project.name}</h3>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-gray-400 hover:text-red-500"
                      onClick={(e) => handleDeleteProject(e, project.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="text-sm text-gray-500 mb-4">
                    Based on: <span className="font-medium text-gray-700">{processes.find(p => p.id === project.process_id)?.name} ({project.version_name})</span>
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center text-xs text-gray-400 gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(project.created_at).toLocaleDateString()}
                    </div>
                    <div className="flex -space-x-2">
                      {users.slice(0, 3).map((u, i) => (
                        <Avatar key={i} className="h-6 w-6 border-2 border-white">
                          <AvatarImage src={u.image_url} />
                          <AvatarFallback>{u.first_name?.[0]}{u.last_name?.[0]}</AvatarFallback>
                        </Avatar>
                      ))}
                      {users.length > 3 && (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-gray-100 text-[10px] font-medium text-gray-500">
                          +{users.length - 3}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
