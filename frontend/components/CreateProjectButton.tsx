"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
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
import { Plus } from "lucide-react"
import { useUser } from "@clerk/nextjs"
import axios from "axios"
import { useRouter } from "next/navigation"
import useSWR from 'swr'
import { useUserRole } from "@/context/UserRoleContext"

interface Process {
  id: number
  name: string
  versions: { name: string; created_at: string; comments?: string }[]
}

const fetcher = (url: string) => axios.get(url).then(res => res.data)

export function CreateProjectButton() {
  const { user } = useUser()
  const { role, loading: isRoleLoading } = useUserRole()
  const router = useRouter()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [projectName, setProjectName] = useState("")
  const [selectedProcessId, setSelectedProcessId] = useState("")
  const [selectedVersion, setSelectedVersion] = useState("")
  const [jiraProjectKey, setJiraProjectKey] = useState("PLUTO")
  const [isCreating, setIsCreating] = useState(false)

  // All hooks must be called before any conditional returns
  const { data: processes = [] } = useSWR<Process[]>(
    user ? `${process.env.NEXT_PUBLIC_API_URL}/processes/${user.id}` : null,
    fetcher
  )

  // Don't show button for viewers
  if (isRoleLoading || role === 'viewer') {
    return null
  }

  const selectedProcess = processes.find(p => p.id.toString() === selectedProcessId)

  const handleCreateProject = async () => {
    if (!user || !projectName || !selectedProcessId || !selectedVersion) return

    setIsCreating(true)
    try {
      const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/projects`, {
        user_id: user.id,
        name: projectName,
        process_id: parseInt(selectedProcessId),
        version_name: selectedVersion,
        jira_project_key: jiraProjectKey
      })
      
      // Reset form
      setProjectName("")
      setSelectedProcessId("")
      setSelectedVersion("")
      setJiraProjectKey("PLUTO")
      setIsDialogOpen(false)
      
      // Navigate to the project editor
      if (response.data?.data?.[0]?.id) {
        router.push(`/dashboard/projects/editor?projectId=${response.data.data[0].id}`)
      } else {
        // Fallback: navigate to projects page
        router.push('/dashboard/projects')
        router.refresh()
      }
    } catch (error) {
      console.error("Failed to create project:", error)
      alert("Failed to create project")
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button className="bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg rounded-xl px-6 h-12 text-base font-medium transition-all hover:scale-105">
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
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
                {processes.length > 0 ? (
                  processes
                    .filter(p => (p as any).status === 'published')
                    .map((process) => (
                      <SelectItem key={process.id} value={process.id.toString()}>
                        {process.name}
                      </SelectItem>
                    ))
                ) : (
                  <SelectItem value="none" disabled>No processes available</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          {selectedProcess && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="version" className="text-right">
                Version
              </Label>
              <Select onValueChange={setSelectedVersion} value={selectedVersion}>
                <SelectTrigger className="col-span-3 h-auto py-2">
                  <SelectValue placeholder="Select a version" />
                </SelectTrigger>
                <SelectContent>
                  {selectedProcess.versions?.length > 0 ? (
                    selectedProcess.versions.map((v, i) => (
                      <SelectItem key={i} value={v.name} className="py-3">
                        <div className="flex flex-col gap-0.5 text-left w-full">
                          <div className="flex items-center justify-between gap-4">
                            <span className="font-medium">{v.name}</span>
                            <span className="text-[10px] text-gray-400 font-normal">
                              {new Date(v.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          {v.comments && (
                            <span className="text-xs text-gray-500 italic line-clamp-2 pr-4 leading-normal">
                              "{v.comments}"
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>No versions available</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="jiraKey" className="text-right flex flex-col items-end">
              <span>JIRA Project</span>
              <span className="text-[10px] text-muted-foreground font-normal">(Required)</span>
            </Label>
            <Input
              id="jiraKey"
              value={jiraProjectKey}
              onChange={(e) => setJiraProjectKey(e.target.value.toUpperCase())}
              placeholder="e.g. PLUTO"
              className="col-span-3 font-mono"
              required
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleCreateProject} 
            className="bg-green-600 hover:bg-green-700 text-white"
            disabled={!projectName || !selectedProcessId || !selectedVersion || !jiraProjectKey || isCreating}
          >
            {isCreating ? "Creating..." : "Save Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

