import { auth } from "@clerk/nextjs/server"
import { UserSync } from "@/components/UserSync"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Bell, FileText, Calendar, FileInput, CheckCircle, AlertTriangle, Info, ArrowRight } from "lucide-react"
import { BentoGrid, BentoCard } from "@/components/magicui/bento-grid"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { formatDistanceToNow } from "date-fns"

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

const NotificationItem = ({ notification }: { notification: any }) => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'invitation': return <Bell className="w-5 h-5 text-purple-500" />;
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <div className="flex items-start gap-4 p-4 rounded-xl bg-gray-50/50 hover:bg-gray-50 transition-colors border border-gray-100">
      <div className="mt-1 bg-white p-2 rounded-full shadow-sm">
        {getIcon(notification.type)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {notification.title}
        </p>
        <p className="text-sm text-gray-500 mt-1 line-clamp-2">
          {notification.message}
        </p>
        <p className="text-xs text-gray-400 mt-2">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
};

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
      className: "lg:col-span-1 lg:row-span-1",
    },
    {
      Icon: FileInput,
      name: `${data.projects_pending} Pending Projects`,
      description: "Projects in progress",
      href: "/dashboard/projects",
      cta: "View Projects",
      background: <div className="absolute -right-20 -top-20 opacity-60 bg-purple-100 w-64 h-64 rounded-full blur-3xl" />,
      className: "lg:col-span-1 lg:row-span-1",
    },
    {
      Icon: Calendar,
      name: "Upcoming Deadlines",
      description: "Stay on top of your schedule",
      href: "/dashboard/calendar",
      cta: "View Calendar",
      background: <div className="absolute -right-20 -top-20 opacity-60 bg-pink-100 w-64 h-64 rounded-full blur-3xl" />,
      className: "lg:col-span-1 lg:row-span-1",
    },
  ];

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <UserSync />
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-2">Welcome back! Here's an overview of your projects.</p>
        </div>
        <Button asChild className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg">
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
            <Card className="border-none shadow-md bg-white/50 backdrop-blur-sm overflow-hidden">
                <CardHeader>
                    <CardTitle>Activity Overview</CardTitle>
                    <CardDescription>Your recent activity and project progress.</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px] flex items-center justify-center bg-gray-50/50 m-6 rounded-xl border border-dashed border-gray-200">
                    <div className="text-center text-gray-400">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FileText className="w-8 h-8" />
                        </div>
                        <p>Activity chart coming soon</p>
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* Notifications Panel */}
        <div className="lg:col-span-1">
            <Card className="h-full border-none shadow-md bg-white/80 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                        <Bell className="w-5 h-5 text-blue-600" />
                        Notifications
                    </CardTitle>
                    <Button variant="ghost" size="sm" asChild className="text-xs text-blue-600 hover:text-blue-700">
                        <Link href="/dashboard/notifications">View All</Link>
                    </Button>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="flex flex-col divide-y divide-gray-100">
                        {data.notifications && data.notifications.length > 0 ? (
                            data.notifications.map((notification: any) => (
                                <NotificationItem key={notification.id} notification={notification} />
                            ))
                        ) : (
                            <div className="p-8 text-center text-gray-500">
                                <p>No new notifications</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  )
}
