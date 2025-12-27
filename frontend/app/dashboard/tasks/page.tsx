"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useUser } from "@clerk/nextjs"
import axios from "axios"
import useSWR from 'swr'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

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

  const { data: tasks = [], isLoading: loadingTasks } = useSWR<Task[]>(
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
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Verification Reviewer</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Review Comments</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Auditor Comments</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {tasks.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-muted-foreground">
                      No tasks found.
                    </td>
                  </tr>
                ) : (
                  tasks.map((task, index) => (
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
                      <td className="p-4 align-middle">{getReviewersNames(task.verification_reviewers)}</td>
                      <td className="p-4 align-middle text-muted-foreground italic">
                        {task.verification_comments || "No comments"}
                      </td>
                      <td className="p-4 align-middle text-muted-foreground italic">
                        {task.author_comments || "No comments"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
