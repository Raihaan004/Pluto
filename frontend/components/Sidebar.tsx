"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Workflow, FolderKanban, HelpCircle, Shield, ChevronLeft, ChevronRight, ClipboardList } from "lucide-react"
import { UserButton, useUser } from "@clerk/nextjs"
import { cn } from "@/lib/utils"
import { useUserRole } from "@/context/UserRoleContext"
import { useState } from "react"

const sidebarItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Process",
    href: "/dashboard/process",
    icon: Workflow,
  },
  {
    title: "Projects",
    href: "/dashboard/projects",
    icon: FolderKanban,
  },
  {
    title: "Tasks",
    href: "/dashboard/tasks",
    icon: ClipboardList,
  },
  {
    title: "Help",
    href: "/dashboard/help",
    icon: HelpCircle,
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { role } = useUserRole()
  const { user } = useUser()
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <div className={cn(
      "flex h-screen flex-col justify-between border-r bg-gray-100/40 p-4 dark:bg-gray-800/40 transition-all duration-300",
      isCollapsed ? "w-20" : "w-64"
    )}>
      <div className="flex flex-col gap-4">
        <div className={cn("flex h-14 items-center border-b px-2 font-bold text-xl", isCollapsed ? "justify-center" : "justify-between")}>
          {!isCollapsed && <span>Pluto</span>}
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 hover:bg-gray-200 rounded-md text-gray-500"
          >
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>
        <nav className="flex flex-col gap-2">
          {sidebarItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-gray-100 dark:hover:bg-gray-800 relative",
                pathname === item.href
                  ? "bg-gray-200 text-gray-900 dark:bg-gray-800 dark:text-gray-50"
                  : "text-gray-500 dark:text-gray-400",
                isCollapsed && "justify-center px-2"
              )}
              title={isCollapsed ? item.title : undefined}
            >
              <div className="relative">
                <item.icon className="h-4 w-4" />
              </div>
              {!isCollapsed && (
                <div className="flex flex-1 items-center justify-between">
                  <span>{item.title}</span>
                </div>
              )}
            </Link>
          ))}
          
          {role === 'admin' && (

            <Link
              href="/dashboard/admin"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-gray-100 dark:hover:bg-gray-800",
                pathname === "/dashboard/admin"
                  ? "bg-gray-200 text-gray-900 dark:bg-gray-800 dark:text-gray-50"
                  : "text-gray-500 dark:text-gray-400",
                isCollapsed && "justify-center px-2"
              )}
              title={isCollapsed ? "Admin" : undefined}
            >
              <Shield className="h-4 w-4" />
              {!isCollapsed && "Admin"}
            </Link>
          )}
        </nav>
      </div>
      <div className={cn("border-t p-4", isCollapsed && "p-2 flex justify-center")}>
        <div className={cn("flex items-center gap-3", isCollapsed && "justify-center")}>
            <UserButton showName={!isCollapsed} />
        </div>
      </div>
    </div>
  )
}
