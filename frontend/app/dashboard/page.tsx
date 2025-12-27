import { auth } from "@clerk/nextjs/server"
import { UserSync } from "@/components/UserSync"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Bell, FileText, Calendar, FileInput, CheckCircle, AlertTriangle, Info, ArrowRight, Activity, Clock } from "lucide-react"
import { BentoGrid, BentoCard } from "@/components/magicui/bento-grid"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { formatDistanceToNow } from "date-fns"
import { DashboardNotifications } from "@/components/DashboardNotifications"

// Mock data fetcher since we might not have the backend running perfectly yet
async function getDashboardData(userId: string) {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/dashboard-stats/${userId}`, {
      cache: 'no-store'
    })
    if (!res.ok) throw new Error('Failed to fetch')
    return res.json()
  } catch (error) {
    console.error("Error fetching dashboard data:", error)
    return {
      tasks_assigned: 0,
      projects_pending: 0,
      notifications: []
    }
  }
}

export default async function DashboardPage() {
  const { userId } = await auth()
  const data = await getDashboardData(userId || "")

  const stats = [
    {
      Icon: FileText,
      name: `${data.tasks_assigned} Tasks Assigned`,
      description: "Tasks requiring your attention",
      href: "/dashboard/tasks",
      cta: "View Tasks",
      background: <div className="absolute -right-20 -top-20 opacity-60 bg-blue-100 w-64 h-64 rounded-full blur-3xl" />,
      className: "lg:col-span-1 lg:row-span-1 transition-all hover:shadow-lg border-blue-100/50",
    },
    {
      Icon: FileInput,
      name: `${data.projects_pending} Pending Projects`,
      description: "Projects in progress",
      href: "/dashboard/projects",
      cta: "View Projects",
      background: <div className="absolute -right-20 -top-20 opacity-60 bg-purple-100 w-64 h-64 rounded-full blur-3xl" />,
      className: "lg:col-span-1 lg:row-span-1 transition-all hover:shadow-lg border-purple-100/50",
    },
    {
      Icon: Calendar,
      name: "Upcoming Deadlines",
      description: "Stay on top of your schedule",
      href: "/dashboard/calendar",
      cta: "View Calendar",
      background: <div className="absolute -right-20 -top-20 opacity-60 bg-pink-100 w-64 h-64 rounded-full blur-3xl" />,
      className: "lg:col-span-1 lg:row-span-1 transition-all hover:shadow-lg border-pink-100/50",
    },
  ];

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <UserSync />
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1 text-lg">Welcome back! Here's an overview of your projects.</p>
        </div>
        <Button asChild className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg rounded-xl px-6 h-12 text-base font-medium transition-all hover:scale-105">
            <Link href="/dashboard/process/create">
                + New Project
            </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Stats Grid */}
        <div className="lg:col-span-2 space-y-8">
            <BentoGrid className="grid-rows-[auto]">
            {stats.map((stat) => (
                <BentoCard key={stat.name} {...stat} />
            ))}
            </BentoGrid>

            {/* Activity Feed / Chart Placeholder */}
            <Card className="border-none shadow-lg bg-white overflow-hidden rounded-2xl">
                <CardHeader className="border-b bg-gray-50/50 pb-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <Activity className="w-5 h-5 text-blue-600" />
                                Activity Overview
                            </CardTitle>
                            <CardDescription className="mt-1">Your recent activity and project progress.</CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                            <span className="text-xs text-gray-500 font-medium">Live</span>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="h-[350px] flex items-center justify-center bg-white p-6 relative">
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
                    <div className="text-center text-gray-400 relative z-10 bg-white/80 p-8 rounded-2xl backdrop-blur-sm border border-gray-100 shadow-sm">
                        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4 rotate-3 hover:rotate-6 transition-transform">
                            <FileText className="w-8 h-8 text-blue-500" />
                        </div>
                        <h3 className="font-semibold text-gray-900 mb-1">No Activity Yet</h3>
                        <p className="text-sm max-w-[200px] mx-auto">Start working on your projects to see your activity chart here.</p>
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* Notifications Panel */}
        <div className="lg:col-span-1 h-full">
            <DashboardNotifications />
        </div>
      </div>
    </div>
  )
}
