import { auth } from "@clerk/nextjs/server"
import { UserSync } from "@/components/UserSync"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Bell, FileText, Calendar, FileInput, CheckCircle, AlertTriangle, Info, ArrowRight, Activity, Clock } from "lucide-react"
import { BentoGrid, BentoCard } from "@/components/magicui/bento-grid";
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { formatDistanceToNow } from "date-fns"
import { DashboardNotifications } from "@/components/DashboardNotifications"
import { CreateProjectButton } from "@/components/CreateProjectButton"
import ProjectProgressGraph from "@/components/ProjectProgressGraph"


async function getDashboardData(userId: string) {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/dashboard-stats/${userId}`, {
      cache: 'no-store'
    });
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json();
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return {
      tasks_assigned: 0,
      upcoming_deadlines: 0,
      notifications: [],
      projects: []
    };
  }
}

export default async function DashboardPage() {
  const { userId } = await auth();
  const data = await getDashboardData(userId || "");

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
      Icon: Calendar,
      name: `${data.upcoming_deadlines} Upcoming Deadlines`,
      description: "Stay on top of your schedule",
      href: "/dashboard/deadlines",
      cta: "View Deadlines",
      background: <div className="absolute -right-20 -top-20 opacity-60 bg-pink-100 w-64 h-64 rounded-full blur-3xl" />,
      className: "lg:col-span-1 lg:row-span-1 transition-all hover:shadow-lg border-pink-100/50",
    },
  ];

  return (
    <div className="p-6 h-full flex flex-col gap-6 max-w-7xl mx-auto overflow-hidden">
      <UserSync />
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-0.5 text-base">Welcome back! Here's an overview of your projects.</p>
        </div>
        <CreateProjectButton />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Stats Grid */}
        <div className="lg:col-span-2 flex flex-col gap-6 min-h-0">
            <BentoGrid className="lg:grid-cols-2 auto-rows-[12rem] shrink-0">
            {stats.map((stat) => (
                <BentoCard key={stat.name} {...stat} />
            ))}
            </BentoGrid>

            {/* Activity Overview Graph */}
            <div className="flex-1 min-h-0">
              <ProjectProgressGraph projects={data.projects} userId={userId || ""} />
            </div>
        </div>

        {/* Notifications Panel */}
        <div className="lg:col-span-1 h-full min-h-0">
            <DashboardNotifications />
        </div>
      </div>
    </div>
  )
}
