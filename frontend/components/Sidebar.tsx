"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LayoutDashboard, Workflow, FolderKanban, HelpCircle, Shield, ChevronLeft, ChevronRight, LogOut, Clock, AlertTriangle } from "lucide-react"
import { UserButton, useUser, useOrganization } from "@clerk/nextjs"
import { cn } from "@/lib/utils"
import { useUserRole } from "@/context/UserRoleContext"
import { useNavigationState, useNavigationDispatch } from "@/context/NavigationContext"
import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

const sidebarItems = [
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
    title: "Admin Console",
    href: "/dashboard/admin",
    icon: Shield,
    adminOnly: true,
  },
  {
    title: "Help",
    href: "/dashboard/help",
    icon: HelpCircle,
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { role } = useUserRole()
  const { user } = useUser()
  const { organization } = useOrganization()
  const { hasUnsavedChanges, saveAction } = useNavigationState()
  const { setHasUnsavedChanges } = useNavigationDispatch()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    // If we're already on this page, don't do anything special
    if (pathname === href) return

    if (hasUnsavedChanges) {
      e.preventDefault()
      setPendingHref(href)
      setShowConfirmDialog(true)
    }
  }

  const handleConfirmNavigate = () => {
    setHasUnsavedChanges(false)
    setShowConfirmDialog(false)
    if (pendingHref) {
      router.push(pendingHref)
    }
  }

  const handleSaveAndNavigate = async () => {
    if (saveAction) {
      setIsSaving(true)
      const success = await saveAction()
      setIsSaving(false)
      if (success) {
        setHasUnsavedChanges(false)
        setShowConfirmDialog(false)
        if (pendingHref) {
          router.push(pendingHref)
        }
      }
    }
  }

  return (
    <>
      <div className={cn(
        "flex h-screen flex-col justify-between border-r bg-white dark:bg-gray-900 transition-all duration-300 shadow-sm z-20 relative",
        isCollapsed ? "w-20" : "w-72"
      )}>
      <div className="flex flex-col gap-6 p-4">
        <div className={cn("flex items-center h-12 mb-2", isCollapsed ? "justify-center" : "justify-between px-2")}>
          {!isCollapsed && (
            <div className="flex items-center gap-3 transition-all duration-300 hover:scale-105 group cursor-default">
              <div className="relative">
                <div className="absolute -inset-1 bg-linear-to-r from-blue-600 to-purple-600 rounded-xl blur-sm opacity-25 group-hover:opacity-50 transition-opacity duration-300" />
                <div className="relative w-10 h-10 bg-linear-to-br from-blue-600 via-blue-700 to-purple-700 rounded-xl flex items-center justify-center text-white font-extrabold text-xl shadow-lg border border-white/20">
                  <span className="drop-shadow-sm">P</span>
                </div>
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-black text-2xl tracking-tighter dark:text-white bg-clip-text text-transparent bg-linear-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
                  Pluto
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600/80 mt-0.5">
                  Design
                </span>
              </div>
            </div>
          )}
          {isCollapsed && (
             <div className="relative group transition-all duration-300 hover:scale-110 cursor-pointer">
                <div className="absolute -inset-1 bg-linear-to-r from-blue-600 to-purple-600 rounded-xl blur-sm opacity-25 group-hover:opacity-50 transition-opacity" />
                <div className="relative w-10 h-10 bg-linear-to-br from-blue-600 via-blue-700 to-purple-700 rounded-xl flex items-center justify-center text-white font-extrabold text-xl shadow-lg border border-white/20">
                  <span>P</span>
                </div>
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
            if (item.adminOnly && role !== 'admin') return null;
            
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={(e) => handleLinkClick(e, item.href)}
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
                {organization?.name && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 truncate mb-0.5">
                    {organization.name}
                  </span>
                )}
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

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-106.25">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Unsaved Changes
            </DialogTitle>
            <DialogDescription className="py-2">
              You have unsaved changes in your process. If you leave now, these changes will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowConfirmDialog(false)}
              disabled={isSaving}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              variant="secondary" 
              onClick={handleConfirmNavigate}
              disabled={isSaving}
              className="flex-1 text-red-600 hover:text-red-700"
            >
              Discard Changes
            </Button>
            <Button 
              onClick={handleSaveAndNavigate}
              disabled={isSaving || !saveAction}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSaving ? "Saving..." : "Save & Leave"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
