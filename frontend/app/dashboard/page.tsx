"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useUser } from "@clerk/nextjs"
import { useUserRole } from "@/context/UserRoleContext"
import { Folder, Workflow, ShieldCheck, ArrowRight, Activity } from "lucide-react"
import Link from "next/link"
import useSWR from 'swr'
import axios from "axios"
import { Particles } from "@/components/magicui/particles"

const fetcher = (url: string) => axios.get(url).then(res => res.data)

export default function DashboardHomePage() {
  const { user } = useUser()
  const { organization } = useUserRole()
  
  const { data: projects = [] } = useSWR(
    user ? `${process.env.NEXT_PUBLIC_API_URL}/projects/${user.id}` : null,
    fetcher
  )

  const { data: processes = [] } = useSWR(
    user ? `${process.env.NEXT_PUBLIC_API_URL}/processes/${user.id}` : null,
    fetcher
  )

  const stats = [
    { label: "Active Projects", value: projects.length, icon: Folder, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Process Packages", value: processes.length, icon: Workflow, color: "text-purple-600", bg: "bg-purple-50" },
  ]

  return (
    <div className="relative min-h-screen">
      <Particles
        className="absolute inset-0 -z-10 pointer-events-none"
        quantity={200}
        ease={80}
        color="#3b82f6"
        refresh
      />
      
      <div className="p-8 space-y-6 max-w-7xl mx-auto relative z-10">
        {/* Header section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white flex items-center gap-3">
              Welcome back, {user?.firstName || 'User'}! 
              <span className="text-xl font-normal text-zinc-400">/</span>
              <span className="text-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" />
                {organization || "Standard Instance"}
              </span>
            </h1>
            <p className="text-zinc-500 mt-1">Here's what's happening with your FuSa processes today.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/dashboard/projects">
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-lg shadow-blue-500/20">
                Go to Projects <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {stats.map((stat) => (
            <Card key={stat.label} className="border-zinc-200 dark:border-zinc-800 hover:shadow-md transition-shadow bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-zinc-500">{stat.label}</p>
                    <p className="text-3xl font-bold mt-1 text-zinc-900 dark:text-white">{stat.value}</p>
                  </div>
                  <div className={`${stat.bg} p-3 rounded-2xl`}>
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity Mock (Can be expanded later) */}
          <Card className="border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-zinc-400" /> Recent Activity
              </CardTitle>
              <CardDescription>Your latest process updates across all projects</CardDescription>
            </CardHeader>
            <CardContent>
              {projects.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-zinc-500 text-sm">No recent activity found. Start by creating a project!</p>
                </div>
              ) : (
                <div className="space-y-4">
                   {projects.slice(0, 5).map((p: any) => (
                     <Link key={p.id} href={`/dashboard/projects/editor?projectId=${p.id}`} className="block">
                       <div className="flex items-start gap-4 p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all active:scale-[0.98] group">
                         <div className="mt-1.5 h-2 w-2 rounded-full bg-blue-600 shrink-0" />
                         <div>
                           <p className="text-sm font-medium text-zinc-900 dark:text-white group-hover:text-blue-600 transition-colors">
                             Project updated: <span>{p.name}</span>
                           </p>
                           <p className="text-xs text-zinc-500 mt-0.5">Updated {new Date(p.updated_at).toLocaleDateString()}</p>
                         </div>
                       </div>
                     </Link>
                   ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Links */}
          <div className="grid grid-cols-1 gap-4">
             {[
               { title: "Manage Processes", href: "/dashboard/process", desc: "Define and version your FuSa workflows" },
               { title: "View Team", href: "/dashboard/admin", desc: "Manage access and roles for your organization" },
               { title: "Get Help", href: "/dashboard/help", desc: "Documentation and support resources" },
             ].map((link) => (
               <Link key={link.title} href={link.href}>
                 <div className="p-4 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm border border-zinc-200 dark:border-zinc-800 rounded-xl hover:border-blue-300 dark:hover:border-blue-900 transition group h-full">
                   <h4 className="font-bold text-sm group-hover:text-blue-600 transition-colors">{link.title}</h4>
                   <p className="text-xs text-zinc-500 mt-1">{link.desc}</p>
                 </div>
               </Link>
             ))}
          </div>
        </div>
      </div>
    </div>
  )
}

