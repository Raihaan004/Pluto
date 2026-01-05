"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Workflow, FolderKanban, HelpCircle, Shield, ChevronLeft, ChevronRight, ClipboardList, LogOut, Clock } from "lucide-react"
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
      "flex h-screen flex-col justify-between border-r bg-white dark:bg-gray-900 transition-all duration-300 shadow-sm z-20 relative",
      isCollapsed ? "w-20" : "w-72"
    )}>
      <div className="flex flex-col gap-6 p-4">
        <div className={cn("flex items-center h-12", isCollapsed ? "justify-center" : "justify-between px-2")}>
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-linear-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-md">
                P
              </div>
              <span className="font-bold text-xl tracking-tight text-gray-900 dark:text-white">Pluto</span>
            </div>
          )}
          {isCollapsed && (
             <div className="w-8 h-8 bg-linear-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-md">
                P
             </div>
          )}
          
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={cn(
              "absolute -right-3 top-9 bg-white border shadow-sm rounded-full p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors z-50",
              isCollapsed && "-right-3"
            )}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        <nav className="flex flex-col gap-1.5">
          {sidebarItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`) && item.href !== "/dashboard";
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all relative overflow-hidden",
                  isActive
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 shadow-sm"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100",
                  isCollapsed && "justify-center px-2"
                )}
                title={isCollapsed ? item.title : undefined}
              >
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 rounded-r-full" />
                )}
                <div className={cn("relative z-10 transition-transform duration-200", isActive && "scale-110")}>
                  <item.icon className={cn("h-5 w-5", isActive ? "text-blue-600" : "text-gray-500 group-hover:text-gray-700")} />
                </div>
                {!isCollapsed && (
                  <div className="flex flex-1 items-center justify-between z-10">
                    <span>{item.title}</span>
                  </div>
                )}
              </Link>
            )
          })}
          
          {role === 'admin' && (
            <Link
              href="/dashboard/admin"
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all relative overflow-hidden mt-4",
                pathname === "/dashboard/admin"
                  ? "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300 shadow-sm"
                  : "text-gray-600 hover:bg-purple-50 hover:text-purple-900 dark:text-gray-400 dark:hover:bg-gray-800",
                isCollapsed && "justify-center px-2"
              )}
              title={isCollapsed ? "Admin" : undefined}
            >
              <Shield className="h-5 w-5" />
              {!isCollapsed && "Admin Console"}
            </Link>
          )}
        </nav>
      </div>

      <div className={cn("p-4 border-t bg-gray-50/50 dark:bg-gray-900/50", isCollapsed && "p-2")}>
        <div className={cn(
          "flex items-center gap-3 p-2 rounded-xl hover:bg-white hover:shadow-sm transition-all cursor-pointer border border-transparent hover:border-gray-200", 
          isCollapsed && "justify-center p-0 hover:bg-transparent hover:shadow-none hover:border-transparent"
        )}>
            <div className={cn("transition-transform hover:scale-105", isCollapsed && "mx-auto")}>
              <UserButton 
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: "h-9 w-9 ring-2 ring-white shadow-sm"
                  }
                }}
              />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0 overflow-hidden">
                <span className="text-sm font-semibold text-gray-900 truncate">
                  {user?.fullName || "User"}
                </span>
                <span className="text-xs text-gray-500 truncate">
                  {user?.primaryEmailAddress?.emailAddress}
                </span>
              </div>
            )}
        </div>
      </div>
    </div>
  )
}
