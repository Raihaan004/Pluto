"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useUser } from "@clerk/nextjs"
import axios from "axios"
import useSWR from 'swr'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface Task {
  project_id: number
  project_name: string
  work_product: string
  version: string
  author_id: string
  status: string
  verification_reviewers: string[]
  verification_comments: string
  author_comments: string
  assigned_role: string
  created_at: string
  node_id: string
  sheet_index: number
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

export default function TasksPage() {
  const { user } = useUser()
  const [clearingTaskId, setClearingTaskId] = useState<string | null>(null)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [taskToClear, setTaskToClear] = useState<Task | null>(null)
  const [successDialogOpen, setSuccessDialogOpen] = useState(false)
  const [errorDialogOpen, setErrorDialogOpen] = useState(false)
  const [dialogMessage, setDialogMessage] = useState("")

  const { data: tasks = [], isLoading: loadingTasks, mutate } = useSWR<Task[]>(
    user ? `${process.env.NEXT_PUBLIC_API_URL}/tasks/${user.id}` : null,
    fetcher
  )

  const { data: users = [] } = useSWR<User[]>(
    user ? [`${process.env.NEXT_PUBLIC_API_URL}/users`, user.id] : null,
    fetcherWithHeader
  )

  const getUserName = (userId: string) => {
    const foundUser = users.find(u => u.clerk_id === userId)
    return foundUser ? `${foundUser.first_name} ${foundUser.last_name}` : "Unknown User"
  }

  const getReviewersNames = (reviewerIds: string[]) => {
    if (!reviewerIds || reviewerIds.length === 0) return "Not Assigned";
    return reviewerIds.map(id => getUserName(id)).join(", ");
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch {
      return "N/A";
    }
  }

  const handleClearTaskClick = (task: Task) => {
    setTaskToClear(task);
    setConfirmDialogOpen(true);
  }

  const handleConfirmClear = async () => {
    if (!user || !taskToClear) return;

    const taskKey = `${taskToClear.project_id}-${taskToClear.node_id}`;
    setClearingTaskId(taskKey);
    setConfirmDialogOpen(false);
    
    try {
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/tasks/${user.id}`, {
        params: {
          project_id: taskToClear.project_id,
          node_id: taskToClear.node_id,
          sheet_index: taskToClear.sheet_index
        }
      });
      
      // Refresh the tasks list
      mutate();
      setDialogMessage("Task cleared successfully!");
      setSuccessDialogOpen(true);
    } catch (error) {
      console.error("Failed to clear task:", error);
      setDialogMessage("Failed to clear task. Please try again.");
      setErrorDialogOpen(true);
    } finally {
      setClearingTaskId(null);
      setTaskToClear(null);
    }
  }

  if (loadingTasks) {
    return <div className="p-8">Loading tasks...</div>
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Tasks</h2>
        <p className="text-muted-foreground">
          Manage your assigned tasks and project responsibilities.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assigned Tasks</CardTitle>
          <CardDescription>
            A list of projects where you have an assigned role.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative w-full overflow-auto">
            <table className="w-full caption-bottom text-sm">
              <thead className="[&_tr]:border-b">
                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Project Name</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Work Product</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Version</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Author</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Date</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Verification Reviewer</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Review Comments</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Auditor Comments</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {tasks.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-4 text-center text-muted-foreground">
                      No tasks found.
                    </td>
                  </tr>
                ) : (
                  tasks.map((task, index) => {
                    const taskKey = `${task.project_id}-${task.node_id}`;
                    const isClearing = clearingTaskId === taskKey;
                    
                    return (
                      <tr key={index} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                        <td className="p-4 align-middle font-medium">{task.project_name}</td>
                        <td className="p-4 align-middle">{task.work_product}</td>
                        <td className="p-4 align-middle">
                          <Badge variant="outline">{task.version}</Badge>
                        </td>
                        <td className="p-4 align-middle">{getUserName(task.author_id)}</td>
                        <td className="p-4 align-middle">
                          <Badge variant={
                            task.status === 'Published' ? 'default' : 
                            task.status === 'Review' ? 'secondary' : 'outline'
                          }>
                            {task.status}
                          </Badge>
                        </td>
                        <td className="p-4 align-middle">{formatDate(task.created_at)}</td>
                        <td className="p-4 align-middle">{getReviewersNames(task.verification_reviewers)}</td>
                        <td className="p-4 align-middle text-muted-foreground italic">
                          {task.verification_comments || "No comments"}
                        </td>
                        <td className="p-4 align-middle text-muted-foreground italic">
                          {task.author_comments || "No comments"}
                        </td>
                        <td className="p-4 align-middle">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleClearTaskClick(task)}
                            disabled={isClearing}
                          >
                            {isClearing ? "Clearing..." : "Clear the task"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear Task</DialogTitle>
            <DialogDescription>
              Are you sure you want to clear this task? This will remove your assignment.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmClear} disabled={clearingTaskId !== null}>
              {clearingTaskId ? "Clearing..." : "Clear Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Success</DialogTitle>
            <DialogDescription>
              {dialogMessage}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setSuccessDialogOpen(false)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error Dialog */}
      <Dialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Error</DialogTitle>
            <DialogDescription>
              {dialogMessage}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setErrorDialogOpen(false)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
